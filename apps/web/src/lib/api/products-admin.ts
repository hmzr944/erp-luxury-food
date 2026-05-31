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
  categoryId?: string
  variants?: Array<{ name: string; price: number; barcode?: string }>
}

export interface CreateCategoryPayload {
  name: string
  color?: string
}

export const productsAdminApi = {
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

export const complianceApi = {
  closeDay: (siteId: string) =>
    apiClient<any>(`/sites/${siteId}/compliance/close-day`, { method: 'POST' }),

  getClosures: (siteId: string) =>
    apiClient<any[]>(`/sites/${siteId}/compliance/closures`),

  verify: (siteId: string, date: string) =>
    apiClient<any>(`/sites/${siteId}/compliance/verify/${date}`),

  exportUrl: (siteId: string) =>
    `${process.env.NEXT_PUBLIC_API_URL}/api/sites/${siteId}/compliance/export/dgfip`,
}
