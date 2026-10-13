import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { InjectQueue } from '@nestjs/bull'
import type { Queue } from 'bull'
import { Decimal } from '@prisma/client/runtime/library'
import { PrismaService } from '../common/prisma/prisma.service'

export interface StockDecrementPayload {
  siteId: string
  orderId: string
  items: Array<{
    productId: string
    variantId?: string | null
    quantity: number
    // Pièce numérotée : déjà sortie de son lot à l'encaissement
    serialNumber?: string | null
  }>
}

export interface ReceiveLotInput {
  siteId: string
  productId: string
  variantId?: string
  lotNumber?: string
  expiresAt?: Date
  quantity?: number
  serialNumbers?: string[]
  userId?: string
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
        const qty = new Decimal(item.quantity)
        const remaining = item.variantId
          ? await this.decrementVariant(tx, item.variantId, qty)
          : await this.decrementProduct(tx, item.productId, qty)

        // Lots : on sort d'abord ceux dont la date limite est la plus proche
        let lotId: string | null = null
        if (!item.serialNumber) {
          lotId = await this.consumeLots(tx, payload.siteId, item.productId, item.variantId ?? null, qty)
        }

        await tx.stockMovement.create({
          data: {
            siteId: payload.siteId,
            productId: item.productId,
            variantId: item.variantId ?? null,
            lotId,
            type: 'SALE',
            quantity: qty,
            orderId: payload.orderId,
          },
        })

        if (remaining?.alertAt && remaining.quantity.lte(remaining.alertAt)) {
          this.logger.warn(
            `Stock bas: ${item.variantId ? `variante ${item.variantId}` : `produit ${item.productId}`} à ${remaining.quantity.toFixed(3)} (seuil: ${remaining.alertAt})`,
          )
        }
      }
    })
  }

  private async decrementProduct(tx: Prisma.TransactionClient, productId: string, qty: Decimal) {
    const stock = await tx.stockItem.findUnique({ where: { productId } })
    if (!stock) return null
    const quantity = Decimal.max(stock.quantity.sub(qty), 0)
    await tx.stockItem.update({ where: { productId }, data: { quantity } })
    return { quantity, alertAt: stock.alertAt }
  }

  private async decrementVariant(tx: Prisma.TransactionClient, variantId: string, qty: Decimal) {
    const stock = await tx.variantStock.findUnique({ where: { variantId } })
    if (!stock) return null
    const quantity = Decimal.max(stock.quantity.sub(qty), 0)
    await tx.variantStock.update({ where: { variantId }, data: { quantity } })
    return { quantity, alertAt: stock.alertAt }
  }

  // Renvoie le premier lot entamé (pour la traçabilité du mouvement)
  private async consumeLots(
    tx: Prisma.TransactionClient,
    siteId: string,
    productId: string,
    variantId: string | null,
    qty: Decimal,
  ): Promise<string | null> {
    const lots = await tx.stockLot.findMany({
      where: { siteId, productId, variantId, serialNumber: null, quantity: { gt: 0 } },
      orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { receivedAt: 'asc' }],
    })
    let left = qty
    let first: string | null = null
    for (const lot of lots) {
      if (left.lte(0)) break
      const take = Decimal.min(lot.quantity, left)
      await tx.stockLot.update({ where: { id: lot.id }, data: { quantity: lot.quantity.sub(take) } })
      first ??= lot.id
      left = left.sub(take)
    }
    return first
  }

  // Réception de marchandise : crée les lots ou pièces numérotées et
  // augmente le stock du produit ou de la variante
  async receiveLot(input: ReceiveLotInput) {
    const product = await this.prisma.product.findFirst({
      where: { id: input.productId, siteId: input.siteId },
      select: { id: true, tracking: true, variants: { where: { isActive: true }, select: { id: true } } },
    })
    if (!product) throw new NotFoundException('Produit introuvable sur ce site')
    if (input.variantId && !product.variants.some((v) => v.id === input.variantId)) {
      throw new BadRequestException('Variante inconnue pour ce produit')
    }
    if (!input.variantId && product.variants.length) {
      throw new BadRequestException('Précisez la variante réceptionnée')
    }

    const serials = [...new Set((input.serialNumbers ?? []).map((s) => s.trim()).filter(Boolean))]
    if (product.tracking === 'SERIAL' && !serials.length) {
      throw new BadRequestException('Saisissez les numéros de série des pièces reçues')
    }
    if (product.tracking === 'LOT_EXPIRY' && !input.expiresAt) {
      throw new BadRequestException('La date limite est obligatoire pour ce produit')
    }
    const quantity = serials.length || input.quantity || 0
    if (quantity <= 0) throw new BadRequestException('Quantité reçue manquante')

    return this.prisma.$transaction(async (tx) => {
      const base = {
        siteId: input.siteId,
        productId: input.productId,
        variantId: input.variantId ?? null,
        lotNumber: input.lotNumber ?? null,
        expiresAt: input.expiresAt ?? null,
      }
      if (serials.length) {
        const taken = await tx.stockLot.findMany({
          where: { productId: input.productId, serialNumber: { in: serials } },
          select: { serialNumber: true },
        })
        if (taken.length) {
          throw new BadRequestException(`Numéros déjà enregistrés : ${taken.map((t) => t.serialNumber).join(', ')}`)
        }
        await tx.stockLot.createMany({
          data: serials.map((serialNumber) => ({ ...base, serialNumber, quantity: new Decimal(1) })),
        })
      } else if (product.tracking !== 'NONE') {
        await tx.stockLot.create({ data: { ...base, quantity: new Decimal(quantity) } })
      }

      const delta = new Decimal(quantity)
      if (input.variantId) {
        await tx.variantStock.upsert({
          where: { variantId: input.variantId },
          update: { quantity: { increment: delta } },
          create: { variantId: input.variantId, siteId: input.siteId, quantity: delta },
        })
      } else {
        await tx.stockItem.upsert({
          where: { productId: input.productId },
          update: { quantity: { increment: delta } },
          create: { productId: input.productId, siteId: input.siteId, quantity: delta, unit: 'unité' },
        })
      }

      return tx.stockMovement.create({
        data: {
          siteId: input.siteId,
          productId: input.productId,
          variantId: input.variantId ?? null,
          type: 'RESTOCK',
          quantity: delta,
          reason: input.lotNumber ? `Lot ${input.lotNumber}` : serials.length ? `${serials.length} pièce(s) numérotée(s)` : null,
          userId: input.userId,
        },
      })
    })
  }

  // Lots en stock, les plus proches de leur date limite d'abord
  getLots(siteId: string, params: { productId?: string; expiringWithinDays?: number }) {
    const horizon = params.expiringWithinDays !== undefined
      ? new Date(Date.now() + params.expiringWithinDays * 86_400_000)
      : undefined
    return this.prisma.stockLot.findMany({
      where: {
        siteId,
        quantity: { gt: 0 },
        ...(params.productId ? { productId: params.productId } : {}),
        ...(horizon ? { expiresAt: { lte: horizon } } : {}),
      },
      include: {
        product: { select: { name: true } },
        variant: { select: { name: true } },
      },
      orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { receivedAt: 'asc' }],
      take: 500,
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
    const product = await this.prisma.product.findFirst({
      where: { id: data.productId, siteId: data.siteId },
      select: { id: true },
    })
    if (!product) throw new NotFoundException('Produit introuvable sur ce site')

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
