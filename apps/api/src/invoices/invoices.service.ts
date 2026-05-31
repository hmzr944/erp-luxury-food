import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { FacturxService } from './facturx.service'

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'ACKNOWLEDGED' | 'PAID' | 'REFUSED'

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name)

  constructor(
    private prisma: PrismaService,
    private facturx: FacturxService,
  ) {}

  // ── Numérotation séquentielle sans gap ───────────────────────
  async generateInvoiceNumber(organizationId: string): Promise<string> {
    const year = new Date().getFullYear()

    // Atomique via upsert + increment — jamais de gap même sous concurrence
    const seq = await this.prisma.$transaction(async (tx) => {
      const current = await tx.invoiceSequence.upsert({
        where: { organizationId_year: { organizationId, year } },
        create: { organizationId, year, lastNumber: 1, prefix: 'FA' },
        update: { lastNumber: { increment: 1 } },
      })
      return current
    })

    const padded = String(seq.lastNumber).padStart(4, '0')
    return `${seq.prefix}-${year}-${padded}`
  }

  // ── Facturer une commande B2B ─────────────────────────────────
  async invoiceOrder(orderId: string, siteId: string, organizationId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, siteId, channel: 'B2B' },
      include: {
        b2bClient: true,
        items: { include: { product: { select: { name: true, subtitle: true } } } },
        receiptChain: { select: { counter: true, signedAt: true } },
        site: { include: { organization: { include: { settings: true } } } },
      },
    })

    if (!order) throw new NotFoundException('Commande B2B introuvable')
    if (order.invoiceNumber) throw new BadRequestException('Facture déjà générée')

    const invoiceNumber = await this.generateInvoiceNumber(organizationId)

    const invoiced = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        invoiceNumber,
        invoicedAt: new Date(),
        status: 'COMPLETED',
      },
      include: {
        b2bClient: true,
        items: { include: { product: { select: { name: true, subtitle: true } } } },
        receiptChain: { select: { counter: true } },
        site: { include: { organization: { include: { settings: true } } } },
      },
    })

    // Si PDP configuré, envoie en arrière-plan
    if (invoiced.site.organization.settings?.pdpEnabled) {
      this.sendToPDP(invoiced).catch((e) =>
        this.logger.warn(`PDP send failed for ${invoiceNumber}: ${e}`),
      )
    }

    return invoiced
  }

  // ── Liste des factures d'une organisation ────────────────────
  getInvoices(organizationId: string, filters?: { clientId?: string; year?: number }) {
    const year = filters?.year ?? new Date().getFullYear()
    return this.prisma.order.findMany({
      where: {
        channel: 'B2B',
        invoiceNumber: { not: null },
        site: { organizationId },
        ...(filters?.clientId ? { b2bClientId: filters.clientId } : {}),
        ...(year ? { invoicedAt: {
          gte: new Date(year, 0, 1),
          lt: new Date(year + 1, 0, 1),
        } } : {}),
      },
      include: {
        b2bClient: { select: { id: true, name: true } },
        site: { select: { name: true } },
        receiptChain: { select: { counter: true } },
        _count: { select: { items: true } },
      },
      orderBy: { invoicedAt: 'desc' },
      take: 200,
    })
  }

  // ── Export Factur-X XML ──────────────────────────────────────
  async exportFacturX(orderId: string, organizationId: string): Promise<string> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, invoiceNumber: { not: null }, site: { organizationId } },
      include: {
        b2bClient: true,
        items: true,
        site: {
          include: { organization: { include: { settings: true } } },
        },
      },
    })

    if (!order) throw new NotFoundException('Facture introuvable')
    return this.facturx.generate(order)
  }

  // ── Mise à jour statut ───────────────────────────────────────
  async updateStatus(
    orderId: string,
    organizationId: string,
    status: 'PAID' | 'REFUSED',
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, invoiceNumber: { not: null }, site: { organizationId } },
    })
    if (!order) throw new NotFoundException('Facture introuvable')

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: status === 'PAID' ? 'COMPLETED' : 'CANCELLED' },
    })
  }

  // ── Envoi PDP (Plateforme Agréée) ────────────────────────────
  private async sendToPDP(order: any): Promise<void> {
    const settings = order.site.organization.settings
    if (!settings?.pdpEndpoint || !settings?.pdpApiKey) return

    const xml = this.facturx.generate(order)

    const res = await fetch(settings.pdpEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        Authorization: `Bearer ${settings.pdpApiKey}`,
        'X-Invoice-Number': order.invoiceNumber,
      },
      body: xml,
    })

    if (!res.ok) throw new Error(`PDP ${settings.pdpName}: HTTP ${res.status}`)
    this.logger.log(`Invoice ${order.invoiceNumber} sent to ${settings.pdpName}`)
  }
}
