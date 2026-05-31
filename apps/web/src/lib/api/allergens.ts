import { apiClient } from './client'

export interface AllergenApi {
  id: string
  name: string
  code: string
  isInco: boolean
}

export interface ProductAllergenApi {
  productId: string
  allergenId: string
  traces: boolean
  allergen: AllergenApi
}

export interface ProductWithAllergens {
  id: string
  name: string
  subtitle: string | null
  category: { name: string; color: string | null } | null
  allergens: ProductAllergenApi[]
}

export const allergensApi = {
  getAll: () =>
    apiClient<AllergenApi[]>('/allergens'),

  getProductsWithAllergens: (siteId: string) =>
    apiClient<ProductWithAllergens[]>(`/sites/${siteId}/allergens`),

  setProductAllergens: (
    siteId: string,
    productId: string,
    allergens: Array<{ allergenId: string; traces: boolean }>,
  ) =>
    apiClient<ProductAllergenApi[]>(`/sites/${siteId}/allergens/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({ allergens }),
    }),
}
