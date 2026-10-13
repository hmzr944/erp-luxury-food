import { apiClient } from './client'

export interface ApiCategory {
  id: string
  name: string
  color: string | null
  position: number
  _count: { products: number }
}

export interface ApiProduct {
  id: string
  siteId: string
  name: string
  subtitle: string | null
  description: string | null
  sku: string | null
  barcode: string | null
  price: number
  taxRate: number
  categoryId: string | null
  category: ApiCategory | null
  variants: ApiVariant[]
  options: ApiProductOption[]
  tracking: 'NONE' | 'LOT' | 'LOT_EXPIRY' | 'SERIAL'
  attributes: Record<string, unknown>
  stockItem: { quantity: string; alertAt: string | null } | null
  isActive: boolean
  imageUrl: string | null
}

export interface ProductSuggestion {
  barcode: string
  name: string
  brand?: string
  quantity?: string
  imageUrl?: string
  source: string
}

export interface ApiProductOption {
  id: string
  name: string
  values: string[]
  position: number
}

export interface ApiVariant {
  id: string
  name: string
  price: number
  barcode: string | null
  sku: string | null
  options: Record<string, string>
  stock: { quantity: string; alertAt: string | null } | null
}

export const productsApi = {
  getAll: (siteId: string) =>
    apiClient<ApiProduct[]>(`/sites/${siteId}/products`),

  getCategories: (siteId: string) =>
    apiClient<ApiCategory[]>(`/sites/${siteId}/categories`),

  // Produit technique « Article libre » (nom et prix saisis en caisse)
  customProduct: (siteId: string) => apiClient<{ id: string; taxRate: string }>(`/sites/${siteId}/products/custom`),

  // Code-barres inconnu : fiche proposée par les bases ouvertes (Open Food Facts...)
  lookup: (siteId: string, code: string) =>
    apiClient<{ existingProductId: string | null; suggestion: ProductSuggestion | null }>(
      `/sites/${siteId}/products/lookup/${encodeURIComponent(code)}`,
    ),

  getByBarcode: (siteId: string, barcode: string) =>
    apiClient<ApiProduct | null>(`/sites/${siteId}/products/barcode/${barcode}`),
}
