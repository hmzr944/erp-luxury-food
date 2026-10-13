import { apiClient } from './client'

export interface ApiSite {
  id: string
  name: string
  address: string | null
  isSupplier?: boolean
  orderCutoff?: string
  leadDays?: number
}

export const sitesApi = {
  getAll: () => apiClient<ApiSite[]>('/sites'),
}
