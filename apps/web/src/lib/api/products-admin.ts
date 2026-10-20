import { apiClient } from './client'
import type { ApiProduct, ApiCategory } from './products'

export interface CreateProductPayload {
  name: string
  subtitle?: string
  description?: string
  sku?: string
  barcode?: string
  price: number
  taxRate?: number
  mealVoucherEligible?: boolean
  categoryId?: string
  imageUrl?: string
  variants?: Array<{ name: string; price: number; barcode?: string }>
  isMenu?: boolean
  soldByWeight?: boolean
  scaleCode?: string | null
  // Seuil d'alerte de stock bas ; null (modification) l'efface
  alertAt?: number | null
  modifierGroupIds?: string[]
  menuSteps?: Array<{ name: string; minSelect: number; maxSelect: number; choices: Array<{ productId: string; supplement: number }> }>
  // Suivi du stock : sans lot, par lot, par date limite ou par numéro de série
  tracking?: 'NONE' | 'LOT' | 'LOT_EXPIRY' | 'SERIAL'
  // Valeurs des champs de la fiche (millésime, origine...), validées par l'API
  attributes?: Record<string, unknown>
}

export interface CreateCategoryPayload {
  name: string
  color?: string
}

export interface AttributeDefinitionApi {
  id: string
  key: string
  label: string
  type: string
  options: string[]
  pack: string | null
  required: boolean
}

export const productsAdminApi = {
  attributeDefinitions: (siteId: string) =>
    apiClient<AttributeDefinitionApi[]>(`/sites/${siteId}/products/attribute-definitions`),

  getAll: (siteId: string) =>
    apiClient<ApiProduct[]>(`/sites/${siteId}/products?all=true`),

  create: (siteId: string, data: CreateProductPayload) =>
    apiClient<ApiProduct>(`/sites/${siteId}/products`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (siteId: string, id: string, data: Partial<CreateProductPayload> & { isActive?: boolean }) =>
    apiClient<ApiProduct>(`/sites/${siteId}/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  remove: (siteId: string, id: string) =>
    apiClient<{ id: string; isActive: boolean }>(`/sites/${siteId}/products/${id}`, {
      method: 'DELETE',
    }),

  createCategory: (siteId: string, data: CreateCategoryPayload) =>
    apiClient<ApiCategory>(`/sites/${siteId}/categories`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCategory: (siteId: string, id: string, data: Partial<CreateCategoryPayload>) =>
    apiClient<ApiCategory>(`/sites/${siteId}/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  removeCategory: (siteId: string, id: string) =>
    apiClient<{ success: boolean }>(`/sites/${siteId}/categories/${id}`, {
      method: 'DELETE',
    }),
}
