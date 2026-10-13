import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Decimal } from '@prisma/client/runtime/library'
import type { Prisma, SupplyStatus } from '@prisma/client'
import { PrismaService } from '../common/prisma/prisma.service'
import { addDays, cutoffFor, localDay, matchProduct, matchVariant, nextDelivery, suggestQuantity } from './supply-plan'

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const num = (d: Decimal | null | undefined) => (d == null ? null : Number(d))
const dayDate = (day: string) => new Date(`${day}T00:00:00Z`)
const dayOf = (d: Date) => d.toISOString().slice(0, 10)

const ORDER_INCLUDE = {
  lines: { orderBy: { name: 'asc' } },
  fromSite: { select: { id: true, name: true } },
  toSite: { select: { id: true, name: true } },
} satisfies Prisma.SupplyOrderInclude

type OrderWithLines = Prisma.SupplyOrderGetPayload<{ include: typeof ORDER_INCLUDE }>

export interface DraftLineInput {
  productId: string
  variantId?: string | null
  quantity: number
  // Quantité proposée par le calcul, gardée pour mesurer l'écart
  suggested?: number | null
}

// Commandes internes : la boutique commande au labo (ou au dépôt), le labo
// voit le total à produire, prépare, expédie ; la boutique réceptionne et son
// stock est crédité. Chaque étape est un statut, rien ne passe par e-mail.
@Injectable()
export class SupplyService {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
  ) {}

  // ---------- Réglages ----------

  async updateSettings(siteId: string, dto: { isSupplier?: boolean; orderCutoff?: string; leadDays?: number }) {
    return this.prisma.site.update({
      where: { id: siteId },
      data: dto,
      select: { id: true, name: true, isSupplier: true, orderCutoff: true, leadDays: true },
    })
  }

  async catalog(siteId: string) {
    await this.supplierSite(siteId)
    const products = await this.prisma.product.findMany({
      where: { siteId, isActive: true, isCustom: false },
      select: { id: true, name: true, price: true, orderable: true, supplyPrice: true, supplyUnit: true, variants: { where: { isActive: true }, select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    })
    return products.map((p) => ({ ...p, price: Number(p.price), supplyPrice: num(p.supplyPrice) }))
  }

  async updateCatalogItem(siteId: string, productId: string, dto: { orderable?: boolean; supplyPrice?: number | null; supplyUnit?: string | null }) {
    await this.supplierSite(siteId)
    const product = await this.prisma.product.findFirst({ where: { id: productId, siteId }, select: { id: true } })
    if (!product) throw new NotFoundException('Produit introuvable')
    return this.prisma.product.update({
      where: { id: productId },
      data: {
        ...(dto.orderable !== undefined ? { orderable: dto.orderable } : {}),
        ...(dto.supplyPrice !== undefined ? { supplyPrice: dto.supplyPrice == null ? null : new Decimal(dto.supplyPrice) } : {}),
        ...(dto.supplyUnit !== undefined ? { supplyUnit: dto.supplyUnit?.trim() || null } : {}),
      },
      select: { id: true, orderable: true, supplyPrice: true, supplyUnit: true },
    })
  }

  // ---------- Côté boutique ----------

  async suppliers(siteId: string) {
    const site = await this.prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { organizationId: true } })
    const sites = await this.prisma.site.findMany({
      where: { organizationId: site.organizationId, isSupplier: true, id: { not: siteId } },
      select: { id: true, name: true, orderCutoff: true, leadDays: true, timezone: true, _count: { select: { products: { where: { orderable: true, isActive: true } } } } },
      orderBy: { name: 'asc' },
    })
    const now = new Date()
    return sites.map((s) => ({
      id: s.id,
      name: s.name,
      orderCutoff: s.orderCutoff,
      leadDays: s.leadDays,
      products: s._count.products,
      ...nextDelivery(now, s.orderCutoff, s.leadDays, s.timezone),
    }))
  }

  // Bon de commande pour la prochaine livraison : celui déjà commencé, sinon
  // un brouillon pré-rempli à partir des ventes. Rien n'est enregistré tant
  // que la boutique n'a pas touché « Enregistrer » ou « Envoyer ».
  async draft(siteId: string, supplierId: string, requestedDay?: string) {
    const supplier = await this.supplierFor(siteId, supplierId)
    const now = new Date()
    const next = nextDelivery(now, supplier.orderCutoff, supplier.leadDays, supplier.timezone)
    const deliveryDay = requestedDay && DAY_RE.test(requestedDay) ? requestedDay : next.deliveryDay
    const cutoffAt = cutoffFor(deliveryDay, supplier.orderCutoff, supplier.leadDays, supplier.timezone)

    const existing = await this.prisma.supplyOrder.findUnique({
      where: { fromSiteId_toSiteId_deliveryDate: { fromSiteId: siteId, toSiteId: supplier.id, deliveryDate: dayDate(deliveryDay) } },
      include: ORDER_INCLUDE,
    })
    const offer = await this.offer(supplier.id)
    const shop = await this.shopCatalog(siteId)
    const weekday = dayDate(deliveryDay).getUTCDay()

    const lines = await Promise.all(
      offer.map(async (item) => {
        const match = this.match(item, shop)
        const saved = existing?.lines.find((l) => l.productId === item.productId && (l.variantId ?? null) === item.variantId)
        const suggestion = await this.suggest(siteId, supplier.id, item, match, deliveryDay, weekday, supplier.timezone)
        return {
          ...item,
          shopProductId: match?.productId ?? null,
          suggested: suggestion.quantity,
          reason: match ? suggestion.reason : "Absent du catalogue de la boutique : stock non crédité à la réception",
          ordered: saved ? Number(saved.ordered) : suggestion.quantity,
        }
      }),
    )

    return {
      supplier: { id: supplier.id, name: supplier.name },
      deliveryDay,
      cutoffAt,
      // Heure de clôture telle que le labo l'a fixée, jour et heure locaux
      cutoffLocal: { day: addDays(deliveryDay, -supplier.leadDays), time: supplier.orderCutoff },
      editable: now < cutoffAt && (!existing || existing.status === 'DRAFT' || existing.status === 'SENT'),
      order: existing ? this.view(existing) : null,
      lines,
    }
  }

  async save(siteId: string, userId: string, dto: { supplierId: string; deliveryDay: string; lines: DraftLineInput[]; note?: string; send: boolean }) {
    const supplier = await this.supplierFor(siteId, dto.supplierId)
    if (!DAY_RE.test(dto.deliveryDay)) throw new BadRequestException('Date de livraison invalide')
    const cutoffAt = cutoffFor(dto.deliveryDay, supplier.orderCutoff, supplier.leadDays, supplier.timezone)
    if (new Date() >= cutoffAt) {
      throw new BadRequestException(`Commande close depuis ${supplier.orderCutoff} : appelez ${supplier.name} pour un ajout`)
    }
    const offer = new Map((await this.offer(supplier.id)).map((o) => [`${o.productId}:${o.variantId ?? ''}`, o]))
    const lines = dto.lines.filter((l) => l.quantity > 0)
    for (const l of lines) {
      if (!offer.has(`${l.productId}:${l.variantId ?? ''}`)) throw new BadRequestException('Un produit ne fait plus partie de l’offre du labo')
      if (!(l.quantity <= 100_000)) throw new BadRequestException('Quantité invalide')
    }
    if (dto.send && !lines.length) throw new BadRequestException('Commande vide')

    const order = await this.prisma.$transaction(async (tx) => {
      const site = await tx.site.findUniqueOrThrow({ where: { id: siteId }, select: { organizationId: true } })
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'supply:' + site.organizationId}))`
      const key = { fromSiteId: siteId, toSiteId: supplier.id, deliveryDate: dayDate(dto.deliveryDay) }
      let current = await tx.supplyOrder.findUnique({ where: { fromSiteId_toSiteId_deliveryDate: key }, include: { lines: true } })
      if (current && current.status !== 'DRAFT' && current.status !== 'SENT') {
        throw new ConflictException(`${supplier.name} a déjà lancé la fabrication de cette commande`)
      }
      if (!current) {
        const last = await tx.supplyOrder.aggregate({ where: { organizationId: site.organizationId }, _max: { number: true } })
        current = await tx.supplyOrder.create({
          data: { ...key, organizationId: site.organizationId, number: (last._max.number ?? 0) + 1, createdById: userId },
          include: { lines: true },
        })
      }
      const previous = new Map(current.lines.map((l) => [`${l.productId}:${l.variantId ?? ''}`, l.suggested]))
      await tx.supplyOrderLine.deleteMany({ where: { orderId: current.id } })
      await tx.supplyOrderLine.createMany({
        data: lines.map((l) => {
          const o = offer.get(`${l.productId}:${l.variantId ?? ''}`)!
          return {
            orderId: current!.id,
            productId: l.productId,
            variantId: l.variantId ?? null,
            name: o.name,
            variantName: o.variantName,
            unit: o.unit,
            unitPrice: o.unitPrice == null ? null : new Decimal(o.unitPrice),
            suggested: l.suggested != null ? new Decimal(l.suggested) : (previous.get(`${l.productId}:${l.variantId ?? ''}`) ?? null),
            ordered: new Decimal(l.quantity),
          }
        }),
      })
      return tx.supplyOrder.update({
        where: { id: current.id },
        data: {
          note: dto.note?.trim() || null,
          ...(dto.send ? { status: 'SENT' as SupplyStatus, sentAt: current.sentAt ?? new Date() } : {}),
        },
        include: ORDER_INCLUDE,
      })
    })
    this.notify(order)
    return this.view(order)
  }

  async outgoing(siteId: string) {
    const orders = await this.prisma.supplyOrder.findMany({
      where: { fromSiteId: siteId },
      include: ORDER_INCLUDE,
      orderBy: [{ deliveryDate: 'desc' }, { number: 'desc' }],
      take: 60,
    })
    return orders.map((o) => this.view(o))
  }

  // Ce que la caisse doit signaler : livraison arrivée, ajustement du labo,
  // commande de demain pas encore envoyée à l'approche de la clôture
  async inbox(siteId: string) {
    const toReceive = await this.prisma.supplyOrder.findMany({
      where: { fromSiteId: siteId, status: 'SHIPPED' },
      include: ORDER_INCLUDE,
      orderBy: { deliveryDate: 'asc' },
    })
    const reminders: Array<{ supplierId: string; supplierName: string; deliveryDay: string; cutoffAt: Date }> = []
    const now = new Date()
    for (const s of await this.suppliers(siteId)) {
      if (!s.products) continue
      const msLeft = s.cutoffAt.getTime() - now.getTime()
      if (msLeft > 3 * 3_600_000) continue
      const sent = await this.prisma.supplyOrder.findFirst({
        where: { fromSiteId: siteId, toSiteId: s.id, deliveryDate: dayDate(s.deliveryDay), status: { not: 'DRAFT' } },
        select: { id: true },
      })
      if (!sent) reminders.push({ supplierId: s.id, supplierName: s.name, deliveryDay: s.deliveryDay, cutoffAt: s.cutoffAt })
    }
    return { toReceive: toReceive.map((o) => this.view(o)), reminders, alerts: await this.alerts(siteId) }
  }

  async receive(siteId: string, orderId: string, userId: string, dto: { lines?: Array<{ lineId: string; received: number; issue?: string }>; note?: string }) {
    const order = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'supply-order:' + orderId}))`
      const o = await tx.supplyOrder.findFirst({ where: { id: orderId, fromSiteId: siteId }, include: { lines: true } })
      if (!o) throw new NotFoundException('Commande introuvable')
      if (o.status === 'RECEIVED') throw new ConflictException('Livraison déjà réceptionnée')
      if (o.status !== 'SHIPPED') throw new BadRequestException("Le labo n'a pas encore expédié cette commande")
      const changes = new Map((dto.lines ?? []).map((l) => [l.lineId, l]))
      const shop = await this.shopCatalog(siteId, tx)

      for (const line of o.lines) {
        const sent = Number(line.prepared ?? line.ordered)
        const c = changes.get(line.id)
        const received = c ? Math.max(0, c.received) : sent
        await tx.supplyOrderLine.update({
          where: { id: line.id },
          data: { received: new Decimal(received), issue: c?.issue?.trim() || (received < sent ? `${fmt(sent - received)} manquant` : null) },
        })
        if (received <= 0) continue
        const source = await this.prisma.product.findUnique({
          where: { id: line.productId },
          select: { sku: true, barcode: true, variants: { where: { id: line.variantId ?? '' }, select: { sku: true } } },
        })
        const match = this.match(
          { productId: line.productId, variantId: line.variantId, name: line.name, variantName: line.variantName, sku: source?.sku, barcode: source?.barcode, variantSku: source?.variants[0]?.sku },
          shop,
        )
        if (!match) continue
        const qty = new Decimal(received)
        if (match.variantId) {
          await tx.variantStock.upsert({
            where: { variantId: match.variantId },
            create: { variantId: match.variantId, siteId, quantity: qty },
            update: { quantity: { increment: qty } },
          })
        } else {
          await tx.stockItem.upsert({
            where: { productId: match.productId },
            create: { productId: match.productId, siteId, quantity: qty },
            update: { quantity: { increment: qty } },
          })
        }
        await tx.stockMovement.create({
          data: { siteId, productId: match.productId, variantId: match.variantId, type: 'RESTOCK', quantity: qty, reason: `Livraison interne n° ${o.number}`, userId },
        })
      }
      return tx.supplyOrder.update({
        where: { id: o.id },
        data: { status: 'RECEIVED', receivedAt: new Date(), receiptNote: dto.note?.trim() || null },
        include: ORDER_INCLUDE,
      })
    })
    this.notify(order)
    return this.view(order)
  }

  // ---------- Côté labo / dépôt ----------

  // Le « totalisateur » : tout ce qu'il faut produire pour un jour de
  // livraison, avec le détail par boutique, et qui n'a pas encore commandé
  async production(siteId: string, requestedDay?: string) {
    const supplier = await this.supplierSite(siteId)
    const now = new Date()
    // Par défaut : la prochaine livraison qui a des commandes à produire
    const today = localDay(now, supplier.timezone)
    const pending = await this.prisma.supplyOrder.findFirst({
      where: { toSiteId: siteId, status: { in: ['SENT', 'IN_PRODUCTION'] }, deliveryDate: { gte: dayDate(today) } },
      orderBy: { deliveryDate: 'asc' },
      select: { deliveryDate: true },
    })
    const day =
      requestedDay && DAY_RE.test(requestedDay)
        ? requestedDay
        : pending
          ? dayOf(pending.deliveryDate)
          : nextDelivery(now, supplier.orderCutoff, supplier.leadDays, supplier.timezone).deliveryDay
    const orders = await this.prisma.supplyOrder.findMany({
      where: { toSiteId: siteId, deliveryDate: dayDate(day), status: { notIn: ['DRAFT', 'CANCELLED'] } },
      include: ORDER_INCLUDE,
      orderBy: { fromSite: { name: 'asc' } },
    })
    const totals = new Map<string, { productId: string; variantId: string | null; name: string; variantName: string | null; unit: string | null; total: number; prepared: number; bySite: Array<{ siteId: string; siteName: string; quantity: number }> }>()
    for (const o of orders) {
      for (const l of o.lines) {
        const key = `${l.productId}:${l.variantId ?? ''}`
        const t = totals.get(key) ?? { productId: l.productId, variantId: l.variantId, name: l.name, variantName: l.variantName, unit: l.unit, total: 0, prepared: 0, bySite: [] }
        t.total += Number(l.ordered)
        t.prepared += Number(l.prepared ?? l.ordered)
        t.bySite.push({ siteId: o.fromSiteId, siteName: o.fromSite.name, quantity: Number(l.ordered) })
        totals.set(key, t)
      }
    }
    const shops = await this.prisma.site.findMany({
      where: { organizationId: supplier.organizationId, isSupplier: false },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    const ordered = new Set(orders.map((o) => o.fromSiteId))
    return {
      day,
      cutoffAt: cutoffFor(day, supplier.orderCutoff, supplier.leadDays, supplier.timezone),
      cutoffLocal: { day: addDays(day, -supplier.leadDays), time: supplier.orderCutoff },
      orders: orders.map((o) => this.view(o)),
      consolidated: [...totals.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      waitingFor: shops.filter((s) => !ordered.has(s.id)),
    }
  }

  async startProduction(siteId: string, day: string) {
    await this.supplierSite(siteId)
    if (!DAY_RE.test(day)) throw new BadRequestException('Date invalide')
    const orders = await this.prisma.supplyOrder.findMany({ where: { toSiteId: siteId, deliveryDate: dayDate(day), status: 'SENT' }, include: ORDER_INCLUDE })
    await this.prisma.supplyOrder.updateMany({
      where: { id: { in: orders.map((o) => o.id) } },
      data: { status: 'IN_PRODUCTION', productionAt: new Date() },
    })
    for (const o of orders) this.notify({ ...o, status: 'IN_PRODUCTION' })
    return { started: orders.length }
  }

  // Colis prêt : quantités réellement préparées ; un manque est visible tout
  // de suite côté boutique
  async ship(siteId: string, orderId: string, userId: string, dto: { lines?: Array<{ lineId: string; prepared: number }> }) {
    await this.supplierSite(siteId)
    const order = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'supply-order:' + orderId}))`
      const o = await tx.supplyOrder.findFirst({ where: { id: orderId, toSiteId: siteId }, include: { lines: true } })
      if (!o) throw new NotFoundException('Commande introuvable')
      if (o.status !== 'SENT' && o.status !== 'IN_PRODUCTION') throw new ConflictException('Commande déjà expédiée')
      const changes = new Map((dto.lines ?? []).map((l) => [l.lineId, Math.max(0, l.prepared)]))
      for (const line of o.lines) {
        const prepared = changes.get(line.id) ?? Number(line.ordered)
        await tx.supplyOrderLine.update({ where: { id: line.id }, data: { prepared: new Decimal(prepared) } })
        if (prepared <= 0) continue
        // Sortie du stock du labo s'il est suivi
        const qty = new Decimal(prepared)
        const tracked = line.variantId
          ? await tx.variantStock.updateMany({ where: { variantId: line.variantId }, data: { quantity: { decrement: qty } } })
          : await tx.stockItem.updateMany({ where: { productId: line.productId }, data: { quantity: { decrement: qty } } })
        if (tracked.count) {
          await tx.stockMovement.create({
            data: { siteId, productId: line.productId, variantId: line.variantId, type: 'TRANSFER', quantity: qty.neg(), reason: `Livraison interne n° ${o.number}`, userId },
          })
        }
      }
      return tx.supplyOrder.update({
        where: { id: o.id },
        data: { status: 'SHIPPED', shippedAt: new Date(), productionAt: o.productionAt ?? new Date() },
        include: ORDER_INCLUDE,
      })
    })
    this.notify(order)
    return this.view(order)
  }

  // Cessions internes du mois : ce que chaque boutique doit au labo, au prix
  // de cession, sur les quantités réceptionnées
  async statement(siteId: string, month: string) {
    await this.supplierSite(siteId)
    if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException('Mois invalide')
    const from = new Date(`${month}-01T00:00:00Z`)
    const to = new Date(from)
    to.setUTCMonth(to.getUTCMonth() + 1)
    const orders = await this.prisma.supplyOrder.findMany({
      where: { toSiteId: siteId, status: 'RECEIVED', deliveryDate: { gte: from, lt: to } },
      include: ORDER_INCLUDE,
    })
    const bySite = new Map<string, { siteId: string; siteName: string; orders: number; amount: number; unpriced: number }>()
    for (const o of orders) {
      const s = bySite.get(o.fromSiteId) ?? { siteId: o.fromSiteId, siteName: o.fromSite.name, orders: 0, amount: 0, unpriced: 0 }
      s.orders++
      for (const l of o.lines) {
        if (l.unitPrice == null) s.unpriced++
        else s.amount += Number(l.unitPrice) * Number(l.received ?? l.prepared ?? l.ordered)
      }
      bySite.set(o.fromSiteId, s)
    }
    const rows = [...bySite.values()].map((r) => ({ ...r, amount: Math.round(r.amount * 100) / 100 }))
    return { month, rows, total: Math.round(rows.reduce((a, r) => a + r.amount, 0) * 100) / 100 }
  }

  // ---------- Alertes du labo à tout le réseau ----------

  // « Pénurie de fraises : tartes aux fraises réduites de 50 % » en un geste
  async createAlert(siteId: string, userId: string, dto: { cause?: string; productName?: string; reductionPct?: number; message?: string; day?: string }) {
    const labo = await this.supplierSite(siteId)
    const day = dto.day && DAY_RE.test(dto.day) ? dto.day : localDay(new Date(), labo.timezone)
    const effect = dto.productName
      ? dto.reductionPct === 100
        ? `${dto.productName} non produit`
        : `${dto.productName} réduit de ${dto.reductionPct ?? 50} %`
      : null
    const message = dto.message?.trim() || [dto.cause?.trim(), effect].filter(Boolean).join(' : ')
    if (!message) throw new BadRequestException('Décrivez le problème ou choisissez un produit')
    const alert = await this.prisma.supplyAlert.create({
      data: {
        organizationId: labo.organizationId,
        siteId,
        siteName: labo.name,
        day: dayDate(day),
        productName: dto.productName?.trim() || null,
        reductionPct: dto.productName ? (dto.reductionPct ?? 50) : null,
        message,
        createdById: userId,
      },
    })
    const sites = await this.prisma.site.findMany({ where: { organizationId: labo.organizationId }, select: { id: true } })
    this.events.emit('supply.updated', { siteIds: sites.map((x) => x.id), orderId: alert.id, status: 'ALERT' })
    return this.alertView(alert)
  }

  // Alertes en cours : celles du jour et des livraisons à venir
  async alerts(siteId: string) {
    const site = await this.prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { organizationId: true, isSupplier: true, timezone: true } })
    const today = localDay(new Date(), site.timezone)
    const list = await this.prisma.supplyAlert.findMany({
      where: { organizationId: site.organizationId, day: { gte: dayDate(today) }, ...(site.isSupplier ? { siteId } : {}) },
      orderBy: [{ day: 'asc' }, { createdAt: 'desc' }],
    })
    return list.map((a) => this.alertView(a))
  }

  async deleteAlert(siteId: string, id: string) {
    await this.supplierSite(siteId)
    const r = await this.prisma.supplyAlert.deleteMany({ where: { id, siteId } })
    if (!r.count) throw new NotFoundException('Alerte introuvable')
    return { deleted: true }
  }

  private alertView(a: { id: string; siteId: string; siteName: string; day: Date; productName: string | null; reductionPct: number | null; message: string; createdAt: Date }) {
    return { id: a.id, siteId: a.siteId, siteName: a.siteName, day: dayOf(a.day), productName: a.productName, reductionPct: a.reductionPct, message: a.message, createdAt: a.createdAt }
  }

  // ---------- Outils ----------

  view(o: OrderWithLines) {
    const lines = o.lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      variantId: l.variantId,
      name: l.name,
      variantName: l.variantName,
      unit: l.unit,
      unitPrice: num(l.unitPrice),
      suggested: num(l.suggested),
      ordered: Number(l.ordered),
      prepared: num(l.prepared),
      received: num(l.received),
      issue: l.issue,
    }))
    const qty = (l: (typeof lines)[number]) => l.received ?? l.prepared ?? l.ordered
    return {
      id: o.id,
      number: o.number,
      status: o.status,
      deliveryDay: dayOf(o.deliveryDate),
      fromSite: o.fromSite,
      toSite: o.toSite,
      note: o.note,
      receiptNote: o.receiptNote,
      sentAt: o.sentAt,
      shippedAt: o.shippedAt,
      receivedAt: o.receivedAt,
      lines,
      // Écarts du labo, pour prévenir la boutique avant l'arrivée du camion
      shortages: lines
        .filter((l) => l.prepared != null && l.prepared < l.ordered)
        .map((l) => ({ name: l.variantName ? `${l.name} ${l.variantName}` : l.name, ordered: l.ordered, prepared: l.prepared! })),
      amount: Math.round(lines.reduce((a, l) => a + (l.unitPrice ?? 0) * qty(l), 0) * 100) / 100,
    }
  }

  private notify(o: { fromSiteId: string; toSiteId: string; id: string; status: string }) {
    this.events.emit('supply.updated', { siteIds: [o.fromSiteId, o.toSiteId], orderId: o.id, status: o.status })
  }

  private async supplierSite(siteId: string) {
    const site = await this.prisma.site.findUniqueOrThrow({
      where: { id: siteId },
      select: { id: true, name: true, organizationId: true, isSupplier: true, orderCutoff: true, leadDays: true, timezone: true },
    })
    if (!site.isSupplier) throw new BadRequestException("Ce site n'est pas déclaré comme labo ou dépôt (Paramètres, Sites)")
    return site
  }

  private async supplierFor(siteId: string, supplierId: string) {
    const [shop, supplier] = await Promise.all([
      this.prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { organizationId: true } }),
      this.prisma.site.findUnique({
        where: { id: supplierId },
        select: { id: true, name: true, organizationId: true, isSupplier: true, orderCutoff: true, leadDays: true, timezone: true },
      }),
    ])
    if (!supplier || supplier.organizationId !== shop.organizationId || !supplier.isSupplier || supplier.id === siteId) {
      throw new NotFoundException('Labo ou dépôt introuvable')
    }
    return supplier
  }

  // Offre du labo : une ligne par produit, ou par variante s'il en a
  private async offer(supplierId: string) {
    const products = await this.prisma.product.findMany({
      where: { siteId: supplierId, orderable: true, isActive: true },
      select: {
        id: true, name: true, sku: true, barcode: true, supplyPrice: true, supplyUnit: true,
        variants: { where: { isActive: true }, select: { id: true, name: true, sku: true }, orderBy: { name: 'asc' } },
        category: { select: { name: true } },
      },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    })
    return products.flatMap((p) => {
      const base = { productId: p.id, name: p.name, sku: p.sku, barcode: p.barcode, unit: p.supplyUnit, unitPrice: num(p.supplyPrice), category: p.category?.name ?? null }
      return p.variants.length
        ? p.variants.map((v) => ({ ...base, variantId: v.id as string | null, variantName: v.name as string | null, variantSku: v.sku }))
        : [{ ...base, variantId: null as string | null, variantName: null as string | null, variantSku: null as string | null }]
    })
  }

  private async shopCatalog(siteId: string, tx: Prisma.TransactionClient = this.prisma) {
    const products = await tx.product.findMany({
      where: { siteId, isCustom: false },
      select: {
        id: true, name: true, sku: true, barcode: true,
        variants: { select: { id: true, name: true, sku: true } },
        stockItem: { select: { quantity: true } },
      },
    })
    const variantStock = await tx.variantStock.findMany({ where: { siteId }, select: { variantId: true, quantity: true } })
    const vs = new Map(variantStock.map((v) => [v.variantId, Number(v.quantity)]))
    return products.map((p) => ({
      ...p,
      stock: p.stockItem ? Number(p.stockItem.quantity) : null,
      variants: p.variants.map((v) => ({ ...v, stock: vs.has(v.id) ? vs.get(v.id)! : null })),
    }))
  }

  private match(
    item: { productId: string; variantId: string | null; name: string; variantName: string | null; sku?: string | null; barcode?: string | null; variantSku?: string | null },
    shop: Awaited<ReturnType<SupplyService['shopCatalog']>>,
  ): { productId: string; variantId: string | null; stock: number | null } | null {
    const product = matchProduct({ id: item.productId, name: item.name, sku: item.sku ?? null, barcode: item.barcode ?? null }, shop)
    if (!product) return null
    if (!item.variantName) return { productId: product.id, variantId: null, stock: product.stock }
    const variant = matchVariant({ name: item.variantName, sku: item.variantSku ?? null }, product.variants)
    return variant ? { productId: product.id, variantId: variant.id, stock: variant.stock } : null
  }

  private async suggest(
    siteId: string,
    supplierId: string,
    item: { productId: string; variantId: string | null },
    match: { productId: string; variantId: string | null; stock: number | null } | null,
    deliveryDay: string,
    weekday: number,
    timeZone: string,
  ) {
    const last = await this.prisma.supplyOrderLine.findFirst({
      where: { productId: item.productId, variantId: item.variantId, order: { fromSiteId: siteId, toSiteId: supplierId, status: { not: 'DRAFT' } } },
      orderBy: { order: { deliveryDate: 'desc' } },
      select: { ordered: true },
    })
    const lastOrdered = last ? Number(last.ordered) : null
    if (!match) return suggestQuantity({ weekday, sameWeekdaySales: [], stock: null, lastOrdered })

    // Même jour de semaine, quatre dernières semaines
    const days = [1, 2, 3, 4].map((k) => addDays(deliveryDay, -7 * k))
    const from = new Date(dayDate(days[3]).getTime() - 86_400_000)
    const items = await this.prisma.orderItem.findMany({
      where: {
        productId: match.productId,
        ...(match.variantId ? { variantId: match.variantId } : {}),
        order: { siteId, kind: 'SALE', createdAt: { gte: from } },
      },
      select: { quantity: true, order: { select: { createdAt: true, soldAt: true } } },
    })
    const perDay = new Map<string, number>()
    for (const i of items) {
      const d = localDay(i.order.soldAt ?? i.order.createdAt, timeZone)
      perDay.set(d, (perDay.get(d) ?? 0) + i.quantity)
    }
    // Semaines où la boutique ne vendait pas encore ce produit : ignorées
    const sales = days.map((d) => perDay.get(d) ?? 0)
    const firstSale = items.length ? Math.min(...items.map((i) => (i.order.soldAt ?? i.order.createdAt).getTime())) : null
    const weeks = firstSale ? sales.filter((_, k) => dayDate(days[k]).getTime() + 86_400_000 >= firstSale) : []
    return suggestQuantity({ weekday, sameWeekdaySales: weeks, stock: match.stock, lastOrdered })
  }
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ','))
