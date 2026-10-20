import { Injectable } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { Decimal } from '@prisma/client/runtime/library'
import { buildSiteSummaries, networkTotals, topProducts, totalsBySite, type SalesRow } from './dashboard-calc'
import { DASHBOARD_TZ, resolvePeriod, type PeriodKey } from './period'

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getDailySummary(siteId: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [completedAgg, inProgressCount, recentOrders] = await Promise.all([
      this.prisma.order.aggregate({
        where: { siteId, status: 'COMPLETED', createdAt: { gte: today, lt: tomorrow } },
        _sum: { total: true },
        _count: true,
        _avg: { total: true },
      }),
      this.prisma.order.count({
        where: { siteId, status: { in: ['PENDING', 'PREPARING', 'READY'] } },
      }),
      this.prisma.order.findMany({
        where: { siteId, createdAt: { gte: today, lt: tomorrow } },
        include: {
          items: { select: { name: true, quantity: true, price: true } },
          receiptChain: { select: { counter: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ])

    // Agrégation CA par heure (calculée en JS depuis les commandes du jour)
    const completedToday = await this.prisma.order.findMany({
      where: { siteId, status: 'COMPLETED', createdAt: { gte: today, lt: tomorrow } },
      select: { total: true, createdAt: true },
    })

    const revenueByHour = this.buildHourlyRevenue(completedToday)

    // Top produits du jour
    const topProducts = await this.getTopProducts(siteId, today, tomorrow)

    return {
      revenue: Number(completedAgg._sum.total ?? 0),
      orderCount: completedAgg._count,
      avgBasket: Number(completedAgg._avg.total ?? 0),
      inProgress: inProgressCount,
      revenueByHour,
      topProducts,
      recentOrders,
    }
  }

  private buildHourlyRevenue(orders: { total: Decimal; createdAt: Date }[]) {
    const hours: Record<number, number> = {}
    for (let h = 8; h <= 20; h++) hours[h] = 0

    for (const o of orders) {
      const h = o.createdAt.getHours()
      if (h >= 8 && h <= 20) {
        hours[h] = (hours[h] ?? 0) + Number(o.total)
      }
    }

    return Object.entries(hours).map(([hour, revenue]) => ({
      hour: `${hour}h`,
      revenue: Math.round(revenue * 100) / 100,
    }))
  }

  private async getTopProducts(siteId: string, from: Date, to: Date) {
    const items = await this.prisma.orderItem.findMany({
      where: { order: { siteId, status: 'COMPLETED', createdAt: { gte: from, lt: to } } },
      select: { name: true, quantity: true, price: true },
    })

    const map: Record<string, { name: string; quantity: number; revenue: number }> = {}
    for (const item of items) {
      if (!map[item.name]) map[item.name] = { name: item.name, quantity: 0, revenue: 0 }
      map[item.name].quantity += item.quantity
      map[item.name].revenue += Number(item.price) * item.quantity
    }

    return Object.values(map)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)
  }

  async getRealtimeKPIs(siteId: string) {
    const [pending, preparing, ready] = await Promise.all([
      this.prisma.order.count({ where: { siteId, status: 'PENDING' } }),
      this.prisma.order.count({ where: { siteId, status: 'PREPARING' } }),
      this.prisma.order.count({ where: { siteId, status: 'READY' } }),
    ])
    return { pending, preparing, ready, total: pending + preparing + ready }
  }

  // ── Dashboard multi-sites consolidé ───────────────────────────
  // Ventes terminées (remboursements compris, en négatif), à l'heure réelle de
  // la vente quand elle existe (vente hors ligne synchronisée plus tard)
  private soldIn(from: Date, to: Date) {
    return {
      status: 'COMPLETED' as const,
      OR: [{ soldAt: { gte: from, lt: to } }, { soldAt: null, createdAt: { gte: from, lt: to } }],
    }
  }

  private async salesRows(siteIds: string[], from: Date, to: Date): Promise<SalesRow[]> {
    const groups = await this.prisma.order.groupBy({
      by: ['siteId', 'kind'],
      where: { siteId: { in: siteIds }, ...this.soldIn(from, to) },
      _sum: { total: true },
      _count: { _all: true },
    })
    return groups.map((g) => ({ siteId: g.siteId, kind: g.kind, total: Number(g._sum.total ?? 0), count: g._count._all }))
  }

  async getMultiSiteSummary(organizationId: string, periodKey: PeriodKey = 'today', now: Date = new Date()) {
    const period = resolvePeriod(periodKey, now)
    const sites = await this.prisma.site.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    const siteIds = sites.map((s) => s.id)

    const [currentRows, previousRows, inProgressRows, items] = await Promise.all([
      this.salesRows(siteIds, period.from, period.to),
      this.salesRows(siteIds, period.previous.from, period.previous.to),
      this.prisma.order.groupBy({
        by: ['siteId'],
        where: { siteId: { in: siteIds }, status: { in: ['PENDING', 'PREPARING', 'READY'] } },
        _count: { _all: true },
      }),
      this.prisma.orderItem.findMany({
        where: { order: { siteId: { in: siteIds }, ...this.soldIn(period.from, period.to) } },
        select: { productId: true, name: true, quantity: true, price: true, discount: true, order: { select: { kind: true } } },
      }),
    ])

    const perSite = buildSiteSummaries(
      sites,
      totalsBySite(currentRows),
      totalsBySite(previousRows),
      new Map(inProgressRows.map((r) => [r.siteId, r._count._all])),
    )

    return {
      period: {
        key: period.key,
        label: period.label,
        timezone: DASHBOARD_TZ,
        from: period.from.toISOString(),
        to: period.to.toISOString(),
        previousFrom: period.previous.from.toISOString(),
        previousTo: period.previous.to.toISOString(),
      },
      ...networkTotals(perSite),
      perSite,
      siteCount: sites.length,
      topProducts: topProducts(
        items.map((i) => ({
          productId: i.productId,
          name: i.name,
          quantity: i.quantity,
          price: Number(i.price),
          discount: Number(i.discount),
          refund: i.order.kind === 'REFUND',
        })),
      ),
    }
  }
}
