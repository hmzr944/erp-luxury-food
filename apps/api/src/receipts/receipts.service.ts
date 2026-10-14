import { join } from 'path'
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { OnEvent } from '@nestjs/event-emitter'
import PDFDocument from 'pdfkit'
import { FISCAL_SOFTWARE } from '@erp/types'
import { buildSaleTicket, layoutTicket, priceOrder, type TicketModel } from '@erp/utils'
import { PrismaService } from '../common/prisma/prisma.service'
import { MailService, esc } from '../common/mail/mail.service'

const FONTS = join(__dirname, '..', '..', 'assets', 'fonts')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const RECEIPT_SELECT = {
  id: true,
  kind: true,
  clientId: true,
  total: true,
  discount: true,
  soldAt: true,
  createdAt: true,
  customerEmail: true,
  receiptSentAt: true,
  invoiceNumber: true,
  invoicedAt: true,
  invoiceSentAt: true,
  b2bClient: { select: { name: true } },
  items: { select: { name: true, variantName: true, serialNumber: true, price: true, taxRate: true, quantity: true, discount: true } },
  payments: { select: { label: true, amount: true, reference: true, kind: true } },
  receiptChain: { select: { counter: true, hash: true, terminalCounter: true, terminalHash: true, signedAt: true, terminal: { select: { name: true } } } },
  site: {
    select: {
      id: true,
      name: true,
      address: true,
      timezone: true,
      organization: {
        select: {
          name: true,
          priceIncludesTax: true,
          settings: { select: { siret: true, vatNumber: true, legalForm: true, rcs: true, legalAddress: true, legalZipCode: true, legalCity: true, receiptFooter: true, serviceNote: true, receiptPolicy: true } },
        },
      },
    },
  },
} as const

type ReceiptOrder = NonNullable<Awaited<ReturnType<ReceiptsService['find']>>>

// Ticket dématérialisé : le reçu d'une vente se consulte et se télécharge en
// PDF depuis le QR code imprimé ou affiché, ou part par e-mail. Le lien
// porte l'identifiant aléatoire de la vente (UUID tiré par la caisse) : il
// ne se devine pas et existe dès l'encaissement, même hors ligne.
@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name)

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private config: ConfigService,
  ) {}

  url(token: string) {
    return `${this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000'}/r/${token}`
  }

  find(token: string) {
    if (!UUID.test(token)) throw new NotFoundException('Ticket introuvable')
    return this.prisma.order.findUnique({ where: { clientId: token }, select: RECEIPT_SELECT })
  }

  private async load(token: string): Promise<ReceiptOrder> {
    const order = await this.find(token)
    if (!order || !order.receiptChain) throw new NotFoundException('Ticket introuvable')
    return order
  }

  ticket(order: ReceiptOrder): TicketModel {
    const org = order.site.organization
    const s = org.settings
    const refund = order.kind === 'REFUND'
    const sign = refund ? -1 : 1
    // Remboursement : prix négatifs ; on calcule sur les valeurs absolues
    const priced = priceOrder(
      order.items.map((i) => ({ unitPrice: Math.abs(Number(i.price)), quantity: i.quantity, discount: Number(i.discount), taxRate: Number(i.taxRate) })),
      { priceIncludesTax: org.priceIncludesTax, orderDiscount: Number(order.discount) || undefined },
    )
    const chain = order.receiptChain!
    return buildSaleTicket({
      software: `${FISCAL_SOFTWARE.name} ${FISCAL_SOFTWARE.version}`,
      receipt: {
        legalName: org.name,
        siret: s?.siret ?? null,
        vatNumber: s?.vatNumber ?? null,
        legalForm: s?.legalForm ?? null,
        rcs: s?.rcs ?? null,
        address: [s?.legalAddress, [s?.legalZipCode, s?.legalCity].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null,
        policy: (s?.receiptPolicy ?? 'ASK') as 'ASK',
        serviceNote: s?.serviceNote ?? false,
        footer: s?.receiptFooter ?? null,
      },
      siteName: order.site.name,
      siteAddress: order.site.address,
      terminalName: chain.terminal?.name ?? 'Caisse',
      // Numéro imprimé par la caisse (compteur du terminal), sinon celui du site
      number: String(chain.terminalCounter ?? chain.counter),
      signedAt: chain.signedAt,
      timeZone: order.site.timezone,
      lines: order.items.map((i, n) => ({
        quantity: i.quantity,
        name: i.name,
        detail: [i.variantName, i.serialNumber ? `N° de série ${i.serialNumber}` : null].filter(Boolean).join(', ') || undefined,
        unit: Math.round(((priced.lines[n]?.ttc ?? 0) / i.quantity) * 100) / 100 * sign,
        total: (priced.lines[n]?.ttc ?? 0) * sign,
        taxRate: Number(i.taxRate),
      })),
      discount: priced.discount ? priced.discount * sign : undefined,
      total: Number(order.total),
      taxBreakdown: priced.taxBreakdown.map((t) => ({ rate: t.rate, ht: t.ht * sign, tax: t.tax * sign })),
      payments: order.payments.map((p) => ({ label: p.label, amount: Number(p.amount), ...(p.reference && p.kind === 'CARD' ? { reference: p.reference } : {}) })),
      signature: (chain.terminalHash ?? chain.hash).slice(0, 16),
      refund,
      receiptUrl: order.clientId ? this.url(order.clientId) : undefined,
    })
  }

  // Page publique /r/:token
  async view(token: string) {
    const order = await this.find(token)
    // Vente encaissée hors ligne, pas encore reçue par le serveur
    if (!order) return { status: 'pending' as const }
    if (!order.receiptChain) throw new NotFoundException('Ticket introuvable')
    return {
      status: 'ready' as const,
      kind: order.kind,
      shop: { name: order.site.name, legalName: order.site.organization.name },
      ticket: this.ticket(order),
      invoice: order.invoiceNumber ? { number: order.invoiceNumber, company: order.b2bClient?.name ?? null, emailed: !!order.invoiceSentAt } : null,
    }
  }

  async pdf(token: string) {
    const order = await this.load(token)
    return { filename: `ticket-${order.receiptChain!.terminalCounter ?? order.receiptChain!.counter}.pdf`, body: await renderTicketPdf(this.ticket(order)) }
  }

  // Envoi du reçu (lien + PDF). Mémorise l'adresse et l'heure d'envoi.
  async email(token: string, to: string, siteId?: string) {
    const address = to.trim().toLowerCase()
    if (!EMAIL.test(address)) throw new BadRequestException('Adresse e-mail invalide')
    const order = await this.load(token)
    if (siteId && order.site.id !== siteId) throw new NotFoundException('Ticket introuvable')
    const ticket = this.ticket(order)
    const shop = order.site.name
    const total = ticket.total.toFixed(2).replace('.', ',')
    const link = this.url(token)
    const result = await this.mail.send({
      to: address,
      subject: `Votre ticket ${shop}`,
      text: `Bonjour,\n\nVoici votre ticket de caisse n° ${order.receiptChain!.terminalCounter ?? order.receiptChain!.counter} chez ${shop} (${total} €), en pièce jointe et en ligne : ${link}\n\nÀ bientôt.`,
      html: `<p>Bonjour,</p><p>Voici votre ticket de caisse n° ${order.receiptChain!.terminalCounter ?? order.receiptChain!.counter} chez <strong>${esc(shop)}</strong> (${total}&nbsp;€), en pièce jointe.</p><p><a href="${link}">Voir le ticket en ligne</a> (facture pour une entreprise sur demande en boutique).</p><p>À bientôt.</p>`,
      attachments: [{ filename: `ticket-${order.receiptChain!.terminalCounter ?? order.receiptChain!.counter}.pdf`, content: await renderTicketPdf(ticket) }],
    })
    await this.prisma.order.update({
      where: { id: order.id },
      data: { customerEmail: address, ...(result.sent ? { receiptSentAt: new Date() } : {}) },
    })
    return result
  }

  // E-mail saisi à l'encaissement : le reçu part dès que la vente arrive
  @OnEvent('order.created', { async: true })
  async onOrderCreated(event: { order: { clientId?: string | null; customerEmail?: string | null; receiptSentAt?: Date | null } }) {
    const { clientId, customerEmail, receiptSentAt } = event.order
    if (!clientId || !customerEmail || receiptSentAt) return
    try {
      await this.email(clientId, customerEmail)
    } catch (e) {
      this.logger.warn(`Reçu non envoyé à ${customerEmail} : ${(e as Error).message}`)
    }
  }
}

// PDF au format ticket (80 mm), même mise en page que l'imprimante
export function renderTicketPdf(t: TicketModel): Promise<Buffer> {
  const cols = 42
  const rows = layoutTicket(t, cols)
  const width = 80 * 2.835
  const margin = 12
  return new Promise((resolve, reject) => {
    const probe = new PDFDocument({ autoFirstPage: false })
    probe.registerFont('mono', join(FONTS, 'GeistMono-Regular.ttf'))
    // Taille telle que `cols` caractères tiennent pile dans la largeur utile
    const charAt1 = probe.font('mono').fontSize(1).widthOfString('0')
    const size = Math.floor(((width - margin * 2) / (cols * charAt1)) * 10) / 10
    const lh = size * 1.5
    const fits = (text: string) => text.length * charAt1 * size * 1.35 <= width - margin * 2
    const height = margin * 2 + rows.reduce((a, r) => a + (r.big && fits(r.text) ? lh * 1.4 : lh), 0)

    const doc = new PDFDocument({ size: [width, height], margin, info: { Title: `${t.title} ${t.shop.name}`, Producer: t.software, Creator: t.software } })
    doc.registerFont('mono', join(FONTS, 'GeistMono-Regular.ttf'))
    doc.registerFont('mono-bold', join(FONTS, 'GeistMono-SemiBold.ttf'))
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    let y = margin
    for (const r of rows) {
      const big = r.big && fits(r.text)
      doc.font(r.bold || r.big ? 'mono-bold' : 'mono').fontSize(big ? size * 1.35 : size)
      doc.text(r.text, margin, y, { width: width - margin * 2, align: r.align === 'center' ? 'center' : 'left', lineBreak: false })
      y += big ? lh * 1.4 : lh
    }
    doc.end()
  })
}
