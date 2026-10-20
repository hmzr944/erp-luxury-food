import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Decimal } from '@prisma/client/runtime/library'
import { PrismaService } from '../common/prisma/prisma.service'
import {
  dateKindOf,
  lotStatus,
  matchesFilter,
  onlyExpired,
  parisDay,
  productsToClear,
  type LotFilter,
} from './lots'

export interface ReceiveInput {
  productId: string
  variantId?: string
  lotNumber?: string
  // Jour de la date limite (AAAA-MM-JJ)
  expiresAt?: string
  quantity?: number
  serialNumbers?: string[]
  // Jour de réception (AAAA-MM-JJ), aujourd'hui par défaut
  receivedAt?: string
}

export interface LossInput {
  // Absent : tout ce qui reste du lot
  quantity?: number
  reason: string
}

const MAX_QUANTITY = 1_000_000

@Injectable()
export class LotsService {
  constructor(private prisma: PrismaService) {}

  private async rows(siteId: string, productId?: string, now = new Date()) {
    const lots = await this.prisma.stockLot.findMany({
      where: { siteId, quantity: { gt: 0 }, ...(productId ? { productId } : {}) },
      include: {
        product: { select: { name: true, tracking: true, attributes: true, soldByWeight: true, stockItem: { select: { unit: true } } } },
        variant: { select: { name: true } },
      },
      orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { receivedAt: 'asc' }],
      take: 2000,
    })
    return lots.map((l) => {
      const { status, daysLeft } = lotStatus(l.expiresAt, now)
      return {
        id: l.id,
        productId: l.productId,
        productName: l.product.name,
        variantName: l.variant?.name ?? null,
        tracking: l.product.tracking,
        dateKind: dateKindOf(l.product.attributes),
        lotNumber: l.lotNumber,
        serialNumber: l.serialNumber,
        quantity: Number(l.quantity),
        // Un produit au poids se stocke en kilos
        unit: l.product.soldByWeight ? 'kg' : (l.product.stockItem?.unit ?? 'unité'),
        receivedAt: parisDay(l.receivedAt),
        expiresAt: l.expiresAt ? parisDay(l.expiresAt) : null,
        daysLeft,
        status,
      }
    })
  }

  // Lots en stock, du plus proche de sa date au plus lointain, et produits à écouler
  async list(siteId: string, filter: LotFilter = 'all', productId?: string, now = new Date()) {
    const all = await this.rows(siteId, productId, now)
    return {
      today: parisDay(now),
      lots: all.filter((l) => matchesFilter(l.daysLeft, filter)),
      counts: {
        all: all.length,
        expired: all.filter((l) => matchesFilter(l.daysLeft, 'expired')).length,
        week: all.filter((l) => matchesFilter(l.daysLeft, '7')).length,
        month: all.filter((l) => matchesFilter(l.daysLeft, '30')).length,
      },
      toClear: productsToClear(all),
    }
  }

  // Pour la caisse : produits qui n'ont plus que des lots périmés
  async expiredOnly(siteId: string, now = new Date()) {
    const all = await this.rows(siteId, undefined, now)
    const ids = onlyExpired(all)
    return { productIds: ids }
  }

  // Réception d'un lot : le lot, le stock du produit et le mouvement d'entrée
  // se créent ensemble, ou pas du tout
  async receive(siteId: string, userId: string, input: ReceiveInput) {
    const product = await this.prisma.product.findFirst({
      where: { id: input.productId, siteId },
      select: {
        id: true,
        tracking: true,
        soldByWeight: true,
        isMenu: true,
        variants: { where: { isActive: true }, select: { id: true } },
      },
    })
    if (!product) throw new NotFoundException('Produit introuvable sur ce site')
    if (product.tracking === 'NONE') {
      throw new BadRequestException('Ce produit n’est pas suivi par lot. Choisissez son mode de suivi dans le catalogue.')
    }
    if (input.variantId && !product.variants.some((v) => v.id === input.variantId)) {
      throw new BadRequestException('Variante inconnue pour ce produit')
    }
    if (!input.variantId && product.variants.length) throw new BadRequestException('Précisez la variante réceptionnée')

    const lotNumber = input.lotNumber?.trim() || null
    const serials = [...new Set((input.serialNumbers ?? []).map((s) => s.trim()).filter(Boolean))]
    let expiresAt: Date | null = null
    if (input.expiresAt) {
      expiresAt = parseDay(input.expiresAt)
      if (!expiresAt) throw new BadRequestException('Date limite illisible')
    }
    let receivedAt = new Date()
    if (input.receivedAt) {
      const day = parseDay(input.receivedAt)
      if (!day) throw new BadRequestException('Date de réception illisible')
      if (input.receivedAt > parisDay(new Date())) throw new BadRequestException('La date de réception ne peut pas être dans le futur')
      receivedAt = day
    }

    let quantity: number
    if (product.tracking === 'SERIAL') {
      if (!serials.length) throw new BadRequestException('Saisissez les numéros de série des pièces reçues')
      quantity = serials.length
    } else {
      quantity = Number(input.quantity ?? 0)
      if (!Number.isFinite(quantity) || quantity <= 0) throw new BadRequestException('Quantité reçue manquante')
      if (quantity > MAX_QUANTITY) throw new BadRequestException('Quantité trop grande')
      if (!product.soldByWeight && !Number.isInteger(quantity)) throw new BadRequestException('La quantité doit être un nombre entier')
      if (product.tracking === 'LOT' && !lotNumber) throw new BadRequestException('Le numéro de lot est obligatoire pour ce produit')
      if (product.tracking === 'LOT_EXPIRY' && !expiresAt) throw new BadRequestException('La date limite est obligatoire pour ce produit')
    }
    // Un produit suivi par numéro de série ou par lot seul n'a pas de date limite
    if (product.tracking !== 'LOT_EXPIRY') expiresAt = null

    const delta = new Decimal(quantity)
    const variantId = input.variantId ?? null

    return this.prisma.$transaction(async (tx) => {
      let lotId: string
      if (product.tracking === 'SERIAL') {
        const taken = await tx.stockLot.findMany({
          where: { productId: product.id, serialNumber: { in: serials } },
          select: { serialNumber: true },
        })
        if (taken.length) throw new BadRequestException(`Numéros déjà enregistrés : ${taken.map((t) => t.serialNumber).join(', ')}`)
        await tx.stockLot.createMany({
          data: serials.map((serialNumber) => ({
            siteId, productId: product.id, variantId, lotNumber, serialNumber, expiresAt: null, quantity: new Decimal(1), receivedAt,
          })),
        })
        const first = await tx.stockLot.findFirst({ where: { productId: product.id, serialNumber: serials[0] }, select: { id: true } })
        lotId = first!.id
      } else {
        // Même numéro de lot déjà reçu : on ajoute à ce lot, à condition que la date soit la même
        const same = lotNumber
          ? await tx.stockLot.findFirst({ where: { siteId, productId: product.id, variantId, lotNumber, serialNumber: null } })
          : null
        if (same) {
          const sameDay = (same.expiresAt ? parisDay(same.expiresAt) : null) === (expiresAt ? parisDay(expiresAt) : null)
          if (!sameDay) throw new ConflictException(`Le lot ${lotNumber} existe déjà avec une autre date limite`)
          await tx.stockLot.update({ where: { id: same.id }, data: { quantity: same.quantity.add(delta) } })
          lotId = same.id
        } else {
          const created = await tx.stockLot.create({
            data: { siteId, productId: product.id, variantId, lotNumber, expiresAt, quantity: delta, receivedAt },
            select: { id: true },
          })
          lotId = created.id
        }
      }

      if (variantId) {
        await tx.variantStock.upsert({
          where: { variantId },
          update: { quantity: { increment: delta } },
          create: { variantId, siteId, quantity: delta },
        })
      } else {
        await tx.stockItem.upsert({
          where: { productId: product.id },
          update: { quantity: { increment: delta } },
          create: { productId: product.id, siteId, quantity: delta, unit: product.soldByWeight ? 'kg' : 'unité' },
        })
      }

      const movement = await tx.stockMovement.create({
        data: {
          siteId,
          productId: product.id,
          variantId,
          lotId,
          type: 'RESTOCK',
          quantity: delta,
          reason: lotNumber ? `Lot ${lotNumber}` : serials.length ? `${serials.length} pièce(s) numérotée(s)` : 'Réception',
          userId,
        },
      })
      return { lotId, movementId: movement.id, quantity }
    })
  }

  // Retrait de la vente d'un lot : la quantité sort du lot et du stock du produit,
  // avec un mouvement de perte lié au lot et un motif
  async loss(siteId: string, userId: string, lotId: string, input: LossInput) {
    const reason = input.reason?.trim()
    if (!reason || reason.length < 3) throw new BadRequestException('Indiquez le motif du retrait')
    if (reason.length > 200) throw new BadRequestException('Motif trop long (200 caractères)')

    const lot = await this.prisma.stockLot.findFirst({ where: { id: lotId, siteId } })
    if (!lot || lot.quantity.lte(0)) throw new NotFoundException('Lot introuvable ou déjà vide')
    const qty = input.quantity === undefined ? lot.quantity : new Decimal(input.quantity)
    if (!qty.isFinite() || qty.lte(0)) throw new BadRequestException('Quantité à retirer invalide')
    if (qty.gt(lot.quantity)) throw new BadRequestException(`Le lot ne contient que ${lot.quantity.toString()}`)

    return this.prisma.$transaction(async (tx) => {
      // Garde contre une vente simultanée : le lot doit encore contenir la quantité
      const taken = await tx.stockLot.updateMany({
        where: { id: lot.id, quantity: { gte: qty } },
        data: { quantity: { decrement: qty } },
      })
      if (taken.count === 0) throw new ConflictException('Le lot a changé entre-temps, rechargez la liste')

      if (lot.variantId) {
        const stock = await tx.variantStock.findUnique({ where: { variantId: lot.variantId } })
        if (stock) await tx.variantStock.update({ where: { variantId: lot.variantId }, data: { quantity: Decimal.max(stock.quantity.sub(qty), 0) } })
      } else {
        const stock = await tx.stockItem.findUnique({ where: { productId: lot.productId } })
        if (stock) await tx.stockItem.update({ where: { productId: lot.productId }, data: { quantity: Decimal.max(stock.quantity.sub(qty), 0) } })
      }

      const movement = await tx.stockMovement.create({
        data: {
          siteId,
          productId: lot.productId,
          variantId: lot.variantId,
          lotId: lot.id,
          type: 'LOSS',
          quantity: qty,
          reason,
          userId,
        },
      })
      return { movementId: movement.id, quantity: Number(qty), remaining: Number(lot.quantity.sub(qty)) }
    })
  }
}

// AAAA-MM-JJ lu comme un jour de calendrier (minuit UTC : le même jour à Paris)
function parseDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null
  const year = d.getUTCFullYear()
  return year >= 2000 && year <= 2100 ? d : null
}
