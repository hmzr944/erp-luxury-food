import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Decimal } from '@prisma/client/runtime/library'
import { PrismaService } from '../common/prisma/prisma.service'
import { ComplianceService } from '../compliance/compliance.service'
import { PrintingService } from '../printing/printing.service'
import { StockService } from '../stock/stock.service'
import type { CheckoutDto } from './dto/checkout.dto'
import type { PaymentKind, PaymentMode } from '@prisma/client'
import { buildOrderDraft, OrderDraftError, type OrderDraft } from './order-draft'

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private compliance: ComplianceService,
    private printing: PrintingService,
    private stock: StockService,
    private eventEmitter: EventEmitter2,
  ) {}

  async checkout(siteId: string, dto: CheckoutDto) {
    const order = await this.prisma.$transaction(async (tx) => {
      // 1. Données de référence en base — jamais confiance au client pour les prix
      const site = await tx.site.findUniqueOrThrow({
        where: { id: siteId },
        select: {
          organization: {
            select: {
              priceIncludesTax: true,
              paymentMethods: { where: { isActive: true }, select: { code: true, label: true, kind: true } },
            },
          },
        },
      })
      const productIds = [...new Set(dto.items.map((i) => i.productId))]
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, siteId, isActive: true },
        select: {
          id: true, name: true, price: true, taxRate: true, tracking: true,
          variants: { where: { isActive: true }, select: { id: true, name: true, price: true } },
        },
      })

      // 2. Lignes, totaux et paiements calculés côté serveur
      let draft: OrderDraft
      try {
        draft = buildOrderDraft({
          items: dto.items,
          products: products.map((p) => ({
            ...p,
            price: Number(p.price),
            taxRate: Number(p.taxRate),
            variants: p.variants.map((v) => ({ ...v, price: Number(v.price) })),
          })),
          priceIncludesTax: site.organization.priceIncludesTax,
          orderDiscount: dto.orderDiscount,
          paymentMethods: site.organization.paymentMethods,
          payments: dto.payments,
          paymentMode: dto.paymentMode,
        })
      } catch (e) {
        if (e instanceof OrderDraftError) throw new BadRequestException(e.message)
        throw e
      }

      // 3. Pièces numérotées : la pièce doit être en stock, et sort du stock
      //    dans la même transaction pour qu'elle ne puisse pas être vendue deux fois
      for (const item of draft.items.filter((i) => i.serialNumber)) {
        const sold = await tx.stockLot.updateMany({
          where: { siteId, productId: item.productId, serialNumber: item.serialNumber, quantity: { gt: 0 } },
          data: { quantity: 0 },
        })
        if (sold.count === 0) {
          throw new BadRequestException(`${item.name} n° ${item.serialNumber} n'est pas en stock`)
        }
      }

      const total = new Decimal(draft.pricing.total)

      // 4. Signature NF525 dans la même transaction
      const receipt = await this.compliance.signReceipt(tx, siteId, total)

      // 5. Création atomique Order + lignes + paiements + lien NF525
      return tx.order.create({
        data: {
          siteId,
          channel: dto.channel ?? 'IN_STORE',
          status: 'COMPLETED',
          subtotal: new Decimal(draft.pricing.subtotal),
          taxAmount: new Decimal(draft.pricing.taxAmount),
          total,
          discount: new Decimal(draft.pricing.discount),
          paymentMode: draft.paymentMode as PaymentMode,
          customerEmail: dto.customerEmail ?? null,
          note: dto.note ?? null,
          receiptChainId: receipt.id,
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
            })),
          },
        },
        include: {
          items: { include: { product: { select: { name: true } } } },
          payments: true,
          site: { select: { name: true } },
          receiptChain: { select: { id: true, counter: true, hash: true, signedAt: true } },
        },
      })
    })

    // 6. Jobs post-transaction (fire & forget — ne bloquent JAMAIS le checkout)
    if (dto.printerId) {
      this.printing
        .queue({
          printerId: dto.printerId,
          content: this.buildReceiptText(order),
          title: `Reçu #${order.receiptChain?.counter}`,
        })
        .catch(() => {})
    }

    // 5b. Décrémentation du stock via BullMQ
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

    // 7. Event WebSocket (découuplé via EventEmitter2)
    this.eventEmitter.emit('order.created', { siteId, order })

    return order
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
