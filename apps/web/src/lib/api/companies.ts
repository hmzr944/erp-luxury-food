import { apiClient } from './client'

export interface Company {
  name: string
  siren: string
  siret: string | null
  vatNumber: string | null
  address: string | null
  zipCode: string | null
  city: string | null
  active: boolean
}

export interface InvoiceCompanyInput {
  name: string
  siret?: string
  vatNumber?: string
  address?: string
  zipCode?: string
  city?: string
}

export const companiesApi = {
  search: (q: string) => apiClient<Company[]>(`/companies/search?q=${encodeURIComponent(q)}`),
  invoice: (siteId: string, clientId: string, body: { company: InvoiceCompanyInput; email?: string }) =>
    apiClient<{ invoiceNumber: string; emailed: boolean; reason?: string }>(`/sites/${siteId}/receipts/${clientId}/invoice`, { method: 'POST', body: JSON.stringify(body) }),
}

export const invoicePdfUrl = (clientId: string) => `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/receipts/${clientId}/invoice`
