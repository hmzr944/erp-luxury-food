import { apiClient } from './client'

export type PaymentProvider = 'SIMULATOR' | 'STRIPE' | 'SUMUP'
export type TerminalPaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED'

export interface PaymentDevice {
  id: string
  provider: PaymentProvider
  name: string
  createdAt: string
}

export interface TerminalPayment {
  id: string
  deviceId: string
  provider: PaymentProvider
  amount: number // centimes
  status: TerminalPaymentStatus
  failureReason: string | null
  createdAt: string
}

export interface PaymentAccount {
  provider: PaymentProvider
  testMode: boolean
  key: string
  merchantCode?: string
  updatedAt: string
}

export const PROVIDER_LABEL: Record<PaymentProvider, string> = {
  SIMULATOR: 'TPE virtuel',
  STRIPE: 'Stripe Terminal',
  SUMUP: 'SumUp Solo',
}

const json = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) })

export const paymentsApi = {
  devices: (siteId: string) => apiClient<PaymentDevice[]>(`/sites/${siteId}/payment-devices`),
  pair: (siteId: string, body: { provider: PaymentProvider; name: string; code?: string; address?: Record<string, string> }) =>
    apiClient<PaymentDevice>(`/sites/${siteId}/payment-devices`, json(body)),
  removeDevice: (siteId: string, id: string) => apiClient(`/sites/${siteId}/payment-devices/${id}`, { method: 'DELETE' }),
  pending: (siteId: string, deviceId: string) =>
    apiClient<TerminalPayment | null>(`/sites/${siteId}/payment-devices/${deviceId}/pending`),

  start: (siteId: string, body: { deviceId: string; amount: number; clientSaleId?: string; force?: boolean }) =>
    apiClient<TerminalPayment>(`/sites/${siteId}/terminal-payments`, json(body)),
  get: (siteId: string, id: string) => apiClient<TerminalPayment>(`/sites/${siteId}/terminal-payments/${id}`),
  cancel: (siteId: string, id: string) => apiClient<TerminalPayment>(`/sites/${siteId}/terminal-payments/${id}/cancel`, json({})),
  simulate: (siteId: string, id: string, approve: boolean) =>
    apiClient<TerminalPayment>(`/sites/${siteId}/terminal-payments/${id}/simulate`, json({ approve })),

  accounts: () => apiClient<PaymentAccount[]>('/organizations/me/payment-accounts'),
  saveAccount: (provider: PaymentProvider, credentials: Record<string, string>) =>
    apiClient<PaymentAccount>(`/organizations/me/payment-accounts/${provider.toLowerCase()}`, {
      method: 'PUT',
      body: JSON.stringify({ credentials }),
    }),
  removeAccount: (provider: PaymentProvider) =>
    apiClient(`/organizations/me/payment-accounts/${provider.toLowerCase()}`, { method: 'DELETE' }),
}
