import { Role } from '@erp/types'
import { describe, expect, it, vi } from 'vitest'
import { ConsolidatedDashboardController } from './dashboard.controller'
import { buildSiteSummaries, topProducts, totalsBySite, type SalesRow } from './dashboard-calc'
import { DashboardService } from './dashboard.service'
import { isAllowed } from '../common/access/workspace-policy'

const sale = (siteId: string, total: number, count: number): SalesRow => ({ siteId, kind: 'SALE', total, count })
const refund = (siteId: string, total: number, count: number): SalesRow => ({ siteId, kind: 'REFUND', total, count })

describe('CA et commandes par site', () => {
  it('les remboursements sont déduits du CA et ne comptent pas comme des commandes', () => {
    const t = totalsBySite([sale('a', 300, 3), refund('a', -50, 1)])
    expect(t.get('a')).toEqual({ revenue: 250, orderCount: 3 })
  })

  it('part du CA, classement et variation par site', () => {
    const sites = [{ id: 'a', name: 'Paris' }, { id: 'b', name: 'Lyon' }]
    const cur = totalsBySite([sale('a', 300, 3), sale('b', 100, 2)])
    const prev = totalsBySite([sale('a', 200, 2)])
    const out = buildSiteSummaries(sites, cur, prev, new Map([['b', 2]]))
    expect(out.map((s) => s.siteName)).toEqual(['Paris', 'Lyon'])
    expect(out[0].share).toBe(75)
    expect(out[1].share).toBe(25)
    expect(out[0].variation).toEqual({ revenue: 50, orderCount: 50 })
    // Lyon n'avait rien vendu : pas de pourcentage
    expect(out[1].variation).toEqual({ revenue: null, orderCount: null })
    expect(out[1].inProgress).toBe(2)
    expect(out[0].avgBasket).toBe(100)
  })

  it('aucun CA : part nulle plutôt que NaN', () => {
    const out = buildSiteSummaries([{ id: 'a', name: 'Paris' }], new Map(), new Map(), new Map())
    expect(out[0].share).toBeNull()
    expect(out[0].avgBasket).toBe(0)
  })
})

describe('top produits', () => {
  it('classe par CA, déduit remises et remboursements, garde cinq lignes', () => {
    const items = [
      { productId: 'p1', name: 'Praliné', quantity: 4, price: 10, discount: 5, refund: false },
      { productId: 'p1', name: 'Praliné', quantity: 1, price: -10, discount: 0, refund: true },
      { productId: 'p2', name: 'Calisson', quantity: 10, price: 2, discount: 0, refund: false },
      ...['a', 'b', 'c', 'd', 'e'].map((n, i) => ({ productId: n, name: n, quantity: 1, price: 1 + i / 10, discount: 0, refund: false })),
    ]
    const top = topProducts(items)
    expect(top).toHaveLength(5)
    // Praliné : 4 x 10 - 5 - 10 = 25 ; 3 vendus
    expect(top[0]).toEqual({ productId: 'p1', name: 'Praliné', quantity: 3, revenue: 25 })
    expect(top[1]).toMatchObject({ name: 'Calisson', quantity: 10, revenue: 20 })
  })

  it('un produit entièrement remboursé disparaît', () => {
    const top = topProducts([
      { productId: 'p1', name: 'Praliné', quantity: 2, price: 10, discount: 0, refund: false },
      { productId: 'p1', name: 'Praliné', quantity: 2, price: -10, discount: 0, refund: true },
    ])
    expect(top).toEqual([])
  })
})

function serviceWith(opts: { current: any[]; previous: any[] }) {
  const calls: any[] = []
  let n = 0
  const prisma: any = {
    site: { findMany: vi.fn(async () => [{ id: 'a', name: 'Paris' }]) },
    order: {
      groupBy: vi.fn(async (args: any) => {
        calls.push(args)
        if (args.by.length === 1) return []
        return n++ === 0 ? opts.current : opts.previous
      }),
    },
    orderItem: { findMany: vi.fn(async () => []) },
  }
  return { service: new DashboardService(prisma), prisma, calls }
}

describe('getMultiSiteSummary', () => {
  it('période précédente à zéro : variations nulles, pas de pourcentage', async () => {
    const { service } = serviceWith({
      current: [{ siteId: 'a', kind: 'SALE', _sum: { total: 120 }, _count: { _all: 4 } }],
      previous: [],
    })
    const r = await service.getMultiSiteSummary('org1', 'today', new Date('2026-10-25T12:00:00Z'))
    expect(r.revenue).toBe(120)
    expect(r.variation).toEqual({ revenue: null, orderCount: null, avgBasket: null })
    expect(r.perSite[0].variation.revenue).toBeNull()
    expect(r.period.timezone).toBe('Europe/Paris')
  })

  it('interroge les ventes terminées, avec les bornes de Paris et l\'heure réelle de vente', async () => {
    const { service, calls } = serviceWith({ current: [], previous: [] })
    await service.getMultiSiteSummary('org1', 'today', new Date('2026-10-25T12:00:00Z'))
    const where = calls[0].where
    expect(where.status).toBe('COMPLETED')
    expect(where.OR[0].soldAt.gte.toISOString()).toBe('2026-10-24T22:00:00.000Z')
    expect(where.OR[0].soldAt.lt.toISOString()).toBe('2026-10-25T23:00:00.000Z')
    expect(where.OR[1]).toMatchObject({ soldAt: null })
    // ni annulées ni remboursées en statut : seules les ventes terminées comptent
    expect(JSON.stringify(where)).not.toContain('CANCELLED')
  })

  it('compare avec la période précédente', async () => {
    const { service } = serviceWith({
      current: [{ siteId: 'a', kind: 'SALE', _sum: { total: 150 }, _count: { _all: 3 } }],
      previous: [{ siteId: 'a', kind: 'SALE', _sum: { total: 100 }, _count: { _all: 4 } }],
    })
    const r = await service.getMultiSiteSummary('org1', '7d', new Date('2026-10-28T10:00:00Z'))
    expect(r.variation.revenue).toBe(50)
    expect(r.variation.orderCount).toBe(-25)
    expect(r.previous.revenue).toBe(100)
  })
})

describe('droits du tableau de bord consolidé', () => {
  it('réservé au titulaire et au gérant', () => {
    expect(Reflect.getMetadata('roles', ConsolidatedDashboardController)).toEqual([Role.OWNER, Role.MANAGER])
    expect(isAllowed('SELLER', 'GET', '/api/dashboard/consolidated?period=7d')).toBe(false)
    expect(isAllowed('PRODUCTION', 'GET', '/api/dashboard/consolidated')).toBe(false)
    expect(isAllowed('MANAGER', 'GET', '/api/dashboard/consolidated')).toBe(true)
  })
})
