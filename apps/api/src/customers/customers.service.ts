import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { GIFT_CARD_CODE, normalizePhone, pointsEarned, pointsToReverse, rewardsAvailable, type LoyaltyRules } from '@erp/utils'
import { PrismaService } from '../common/prisma/prisma.service'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CUSTOMER_SELECT = { id: true, firstName: true, lastName: true, phone: true, email: true, points: true, visits: true, totalSpent: true, lastVisitAt: true, marketingOptIn: true, createdAt: true } as const

export interface CustomerInput {
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  marketingOptIn?: boolean
}

export interface SaleLoyaltyInput {
  organizationId: string
  orderId: string
  customerId?: string | null
  pointsUsed?: number | null
  // Total payé et part de cartes cadeaux achetées (sans points)
  paid: number
  giftCards: Array<{ code: string; amount: number }>
  strict: boolean
}

// Clients particuliers et fidélité. Inclus dans tous les forfaits : le
// commerçant active le programme et fixe lui-même ce qu'il offre.
@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async rules(organizationId: string, tx: Prisma.TransactionClient = this.prisma): Promise<LoyaltyRules & { giftCardMonths: number | null }> {
    const s = await tx.organizationSettings.findUnique({
      where: { organizationId },
      select: { loyaltyEnabled: true, loyaltyPointsPerEuro: true, loyaltyThreshold: true, loyaltyReward: true, giftCardMonths: true },
    })
    return {
      enabled: s?.loyaltyEnabled ?? false,
      pointsPerEuro: Number(s?.loyaltyPointsPerEuro ?? 1),
      threshold: s?.loyaltyThreshold ?? 100,
      reward: Number(s?.loyaltyReward ?? 5),
      giftCardMonths: s === null ? 12 : s.giftCardMonths,
    }
  }

  async updateRules(organizationId: string, dto: { enabled?: boolean; pointsPerEuro?: number; threshold?: number; reward?: number; giftCardMonths?: number | null }) {
    if (dto.threshold !== undefined && (dto.threshold < 1 || dto.threshold > 100_000)) throw new BadRequestException('Seuil de points invalide')
    if (dto.reward !== undefined && (dto.reward <= 0 || dto.reward > 1000)) throw new BadRequestException('Valeur de récompense invalide')
    if (dto.pointsPerEuro !== undefined && (dto.pointsPerEuro <= 0 || dto.pointsPerEuro > 100)) throw new BadRequestException('Points par euro invalides')
    const data = {
      ...(dto.enabled !== undefined ? { loyaltyEnabled: dto.enabled } : {}),
      ...(dto.pointsPerEuro !== undefined ? { loyaltyPointsPerEuro: new Decimal(dto.pointsPerEuro) } : {}),
      ...(dto.threshold !== undefined ? { loyaltyThreshold: dto.threshold } : {}),
      ...(dto.reward !== undefined ? { loyaltyReward: new Decimal(dto.reward) } : {}),
      ...(dto.giftCardMonths !== undefined ? { giftCardMonths: dto.giftCardMonths } : {}),
    }
    await this.prisma.organizationSettings.upsert({ where: { organizationId }, create: { organizationId, ...data }, update: data })
    return this.rules(organizationId)
  }

  // Recherche par téléphone, e-mail ou nom
  async search(organizationId: string, q: string) {
    const query = q.trim()
    if (query.length < 2) return []
    const phone = normalizePhone(query)
    // Chiffres tapés : « 0612 » doit trouver +33612..., le 0 national est retiré
    const digits = query.replace(/\D/g, '').replace(/^0+/, '')
    const rows = await this.prisma.customer.findMany({
      where: {
        organizationId,
        OR: [
          ...(phone ? [{ phone }] : []),
          ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
          { email: { contains: query.toLowerCase() } },
          { firstName: { contains: query, mode: 'insensitive' as const } },
          { lastName: { contains: query, mode: 'insensitive' as const } },
        ],
      },
      orderBy: { lastVisitAt: { sort: 'desc', nulls: 'last' } },
      take: 8,
      select: CUSTOMER_SELECT,
    })
    const rules = await this.rules(organizationId)
    return rows.map((c) => this.view(c, rules))
  }

  async create(organizationId: string, dto: CustomerInput) {
    const phone = dto.phone?.trim() ? normalizePhone(dto.phone) : null
    if (dto.phone?.trim() && !phone) throw new BadRequestException('Numéro de téléphone invalide')
    const email = dto.email?.trim().toLowerCase() || null
    if (email && !EMAIL.test(email)) throw new BadRequestException('Adresse e-mail invalide')
    if (!phone && !email) throw new BadRequestException('Téléphone ou e-mail requis')
    try {
      const c = await this.prisma.customer.create({
        data: { organizationId, phone, email, firstName: dto.firstName?.trim() || null, lastName: dto.lastName?.trim() || null, marketingOptIn: !!dto.marketingOptIn },
        select: CUSTOMER_SELECT,
      })
      return this.view(c, await this.rules(organizationId))
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') throw new ConflictException('Ce client existe déjà')
      throw e
    }
  }

  async get(organizationId: string, id: string) {
    const c = await this.prisma.customer.findFirst({
      where: { id, organizationId },
      select: { ...CUSTOMER_SELECT, entries: { orderBy: { createdAt: 'desc' }, take: 20, select: { points: true, reason: true, note: true, orderId: true, createdAt: true } } },
    })
    if (!c) throw new NotFoundException('Client introuvable')
    return { ...this.view(c, await this.rules(organizationId)), entries: c.entries }
  }

  // Droit à l'effacement (RGPD) : le client disparaît, ses ventes restent sans lui
  async remove(organizationId: string, id: string) {
    const c = await this.prisma.customer.findFirst({ where: { id, organizationId }, select: { id: true } })
    if (!c) throw new NotFoundException('Client introuvable')
    await this.prisma.$transaction([
      this.prisma.order.updateMany({ where: { customerId: id }, data: { customerId: null } }),
      this.prisma.customer.delete({ where: { id } }),
    ])
    return { deleted: true }
  }

  private view<T extends { points: number; totalSpent: Decimal }>(c: T, rules: LoyaltyRules) {
    return { ...c, totalSpent: Number(c.totalSpent), reward: rewardsAvailable(c.points, rules) }
  }

  // Dans la transaction de la vente : cartes cadeaux émises, points utilisés
  // et gagnés. Vente signée hors ligne : un écart est signalé, pas refusé.
  async applyToSale(tx: Prisma.TransactionClient, input: SaleLoyaltyInput): Promise<string[]> {
    const notes: string[] = []
    const rules = await this.rules(input.organizationId, tx)

    for (const g of input.giftCards) {
      const expiresAt = rules.giftCardMonths ? new Date(Date.now() + rules.giftCardMonths * 30.44 * 86_400_000) : null
      try {
        await tx.storeCredit.create({
          data: { organizationId: input.organizationId, code: g.code, kind: 'GIFT_CARD', initialAmount: new Decimal(g.amount), balance: new Decimal(g.amount), soldOrderId: input.orderId, expiresAt },
        })
      } catch (e) {
        if ((e as { code?: string }).code !== 'P2002') throw e
        if (input.strict) throw new ConflictException(`Code de carte cadeau déjà utilisé : ${g.code}`)
        notes.push(`Carte cadeau ${g.code} : code déjà existant, à vérifier`)
      }
    }

    if (!input.customerId) return notes
    const customer = await tx.customer.findFirst({ where: { id: input.customerId, organizationId: input.organizationId }, select: { id: true, points: true } })
    if (!customer) {
      notes.push('Client fidélité introuvable : points non crédités')
      return notes
    }
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'fidelite:' + customer.id}))`
    const current = await tx.customer.findUniqueOrThrow({ where: { id: customer.id }, select: { points: true } })
    let used = Math.max(0, Math.floor(input.pointsUsed ?? 0))
    if (used > current.points) {
      if (input.strict) throw new BadRequestException(`Points insuffisants : ${current.points} disponibles`)
      notes.push(`Fidélité : ${used} points utilisés pour ${current.points} disponibles`)
      used = current.points
    }
    const giftTotal = input.giftCards.reduce((a, g) => a + g.amount, 0)
    const earned = pointsEarned(input.paid - giftTotal, rules)
    if (used) await tx.loyaltyEntry.create({ data: { customerId: customer.id, orderId: input.orderId, points: -used, reason: 'REDEEM' } })
    if (earned) await tx.loyaltyEntry.create({ data: { customerId: customer.id, orderId: input.orderId, points: earned, reason: 'EARN' } })
    await tx.customer.update({
      where: { id: customer.id },
      data: { points: { increment: earned - used }, visits: { increment: 1 }, totalSpent: { increment: new Decimal(Math.max(0, input.paid - giftTotal)) }, lastVisitAt: new Date() },
    })
    await tx.order.update({ where: { id: input.orderId }, data: { customerId: customer.id, loyaltyPointsUsed: used || null, loyaltyPointsEarned: earned || null } })
    return notes
  }

  // Remboursement : points repris au prorata (jamais sous zéro). Les cartes
  // cadeaux ne rapportent pas de points : elles sortent des deux montants.
  async reverseForRefund(
    tx: Prisma.TransactionClient,
    sale: { id: string; customerId: string | null; loyaltyPointsEarned: number | null; total: Decimal },
    refundOrderId: string,
    amounts: { refunded: number; refundedGiftCards: number; saleGiftCards: number },
  ) {
    if (!sale.customerId || !sale.loyaltyPointsEarned) return
    const back = pointsToReverse(sale.loyaltyPointsEarned, Math.abs(amounts.refunded) - amounts.refundedGiftCards, Number(sale.total) - amounts.saleGiftCards)
    if (!back) return
    const c = await tx.customer.findUnique({ where: { id: sale.customerId }, select: { points: true } })
    if (!c) return
    const taken = Math.min(back, c.points)
    await tx.loyaltyEntry.create({ data: { customerId: sale.customerId, orderId: refundOrderId, points: -taken, reason: 'REFUND' } })
    await tx.customer.update({ where: { id: sale.customerId }, data: { points: { decrement: taken } } })
  }
}

// Cartes cadeaux vendues dans une vente : lignes du produit technique, code dans le nom
export function giftCardsOf(items: Array<{ name: string; price: number; quantity: number; isGiftCard?: boolean }>) {
  return items
    .filter((i) => i.isGiftCard)
    .map((i) => ({ code: i.name.match(GIFT_CARD_CODE)?.[0] ?? '', amount: Math.round(i.price * i.quantity * 100) / 100 }))
    .filter((g) => g.code)
}
