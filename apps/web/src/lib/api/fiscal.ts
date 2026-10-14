import { apiClient, authorizedFetch } from './client'

export type ClosurePeriod = 'DAY' | 'MONTH' | 'YEAR'

export interface FiscalClosure {
  id: string
  period: ClosurePeriod
  label: string
  seq: number
  firstCounter: number | null
  lastCounter: number | null
  ticketCount: number
  salesCount: number
  refundCount: number
  salesTotal: string
  refundsTotal: string
  periodTotal: string
  totalHT: string
  totalTax: string
  taxBreakdown: Array<{ rate: number; ht: number; tax: number; ttc: number }>
  paymentBreakdown: Array<{ code: string; label: string; amount: number }>
  perpetualTotal: string
  perpetualAbsTotal: string
  hash: string
  previousHash: string
  auto: boolean
  closedAt: string
}

export interface FiscalSummary {
  software: { name: string; majorVersion: string; version: string; releasedAt: string }
  lastCounter: number
  perpetualTotal: string
  perpetualAbsTotal: string
  pending: { fromCounter: number; tickets: number; total: string }
  lastClosures: Record<ClosurePeriod, FiscalClosure | null>
  archives: number
}

export interface FiscalEvent {
  id: string
  seq: number
  code: string
  label: string
  detail: Record<string, unknown> | null
  userId: string | null
  terminalId: string | null
  hash: string
  createdAt: string
}

export interface FiscalArchive {
  id: string
  period: ClosurePeriod
  label: string
  fromCounter: number | null
  toCounter: number | null
  sha256: string
  size: number
  createdAt: string
}

export interface VerifyResult {
  valid: boolean
  chain: { checked: number; errors: string[]; perpetualTotal?: string }
  closures: { checked: number; errors: string[] }
  journal: { checked: number; errors: string[] }
}

export interface AttestationStatus {
  available: boolean
  licence: string
  software: FiscalSummary['software']
  covered: string[]
  notCovered: string[]
}

const base = (siteId: string) => `/sites/${siteId}/compliance`

export const fiscalApi = {
  summary: (siteId: string) => apiClient<FiscalSummary>(`${base(siteId)}/summary`),
  closures: (siteId: string, period: ClosurePeriod) => apiClient<FiscalClosure[]>(`${base(siteId)}/closures?period=${period}`),
  closeDay: (siteId: string) => apiClient<FiscalClosure>(`${base(siteId)}/closures/day`, { method: 'POST', body: '{}' }),
  closeMonth: (siteId: string, label: string) => apiClient<FiscalClosure>(`${base(siteId)}/closures/month`, { method: 'POST', body: JSON.stringify({ label }) }),
  verify: (siteId: string) => apiClient<VerifyResult>(`${base(siteId)}/verify`),
  events: (siteId: string) => apiClient<FiscalEvent[]>(`${base(siteId)}/events`),
  archives: (siteId: string) => apiClient<FiscalArchive[]>(`${base(siteId)}/archives`),
  attestation: () => apiClient<AttestationStatus>('/organizations/me/attestation/status'),
  training: (siteId: string, active: boolean, terminalId?: string) =>
    apiClient<{ active: boolean }>(`${base(siteId)}/training`, { method: 'POST', body: JSON.stringify({ active, terminalId }) }),
  trainingTicket: (siteId: string, body: { total: number; content: Record<string, unknown>; terminalId?: string }) =>
    apiClient<{ number: number; userName: string; createdAt: string }>(`${base(siteId)}/training-tickets`, { method: 'POST', body: JSON.stringify(body) }),
  duplicate: (siteId: string, orderId: string, terminalId?: string) =>
    apiClient<{ number: number; createdAt: string }>(`${base(siteId)}/orders/${orderId}/duplicate`, { method: 'POST', body: JSON.stringify({ terminalId }) }),
}

// Téléchargement authentifié (PDF, archives, exports) sous le nom donné par le serveur
export async function downloadFile(path: string, fallbackName: string) {
  const res = await authorizedFetch(path)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message
    throw new Error(message ?? (res.status === 403 ? 'Réservé aux responsables' : `Téléchargement impossible (${res.status})`))
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? fallbackName
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export const fiscalPaths = {
  archive: (siteId: string, id: string) => `${base(siteId)}/archives/${id}/download`,
  attestation: () => '/organizations/me/attestation',
  closuresCsv: (siteId: string, period: ClosurePeriod) => `${base(siteId)}/export/closures?period=${period}`,
}
