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
      // 1. Récupère les produits en base — jamais confiance au client pour les prix
      const productIds = dto.items.map((i) => i.productId)
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, siteId, isActive: true },
        select: { id: true, price: true, taxRate: true, name: true },
      })

      if (products.length !== productIds.length) {
        const foundIds = products.map((p) => p.id)
        const missing = productIds.filter((id) => !foundIds.includes(id))
        throw new BadRequestException(`Produits introuvables: ${missing.join(', ')}`)
      }

      // 2. Calcul des totaux côté serveur
      let subtotal = new Decimal(0)
      let taxAmount = new Decimal(0)

      const itemsData = dto.items.map((item) => {
        const product = products.find((p) => p.id === item.productId)!
        const lineDiscount = new Decimal(item.discount ?? 0)
        const lineHT = product.price.mul(item.quantity).sub(lineDiscount)
        const lineTax = lineHT.mul(product.taxRate).div(100)

        subtotal = subtotal.add(lineHT)
        taxAmount = taxAmount.add(lineTax)

        return {
          productId: item.productId,
          variantId: item.variantId ?? null,
          name: product.name,
          price: product.price,
          taxRate: product.taxRate,
          quantity: item.quantity,
          discount: lineDiscount,
        }
      })

      const orderDiscount = new Decimal(dto.orderDiscount ?? 0)
      const serverTotal = subtotal.add(taxAmount).sub(orderDiscount)

      // 3. Signature NF525 dans la même transaction
      const receipt = await this.compliance.signReceipt(tx, siteId, serverTotal)

      // 4. Création atomique Order + OrderItems + lien NF525
      return tx.order.create({
        data: {
          siteId,
          channel: dto.channel ?? 'IN_STORE',
          status: 'COMPLETED',
          subtotal,
          taxAmount,
          total: serverTotal,
          discount: orderDiscount,
          paymentMode: dto.paymentMode,
          customerEmail: dto.customerEmail ?? null,
          note: dto.note ?? null,
          receiptChainId: receipt.id,
          items: { create: itemsData },
        },
        include: {
          items: { include: { product: { select: { name: true } } } },
          receiptChain: { select: { id: true, counter: true, hash: true, signedAt: true } },
        },
      })
    })

    // 5. Jobs post-transaction (fire & forget — ne bloquent JAMAIS le checkout)
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
        items: order.items.map((i: any) => ({ productId: i.productId, quantity: i.quantity })),
      })
      .catch(() => {})

    // 6. Event WebSocket (découuplé via EventEmitter2)
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
      'MAISON ARTISANE',
      '─'.repeat(32),
      `Ticket #${order.receiptChain?.counter ?? '?'}`,
      new Date().toLocaleString('fr-FR'),
      '─'.repeat(32),
    ]

    for (const item of order.items ?? []) {
      const price = Number(item.price) * item.quantity
      lines.push(`${item.name.padEnd(20)} ${price.toFixed(2).padStart(10)} €`)
    }

    lines.push('─'.repeat(32))
    lines.push(`TOTAL              ${Number(order.total).toFixed(2).padStart(10)} €`)
    lines.push(`Mode: ${order.paymentMode}`)
    lines.push('')
    lines.push(`NF525: ${order.receiptChain?.hash?.substring(0, 16) ?? ''}...`)
    lines.push('\n\n\n')

    return lines.join('\n')
  }
}
