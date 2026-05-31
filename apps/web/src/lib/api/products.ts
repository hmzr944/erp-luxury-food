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
  isActive: boolean
  imageUrl: string | null
}

export interface ApiVariant {
  id: string
  name: string
  price: number
  barcode: string | null
}

export const productsApi = {
  getAll: (siteId: string) =>
    apiClient<ApiProduct[]>(`/sites/${siteId}/products`),

  getCategories: (siteId: string) =>
    apiClient<ApiCategory[]>(`/sites/${siteId}/categories`),

  getByBarcode: (siteId: string, barcode: string) =>
    apiClient<ApiProduct | null>(`/sites/${siteId}/products/barcode/${barcode}`),
}
