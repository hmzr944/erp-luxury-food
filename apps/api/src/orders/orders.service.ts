import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Decimal } from '@prisma/client/runtime/library'
import { PrismaService } from '../common/prisma/prisma.service'
import { ComplianceService } from '../compliance/compliance.service'
import { PrintingService } from '../printing/printing.service'
import { StockService } from '../stock/stock.service'
import type { CheckoutDto } from './dto/checkout.dto'
import type { Channel, PaymentKind, PaymentMode, Prisma } from '@prisma/client'
import { RECEIPT_GENESIS_HASH } from '@erp/utils'
import { verifyTerminalReceipt } from '../compliance/terminal-receipt'
import type { SyncSaleDto } from './dto/sync-sale.dto'
import { buildOrderDraft, OrderDraftError, type DraftInput, type OrderDraft } from './order-draft'

const ORDER_INCLUDE = {
  items: { include: { product: { select: { name: true } } } },
  payments: true,
  site: { select: { name: true } },
  receiptChain: {
    select: { id: true, counter: true, hash: true, signedAt: true, terminalCounter: true, terminalHash: true },
  },
} satisfies Prisma.OrderInclude

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private compliance: ComplianceService,
    private printing: PrintingService,
    private stock: StockService,
    private eventEmitter: EventEmitter2,
  ) {}

  // Vente encaissée par le serveur (API, B2B, intégrations)
  async checkout(siteId: string, dto: CheckoutDto) {
    const order = await this.prisma.$transaction(async (tx) => {
      const ref = await this.loadReference(tx, siteId, dto.items.map((i) => i.productId), true)
      const draft = this.draft({
        items: dto.items,
        products: ref.products,
        priceIncludesTax: ref.priceIncludesTax,
        orderDiscount: dto.orderDiscount,
        paymentMethods: ref.paymentMethods,
        payments: dto.payments,
        paymentMode: dto.paymentMode,
      })
      await this.takeSerials(tx, siteId, draft, true)

      const total = new Decimal(draft.pricing.total)
      const receipt = await this.compliance.signReceipt(tx, siteId, total)
      return this.persistOrder(tx, siteId, draft, {
        channel: dto.channel ?? 'IN_STORE',
        customerEmail: dto.customerEmail,
        note: dto.note,
        receiptChainId: receipt.id,
      })
    })

    this.afterOrder(siteId, order, dto.printerId)
    return order
  }

  // Vente signée par une caisse (en ligne ou au retour du réseau).
  // Le ticket a déjà été remis au client : on vérifie qu'il est authentique
  // et intact, puis on l'enregistre. Renvoyer la même vente ne crée rien.
  async syncSignedSale(siteId: string, dto: SyncSaleDto) {
    const existing = await this.prisma.order.findUnique({
      where: { clientId: dto.clientId },
      include: ORDER_INCLUDE,
    })
    if (existing) {
      if (existing.siteId !== siteId) throw new ConflictException('Identifiant de vente déjà utilisé')
      return existing
    }

    const terminal = await this.prisma.terminal.findFirst({
      where: { id: dto.terminalId, siteId },
      select: { id: true, publicKey: true, isActive: true },
    })
    if (!terminal) throw new NotFoundException('Caisse inconnue sur ce site')
    // Une caisse désactivée garde le droit de remonter les ventes déjà signées

    const content = { items: dto.items, payments: dto.payments, orderDiscount: dto.orderDiscount }
    const check = await verifyTerminalReceipt({
      publicKeyJwk: JSON.parse(terminal.publicKey),
      content,
      fields: {
        terminalId: terminal.id,
        clientId: dto.clientId,
        counter: dto.receipt.counter,
        previousHash: dto.receipt.previousHash,
        total: dto.receipt.total,
        signedAt: dto.receipt.signedAt,
      },
      hash: dto.receipt.hash,
      signature: dto.receipt.signature,
    })
    if (!check.ok) throw new UnprocessableEntityException(check.reason)

    const order = await this.prisma.$transaction(async (tx) => {
      // Continuité de la chaîne de la caisse : ni trou, ni retour en arrière.
      // Verrou par caisse : deux envois simultanés sont traités l'un après l'autre
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'terminal:' + terminal.id}))`
      const last = await tx.receiptChain.findFirst({
        where: { terminalId: terminal.id },
        orderBy: { terminalCounter: 'desc' },
        select: { terminalCounter: true, terminalHash: true },
      })
      const expectedCounter = (last?.terminalCounter ?? 0) + 1
      const expectedPrevious = last?.terminalHash ?? RECEIPT_GENESIS_HASH
      if (dto.receipt.counter !== expectedCounter || dto.receipt.previousHash !== expectedPrevious) {
        throw new ConflictException({
          message: `Ticket n° ${dto.receipt.counter} reçu, n° ${expectedCounter} attendu`,
          expectedCounter,
        })
      }

      const ref = await this.loadReference(tx, siteId, dto.items.map((i) => i.productId), false)
      const draft = this.draft({
        items: dto.items,
        products: ref.products,
        priceIncludesTax: ref.priceIncludesTax,
        orderDiscount: dto.orderDiscount,
        // Un moyen de paiement désactivé depuis la vente reste valable pour elle
        paymentMethods: ref.allPaymentMethods,
        payments: dto.payments,
        useSignedPrices: true,
      })
      if (Math.round(draft.pricing.total * 100) !== Math.round(dto.receipt.total * 100)) {
        throw new UnprocessableEntityException(
          `Total recalculé ${draft.pricing.total.toFixed(2)} ≠ total signé ${dto.receipt.total.toFixed(2)}`,
        )
      }
      // La vente a eu lieu : une pièce numérotée absente du stock est signalée, pas refusée
      const missingSerials = await this.takeSerials(tx, siteId, draft, false)

      const signedAt = new Date(dto.receipt.signedAt)
      const total = new Decimal(draft.pricing.total)
      const receipt = await this.compliance.signReceipt(tx, siteId, total, {
        terminalId: terminal.id,
        terminalCounter: dto.receipt.counter,
        terminalHash: dto.receipt.hash,
        terminalPreviousHash: dto.receipt.previousHash,
        terminalSignature: dto.receipt.signature,
        terminalSignedAt: signedAt,
      })
      await tx.terminal.update({ where: { id: terminal.id }, data: { lastSeenAt: new Date() } })

      const notes = [
        dto.note,
        ...draft.priceDifferences.map((d) => `Prix signé différent du catalogue — ${d}`),
        ...missingSerials.map((sn) => `N° de série absent du stock à la synchronisation : ${sn}`),
      ].filter(Boolean)

      // Paiements encaissés sur un TPE connecté : on garde la référence du prestataire
      const terminalRefs = await tx.terminalPayment.findMany({
        where: { clientSaleId: dto.clientId, status: 'SUCCEEDED', siteId },
        select: { amount: true, providerRef: true, id: true },
      })
      for (const p of draft.payments) {
        const i = terminalRefs.findIndex((t) => t.amount === Math.round(p.amount * 100))
        if (i >= 0) {
          p.reference = terminalRefs[i].providerRef ?? terminalRefs[i].id
          terminalRefs.splice(i, 1)
        }
      }

      return this.persistOrder(tx, siteId, draft, {
        channel: 'IN_STORE',
        customerEmail: dto.customerEmail,
        note: notes.length ? notes.join('\n') : undefined,
        receiptChainId: receipt.id,
        clientId: dto.clientId,
        soldAt: signedAt,
        createdAt: await this.bookingDate(tx, siteId, signedAt),
      })
    }).catch(async (e) => {
      // Même vente envoyée deux fois en parallèle : la première a gagné
      if (this.isUniqueViolation(e)) {
        const winner = await this.prisma.order.findUnique({ where: { clientId: dto.clientId }, include: ORDER_INCLUDE })
        if (winner) return winner
      }
      throw e
    })

    this.afterOrder(siteId, order)
    return order
  }

  private isUniqueViolation(e: unknown) {
    return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002'
  }

  // Une vente est comptée le jour où elle a eu lieu, sauf si ce jour est déjà
  // clôturé (ticket Z émis) : elle entre alors dans la journée en cours
  private async bookingDate(tx: Prisma.TransactionClient, siteId: string, soldAt: Date) {
    const now = new Date()
    if (soldAt > now) return now
    const day = new Date(soldAt)
    day.setHours(0, 0, 0, 0)
    const closed = await tx.dayClosure.findUnique({ where: { siteId_date: { siteId, date: day } } })
    return closed ? now : soldAt
  }

  private async loadReference(tx: Prisma.TransactionClient, siteId: string, productIds: string[], activeOnly: boolean) {
    const site = await tx.site.findUniqueOrThrow({
      where: { id: siteId },
      select: {
        organization: {
          select: {
            priceIncludesTax: true,
            paymentMethods: { select: { code: true, label: true, kind: true, isActive: true } },
          },
        },
      },
    })
    const products = await tx.product.findMany({
      // L'article libre est masqué du catalogue mais toujours vendable
      where: { id: { in: [...new Set(productIds)] }, siteId, ...(activeOnly ? { OR: [{ isActive: true }, { isCustom: true }] } : {}) },
      select: {
        id: true, name: true, price: true, taxRate: true, tracking: true, isCustom: true,
        variants: {
          where: activeOnly ? { isActive: true } : {},
          select: { id: true, name: true, price: true },
        },
      },
    })
    const methods = site.organization.paymentMethods
    return {
      priceIncludesTax: site.organization.priceIncludesTax,
      paymentMethods: methods.filter((m) => m.isActive),
      allPaymentMethods: methods,
      products: products.map((p) => ({
        ...p,
        price: Number(p.price),
        taxRate: Number(p.taxRate),
        variants: p.variants.map((v) => ({ ...v, price: Number(v.price) })),
      })),
    }
  }

  private draft(input: DraftInput): OrderDraft {
    try {
      return buildOrderDraft(input)
    } catch (e) {
      if (e instanceof OrderDraftError) throw new BadRequestException(e.message)
      throw e
    }
  }

  // Sort les pièces numérotées de leur lot dans la transaction de la vente,
  // pour qu'une même pièce ne puisse pas être vendue deux fois
  private async takeSerials(tx: Prisma.TransactionClient, siteId: string, draft: OrderDraft, strict: boolean) {
    const missing: string[] = []
    for (const item of draft.items.filter((i) => i.serialNumber)) {
      const sold = await tx.stockLot.updateMany({
        where: { siteId, productId: item.productId, serialNumber: item.serialNumber, quantity: { gt: 0 } },
        data: { quantity: 0 },
      })
      if (sold.count === 0) {
        if (strict) throw new BadRequestException(`${item.name} n° ${item.serialNumber} n'est pas en stock`)
        missing.push(`${item.name} ${item.serialNumber}`)
      }
    }
    return missing
  }

  private persistOrder(
    tx: Prisma.TransactionClient,
    siteId: string,
    draft: OrderDraft,
    extra: {
      channel: Channel
      customerEmail?: string
      note?: string
      receiptChainId: string
      clientId?: string
      soldAt?: Date
      createdAt?: Date
    },
  ) {
    return tx.order.create({
      data: {
        siteId,
        channel: extra.channel,
        status: 'COMPLETED',
        subtotal: new Decimal(draft.pricing.subtotal),
        taxAmount: new Decimal(draft.pricing.taxAmount),
        total: new Decimal(draft.pricing.total),
        discount: new Decimal(draft.pricing.discount),
        paymentMode: draft.paymentMode as PaymentMode,
        customerEmail: extra.customerEmail ?? null,
        note: extra.note ?? null,
        receiptChainId: extra.receiptChainId,
        clientId: extra.clientId,
        soldAt: extra.soldAt,
        ...(extra.createdAt ? { createdAt: extra.createdAt } : {}),
        items: {
          create: draft.items.map((i) => ({
            ...i,
            price: new Decimal(i.price),
            taxRate: new Decimal(i.taxRate),
            discount: new Decimal(i.discount),
          })),
        },
        payments: {
          create: draft.payments.map((p) => ({
            code: p.code,
            label: p.label,
            kind: p.kind as PaymentKind,
            amount: new Decimal(p.amount),
            reference: p.reference,
          })),
        },
      },
      include: ORDER_INCLUDE,
    })
  }

  // Tâches après enregistrement — ne bloquent jamais l'encaissement
  private afterOrder(siteId: string, order: Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>, printerId?: number) {
    if (printerId) {
      this.printing
        .queue({
          printerId,
          content: this.buildReceiptText(order),
          title: `Reçu #${order.receiptChain?.counter}`,
        })
        .catch(() => {})
    }

    this.stock
      .queueDecrement({
        siteId,
        orderId: order.id,
        items: order.items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
          // Déjà sortie du stock lot par lot pendant la transaction
          serialNumber: i.serialNumber,
        })),
      })
      .catch(() => {})

    this.eventEmitter.emit('order.created', { siteId, order })
  }

  async findBySite(siteId: string, params: { limit?: number; status?: string }) {
    return this.prisma.order.findMany({
      where: {
        siteId,
        ...(params.status ? { status: params.status as any } : {}),
      },
      include: {
        items: true,
        receiptChain: { select: { counter: true, signedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 50,
    })
  }

  async findById(id: string, siteId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, siteId },
      include: {
        items: { include: { product: { select: { name: true, subtitle: true } } } },
        payments: true,
        receiptChain: true,
      },
    })
    if (!order) throw new NotFoundException('Commande introuvable')
    return order
  }

  async updateStatus(id: string, siteId: string, status: string) {
    const order = await this.prisma.order.update({
      where: { id },
      data: { status: status as any },
      include: { receiptChain: { select: { counter: true } } },
    })

    this.eventEmitter.emit('order.updated', { siteId, order })
    return order
  }

  private buildReceiptText(order: any): string {
    const lines: string[] = [
      order.site?.name ?? '',
      '─'.repeat(32),
      `Ticket #${order.receiptChain?.counter ?? '?'}`,
      new Date().toLocaleString('fr-FR'),
      '─'.repeat(32),
    ]

    for (const item of order.items ?? []) {
      const price = Number(item.price) * item.quantity
      const label = item.variantName ? `${item.name} ${item.variantName}` : item.name
      lines.push(`${label.slice(0, 20).padEnd(20)} ${price.toFixed(2).padStart(10)} €`)
      if (item.serialNumber) lines.push(`  N° ${item.serialNumber}`)
    }

    lines.push('─'.repeat(32))
    lines.push(`TOTAL              ${Number(order.total).toFixed(2).padStart(10)} €`)
    for (const p of order.payments ?? []) {
      lines.push(`${p.label.padEnd(20)} ${Number(p.amount).toFixed(2).padStart(10)} €`)
    }
    lines.push('')
    lines.push(`NF525: ${order.receiptChain?.hash?.substring(0, 16) ?? ''}...`)
    lines.push('\n\n\n')

    return lines.join('\n')
  }
}
