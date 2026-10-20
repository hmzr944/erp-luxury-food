// Calculs du tableau de bord consolidé, sans base de données.
import { variation } from './period'

const round2 = (n: number) => Math.round(n * 100) / 100

// Une ligne par site et par nature de ticket (vente ou remboursement)
export interface SalesRow {
  siteId: string
  kind: 'SALE' | 'REFUND'
  total: number
  count: number
}

export interface SiteTotals {
  revenue: number
  orderCount: number
}

// CA net : les remboursements (tickets négatifs) sont déduits.
// Nombre de commandes : les ventes seulement, un remboursement n'est pas une vente.
export function totalsBySite(rows: SalesRow[]): Map<string, SiteTotals> {
  const out = new Map<string, SiteTotals>()
  for (const r of rows) {
    const t = out.get(r.siteId) ?? { revenue: 0, orderCount: 0 }
    t.revenue += r.total
    if (r.kind === 'SALE') t.orderCount += r.count
    out.set(r.siteId, t)
  }
  return out
}

export interface SiteSummary {
  siteId: string
  siteName: string
  revenue: number
  orderCount: number
  avgBasket: number
  inProgress: number
  // Part du CA du réseau, en %, null si le réseau n'a pas de CA
  share: number | null
  previous: { revenue: number; orderCount: number }
  variation: { revenue: number | null; orderCount: number | null }
}

export function buildSiteSummaries(
  sites: Array<{ id: string; name: string }>,
  current: Map<string, SiteTotals>,
  previous: Map<string, SiteTotals>,
  inProgress: Map<string, number>,
): SiteSummary[] {
  const zero: SiteTotals = { revenue: 0, orderCount: 0 }
  const networkRevenue = sites.reduce((a, s) => a + (current.get(s.id)?.revenue ?? 0), 0)
  return sites
    .map((s) => {
      const cur = current.get(s.id) ?? zero
      const prev = previous.get(s.id) ?? zero
      return {
        siteId: s.id,
        siteName: s.name,
        revenue: round2(cur.revenue),
        orderCount: cur.orderCount,
        avgBasket: cur.orderCount > 0 ? round2(cur.revenue / cur.orderCount) : 0,
        inProgress: inProgress.get(s.id) ?? 0,
        share: networkRevenue > 0 ? Math.round((cur.revenue / networkRevenue) * 1000) / 10 : null,
        previous: { revenue: round2(prev.revenue), orderCount: prev.orderCount },
        variation: { revenue: variation(cur.revenue, prev.revenue), orderCount: variation(cur.orderCount, prev.orderCount) },
      }
    })
    .sort((a, b) => b.revenue - a.revenue || a.siteName.localeCompare(b.siteName, 'fr'))
}

export function networkTotals(perSite: SiteSummary[]) {
  const revenue = round2(perSite.reduce((a, s) => a + s.revenue, 0))
  const orderCount = perSite.reduce((a, s) => a + s.orderCount, 0)
  const prevRevenue = round2(perSite.reduce((a, s) => a + s.previous.revenue, 0))
  const prevOrders = perSite.reduce((a, s) => a + s.previous.orderCount, 0)
  const avgBasket = orderCount > 0 ? round2(revenue / orderCount) : 0
  const prevAvg = prevOrders > 0 ? round2(prevRevenue / prevOrders) : 0
  return {
    revenue,
    orderCount,
    avgBasket,
    inProgress: perSite.reduce((a, s) => a + s.inProgress, 0),
    previous: { revenue: prevRevenue, orderCount: prevOrders, avgBasket: prevAvg },
    variation: {
      revenue: variation(revenue, prevRevenue),
      orderCount: variation(orderCount, prevOrders),
      avgBasket: variation(avgBasket, prevAvg),
    },
  }
}

export interface ItemRow {
  productId: string
  name: string
  quantity: number
  price: number
  discount: number
  // Ligne d'un ticket de remboursement : le prix y est déjà négatif, la
  // quantité est positive et se retranche
  refund: boolean
}

// Top produits du réseau : CA décroissant, puis quantités. Une ligne remboursée
// retranche son montant et sa quantité. Remise de ligne déduite ; la remise
// globale du ticket n'est pas répartie sur les produits.
export function topProducts(items: ItemRow[], limit = 5) {
  const map = new Map<string, { productId: string; name: string; quantity: number; revenue: number }>()
  for (const i of items) {
    const row = map.get(i.productId) ?? { productId: i.productId, name: i.name, quantity: 0, revenue: 0 }
    row.quantity += i.refund ? -i.quantity : i.quantity
    row.revenue += i.price * i.quantity - i.discount
    map.set(i.productId, row)
  }
  return [...map.values()]
    .filter((r) => r.quantity > 0 && r.revenue > 0)
    .map((r) => ({ ...r, revenue: round2(r.revenue) }))
    .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity || a.name.localeCompare(b.name, 'fr'))
    .slice(0, limit)
}
