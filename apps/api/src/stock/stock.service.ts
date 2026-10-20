import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { InjectQueue } from '@nestjs/bull'
import type { Queue } from 'bull'
import { Decimal } from '@prisma/client/runtime/library'
import { PrismaService } from '../common/prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { applyStockDelta, consumeLotsFefo, readStock, type StockTarget } from './stock-adjust'
import { CORRECTION_REASONS, reasonText, type CorrectionReason, type ManualMovementType } from './stock-rules'

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
    // Le journal est global ; absent, les corrections s'enregistrent sans trace d'audit
    @Optional() private audit?: AuditService,
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
          lotId = await consumeLotsFefo(tx, { siteId: payload.siteId, productId: item.productId, variantId: item.variantId ?? null }, qty)
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

  // Une ligne par produit sans variante et par variante : le stock réel
  // se compte à la variante près
  async getInventory(siteId: string) {
    const [items, variants] = await Promise.all([
      this.prisma.stockItem.findMany({
        where: { siteId, product: { isActive: true } },
        include: { product: { select: { id: true, name: true, subtitle: true, sku: true, barcode: true, tracking: true } } },
      }),
      this.prisma.variantStock.findMany({
        where: { siteId, variant: { isActive: true, product: { isActive: true } } },
        include: {
          variant: {
            select: {
              id: true, name: true, sku: true, barcode: true,
              product: { select: { id: true, name: true, subtitle: true, sku: true, barcode: true, tracking: true } },
            },
          },
        },
      }),
    ])
    const rows = [
      ...items.map((i) => ({
        id: i.id, productId: i.productId, variantId: null as string | null, variantName: null as string | null,
        siteId: i.siteId, quantity: i.quantity, unit: i.unit, alertAt: i.alertAt, updatedAt: i.updatedAt,
        product: i.product,
      })),
      ...variants.map((v) => ({
        id: v.id, productId: v.variant.product.id, variantId: v.variantId as string | null, variantName: v.variant.name as string | null,
        siteId: v.siteId, quantity: v.quantity, unit: 'unité', alertAt: v.alertAt, updatedAt: v.updatedAt,
        product: { ...v.variant.product, sku: v.variant.sku ?? v.variant.product.sku, barcode: v.variant.barcode ?? v.variant.product.barcode },
      })),
    ]
    return rows.sort((a, b) => a.product.name.localeCompare(b.product.name, 'fr') || (a.variantName ?? '').localeCompare(b.variantName ?? '', 'fr'))
  }

  // Produits et variantes dont le stock est au seuil d'alerte ou en dessous
  async getLowStockAlerts(siteId: string) {
    const rows = await this.getInventory(siteId)
    return rows.filter((s) => s.alertAt !== null && s.quantity.lte(s.alertAt))
  }

  getMovements(siteId: string, productId?: string, limit = 50) {
    return this.prisma.stockMovement.findMany({
      where: { siteId, ...(productId ? { productId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit || 50, 1), 200),
    })
  }

  // Produit du site et variante demandée : un produit à variantes se compte
  // par variante, jamais au total
  private async resolveTarget(siteId: string, productId: string, variantId?: string | null) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, siteId },
      select: { id: true, name: true, tracking: true, variants: { where: { isActive: true }, select: { id: true, name: true } } },
    })
    if (!product) throw new NotFoundException('Produit introuvable sur ce site')
    if (variantId && !product.variants.some((v) => v.id === variantId)) {
      throw new BadRequestException('Variante inconnue pour ce produit')
    }
    if (!variantId && product.variants.length) throw new BadRequestException('Précisez la variante concernée')
    const variant = product.variants.find((v) => v.id === variantId)
    const target: StockTarget = { siteId, productId, variantId: variantId ?? null }
    return { product, target, label: variant ? `${product.name} (${variant.name})` : product.name }
  }

  // Réception (entrée) ou perte (sortie) : mouvement et quantité dans une
  // seule transaction. Un échec n'écrit rien.
  async addMovement(data: {
    siteId: string
    productId: string
    variantId?: string
    type: ManualMovementType
    quantity: number
    reason?: string
    userId?: string
  }) {
    if (!(data.quantity > 0)) throw new BadRequestException('La quantité doit être supérieure à zéro')
    const { product, target } = await this.resolveTarget(data.siteId, data.productId, data.variantId)
    if (data.type === 'RESTOCK' && product.tracking !== 'NONE') {
      throw new BadRequestException('Ce produit est suivi par lot ou numéro de série : réceptionnez-le depuis « Lots et dates »')
    }
    const qty = new Decimal(data.quantity)

    return this.prisma.$transaction(async (tx) => {
      let lotId: string | null = null
      if (data.type === 'LOSS') {
        const current = await readStock(tx, target)
        if (!current || current.quantity.lt(qty)) {
          throw new BadRequestException(
            `Perte de ${data.quantity} supérieure au stock (${current ? current.quantity.toString() : '0'}). Corrigez d'abord le stock.`,
          )
        }
        lotId = await consumeLotsFefo(tx, target, qty)
      }
      await applyStockDelta(tx, target, data.type === 'LOSS' ? qty.neg() : qty)
      return tx.stockMovement.create({
        data: {
          siteId: data.siteId,
          productId: data.productId,
          variantId: target.variantId,
          lotId,
          type: data.type,
          quantity: qty,
          reason: data.reason?.trim() || null,
          userId: data.userId,
        },
      })
    })
  }

  // « Corriger le stock » : on donne la quantité réellement comptée, l'écart
  // est calculé ici. Le mouvement ADJUSTMENT est signé (négatif si le stock baisse).
  async correct(data: {
    siteId: string
    organizationId: string | null
    productId: string
    variantId?: string
    countedQuantity: number
    reasonCode: CorrectionReason
    note?: string
    userId?: string
  }) {
    if (!(data.countedQuantity >= 0)) throw new BadRequestException('La quantité comptée ne peut pas être négative')
    if (!(data.reasonCode in CORRECTION_REASONS)) throw new BadRequestException('Motif de correction inconnu')
    if (data.reasonCode === 'AUTRE' && !data.note?.trim()) throw new BadRequestException('Précisez le motif de la correction')
    const { target, label } = await this.resolveTarget(data.siteId, data.productId, data.variantId)
    const counted = new Decimal(data.countedQuantity)

    const result = await this.prisma.$transaction(async (tx) => {
      const current = await readStock(tx, target)
      const before = current?.quantity ?? new Decimal(0)
      const delta = counted.sub(before)
      if (delta.isZero()) throw new BadRequestException('La quantité comptée est déjà celle du stock : rien à corriger')
      const lotId = delta.isNeg() ? await consumeLotsFefo(tx, target, delta.abs()) : null
      await applyStockDelta(tx, target, delta)
      const movement = await tx.stockMovement.create({
        data: {
          siteId: data.siteId,
          productId: data.productId,
          variantId: target.variantId,
          lotId,
          type: 'ADJUSTMENT',
          quantity: delta,
          reason: `Correction : ${reasonText(data.reasonCode, data.note)}`,
          reasonCode: data.reasonCode,
          userId: data.userId,
        },
      })
      return { movement, before, delta }
    })

    // Le journal ne bloque jamais la correction, déjà enregistrée
    await this.audit?.log({
      organizationId: data.organizationId,
      userId: data.userId,
      action: 'stock.correction',
      target: data.productId,
      detail: `${label} : ${result.before.toString()} vers ${counted.toString()} (${result.delta.isNeg() ? '' : '+'}${result.delta.toString()}), ${reasonText(data.reasonCode, data.note)}`,
    })
    return { ...result.movement, previousQuantity: result.before, countedQuantity: counted, delta: result.delta }
  }

  // Seuil d'alerte et unité d'une ligne de stock (créée à zéro si elle n'existe pas encore)
  async updateItemSettings(
    siteId: string,
    productId: string,
    data: { variantId?: string; alertAt?: number | null; unit?: string },
  ) {
    const { target } = await this.resolveTarget(siteId, productId, data.variantId)
    const alertAt = data.alertAt === undefined ? undefined : data.alertAt === null ? null : new Decimal(data.alertAt)
    if (target.variantId) {
      return this.prisma.variantStock.upsert({
        where: { variantId: target.variantId },
        update: { ...(alertAt !== undefined ? { alertAt } : {}) },
        create: { variantId: target.variantId, siteId, quantity: new Decimal(0), alertAt: alertAt ?? null },
      })
    }
    const unit = data.unit?.trim()
    return this.prisma.stockItem.upsert({
      where: { productId },
      update: { ...(alertAt !== undefined ? { alertAt } : {}), ...(unit ? { unit } : {}) },
      create: { productId, siteId, quantity: new Decimal(0), unit: unit || 'unité', alertAt: alertAt ?? null },
    })
  }
}
