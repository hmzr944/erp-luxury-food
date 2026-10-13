import { apiClient } from './client'

export interface ApiSite {
  id: string
  name: string
  address: string | null
}

export const sitesApi = {
  getAll: () => apiClient<ApiSite[]>('/sites'),
}
