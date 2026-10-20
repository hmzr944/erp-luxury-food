import { apiClient } from './client'

export type CorrectionReason = 'CASSE' | 'VOL' | 'ERREUR_SAISIE' | 'DON' | 'AUTRE'

export const CORRECTION_REASONS: Array<{ code: CorrectionReason; label: string }> = [
  { code: 'CASSE', label: 'Casse' },
  { code: 'VOL', label: 'Vol' },
  { code: 'ERREUR_SAISIE', label: 'Erreur de saisie' },
  { code: 'DON', label: 'Don' },
  { code: 'AUTRE', label: 'Autre' },
]

// Une ligne par produit sans variante et par variante
export interface StockItemApi {
  id: string
  productId: string
  variantId: string | null
  variantName: string | null
  siteId: string
  quantity: number | string
  unit: string
  alertAt: number | string | null
  updatedAt: string
  product: {
    id: string
    name: string
    subtitle: string | null
    sku: string | null
    barcode: string | null
    tracking: 'NONE' | 'LOT' | 'LOT_EXPIRY' | 'SERIAL'
  }
}

export interface StockMovementApi {
  id: string
  siteId: string
  productId: string
  variantId: string | null
  type: 'SALE' | 'RESTOCK' | 'ADJUSTMENT' | 'TRANSFER' | 'LOSS'
  quantity: number | string
  reason: string | null
  reasonCode: string | null
  orderId: string | null
  createdAt: string
}

export interface StockCorrectionResult {
  previousQuantity: string
  countedQuantity: string
  delta: string
}

export const stockApi = {
  getInventory: (siteId: string) =>
    apiClient<StockItemApi[]>(`/sites/${siteId}/stock/inventory`),

  getAlerts: (siteId: string) =>
    apiClient<StockItemApi[]>(`/sites/${siteId}/stock/alerts`),

  getMovements: (siteId: string, productId?: string) => {
    const qs = productId ? `?productId=${productId}&limit=200` : '?limit=200'
    return apiClient<StockMovementApi[]>(`/sites/${siteId}/stock/movements${qs}`)
  },

  // Réception (entrée) ou perte (sortie)
  addMovement: (
    siteId: string,
    data: { productId: string; variantId?: string; type: 'RESTOCK' | 'LOSS'; quantity: number; reason?: string },
  ) =>
    apiClient<StockMovementApi>(`/sites/${siteId}/stock/movements`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Fixe la quantité réellement comptée ; l'écart est calculé par le serveur
  correct: (
    siteId: string,
    data: { productId: string; variantId?: string; countedQuantity: number; reasonCode: CorrectionReason; note?: string },
  ) =>
    apiClient<StockCorrectionResult>(`/sites/${siteId}/stock/corrections`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Seuil d'alerte (null l'efface) et unité
  updateItem: (
    siteId: string,
    productId: string,
    data: { variantId?: string; alertAt?: number | null; unit?: string },
  ) =>
    apiClient<unknown>(`/sites/${siteId}/stock/items/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
}
