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
  createdAt: string
  reward: { count: number; points: number; amount: number }
}

export interface LoyaltyEntryView {
  points: number
  reason: 'EARN' | 'REDEEM' | 'REFUND' | 'ADJUST'
  note: string | null
  orderId: string | null
  createdAt: string
}

export interface CustomerInput {
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  marketingOptIn?: boolean
}

// +33612345678 → 06 12 34 56 78 (numéros étrangers laissés tels quels)
export const displayPhone = (p: string | null) =>
  p && /^\+33\d{9}$/.test(p) ? `0${p.slice(3)}`.replace(/(\d{2})(?=\d)/g, '$1 ') : p

export const customerName = (c: Pick<ApiCustomer, 'firstName' | 'lastName' | 'phone' | 'email'>) =>
  [c.firstName, c.lastName].filter(Boolean).join(' ') || displayPhone(c.phone) || c.email || 'Client'

export const customersApi = {
  loyalty: () => apiClient<LoyaltySettings>('/customers/loyalty'),
  updateLoyalty: (body: Partial<LoyaltySettings>) =>
    apiClient<LoyaltySettings>('/customers/loyalty', { method: 'PUT', body: JSON.stringify(body) }),
  search: (q: string) => apiClient<ApiCustomer[]>(`/customers?q=${encodeURIComponent(q)}`),
  create: (body: CustomerInput) => apiClient<ApiCustomer>('/customers', { method: 'POST', body: JSON.stringify(body) }),
  get: (id: string) => apiClient<ApiCustomer & { entries: LoyaltyEntryView[] }>(`/customers/${id}`),
  adjust: (id: string, body: { points: number; note: string }) =>
    apiClient<ApiCustomer & { entries: LoyaltyEntryView[] }>(`/customers/${id}/adjust`, { method: 'POST', body: JSON.stringify(body) }),
  remove: (id: string) => apiClient<{ deleted: boolean }>(`/customers/${id}`, { method: 'DELETE' }),
}
