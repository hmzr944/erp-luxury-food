import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import type { Queue } from 'bull'
import { Decimal } from '@prisma/client/runtime/library'
import { PrismaService } from '../common/prisma/prisma.service'

export interface StockDecrementPayload {
  siteId: string
  orderId: string
  items: Array<{ productId: string; quantity: number }>
}

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name)

  constructor(
    private prisma: PrismaService,
    @InjectQueue('stock') private stockQueue: Queue,
  ) {}

  // Appelé depuis OrdersService (post-transaction, fire & forget)
  async queueDecrement(payload: StockDecrementPayload): Promise<void> {
    await this.stockQueue.add('decrement', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
    })
  }

  // Exécuté par StockProcessor
  async decrementItems(payload: StockDecrementPayload): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const item of payload.items) {
        const stock = await tx.stockItem.findUnique({
          where: { productId: item.productId },
        })
        if (!stock) continue

        const newQty = stock.quantity.sub(new Decimal(item.quantity))

        await tx.stockItem.update({
          where: { productId: item.productId },
          data: { quantity: newQty.gt(0) ? newQty : new Decimal(0) },
        })

        await tx.stockMovement.create({
          data: {
            siteId: payload.siteId,
            productId: item.productId,
            type: 'SALE',
            quantity: new Decimal(item.quantity),
            orderId: payload.orderId,
          },
        })

        // Alerte seuil bas
        if (stock.alertAt && newQty.lte(stock.alertAt)) {
          this.logger.warn(
            `Stock bas: produit ${item.productId} à ${newQty.toFixed(3)} ${stock.unit} (seuil: ${stock.alertAt})`,
          )
          // TODO Sprint 5: envoyer notification (email Resend ou WebSocket)
        }
      }
    })
  }

  getInventory(siteId: string) {
    return this.prisma.stockItem.findMany({
      where: { siteId },
      include: {
        product: { select: { id: true, name: true, subtitle: true, sku: true } },
      },
      orderBy: { product: { name: 'asc' } },
    })
  }

  async getLowStockAlerts(siteId: string) {
    const items = await this.prisma.stockItem.findMany({
      where: { siteId, alertAt: { not: null } },
      include: { product: { select: { id: true, name: true } } },
    })
    return items.filter((s) => s.alertAt && s.quantity.lte(s.alertAt))
  }

  getMovements(siteId: string, productId?: string, limit = 50) {
    return this.prisma.stockMovement.findMany({
      where: { siteId, ...(productId ? { productId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  async addMovement(data: {
    siteId: string
    productId: string
    type: string
    quantity: number
    reason?: string
    userId?: string
  }) {
    const movement = await this.prisma.stockMovement.create({
      data: {
        siteId: data.siteId,
        productId: data.productId,
        type: data.type as any,
        quantity: new Decimal(data.quantity),
        reason: data.reason,
        userId: data.userId,
      },
    })

    // Mise à jour du stock
    const delta = ['SALE', 'LOSS', 'TRANSFER'].includes(data.type)
      ? -Math.abs(data.quantity)
      : Math.abs(data.quantity)

    await this.prisma.stockItem.upsert({
      where: { productId: data.productId },
      update: { quantity: { increment: delta } },
      create: {
        productId: data.productId,
        siteId: data.siteId,
        quantity: new Decimal(Math.max(0, delta)),
        unit: 'unité',
      },
    })

    return movement
  }
}
