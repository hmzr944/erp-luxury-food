import { apiClient } from './client'
import type { CorrectionReason } from './stock'

export type InventoryStatus = 'DRAFT' | 'VALIDATED' | 'CANCELLED'

export interface InventoryLineApi {
  id: string
  countId: string
  productId: string
  variantId: string | null
  name: string
  sku: string | null
  barcode: string | null
  unit: string
  expectedQty: string | number
  countedQty: string | number | null
  reasonCode: CorrectionReason | null
  note: string | null
  gap: number | null
}

export interface InventorySummary {
  total: number
  counted: number
  uncounted: number
  withGap: number
  surplus: number
  missing: number
}

export interface InventoryApi {
  id: string
  siteId: string
  status: InventoryStatus
  categoryId: string | null
  categoryName: string | null
  createdById: string | null
  validatedById: string | null
  createdAt: string
  validatedAt: string | null
  cancelledAt: string | null
  summary: InventorySummary
}

export interface InventoryDetailApi extends InventoryApi {
  lines: InventoryLineApi[]
  // Nombre de corrections écrites à la validation
  adjusted?: number
}

export const inventoryApi = {
  list: (siteId: string) => apiClient<InventoryApi[]>(`/sites/${siteId}/inventories`),
  current: (siteId: string) => apiClient<InventoryDetailApi | null>(`/sites/${siteId}/inventories/current`),
  get: (siteId: string, id: string) => apiClient<InventoryDetailApi>(`/sites/${siteId}/inventories/${id}`),
  start: (siteId: string, categoryId?: string) =>
    apiClient<InventoryDetailApi>(`/sites/${siteId}/inventories`, {
      method: 'POST',
      body: JSON.stringify(categoryId ? { categoryId } : {}),
    }),
  countLine: (
    siteId: string,
    id: string,
    lineId: string,
    data: { countedQty?: number | null; reasonCode?: CorrectionReason | ''; note?: string },
  ) =>
    apiClient<InventoryLineApi>(`/sites/${siteId}/inventories/${id}/lines/${lineId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  validate: (siteId: string, id: string) =>
    apiClient<InventoryDetailApi>(`/sites/${siteId}/inventories/${id}/validate`, { method: 'POST', body: '{}' }),
  cancel: (siteId: string, id: string) =>
    apiClient<InventoryDetailApi>(`/sites/${siteId}/inventories/${id}/cancel`, { method: 'POST', body: '{}' }),
}
