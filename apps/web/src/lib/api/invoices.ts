import { apiClient } from './client'

export interface InvoiceRecord {
  id: string
  invoiceNumber: string
  invoicedAt: string
  total: number
  status: string
  paymentTerms: number | null
  b2bClient: { id: string; name: string } | null
  site: { name: string }
  receiptChain: { counter: number } | null
  _count: { items: number }
}

export const invoicesApi = {
  list: (params?: { clientId?: string; year?: number }) => {
    const qs = new URLSearchParams()
    if (params?.clientId) qs.set('clientId', params.clientId)
    if (params?.year) qs.set('year', String(params.year))
    return apiClient<InvoiceRecord[]>(`/invoices?${qs}`)
  },

  generate: (siteId: string, orderId: string) =>
    apiClient<any>(`/invoices/sites/${siteId}/orders/${orderId}/invoice`, { method: 'POST' }),

  exportFacturXUrl: (orderId: string) =>
    `${process.env.NEXT_PUBLIC_API_URL}/api/invoices/${orderId}/facturx`,

  markPaid: (orderId: string) =>
    apiClient<any>(`/invoices/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'PAID' }) }),

  markRefused: (orderId: string) =>
    apiClient<any>(`/invoices/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'REFUSED' }) }),
}

export const orgSettingsApi = {
  get: () => apiClient<any>('/organizations/me/settings'),
  save: (data: any) =>
    apiClient<any>('/organizations/me/settings', { method: 'PUT', body: JSON.stringify(data) }),
}

export const consolidatedDashboardApi = {
  get: () => apiClient<any>('/dashboard/consolidated'),
}
