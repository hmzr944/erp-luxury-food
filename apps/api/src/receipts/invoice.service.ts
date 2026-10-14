import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { FISCAL_SOFTWARE } from '@erp/types'
import { priceOrder, soldItemDetail, soldItemView } from '@erp/utils'
import { PrismaService } from '../common/prisma/prisma.service'
import { MailService, esc } from '../common/mail/mail.service'
import { AuditService } from '../audit/audit.service'
import { frenchVatNumber, validSiren, validSiret } from '../companies/companies'
import { renderInvoicePdf, type InvoiceDoc } from './invoice-pdf'
import { ReceiptsService } from './receipts.service'

export interface InvoiceCompany {
  name: string
  siren?: string | null
  siret?: string | null
  vatNumber?: string | null
  address?: string | null
  zipCode?: string | null
  city?: string | null
  country?: string | null
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const digits = (s?: string | null) => (s ?? '').replace(/\D/g, '')
const eur = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

// Facture entreprise d'une vente encaissée : le vendeur choisit l'entreprise
// (annuaire SIRENE), la facture est numérotée sans trou, rattachée au ticket,
// et part par e-mail au service comptable. Rien à ressaisir.
@Injectable()
export class InvoiceFromReceiptService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private audit: AuditService,
    private receipts: ReceiptsService,
  ) {}

  async issue(siteId: string, token: string, input: { company: InvoiceCompany; email?: string | null }, user: { id: string }) {
    const order = await this.receipts.find(token)
    if (!order || order.site.id !== siteId || !order.receiptChain) throw new NotFoundException('La vente n’est pas encore arrivée au serveur')
    if (order.kind === 'REFUND') throw new BadRequestException('Un remboursement ne se facture pas : la facture d’origine reste valable')
    const email = input.email?.trim().toLowerCase() || null
    if (email && !EMAIL.test(email)) throw new BadRequestException('Adresse e-mail invalide')

    let number = order.invoiceNumber
    // Une facture porte le SIREN du vendeur (art. 242 nonies A, annexe II CGI)
    if (!order.site.organization.settings?.siret) throw new BadRequestException('Renseignez d’abord le SIRET de votre entreprise (Paramètres, Organisation) : il figure sur chaque facture.')
    if (!number) {
      const c = this.company(input.company)
      const full = await this.prisma.order.findUniqueOrThrow({ where: { id: order.id }, select: { site: { select: { organizationId: true } } } })
      const organizationId = full.site.organizationId
      number = await this.prisma.$transaction(async (tx) => {
        // Même entreprise déjà connue (SIRET) : on la réutilise, coordonnées à jour
        const known = c.siret ? await tx.b2BClient.findFirst({ where: { organizationId, siret: c.siret } }) : null
        const data = { name: c.name, siret: c.siret, vatNumber: c.vatNumber, address: c.address, zipCode: c.zipCode, city: c.city, country: c.country, ...(email ? { email } : {}) }
        const client = known ? await tx.b2BClient.update({ where: { id: known.id }, data }) : await tx.b2BClient.create({ data: { organizationId, ...data } })
        // Numéro séquentiel attribué dans la même transaction : pas de trou
        const year = new Date().getFullYear()
        const seq = await tx.invoiceSequence.upsert({
          where: { organizationId_year: { organizationId, year } },
          create: { organizationId, year, lastNumber: 1, prefix: 'FA' },
          update: { lastNumber: { increment: 1 } },
        })
        const n = `${seq.prefix}-${year}-${String(seq.lastNumber).padStart(4, '0')}`
        const updated = await tx.order.updateMany({ where: { id: order.id, invoiceNumber: null }, data: { invoiceNumber: n, invoicedAt: new Date(), b2bClientId: client.id } })
        if (updated.count !== 1) throw new BadRequestException('Cette vente vient d’être facturée')
        return n
      })
      await this.audit.log({ organizationId, userId: user.id, action: 'invoice.issued', target: order.id, detail: `${number} ${c.name}${c.siret ? ` (${c.siret})` : ''}` })
    }

    const pdf = await this.pdf(token)
    let sent: { sent: boolean; reason?: string } = { sent: false, reason: 'Aucune adresse e-mail' }
    if (email) {
      const shop = order.site.organization.name
      sent = await this.mail.send({
        to: email,
        subject: `Facture ${number} de ${shop}`,
        text: `Bonjour,\n\nVeuillez trouver ci-jointe la facture ${number} de ${shop}, d’un montant de ${eur(Number(order.total))} TTC, déjà réglée.\n\nCordialement,\n${shop}`,
        html: `<p>Bonjour,</p><p>Veuillez trouver ci-jointe la facture <strong>${esc(number)}</strong> de ${esc(shop)}, d’un montant de ${eur(Number(order.total))}&nbsp;TTC, déjà réglée.</p><p>Cordialement,<br>${esc(shop)}</p>`,
        attachments: [{ filename: pdf.filename, content: pdf.body }],
      })
      if (sent.sent) await this.prisma.order.update({ where: { id: order.id }, data: { invoiceSentAt: new Date(), invoiceSentTo: email } })
    }
    return { invoiceNumber: number, emailed: sent.sent, ...(sent.sent ? {} : { reason: sent.reason }) }
  }

  private company(c: InvoiceCompany) {
    const name = c.name?.trim()
    if (!name) throw new BadRequestException('Raison sociale à saisir')
    const siret = digits(c.siret) || null
    const siren = digits(c.siren) || (siret ? siret.slice(0, 9) : null)
    if (siret && !validSiret(siret)) throw new BadRequestException('SIRET invalide (14 chiffres)')
    if (siren && !validSiren(siren)) throw new BadRequestException('SIREN invalide (9 chiffres)')
    const country = (c.country?.trim() || 'FR').toUpperCase().slice(0, 2)
    return {
      name: name.slice(0, 200),
      siret: siret ?? siren,
      vatNumber: c.vatNumber?.replace(/\s/g, '').toUpperCase() || (siren && country === 'FR' ? frenchVatNumber(siren) : null),
      address: c.address?.trim() || null,
      zipCode: c.zipCode?.trim() || null,
      city: c.city?.trim() || null,
      country,
    }
  }

  // Facture A4 (PDF) d'une vente déjà facturée
  async pdf(token: string) {
    const order = await this.prisma.order.findUnique({
      where: { clientId: token },
      select: {
        invoiceNumber: true,
        invoicedAt: true,
        total: true,
        discount: true,
        items: { select: { name: true, variantName: true, serialNumber: true, price: true, taxRate: true, quantity: true, discount: true, modifiers: true, menuGroup: true, menuName: true, weight: true, pricePerKg: true } },
        payments: { select: { label: true, amount: true } },
        receiptChain: { select: { counter: true, terminalCounter: true, signedAt: true, terminal: { select: { name: true } } } },
        b2bClient: true,
        site: {
          select: {
            name: true,
            timezone: true,
            organization: { select: { name: true, sector: true, priceIncludesTax: true, settings: true } },
          },
        },
      },
    })
    if (!order?.invoiceNumber || !order.receiptChain) throw new NotFoundException('Facture introuvable')
    const org = order.site.organization
    const s = org.settings
    const tz = order.site.timezone
    const priced = priceOrder(
      order.items.map((i) => ({ unitPrice: Number(i.price), quantity: i.quantity, discount: Number(i.discount), taxRate: Number(i.taxRate) })),
      { priceIncludesTax: org.priceIncludesTax, orderDiscount: Number(order.discount) || undefined },
    )
    const totalHt = Math.round(priced.taxBreakdown.reduce((a, t) => a + t.ht, 0) * 100) / 100
    const totalTax = Math.round(priced.taxBreakdown.reduce((a, t) => a + t.tax, 0) * 100) / 100
    const date = (d: Date) => d.toLocaleDateString('fr-FR', { timeZone: tz })
    const b = order.b2bClient
    const doc: InvoiceDoc = {
      number: order.invoiceNumber,
      date: order.invoicedAt ?? new Date(),
      timeZone: tz,
      seller: {
        name: org.name,
        lines: [
          [s?.legalForm, s?.capital ? `au capital de ${eur(Number(s.capital))}` : null].filter(Boolean).join(' '),
          s?.legalAddress ?? '',
          [s?.legalZipCode, s?.legalCity].filter(Boolean).join(' '),
          s?.siret ? `SIRET ${s.siret}` : '',
          s?.rcs ?? '',
          s?.vatNumber ? `TVA intracommunautaire ${s.vatNumber}` : '',
        ].filter(Boolean),
      },
      buyer: {
        name: b?.name ?? 'Client',
        lines: [
          b?.address ?? '',
          [b?.zipCode, b?.city].filter(Boolean).join(' '),
          b?.country && b.country !== 'FR' ? b.country : '',
          b?.siret ? (b.siret.length === 14 ? `SIRET ${b.siret}` : `SIREN ${b.siret}`) : '',
          b?.vatNumber ? `TVA intracommunautaire ${b.vatNumber}` : '',
        ].filter(Boolean),
      },
      reference: `Ticket de caisse n° ${order.receiptChain.terminalCounter ?? order.receiptChain.counter} (${order.receiptChain.terminal?.name ?? 'caisse'}) du ${date(order.receiptChain.signedAt)}, ${order.site.name}.`,
      nature: org.sector === 'SERVICES' ? 'Prestation de services' : 'Livraison de biens',
      lines: order.items.map((i, k) => {
        const ht = priced.lines[k]?.ht ?? 0
        return {
          // Composant de formule : facturé à son taux, sous le nom de la formule
          name: i.menuName ? `${i.menuName} : ${i.name}` : i.name,
          detail: soldItemDetail(soldItemView(i)),
          quantity: i.quantity,
          unitHt: Math.round((ht / i.quantity) * 100) / 100,
          rate: Number(i.taxRate),
          totalHt: ht,
        }
      }),
      taxes: priced.taxBreakdown,
      totalHt,
      totalTax,
      total: Number(order.total),
      paid: [`Facture acquittée le ${date(order.receiptChain.signedAt)}`, ...order.payments.map((p) => `${p.label} : ${eur(Number(p.amount))}`)],
      legal: [
        'Facture acquittée : aucune somme restant due. Escompte pour paiement anticipé : néant.',
        'En cas de retard de paiement : pénalités au taux de trois fois le taux d’intérêt légal et indemnité forfaitaire pour frais de recouvrement de 40 € (art. L441-10 et D441-5 du code de commerce).',
      ],
      software: `${FISCAL_SOFTWARE.name} ${FISCAL_SOFTWARE.version}`,
    }
    return { filename: `facture-${order.invoiceNumber}.pdf`, body: await renderInvoicePdf(doc) }
  }
}
