import { apiClient } from './client'

export type SupplyStatus = 'DRAFT' | 'SENT' | 'IN_PRODUCTION' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED'

export interface SupplyLine {
  id: string
  productId: string
  variantId: string | null
  name: string
  variantName: string | null
  unit: string | null
  unitPrice: number | null
  suggested: number | null
  ordered: number
  prepared: number | null
  received: number | null
  issue: string | null
}

export interface SupplyOrder {
  id: string
  number: number
  status: SupplyStatus
  deliveryDay: string
  fromSite: { id: string; name: string }
  toSite: { id: string; name: string }
  note: string | null
  receiptNote: string | null
  sentAt: string | null
  shippedAt: string | null
  receivedAt: string | null
  lines: SupplyLine[]
  shortages: Array<{ name: string; ordered: number; prepared: number }>
  amount: number
}

export interface Supplier {
  id: string
  name: string
  orderCutoff: string
  leadDays: number
  products: number
  deliveryDay: string
  cutoffAt: string
}

export interface DraftLine {
  productId: string
  variantId: string | null
  name: string
  variantName: string | null
  unit: string | null
  unitPrice: number | null
  category: string | null
  shopProductId: string | null
  suggested: number
  reason: string
  ordered: number
}

export interface SupplyDraft {
  supplier: { id: string; name: string }
  deliveryDay: string
  cutoffAt: string
  cutoffLocal: { day: string; time: string }
  editable: boolean
  order: SupplyOrder | null
  lines: DraftLine[]
}

export interface Production {
  day: string
  cutoffAt: string
  cutoffLocal: { day: string; time: string }
  orders: SupplyOrder[]
  consolidated: Array<{
    productId: string
    variantId: string | null
    name: string
    variantName: string | null
    unit: string | null
    total: number
    prepared: number
    bySite: Array<{ siteId: string; siteName: string; quantity: number }>
  }>
  waitingFor: Array<{ id: string; name: string }>
}

export interface CatalogItem {
  id: string
  name: string
  price: number
  orderable: boolean
  supplyPrice: number | null
  supplyUnit: string | null
  variants: Array<{ id: string; name: string }>
}

const base = (siteId: string) => `/sites/${siteId}/supply`
const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) })

export const supplyApi = {
  settings: (siteId: string, body: { isSupplier?: boolean; orderCutoff?: string; leadDays?: number }) =>
    apiClient(`${base(siteId)}/settings`, json('PATCH', body)),
  suppliers: (siteId: string) => apiClient<Supplier[]>(`${base(siteId)}/suppliers`),
  draft: (siteId: string, supplierId: string, day?: string) =>
    apiClient<SupplyDraft>(`${base(siteId)}/draft?supplierId=${supplierId}${day ? `&day=${day}` : ''}`),
  save: (
    siteId: string,
    body: { supplierId: string; deliveryDay: string; send: boolean; note?: string; lines: Array<{ productId: string; variantId: string | null; quantity: number; suggested?: number | null }> },
  ) => apiClient<SupplyOrder>(`${base(siteId)}/orders`, json('PUT', body)),
  outgoing: (siteId: string) => apiClient<SupplyOrder[]>(`${base(siteId)}/orders`),
  inbox: (siteId: string) =>
    apiClient<{ toReceive: SupplyOrder[]; reminders: Array<{ supplierId: string; supplierName: string; deliveryDay: string; cutoffAt: string }> }>(
      `${base(siteId)}/inbox`,
    ),
  receive: (siteId: string, id: string, body: { lines?: Array<{ lineId: string; received: number; issue?: string }>; note?: string }) =>
    apiClient<SupplyOrder>(`${base(siteId)}/orders/${id}/receive`, json('POST', body)),
  production: (siteId: string, day?: string) => apiClient<Production>(`${base(siteId)}/production${day ? `?day=${day}` : ''}`),
  start: (siteId: string, day: string) => apiClient<{ started: number }>(`${base(siteId)}/production/start`, json('POST', { day })),
  ship: (siteId: string, id: string, lines: Array<{ lineId: string; prepared: number }>) =>
    apiClient<SupplyOrder>(`${base(siteId)}/orders/${id}/ship`, json('POST', { lines })),
  catalog: (siteId: string) => apiClient<CatalogItem[]>(`${base(siteId)}/catalog`),
  updateCatalog: (siteId: string, productId: string, body: { orderable?: boolean; supplyPrice?: number | null; supplyUnit?: string | null }) =>
    apiClient(`${base(siteId)}/catalog/${productId}`, json('PATCH', body)),
  statement: (siteId: string, month: string) =>
    apiClient<{ month: string; total: number; rows: Array<{ siteId: string; siteName: string; orders: number; amount: number; unpriced: number }> }>(
      `${base(siteId)}/statement?month=${month}`,
    ),
}

// « Jeudi 15 octobre »
export const deliveryLabel = (day: string) => {
  const s = new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// « dans 45 min », « dans 3 h 20 », sinon « mercredi à 18:00 » à l'heure
// du labo (pas celle de l'appareil qui affiche)
export function untilLabel(iso: string, now = Date.now(), local?: { day: string; time: string }) {
  const ms = new Date(iso).getTime() - now
  if (ms <= 0) return null
  const min = Math.round(ms / 60_000)
  if (min < 60) return `dans ${min} min`
  if (min < 12 * 60 || !local) return `dans ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
  return `${deliveryLabel(local.day).split(' ')[0].toLowerCase()} à ${local.time}`
}

export const qty = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString('fr-FR', { maximumFractionDigits: 3 }))

export const STATUS_LABEL: Record<SupplyStatus, string> = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyée',
  IN_PRODUCTION: 'En fabrication',
  SHIPPED: 'Expédiée',
  RECEIVED: 'Réceptionnée',
  CANCELLED: 'Annulée',
}
