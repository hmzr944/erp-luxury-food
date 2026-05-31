import { apiClient } from './client'

export interface StockItemApi {
  id: string
  productId: string
  siteId: string
  quantity: number
  unit: string
  alertAt: number | null
  updatedAt: string
  product: { id: string; name: string; subtitle: string | null; sku: string | null }
}

export interface StockMovementApi {
  id: string
  siteId: string
  productId: string
  type: 'SALE' | 'RESTOCK' | 'ADJUSTMENT' | 'TRANSFER' | 'LOSS'
  quantity: number
  reason: string | null
  orderId: string | null
  createdAt: string
}

export const stockApi = {
  getInventory: (siteId: string) =>
    apiClient<StockItemApi[]>(`/sites/${siteId}/stock/inventory`),

  getAlerts: (siteId: string) =>
    apiClient<StockItemApi[]>(`/sites/${siteId}/stock/alerts`),

  getMovements: (siteId: string, productId?: string) => {
    const qs = productId ? `?productId=${productId}` : ''
    return apiClient<StockMovementApi[]>(`/sites/${siteId}/stock/movements${qs}`)
  },

  addMovement: (
    siteId: string,
    data: { productId: string; type: string; quantity: number; reason?: string },
  ) =>
    apiClient<StockMovementApi>(`/sites/${siteId}/stock/movements`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}
