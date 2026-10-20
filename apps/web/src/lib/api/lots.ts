import { apiClient } from './client'

export type LotStatus = 'NO_DATE' | 'EXPIRED' | 'TODAY' | 'SOON' | 'NEAR' | 'OK'
export type LotFilter = 'all' | 'expired' | '7' | '30'
export type DateKind = 'DLC' | 'DDM'

export interface LotRow {
  id: string
  productId: string
  productName: string
  variantName: string | null
  tracking: 'LOT' | 'LOT_EXPIRY' | 'SERIAL' | 'NONE'
  dateKind: DateKind
  lotNumber: string | null
  serialNumber: string | null
  quantity: number
  unit: string
  // Jours AAAA-MM-JJ, calendrier de Paris
  receivedAt: string
  expiresAt: string | null
  daysLeft: number | null
  status: LotStatus
}

export interface ClearingLine {
  productId: string
  name: string
  unit: string
  quantity: number
  daysLeft: number
  lots: number
}

export interface LotsResponse {
  today: string
  lots: LotRow[]
  counts: { all: number; expired: number; week: number; month: number }
  toClear: ClearingLine[]
}

export interface ReceiveLotPayload {
  productId: string
  variantId?: string
  lotNumber?: string
  expiresAt?: string
  quantity?: number
  serialNumbers?: string[]
  receivedAt?: string
}

export const lotsApi = {
  list: (siteId: string, filter: LotFilter = 'all') =>
    apiClient<LotsResponse>(`/sites/${siteId}/lots?filtre=${filter}`),

  // Produits qui n'ont plus que des lots périmés (avertissement en caisse)
  expiredOnly: (siteId: string) => apiClient<{ productIds: string[] }>(`/sites/${siteId}/lots/perimes`),

  receive: (siteId: string, data: ReceiveLotPayload) =>
    apiClient<{ lotId: string; movementId: string; quantity: number }>(`/sites/${siteId}/lots`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  loss: (siteId: string, lotId: string, data: { quantity?: number; reason: string }) =>
    apiClient<{ movementId: string; quantity: number; remaining: number }>(`/sites/${siteId}/lots/${lotId}/perte`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}
