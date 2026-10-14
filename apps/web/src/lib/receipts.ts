import { apiClient } from './api/client'

// Lien du ticket dématérialisé : identifiant de la vente tiré par la caisse,
// connu dès l'encaissement, même hors ligne
export function receiptUrl(clientId: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base}/r/${clientId}`
}

export const receiptsApi = {
  email: (siteId: string, clientId: string, email: string) =>
    apiClient<{ sent: boolean; reason?: string }>(`/sites/${siteId}/receipts/${clientId}/email`, { method: 'POST', body: JSON.stringify({ email }) }),
}
