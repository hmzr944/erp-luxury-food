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
  // Payable en titre-restaurant
  mealVoucherEligible?: boolean
  categoryId: string | null
  category: ApiCategory | null
  variants: ApiVariant[]
  options: ApiProductOption[]
  tracking: 'NONE' | 'LOT' | 'LOT_EXPIRY' | 'SERIAL'
  attributes: Record<string, unknown>
  stockItem: { quantity: string; alertAt: string | null } | null
  isActive: boolean
  imageUrl: string | null
  // Options et suppléments proposés à la vente
  modifierGroups?: Array<{ group: ApiModifierGroup }>
  // Formule : étapes de choix
  isMenu?: boolean
  menuSteps?: ApiMenuStep[]
  // Vente au poids : price est le prix au kilo
  soldByWeight?: boolean
  scaleCode?: string | null
}

export interface ApiModifierGroup {
  id: string
  name: string
  minSelect: number
  maxSelect: number | null
  modifiers: Array<{ id: string; name: string; price: number | string }>
}

export interface ApiMenuStep {
  id: string
  name: string
  minSelect: number
  maxSelect: number
  choices: Array<{ id: string; productId: string; variantId: string | null; supplement: number | string }>
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
  giftCardProduct: (siteId: string) => apiClient<{ id: string; taxRate: string }>(`/sites/${siteId}/products/gift-card`),

  // Code-barres inconnu : fiche proposée par les bases ouvertes (Open Food Facts...)
  lookup: (siteId: string, code: string) =>
    apiClient<{ existingProductId: string | null; suggestion: ProductSuggestion | null }>(
      `/sites/${siteId}/products/lookup/${encodeURIComponent(code)}`,
    ),

  getByBarcode: (siteId: string, barcode: string) =>
    apiClient<ApiProduct | null>(`/sites/${siteId}/products/barcode/${barcode}`),
}
