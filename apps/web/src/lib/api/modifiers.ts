import type { ScaleBarcodeRule } from '@erp/utils'
import { apiClient } from './client'
import type { PlatformConfig } from './platform'

export interface ModifierGroupAdmin {
  id: string
  name: string
  minSelect: number
  maxSelect: number | null
  modifiers: Array<{ id: string; name: string; price: number | string }>
  _count?: { products: number }
}

export interface ModifierGroupPayload {
  name: string
  minSelect: number
  maxSelect: number | null
  modifiers: Array<{ id?: string; name: string; price: number }>
}

// Groupes d'options d'une boutique et étiquettes de balance de l'organisation
export const modifiersApi = {
  list: (siteId: string) => apiClient<ModifierGroupAdmin[]>(`/sites/${siteId}/modifier-groups`),
  create: (siteId: string, data: ModifierGroupPayload) =>
    apiClient<ModifierGroupAdmin>(`/sites/${siteId}/modifier-groups`, { method: 'POST', body: JSON.stringify(data) }),
  update: (siteId: string, id: string, data: ModifierGroupPayload) =>
    apiClient<ModifierGroupAdmin>(`/sites/${siteId}/modifier-groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (siteId: string, id: string) => apiClient<{ success: boolean }>(`/sites/${siteId}/modifier-groups/${id}`, { method: 'DELETE' }),
  saveScaleRules: (rules: ScaleBarcodeRule[]) =>
    apiClient<PlatformConfig>('/organizations/me/platform', { method: 'PATCH', body: JSON.stringify({ scaleBarcodes: rules }) }),
}
