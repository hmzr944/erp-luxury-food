import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { PrismaService } from '../common/prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { applyStockDelta, consumeLotsFefo } from '../stock/stock-adjust'
import { CORRECTION_REASONS, frDate, gap, type CorrectionReason } from '../stock/stock-rules'
import { lineGap, summarize } from './inventory-plan'
import type { CountLineDto } from './inventory.dto'

const num = (d: Decimal | null) => (d === null ? null : Number(d))

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // Historique : les inventaires les plus récents, avec leur bilan
  async list(siteId: string) {
    const counts = await this.prisma.inventoryCount.findMany({
      where: { siteId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { lines: { select: { expectedQty: true, countedQty: true } } },
    })
    return counts.map(({ lines, ...c }) => ({
      ...c,
      summary: summarize(lines.map((l) => ({ expectedQty: Number(l.expectedQty), countedQty: num(l.countedQty) }))),
    }))
  }

  async get(siteId: string, id: string) {
    const count = await this.prisma.inventoryCount.findFirst({
      where: { id, siteId },
      include: { lines: { orderBy: [{ name: 'asc' }, { id: 'asc' }] } },
    })
    if (!count) throw new NotFoundException('Inventaire introuvable')
    const lines = count.lines.map((l) => ({
      ...l,
      gap: lineGap({ expectedQty: Number(l.expectedQty), countedQty: num(l.countedQty) }),
    }))
    return { ...count, lines, summary: summarize(lines.map((l) => ({ expectedQty: Number(l.expectedQty), countedQty: num(l.countedQty) }))) }
  }

  // Le brouillon du site, s'il y en a un
  async current(siteId: string) {
    const draft = await this.prisma.inventoryCount.findFirst({ where: { siteId, status: 'DRAFT' }, select: { id: true } })
    return draft ? this.get(siteId, draft.id) : null
  }

  // Démarre un inventaire : instantané du stock du site, tout le catalogue
  // ou une catégorie. Un seul brouillon par site.
  async start(siteId: string, input: { categoryId?: string }, userId?: string) {
    const existing = await this.prisma.inventoryCount.findFirst({ where: { siteId, status: 'DRAFT' }, select: { id: true } })
    if (existing) throw new ConflictException("Un inventaire est déjà en cours sur ce site : validez-le ou annulez-le d'abord")

    let categoryName: string | null = null
    if (input.categoryId) {
      const cat = await this.prisma.category.findFirst({ where: { id: input.categoryId, siteId }, select: { name: true } })
      if (!cat) throw new NotFoundException('Catégorie introuvable sur ce site')
      categoryName = cat.name
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const products = await tx.product.findMany({
            where: {
              siteId, isActive: true, isCustom: false, isGiftCard: false, isMenu: false,
              ...(input.categoryId ? { categoryId: input.categoryId } : {}),
            },
            select: {
              id: true, name: true, sku: true, barcode: true, soldByWeight: true,
              stockItem: { select: { quantity: true, unit: true } },
              variants: {
                where: { isActive: true },
                orderBy: { position: 'asc' },
                select: { id: true, name: true, sku: true, barcode: true, stock: { select: { quantity: true } } },
              },
            },
            orderBy: { name: 'asc' },
          })

          const lines: Prisma.InventoryCountLineCreateManyInput[] = []
          for (const p of products) {
            const unit = p.stockItem?.unit ?? (p.soldByWeight ? 'kg' : 'unité')
            if (p.variants.length) {
              for (const v of p.variants) {
                lines.push({
                  countId: '', productId: p.id, variantId: v.id, name: `${p.name} (${v.name})`,
                  sku: v.sku ?? p.sku, barcode: v.barcode ?? p.barcode, unit,
                  expectedQty: v.stock?.quantity ?? new Decimal(0),
                })
              }
            } else {
              lines.push({
                countId: '', productId: p.id, variantId: null, name: p.name, sku: p.sku, barcode: p.barcode, unit,
                expectedQty: p.stockItem?.quantity ?? new Decimal(0),
              })
            }
          }
          if (!lines.length) throw new BadRequestException('Aucun produit à compter')

          const count = await tx.inventoryCount.create({
            data: {
              siteId, status: 'DRAFT', openKey: siteId, categoryId: input.categoryId ?? null, categoryName, createdById: userId ?? null,
            },
          })
          await tx.inventoryCountLine.createMany({ data: lines.map((l) => ({ ...l, countId: count.id })) })
          return count
        },
        { timeout: 60_000, maxWait: 10_000 },
      ).then((c) => this.get(siteId, c.id))
    } catch (e) {
      // Deux démarrages simultanés : la clé unique du brouillon départage
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException("Un inventaire est déjà en cours sur ce site : validez-le ou annulez-le d'abord")
      }
      throw e
    }
  }

  // Saisie d'une quantité comptée (ou remise à « non comptée »), motif et note
  async countLine(siteId: string, id: string, lineId: string, dto: CountLineDto) {
    const count = await this.prisma.inventoryCount.findFirst({ where: { id, siteId }, select: { status: true } })
    if (!count) throw new NotFoundException('Inventaire introuvable')
    if (count.status !== 'DRAFT') throw new ConflictException(lockedMessage(count.status))

    const data: Prisma.InventoryCountLineUpdateManyMutationInput = {}
    if (dto.countedQty !== undefined) data.countedQty = dto.countedQty === null ? null : new Decimal(dto.countedQty)
    if (dto.reasonCode !== undefined) data.reasonCode = dto.reasonCode || null
    if (dto.note !== undefined) data.note = dto.note.trim() || null
    // La garde sur le statut ferme la porte à une saisie arrivée pendant la validation
    const res = await this.prisma.inventoryCountLine.updateMany({
      where: { id: lineId, countId: id, count: { status: 'DRAFT' } },
      data,
    })
    if (res.count === 0) throw new NotFoundException('Ligne introuvable dans cet inventaire')
    const line = await this.prisma.inventoryCountLine.findUniqueOrThrow({ where: { id: lineId } })
    return { ...line, gap: lineGap({ expectedQty: Number(line.expectedQty), countedQty: num(line.countedQty) }) }
  }

  // Écrit les écarts en mouvements ADJUSTMENT, en une transaction : tout
  // passe ou rien. L'inventaire validé ne peut plus être modifié.
  // L'écart (compté moins attendu au démarrage) est appliqué en relatif :
  // les ventes faites pendant le comptage ne sont pas effacées.
  async validate(siteId: string, id: string, ctx: { userId?: string; organizationId: string | null }) {
    const site = await this.prisma.site.findUnique({ where: { id: siteId }, select: { timezone: true } })
    const now = new Date()
    const label = `Inventaire du ${frDate(now, site?.timezone ?? 'Europe/Paris')}`

    const result = await this.prisma.$transaction(
      async (tx) => {
        const locked = await tx.inventoryCount.updateMany({
          where: { id, siteId, status: 'DRAFT' },
          data: { status: 'VALIDATED', validatedAt: now, validatedById: ctx.userId ?? null, openKey: null },
        })
        if (locked.count === 0) {
          const found = await tx.inventoryCount.findFirst({ where: { id, siteId }, select: { status: true } })
          if (!found) throw new NotFoundException('Inventaire introuvable')
          throw new ConflictException(lockedMessage(found.status))
        }

        const lines = await tx.inventoryCountLine.findMany({ where: { countId: id } })
        let adjusted = 0
        for (const l of lines) {
          if (l.countedQty === null) continue
          const g = gap(Number(l.countedQty), Number(l.expectedQty))
          if (g === 0) continue
          const target = { siteId, productId: l.productId, variantId: l.variantId }
          const delta = new Decimal(g)
          const { before, after } = await applyStockDelta(tx, target, delta)
          const applied = after.sub(before)
          if (applied.isZero()) continue
          const lotId = applied.isNeg() ? await consumeLotsFefo(tx, target, applied.abs()) : null
          const code = l.reasonCode as CorrectionReason | null
          const detail = [code && code in CORRECTION_REASONS ? CORRECTION_REASONS[code] : null, l.note].filter(Boolean).join(' : ')
          await tx.stockMovement.create({
            data: {
              siteId, productId: l.productId, variantId: l.variantId, lotId,
              type: 'ADJUSTMENT', quantity: applied,
              reason: detail ? `${label} (${detail})` : label,
              reasonCode: code, inventoryCountId: id, userId: ctx.userId,
            },
          })
          adjusted++
        }
        const summary = summarize(lines.map((l) => ({ expectedQty: Number(l.expectedQty), countedQty: num(l.countedQty) })))
        return { adjusted, summary }
      },
      { timeout: 120_000, maxWait: 10_000 },
    )

    await this.audit.log({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'inventory.validated',
      target: id,
      detail: `${label} : ${result.summary.counted} ligne(s) comptée(s) sur ${result.summary.total}, ${result.adjusted} correction(s), surplus ${result.summary.surplus}, manquants ${result.summary.missing}`,
    })
    return { ...(await this.get(siteId, id)), adjusted: result.adjusted }
  }

  // Annule un brouillon : rien n'est écrit dans le stock
  async cancel(siteId: string, id: string, ctx: { userId?: string; organizationId: string | null }) {
    const res = await this.prisma.inventoryCount.updateMany({
      where: { id, siteId, status: 'DRAFT' },
      data: { status: 'CANCELLED', cancelledAt: new Date(), openKey: null },
    })
    if (res.count === 0) {
      const found = await this.prisma.inventoryCount.findFirst({ where: { id, siteId }, select: { status: true } })
      if (!found) throw new NotFoundException('Inventaire introuvable')
      throw new ConflictException(lockedMessage(found.status))
    }
    await this.audit.log({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'inventory.cancelled', target: id })
    return this.get(siteId, id)
  }
}

function lockedMessage(status: string) {
  return status === 'VALIDATED'
    ? 'Inventaire validé : il ne peut plus être modifié'
    : 'Inventaire annulé : il ne peut plus être modifié'
}
