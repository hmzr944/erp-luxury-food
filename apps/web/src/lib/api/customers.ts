import { apiClient } from './client'

export interface LoyaltySettings {
  enabled: boolean
  pointsPerEuro: number
  threshold: number
  reward: number
  giftCardMonths: number | null
}

export interface ApiCustomer {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  email: string | null
  points: number
  visits: number
  totalSpent: number
  lastVisitAt: string | null
  marketingOptIn: boolean
  reward: { count: number; points: number; amount: number }
}

export interface CustomerInput {
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  marketingOptIn?: boolean
}

export const customerName = (c: Pick<ApiCustomer, 'firstName' | 'lastName' | 'phone' | 'email'>) =>
  [c.firstName, c.lastName].filter(Boolean).join(' ') || c.phone || c.email || 'Client'

export const customersApi = {
  loyalty: () => apiClient<LoyaltySettings>('/customers/loyalty'),
  updateLoyalty: (body: Partial<LoyaltySettings>) =>
    apiClient<LoyaltySettings>('/customers/loyalty', { method: 'PUT', body: JSON.stringify(body) }),
  search: (q: string) => apiClient<ApiCustomer[]>(`/customers?q=${encodeURIComponent(q)}`),
  create: (body: CustomerInput) => apiClient<ApiCustomer>('/customers', { method: 'POST', body: JSON.stringify(body) }),
  remove: (id: string) => apiClient<{ deleted: boolean }>(`/customers/${id}`, { method: 'DELETE' }),
}
