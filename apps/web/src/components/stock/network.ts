import { apiClient } from '@/lib/api/client'

export interface NetworkSite {
  id: string
  name: string
}

export interface NetworkStockRow {
  key: string
  name: string
  variantName: string | null
  sku: string | null
  barcode: string | null
  unit: string
  total: number
  sites: Array<{ siteId: string; quantity: number; alertAt: number | null; low: boolean }>
  lowSiteIds: string[]
  matchedBy: 'sku' | 'barcode' | 'name' | null
}

export interface NetworkStock {
  sites: NetworkSite[]
  rows: NetworkStockRow[]
  page: number
  pageSize: number
  pageCount: number
  total: number
  lowCount: number
}

export type NetworkSort = 'name' | 'total' | 'low'

export interface NetworkQuery {
  q: string
  siteIds: string[]
  lowOnly: boolean
  sort: NetworkSort
  order: 'asc' | 'desc'
  page: number
}

export const NETWORK_PAGE_SIZE = 25

export function networkQueryString(q: NetworkQuery): string {
  const p = new URLSearchParams()
  if (q.q.trim()) p.set('q', q.q.trim())
  if (q.siteIds.length) p.set('siteIds', q.siteIds.join(','))
  if (q.lowOnly) p.set('low', '1')
  p.set('sort', q.sort)
  p.set('order', q.order)
  p.set('page', String(q.page))
  p.set('pageSize', String(NETWORK_PAGE_SIZE))
  return p.toString()
}

export const stockNetworkApi = {
  get: (q: NetworkQuery) => apiClient<NetworkStock>(`/stock/consolidated?${networkQueryString(q)}`),
}

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 })
export const formatQty = (n: number) => nf.format(n)

// Clic sur un en-tête : même colonne, on inverse ; autre colonne, ordre naturel
// (A à Z pour le nom, du plus au moins pour les quantités et les alertes)
export function nextSort(current: Pick<NetworkQuery, 'sort' | 'order'>, column: NetworkSort): Pick<NetworkQuery, 'sort' | 'order'> {
  if (current.sort === column) return { sort: column, order: current.order === 'asc' ? 'desc' : 'asc' }
  return { sort: column, order: column === 'name' ? 'asc' : 'desc' }
}

export function ariaSort(current: Pick<NetworkQuery, 'sort' | 'order'>, column: NetworkSort): 'ascending' | 'descending' | 'none' {
  if (current.sort !== column) return 'none'
  return current.order === 'asc' ? 'ascending' : 'descending'
}
