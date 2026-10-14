import { apiClient } from './client'

export interface CashSession {
  id: string
  terminalId: string
  status: 'OPEN' | 'CLOSED'
  openedAt: string
  openingFloat: number
  expectedOpening: number | null
  openingNote: string | null
  closedAt: string | null
  counted: number | null
  expectedCash: number | null
  difference: number | null
  differenceReason: string | null
  keptFloat: number | null
  deposit: number | null
}

export interface CashState {
  session: CashSession | null
  // Caisse restée ouverte depuis une journée précédente (oubli de clôture)
  stale?: { day: string; openedAt: string } | null
  suggestedOpening: number
  lastClosedAt: string | null
  floatTarget: number
  tolerance: number
}

export interface CashSettingsView {
  auto: boolean
  cashFloat: number
  cashTolerance: number
  recommended: { floatTarget: number; tolerance: number; reasons: string[] }
  manual: { cashFloat: number; cashTolerance: number }
}

const base = (siteId: string) => `/sites/${siteId}/cash`

export const cashApi = {
  current: (siteId: string, terminalId: string) => apiClient<CashState>(`${base(siteId)}/current?terminalId=${terminalId}`),
  open: (siteId: string, body: { terminalId: string; amount: number; note?: string }) =>
    apiClient<CashSession>(`${base(siteId)}/open`, { method: 'POST', body: JSON.stringify(body) }),
  close: (siteId: string, body: { terminalId: string; denominations: Record<string, number>; reason?: string }) =>
    apiClient<CashSession & { withinTolerance: boolean; keep: Record<string, number>; depositDetail: Record<string, number>; exactFloat: boolean }>(`${base(siteId)}/close`, { method: 'POST', body: JSON.stringify(body) }),
  sessions: (siteId: string) => apiClient<CashSession[]>(`${base(siteId)}/sessions`),
  getSettings: (siteId: string) => apiClient<CashSettingsView>(`${base(siteId)}/settings`),
  settings: (siteId: string, body: { cashAuto?: boolean; cashFloat?: number; cashTolerance?: number }) =>
    apiClient<CashSettingsView>(`${base(siteId)}/settings`, { method: 'PATCH', body: JSON.stringify(body) }),
}
