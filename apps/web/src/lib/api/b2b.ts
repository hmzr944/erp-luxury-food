import { apiClient } from './client'

export interface B2BClient {
  id: string
  name: string
  siret: string | null
  vatNumber: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  zipCode: string | null
  country: string
  discount: number | null
  paymentTerms: number
  notes: string | null
  createdAt: string
  _count?: { orders: number }
}

export interface B2BOrder {
  id: string
  status: string
  total: number
  paymentTerms: number | null
  invoiceNumber: string | null
  invoicedAt: string | null
  createdAt: string
  b2bClient: { id: string; name: string; paymentTerms: number } | null
  items: Array<{ name: string; quantity: number; price: number; taxRate: number }>
  receiptChain: { counter: number } | null
  site?: { name: string; address: string | null; organization: { name: string } }
}

export const b2bApi = {
  getClients: () => apiClient<B2BClient[]>('/b2b/clients'),

  getClient: (id: string) => apiClient<B2BClient>(`/b2b/clients/${id}`),

  createClient: (data: Partial<B2BClient>) =>
    apiClient<B2BClient>('/b2b/clients', { method: 'POST', body: JSON.stringify(data) }),

  updateClient: (id: string, data: Partial<B2BClient>) =>
    apiClient<B2BClient>(`/b2b/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteClient: (id: string) =>
    apiClient<{ success: boolean }>(`/b2b/clients/${id}`, { method: 'DELETE' }),

  getClientStats: (id: string) =>
    apiClient<{ totalOrders: number; totalRevenue: number; avgOrder: number }>(`/b2b/clients/${id}/stats`),

  getB2BOrders: (siteId: string, params?: { clientId?: string; status?: string }) => {
    const qs = new URLSearchParams()
    if (params?.clientId) qs.set('clientId', params.clientId)
    if (params?.status) qs.set('status', params.status)
    return apiClient<B2BOrder[]>(`/sites/${siteId}/b2b-orders?${qs}`)
  },

  createB2BOrder: (
    siteId: string,
    data: {
      b2bClientId: string
      items: Array<{ productId: string; quantity: number; unitPrice?: number }>
      paymentTerms?: number
      note?: string
      orderDiscount?: number
    },
  ) => apiClient<B2BOrder>(`/sites/${siteId}/b2b-orders`, { method: 'POST', body: JSON.stringify(data) }),

  generateInvoice: (siteId: string, orderId: string) =>
    apiClient<B2BOrder>(`/sites/${siteId}/b2b-orders/${orderId}/invoice`, { method: 'POST' }),

  getInvoiceData: (siteId: string, orderId: string) =>
    apiClient<B2BOrder>(`/sites/${siteId}/b2b-orders/${orderId}/invoice`),
}

export const apiTokensApi = {
  getAll: () => apiClient<any[]>('/api-tokens'),
  getScopes: () => apiClient<string[]>('/api-tokens/scopes'),
  create: (data: { name: string; scopes: string[]; expiresAt?: string }) =>
    apiClient<{ token: string; record: any }>('/api-tokens', { method: 'POST', body: JSON.stringify(data) }),
  revoke: (id: string) => apiClient<{ success: boolean }>(`/api-tokens/${id}`, { method: 'DELETE' }),
}

export const webhooksApi = {
  getAll: () => apiClient<any[]>('/webhooks'),
  getEvents: () => apiClient<string[]>('/webhooks/events'),
  create: (data: { url: string; events: string[] }) =>
    apiClient<any>('/webhooks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { url?: string; events?: string[]; isActive?: boolean }) =>
    apiClient<any>(`/webhooks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  test: (id: string) => apiClient<{ queued: boolean }>(`/webhooks/${id}/test`, { method: 'POST' }),
  delete: (id: string) => apiClient<{ success: boolean }>(`/webhooks/${id}`, { method: 'DELETE' }),
}
