import { apiClient } from './client'

export interface RoutineTask {
  key: string
  kind: 'SUPPLY' | 'CASH' | 'CUSTOM'
  label: string
  deadlineAt: string
  done: boolean
  doneAt: string | null
  doneBy: string | null
  overdue: boolean
}

export interface RoutineStatus {
  enabled: boolean
  day: string
  openDay: boolean
  closingAt: string
  alertAt: string
  autoLock: boolean
  level: 0 | 1 | 2 | 3
  tasks: RoutineTask[]
}

export interface RoutineSettings {
  enabled: boolean
  closingTime: string
  supplyDeadline: string | null
  cashDeadline: string | null
  days: number[]
  reminderMinutes: number
  alertAfterMinutes: number
  autoLock: boolean
  notifyEmails: string[]
  tasks: Array<{ key: string; label: string; deadline?: string | null }>
  configured: boolean
  canOrderSupply: boolean
}

const base = (siteId: string) => `/sites/${siteId}/routine`

export const routineApi = {
  status: (siteId: string) => apiClient<RoutineStatus>(`${base(siteId)}/status`),
  check: (siteId: string, key: string, done: boolean) => apiClient<RoutineStatus>(`${base(siteId)}/checks/${encodeURIComponent(key)}`, { method: 'POST', body: JSON.stringify({ done }) }),
  settings: (siteId: string) => apiClient<RoutineSettings>(`${base(siteId)}/settings`),
  update: (siteId: string, body: Partial<Omit<RoutineSettings, 'configured' | 'canOrderSupply'>>) =>
    apiClient<RoutineSettings>(`${base(siteId)}/settings`, { method: 'PATCH', body: JSON.stringify(body) }),
}

export const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
