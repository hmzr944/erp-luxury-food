import { createHash } from 'crypto'
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import type { ClosurePeriod, FiscalClosure, Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { RECEIPT_GENESIS_HASH, businessDate, businessDayStart, closureInput, priceOrder } from '@erp/utils'
import { PrismaService } from '../common/prisma/prisma.service'
import { ComplianceService } from './compliance.service'
import { FiscalEventsService } from './fiscal-events.service'
import { ArchivesService } from './archives.service'

type Tx = Prisma.TransactionClient

interface Totals {
  firstCounter: number | null
  lastCounter: number | null
  ticketCount: number
  salesCount: number
  refundCount: number
  salesTotal: Decimal
  refundsTotal: Decimal
  periodTotal: Decimal
  totalHT: Decimal
  totalTax: Decimal
  taxBreakdown: Array<{ rate: number; ht: number; tax: number; ttc: number }>
  paymentBreakdown: Array<{ code: string; label: string; amount: number }>
}

const ZERO = () => new Decimal(0)
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const cents = (n: number) => Math.round(n * 100)
const nextDay = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

// Clôtures fiscales cumulatives (BOI-TVA-DECLA-30-10-30 § 170) :
// - Z du jour : plage continue de tickets, du premier ticket non clôturé au
//   dernier ticket du jour d'activité ; les ventes hors ligne remontées après
//   coup entrent dans le Z suivant, aucun Z scellé n'est jamais rouvert
// - Z du mois : cumul des Z du jour du mois ; Z de l'année : cumul des Z du mois
// - chaque Z porte le grand total de sa période et le total perpétuel, et
//   s'enchaîne au Z précédent de même période
@Injectable()
export class ClosuresService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClosuresService.name)
  private timer: NodeJS.Timeout | null = null

  constructor(
    private prisma: PrismaService,
    private ledger: ComplianceService,
    private events: FiscalEventsService,
    private archives: ArchivesService,
  ) {}

  onModuleInit() {
    // Clôtures automatiques : toutes les 10 minutes, chaque site clôture les
    // jours d'activité terminés qui ne l'ont pas été à la main
    if (process.env.NODE_ENV === 'test' || process.env.FISCAL_AUTO_CLOSE === 'off') return
    this.timer = setInterval(() => void this.autoCloseAll(), 10 * 60_000)
    setTimeout(() => void this.autoCloseAll(), 30_000)
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
  }

  list(siteId: string, period: ClosurePeriod, take = 60) {
    return this.prisma.fiscalClosure.findMany({ where: { siteId, period }, orderBy: { seq: 'desc' }, take })
  }

  async get(siteId: string, id: string) {
    const closure = await this.prisma.fiscalClosure.findFirst({ where: { id, siteId } })
    if (!closure) throw new NotFoundException('Clôture introuvable')
    return closure
  }

  // Tickets pas encore couverts par un Z du jour
  async pending(siteId: string) {
    const lastDay = await this.prisma.fiscalClosure.findFirst({ where: { siteId, period: 'DAY' }, orderBy: { seq: 'desc' } })
    const from = (lastDay?.lastCounter ?? 0) + 1
    const agg = await this.prisma.receiptChain.aggregate({ where: { siteId, counter: { gte: from } }, _count: true, _sum: { total: true } })
    return { fromCounter: from, tickets: agg._count, total: (agg._sum.total ?? ZERO()).toFixed(2) }
  }

  // Z du jour à la main (fin de journée) : tous les tickets non clôturés
  async closeDay(siteId: string, userId: string | null) {
    const site = await this.site(siteId)
    const label = businessDate(new Date(), site.timezone)
    const closure = await this.prisma.$transaction(
      async (tx) => {
        await this.lock(tx, siteId)
        const existing = await tx.fiscalClosure.findUnique({ where: { siteId_period_label: { siteId, period: 'DAY', label } } })
        if (existing) throw new ConflictException('La journée est déjà clôturée. Les ventes suivantes iront dans la clôture de demain.')
        return this.sealDay(tx, site, label, null, userId, false)
      },
      { timeout: 60_000 },
    )
    await this.rollUp(siteId, userId, false)
    return closure
  }

  async closeMonth(siteId: string, label: string, userId: string | null) {
    if (!/^\d{4}-\d{2}$/.test(label)) throw new BadRequestException('Mois attendu au format AAAA-MM')
    const site = await this.site(siteId)
    const current = businessDate(new Date(), site.timezone).slice(0, 7)
    if (label >= current) throw new BadRequestException('Le mois en cours ne peut pas être clôturé avant sa fin')
    const closure = await this.prisma.$transaction((tx) => this.sealAggregate(tx, site, 'MONTH', label, userId, false), { timeout: 60_000 })
    await this.archives.ensure(siteId, 'MONTH', label, userId)
    return closure
  }

  async closeYear(siteId: string, label: string, userId: string | null) {
    if (!/^\d{4}$/.test(label)) throw new BadRequestException('Année attendue au format AAAA')
    const site = await this.site(siteId)
    const current = businessDate(new Date(), site.timezone).slice(0, 4)
    if (label >= current) throw new BadRequestException('L’année en cours ne peut pas être clôturée avant sa fin')
    const closure = await this.prisma.$transaction((tx) => this.sealAggregate(tx, site, 'YEAR', label, userId, false), { timeout: 60_000 })
    await this.archives.ensure(siteId, 'YEAR', label, userId)
    return closure
  }

  // Clôture automatique d'un site : chaque jour d'activité terminé, puis les
  // mois et années terminés, et leurs archives
  async autoClose(siteId: string) {
    const site = await this.site(siteId)
    const today = businessDate(new Date(), site.timezone)
    for (let guard = 0; guard < 400; guard++) {
      const done = await this.prisma.$transaction(
        async (tx) => {
          await this.lock(tx, siteId)
          const lastDay = await tx.fiscalClosure.findFirst({ where: { siteId, period: 'DAY' }, orderBy: { seq: 'desc' } })
          const first = await tx.receiptChain.findFirst({
            where: { siteId, counter: { gt: lastDay?.lastCounter ?? 0 } },
            orderBy: { counter: 'asc' },
            select: { signedAt: true },
          })
          if (!first) return true
          let label = businessDate(first.signedAt, site.timezone)
          // Jour déjà clôturé à la main : ces tickets vont au jour suivant
          while (label < today && (await tx.fiscalClosure.findUnique({ where: { siteId_period_label: { siteId, period: 'DAY', label } } }))) {
            label = nextDay(label)
          }
          if (label >= today) return true
          const cutoff = businessDayStart(nextDay(label), site.timezone)
          await this.sealDay(tx, site, label, cutoff, null, true)
          return false
        },
        { timeout: 60_000 },
      )
      if (done) break
    }
    await this.rollUp(siteId, null, true)
  }

  private async autoCloseAll() {
    const sites = await this.prisma.site.findMany({ select: { id: true } })
    for (const s of sites) {
      try {
        await this.autoClose(s.id)
      } catch (e) {
        this.logger.error(`Clôture automatique du site ${s.id} : ${(e as Error).message}`)
      }
    }
  }

  // Mois et années terminés dont tous les jours sont clôturés : cumul et archive
  private async rollUp(siteId: string, userId: string | null, auto: boolean) {
    const site = await this.site(siteId)
    const today = businessDate(new Date(), site.timezone)
    const days = await this.prisma.fiscalClosure.findMany({ where: { siteId, period: 'DAY' }, select: { label: true } })
    const months = [...new Set(days.map((d) => d.label.slice(0, 7)))].filter((m) => m < today.slice(0, 7)).sort()
    for (const month of months) {
      const exists = await this.prisma.fiscalClosure.findUnique({ where: { siteId_period_label: { siteId, period: 'MONTH', label: month } } })
      if (!exists) await this.prisma.$transaction((tx) => this.sealAggregate(tx, site, 'MONTH', month, userId, auto), { timeout: 60_000 })
      await this.archives.ensure(siteId, 'MONTH', month, userId)
    }
    const years = [...new Set(months.map((m) => m.slice(0, 4)))].filter((y) => y < today.slice(0, 4)).sort()
    for (const year of years) {
      const exists = await this.prisma.fiscalClosure.findUnique({ where: { siteId_period_label: { siteId, period: 'YEAR', label: year } } })
      if (!exists) await this.prisma.$transaction((tx) => this.sealAggregate(tx, site, 'YEAR', year, userId, auto), { timeout: 60_000 })
      await this.archives.ensure(siteId, 'YEAR', year, userId)
    }
  }

  // Scelle un Z du jour : tickets du premier non clôturé jusqu'au dernier
  // signé avant `cutoff` (ou jusqu'au dernier tout court)
  private async sealDay(tx: Tx, site: SiteInfo, label: string, cutoff: Date | null, userId: string | null, auto: boolean) {
    const previous = await tx.fiscalClosure.findFirst({ where: { siteId: site.id, period: 'DAY' }, orderBy: { seq: 'desc' } })
    const from = (previous?.lastCounter ?? 0) + 1
    const last = await tx.receiptChain.findFirst({
      where: { siteId: site.id, counter: { gte: from }, ...(cutoff ? { signedAt: { lt: cutoff } } : {}) },
      orderBy: { counter: 'desc' },
      select: { counter: true },
    })
    const totals = last ? await this.totalsForRange(tx, site, from, last.counter) : this.emptyTotals()
    const perpetual = await this.ledger.perpetualAt(tx, site.id, totals.lastCounter ?? previous?.lastCounter ?? null)
    const closure = await this.persist(tx, site.id, 'DAY', label, totals, perpetual, previous, userId, auto)
    await this.events.record(tx, {
      organizationId: site.organizationId,
      siteId: site.id,
      code: 'CLOSURE_DAY',
      userId,
      detail: { label, seq: closure.seq, firstCounter: closure.firstCounter, lastCounter: closure.lastCounter, total: closure.periodTotal.toFixed(2), auto },
    })
    return closure
  }

  // Z du mois (cumul des Z du jour) ou de l'année (cumul des Z du mois)
  private async sealAggregate(tx: Tx, site: SiteInfo, period: 'MONTH' | 'YEAR', label: string, userId: string | null, auto: boolean) {
    await this.lock(tx, site.id)
    const existing = await tx.fiscalClosure.findUnique({ where: { siteId_period_label: { siteId: site.id, period, label } } })
    if (existing) {
      if (auto) return existing
      throw new ConflictException(period === 'MONTH' ? 'Ce mois est déjà clôturé' : 'Cette année est déjà clôturée')
    }
    const childPeriod = period === 'MONTH' ? 'DAY' : 'MONTH'
    const children = await tx.fiscalClosure.findMany({
      where: { siteId: site.id, period: childPeriod, label: { startsWith: label + '-' } },
      orderBy: { seq: 'asc' },
    })
    if (period === 'YEAR') {
      // Une année ne se clôture qu'une fois tous ses mois clôturés
      const days = await tx.fiscalClosure.findMany({ where: { siteId: site.id, period: 'DAY', label: { startsWith: label + '-' } }, select: { label: true } })
      const monthsWithDays = new Set(days.map((d) => d.label.slice(0, 7)))
      const missing = [...monthsWithDays].filter((m) => !children.some((c) => c.label === m))
      if (missing.length) throw new BadRequestException(`Mois à clôturer d’abord : ${missing.join(', ')}`)
    }
    const totals = this.sumClosures(children)
    const previous = await tx.fiscalClosure.findFirst({ where: { siteId: site.id, period }, orderBy: { seq: 'desc' } })
    const lastChild = children[children.length - 1]
    const perpetual = lastChild
      ? { total: lastChild.perpetualTotal, abs: lastChild.perpetualAbsTotal }
      : await this.ledger.perpetualAt(tx, site.id, previous?.lastCounter ?? null)
    const closure = await this.persist(tx, site.id, period, label, totals, perpetual, previous, userId, auto)
    await this.events.record(tx, {
      organizationId: site.organizationId,
      siteId: site.id,
      code: period === 'MONTH' ? 'CLOSURE_MONTH' : 'CLOSURE_YEAR',
      userId,
      detail: { label, seq: closure.seq, closures: children.length, total: closure.periodTotal.toFixed(2), auto },
    })
    return closure
  }

  private async persist(
    tx: Tx,
    siteId: string,
    period: ClosurePeriod,
    label: string,
    t: Totals,
    perpetual: { total: Decimal; abs: Decimal },
    previous: FiscalClosure | null,
    userId: string | null,
    auto: boolean,
  ) {
    const seq = (previous?.seq ?? 0) + 1
    const previousHash = previous?.hash ?? RECEIPT_GENESIS_HASH
    const closedAt = new Date()
    const hash = sha256(
      closureInput({
        siteId,
        period,
        label,
        seq,
        firstCounter: t.firstCounter,
        lastCounter: t.lastCounter,
        ticketCount: t.ticketCount,
        salesTotal: t.salesTotal.toFixed(2),
        refundsTotal: t.refundsTotal.toFixed(2),
        periodTotal: t.periodTotal.toFixed(2),
        totalHT: t.totalHT.toFixed(2),
        totalTax: t.totalTax.toFixed(2),
        taxBreakdown: t.taxBreakdown,
        paymentBreakdown: t.paymentBreakdown,
        perpetualTotal: perpetual.total.toFixed(2),
        perpetualAbsTotal: perpetual.abs.toFixed(2),
        previousHash,
        closedAt: closedAt.toISOString(),
      }),
    )
    return tx.fiscalClosure.create({
      data: {
        siteId,
        period,
        label,
        seq,
        firstCounter: t.firstCounter,
        lastCounter: t.lastCounter,
        ticketCount: t.ticketCount,
        salesCount: t.salesCount,
        refundCount: t.refundCount,
        salesTotal: t.salesTotal,
        refundsTotal: t.refundsTotal,
        periodTotal: t.periodTotal,
        totalHT: t.totalHT,
        totalTax: t.totalTax,
        taxBreakdown: t.taxBreakdown,
        paymentBreakdown: t.paymentBreakdown,
        perpetualTotal: perpetual.total,
        perpetualAbsTotal: perpetual.abs,
        previousHash,
        hash,
        auto,
        closedAt,
        closedById: userId,
      },
    })
  }

  // Revérifie l'enchaînement et l'empreinte des clôtures d'un site
  async verify(siteId: string) {
    const errors: string[] = []
    let checked = 0
    for (const period of ['DAY', 'MONTH', 'YEAR'] as const) {
      const list = await this.prisma.fiscalClosure.findMany({ where: { siteId, period }, orderBy: { seq: 'asc' } })
      let previous = RECEIPT_GENESIS_HASH
      list.forEach((c, i) => {
        checked++
        if (c.seq !== i + 1) errors.push(`Clôture ${period} n° ${i + 1} manquante`)
        if (c.previousHash !== previous) errors.push(`Chaîne des clôtures rompue (${c.label})`)
        const expected = sha256(
          closureInput({
            siteId: c.siteId,
            period: c.period,
            label: c.label,
            seq: c.seq,
            firstCounter: c.firstCounter,
            lastCounter: c.lastCounter,
            ticketCount: c.ticketCount,
            salesTotal: c.salesTotal.toFixed(2),
            refundsTotal: c.refundsTotal.toFixed(2),
            periodTotal: c.periodTotal.toFixed(2),
            totalHT: c.totalHT.toFixed(2),
            totalTax: c.totalTax.toFixed(2),
            taxBreakdown: c.taxBreakdown as Totals['taxBreakdown'],
            paymentBreakdown: c.paymentBreakdown as Totals['paymentBreakdown'],
            perpetualTotal: c.perpetualTotal.toFixed(2),
            perpetualAbsTotal: c.perpetualAbsTotal.toFixed(2),
            previousHash: c.previousHash,
            closedAt: c.closedAt.toISOString(),
          }),
        )
        if (expected !== c.hash) errors.push(`Empreinte incorrecte de la clôture ${c.label}`)
        previous = c.hash
      })
    }
    return { valid: errors.length === 0, checked, errors }
  }

  // Totaux d'une plage de tickets : ventes et retours, TVA par taux,
  // encaissements par moyen de paiement
  async totalsForRange(tx: Tx | PrismaService, site: SiteInfo, from: number, to: number): Promise<Totals> {
    const receipts = await tx.receiptChain.findMany({
      where: { siteId: site.id, counter: { gte: from, lte: to } },
      orderBy: { counter: 'asc' },
      select: {
        counter: true,
        total: true,
        order: {
          select: {
            kind: true,
            subtotal: true,
            taxAmount: true,
            total: true,
            discount: true,
            items: { select: { price: true, quantity: true, discount: true, taxRate: true } },
            payments: { select: { code: true, label: true, amount: true } },
          },
        },
      },
    })
    const t = this.emptyTotals()
    t.firstCounter = from
    t.lastCounter = to
    const byRate = new Map<number, { ht: number; tax: number; ttc: number }>()
    const byPayment = new Map<string, { label: string; amount: number }>()

    for (const r of receipts) {
      t.ticketCount++
      const refund = r.order?.kind === 'REFUND' || r.total.isNegative()
      if (refund) {
        t.refundCount++
        t.refundsTotal = t.refundsTotal.add(r.total)
      } else {
        t.salesCount++
        t.salesTotal = t.salesTotal.add(r.total)
      }
      t.periodTotal = t.periodTotal.add(r.total)
      const o = r.order
      if (!o) continue
      t.totalHT = t.totalHT.add(o.subtotal)
      t.totalTax = t.totalTax.add(o.taxAmount)

      // TVA par taux : recalcul exact de la vente (mêmes règles qu'en caisse)
      const sign = refund ? -1 : 1
      const priced = priceOrder(
        o.items.map((i) => ({ unitPrice: Math.abs(Number(i.price)), quantity: i.quantity, discount: Number(i.discount), taxRate: Number(i.taxRate) })),
        { priceIncludesTax: refund ? true : site.priceIncludesTax, orderDiscount: Number(o.discount) },
      )
      for (const line of priced.taxBreakdown) {
        const entry = byRate.get(line.rate) ?? { ht: 0, tax: 0, ttc: 0 }
        entry.ht += sign * cents(line.ht)
        entry.tax += sign * cents(line.tax)
        entry.ttc += sign * (cents(line.ht) + cents(line.tax))
        byRate.set(line.rate, entry)
      }
      for (const p of o.payments) {
        const entry = byPayment.get(p.code) ?? { label: p.label, amount: 0 }
        entry.amount += cents(Number(p.amount))
        byPayment.set(p.code, entry)
      }
    }
    t.taxBreakdown = [...byRate.entries()]
      .sort(([a], [b]) => a - b)
      .map(([rate, v]) => ({ rate, ht: v.ht / 100, tax: v.tax / 100, ttc: v.ttc / 100 }))
    t.paymentBreakdown = [...byPayment.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, v]) => ({ code, label: v.label, amount: v.amount / 100 }))
    return t
  }

  private sumClosures(list: FiscalClosure[]): Totals {
    const t = this.emptyTotals()
    const byRate = new Map<number, { ht: number; tax: number; ttc: number }>()
    const byPayment = new Map<string, { label: string; amount: number }>()
    for (const c of list) {
      if (c.firstCounter != null && (t.firstCounter == null || c.firstCounter < t.firstCounter)) t.firstCounter = c.firstCounter
      if (c.lastCounter != null && (t.lastCounter == null || c.lastCounter > t.lastCounter)) t.lastCounter = c.lastCounter
      t.ticketCount += c.ticketCount
      t.salesCount += c.salesCount
      t.refundCount += c.refundCount
      t.salesTotal = t.salesTotal.add(c.salesTotal)
      t.refundsTotal = t.refundsTotal.add(c.refundsTotal)
      t.periodTotal = t.periodTotal.add(c.periodTotal)
      t.totalHT = t.totalHT.add(c.totalHT)
      t.totalTax = t.totalTax.add(c.totalTax)
      for (const r of c.taxBreakdown as Totals['taxBreakdown']) {
        const e = byRate.get(r.rate) ?? { ht: 0, tax: 0, ttc: 0 }
        e.ht += cents(r.ht)
        e.tax += cents(r.tax)
        e.ttc += cents(r.ttc)
        byRate.set(r.rate, e)
      }
      for (const p of c.paymentBreakdown as Totals['paymentBreakdown']) {
        const e = byPayment.get(p.code) ?? { label: p.label, amount: 0 }
        e.amount += cents(p.amount)
        byPayment.set(p.code, e)
      }
    }
    t.taxBreakdown = [...byRate.entries()].sort(([a], [b]) => a - b).map(([rate, v]) => ({ rate, ht: v.ht / 100, tax: v.tax / 100, ttc: v.ttc / 100 }))
    t.paymentBreakdown = [...byPayment.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([code, v]) => ({ code, label: v.label, amount: v.amount / 100 }))
    return t
  }

  private emptyTotals(): Totals {
    return {
      firstCounter: null,
      lastCounter: null,
      ticketCount: 0,
      salesCount: 0,
      refundCount: 0,
      salesTotal: ZERO(),
      refundsTotal: ZERO(),
      periodTotal: ZERO(),
      totalHT: ZERO(),
      totalTax: ZERO(),
      taxBreakdown: [],
      paymentBreakdown: [],
    }
  }

  private lock(tx: Tx, siteId: string) {
    return tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'closure:' + siteId}))`
  }

  private async site(siteId: string): Promise<SiteInfo> {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true, timezone: true, organizationId: true, organization: { select: { priceIncludesTax: true } } },
    })
    if (!site) throw new NotFoundException('Site introuvable')
    return { id: site.id, timezone: site.timezone, organizationId: site.organizationId, priceIncludesTax: site.organization.priceIncludesTax }
  }
}

export interface SiteInfo {
  id: string
  timezone: string
  organizationId: string
  priceIncludesTax: boolean
}
