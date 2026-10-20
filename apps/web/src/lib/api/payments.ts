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
  // Absent : paiement par QR code
  deviceId: string | null
  checkoutUrl?: string | null
  expiresAt?: string | null
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
  // Paiement par QR : prestataire disponible (Stripe, ou TPE virtuel pour essayer)
  qrProvider: (siteId: string) => apiClient<{ provider: PaymentProvider | null }>(`/sites/${siteId}/terminal-payments/qr`),
  startQr: (siteId: string, body: { amount: number; clientSaleId?: string }) =>
    apiClient<TerminalPayment>(`/sites/${siteId}/terminal-payments/qr`, json(body)),
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

// Le serveur ne passe un paiement à « annulé » que si le prestataire le confirme
export const CANCEL_UNCONFIRMED_MESSAGE = "L'annulation n'a pas été confirmée par le terminal : vérifiez sur le TPE"

// Annule un paiement TPE ou QR. done : le paiement est bien clos, la caisse peut
// quitter l'attente. Sinon (message présent ou non), le paiement reste en cours :
// la caisse garde son interrogation, car le client a pu payer entre-temps.
export async function cancelPayment(siteId: string, id: string): Promise<{ done: boolean; message?: string }> {
  try {
    const p = await paymentsApi.cancel(siteId, id)
    return { done: p.status === 'CANCELED' || p.status === 'FAILED' }
  } catch {
    return { done: false, message: CANCEL_UNCONFIRMED_MESSAGE }
  }
}
