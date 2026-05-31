import { Injectable } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { Decimal } from '@prisma/client/runtime/library'

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
  async getMultiSiteSummary(organizationId: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const sites = await this.prisma.site.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    })

    const perSite = await Promise.all(
      sites.map(async (site) => {
        const agg = await this.prisma.order.aggregate({
          where: { siteId: site.id, status: 'COMPLETED', createdAt: { gte: today, lt: tomorrow } },
          _sum: { total: true },
          _count: true,
          _avg: { total: true },
        })
        const inProgress = await this.prisma.order.count({
          where: { siteId: site.id, status: { in: ['PENDING', 'PREPARING', 'READY'] } },
        })
        return {
          siteId: site.id,
          siteName: site.name,
          revenue: Number(agg._sum.total ?? 0),
          orderCount: agg._count,
          avgBasket: Number(agg._avg.total ?? 0),
          inProgress,
        }
      }),
    )

    const totals = perSite.reduce(
      (acc, s) => ({
        revenue: acc.revenue + s.revenue,
        orderCount: acc.orderCount + s.orderCount,
        inProgress: acc.inProgress + s.inProgress,
      }),
      { revenue: 0, orderCount: 0, inProgress: 0 },
    )

    return {
      ...totals,
      avgBasket: totals.orderCount > 0 ? totals.revenue / totals.orderCount : 0,
      perSite,
      siteCount: sites.length,
    }
  }
}
