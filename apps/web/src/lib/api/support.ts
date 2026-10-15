import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'

export type SupportStatus = 'OPEN' | 'WAITING_CUSTOMER' | 'RESOLVED'
export type SupportPriority = 'NORMAL' | 'URGENT'

export interface SupportInfo {
  timeZone: string
  slaMinutes: number | null
  urgentSlaMinutes: number | null
  // Texte de la promesse, construit par le serveur à partir de sa configuration
  promise: string | null
  urgentPromise: string | null
  hoursConfigured: boolean
  openNow: boolean
  nextOpenAt: string | null
  trialContact: { name: string; phone: string | null } | null
  isAgent: boolean
}

export interface SupportMessage {
  id: string
  author: 'USER' | 'AGENT' | 'SYSTEM'
  authorName: string
  body: string
  createdAt: string
  readAt: string | null
}

export interface SupportContext {
  appVersion?: string
  page?: string
  siteName?: string
  terminalName?: string
  online?: boolean
  userAgent?: string
  screen?: string
  errors?: string[]
  role?: string
}

export interface SupportThreadSummary {
  id: string
  siteId: string | null
  userId: string
  subject: string
  status: SupportStatus
  priority: SupportPriority
  // Réponse attendue avant ; null quand l'équipe ne doit rien
  dueAt: string | null
  firstResponseAt: string | null
  slaMet: boolean | null
  lastMessageAt: string
  createdAt: string
  lastMessage: SupportMessage | null
  unread: number
}

export interface SupportThread extends Omit<SupportThreadSummary, 'lastMessage' | 'unread'> {
  context: SupportContext | null
  messages: SupportMessage[]
}

export interface AgentThreadSummary extends Omit<SupportThreadSummary, 'dueAt'> {
  dueAt: string
  organizationId: string
  organizationName: string | null
  siteName: string | null
  user: { name: string; email: string; role: string } | null
  context: SupportContext | null
  overdue: boolean
}

export interface AgentThread extends Omit<AgentThreadSummary, 'lastMessage' | 'unread'> {
  messages: SupportMessage[]
  organization: { plan: string; subscriptionStatus: string; trialEndsAt: string | null; sector: string } | null
}

export interface NewThreadInput {
  subject: string
  body: string
  priority: SupportPriority
  siteId?: string
  context: SupportContext
}

export const supportApi = {
  status: () => apiClient<SupportInfo>('/support/status'),
  unread: () => apiClient<{ count: number }>('/support/unread'),
  threads: () => apiClient<SupportThreadSummary[]>('/support/threads'),
  thread: (id: string) => apiClient<SupportThread>(`/support/threads/${id}`),
  create: (input: NewThreadInput) => apiClient<SupportThread>('/support/threads', { method: 'POST', body: JSON.stringify(input) }),
  post: (id: string, body: string) => apiClient<SupportThread>(`/support/threads/${id}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),
  read: (id: string) => apiClient<{ ok: true }>(`/support/threads/${id}/read`, { method: 'POST' }),

  agentThreads: (filter: 'active' | 'all' | 'RESOLVED') => apiClient<AgentThreadSummary[]>(`/support/agent/threads?filter=${filter}`),
  agentThread: (id: string) => apiClient<AgentThread>(`/support/agent/threads/${id}`),
  agentReply: (id: string, body: string, status: SupportStatus) =>
    apiClient<AgentThread>(`/support/agent/threads/${id}/messages`, { method: 'POST', body: JSON.stringify({ body, status }) }),
  agentStatus: (id: string, status: SupportStatus) =>
    apiClient<AgentThread>(`/support/agent/threads/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
}

export const useSupportInfo = (enabled = true) =>
  useQuery({ queryKey: ['support', 'status'], queryFn: supportApi.status, staleTime: 60_000, refetchInterval: enabled ? 5 * 60_000 : false, enabled })

// Pastille « réponse non lue » : relue chaque minute, sans bruit si l'API ne répond pas
export const useSupportUnread = (enabled = true) =>
  useQuery({ queryKey: ['support', 'unread'], queryFn: supportApi.unread, refetchInterval: 60_000, retry: false, staleTime: 30_000, enabled })
