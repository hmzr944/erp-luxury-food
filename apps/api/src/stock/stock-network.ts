// Stock du réseau : un même produit vendu dans plusieurs sites est rapproché
// par référence (SKU), sinon code-barres, sinon nom normalisé, comme
// matchProduct (supply-plan.ts). Recopié avec des index plutôt que réutilisé :
// matchProduct parcourt la liste à chaque appel, trop lent sur tout un réseau.

export interface StockEntry {
  siteId: string
  productId: string
  variantId: string | null
  name: string
  variantName: string | null
  sku: string | null
  barcode: string | null
  unit: string
  quantity: number
  alertAt: number | null
}

export interface NetworkSiteStock {
  siteId: string
  quantity: number
  alertAt: number | null
  // Quantité au seuil d'alerte ou en dessous
  low: boolean
}

export interface NetworkStockRow {
  key: string
  name: string
  variantName: string | null
  sku: string | null
  barcode: string | null
  unit: string
  total: number
  sites: NetworkSiteStock[]
  lowSiteIds: string[]
  // Par quoi les sites ont été rapprochés ; null si un seul site a le produit
  matchedBy: 'sku' | 'barcode' | 'name' | null
}

export const normalize = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

const RANK = { sku: 0, barcode: 1, name: 2 } as const

interface Group {
  row: NetworkStockRow
  siteIds: Set<string>
}

export function consolidateStock(entries: StockEntry[]): NetworkStockRow[] {
  const groups: Group[] = []
  const bySku = new Map<string, Group>()
  const byBarcode = new Map<string, Group>()
  const byName = new Map<string, Group>()

  for (const e of entries) {
    const skuKey = normalize(e.sku)
    const barcodeKey = (e.barcode ?? '').trim()
    const nameKey = `${normalize(e.name)}|${normalize(e.variantName)}`

    // Un site ne compte qu'une fois par ligne : deux produits du même site
    // ne se fusionnent jamais entre eux
    const free = (g: Group | undefined) => (g && !g.siteIds.has(e.siteId) ? g : undefined)
    let matchedBy: 'sku' | 'barcode' | 'name' | null = null
    let group = skuKey ? free(bySku.get(skuKey)) : undefined
    if (group) matchedBy = 'sku'
    if (!group && barcodeKey) {
      group = free(byBarcode.get(barcodeKey))
      if (group) matchedBy = 'barcode'
    }
    if (!group && normalize(e.name)) {
      group = free(byName.get(nameKey))
      if (group) matchedBy = 'name'
    }

    if (!group) {
      group = {
        siteIds: new Set(),
        row: {
          key: `${e.productId}:${e.variantId ?? ''}`,
          name: e.name,
          variantName: e.variantName,
          sku: e.sku,
          barcode: e.barcode,
          unit: e.unit,
          total: 0,
          sites: [],
          lowSiteIds: [],
          matchedBy: null,
        },
      }
      groups.push(group)
    } else {
      const prior = group.row.matchedBy
      if (matchedBy && (prior === null || RANK[matchedBy] > RANK[prior])) group.row.matchedBy = matchedBy
      group.row.sku ??= e.sku
      group.row.barcode ??= e.barcode
    }

    // Les clés de cette ligne pointent vers le groupe (sans écraser un autre groupe)
    if (skuKey && !bySku.has(skuKey)) bySku.set(skuKey, group)
    if (barcodeKey && !byBarcode.has(barcodeKey)) byBarcode.set(barcodeKey, group)
    if (!byName.has(nameKey)) byName.set(nameKey, group)

    const low = e.alertAt !== null && e.quantity <= e.alertAt
    group.siteIds.add(e.siteId)
    group.row.sites.push({ siteId: e.siteId, quantity: e.quantity, alertAt: e.alertAt, low })
    group.row.total += e.quantity
    if (low) group.row.lowSiteIds.push(e.siteId)
  }

  return groups.map((g) => ({ ...g.row, total: Math.round(g.row.total * 1000) / 1000 }))
}

export type StockSort = 'name' | 'total' | 'low'

export interface StockQuery {
  q?: string
  lowOnly?: boolean
  sort?: StockSort
  order?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export function queryRows(rows: NetworkStockRow[], query: StockQuery) {
  const q = normalize(query.q)
  let list = rows
  if (q) {
    list = list.filter((r) => [r.name, r.variantName, r.sku, r.barcode].some((v) => normalize(v).includes(q)))
  }
  if (query.lowOnly) list = list.filter((r) => r.lowSiteIds.length > 0)

  const dir = query.order === 'desc' ? -1 : 1
  const byName = (a: NetworkStockRow, b: NetworkStockRow) =>
    a.name.localeCompare(b.name, 'fr') || (a.variantName ?? '').localeCompare(b.variantName ?? '', 'fr')
  const sort = query.sort ?? 'name'
  const sorted = [...list].sort((a, b) => {
    const primary = sort === 'total' ? a.total - b.total : sort === 'low' ? a.lowSiteIds.length - b.lowSiteIds.length : byName(a, b)
    return primary * dir || byName(a, b)
  })

  const pageSize = Math.min(100, Math.max(1, Math.floor(query.pageSize ?? 25)))
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const page = Math.min(pageCount, Math.max(1, Math.floor(query.page ?? 1)))
  return {
    rows: sorted.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    pageCount,
    total: sorted.length,
    lowCount: rows.filter((r) => r.lowSiteIds.length > 0).length,
  }
}
