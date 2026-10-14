'use client'

import { io, type Socket } from 'socket.io-client'
import { apiClient } from '@/lib/api/client'

// Tablette écran client reliée par le serveur (appareil séparé de la caisse)

const WS = () => process.env.NEXT_PUBLIC_WS_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const TOKEN_KEY = 'flow-display-token'
const pairedKey = (siteId: string) => `flow-display-remote:${siteId}`

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // stockage indisponible : l'appairage durera le temps de la page
  }
}

export type DisplayStatus = { paired: true; siteName: string | null } | { paired: false; code: string; expiresAt: string }

// ── Côté tablette ───────────────────────────────────────────

export const displayDevice = {
  token: () => read(TOKEN_KEY),
  forget: () => write(TOKEN_KEY, null),
  async ensure(): Promise<string> {
    const existing = read(TOKEN_KEY)
    if (existing) return existing
    const created = await apiClient<{ token: string }>('/displays', { method: 'POST', skipAuth: true })
    write(TOKEN_KEY, created.token)
    return created.token
  },
  status: (token: string) => apiClient<DisplayStatus>('/displays/me', { skipAuth: true, headers: { 'x-display-token': token } }),
  connect: (token: string): Socket => io(`${WS()}/display`, { transports: ['websocket'], auth: { displayToken: token } }),
}

// ── Côté caisse ─────────────────────────────────────────────

export interface PairedDisplay {
  id: string
  terminalId: string | null
  pairedAt: string | null
  lastSeenAt: string | null
}

export const displaysApi = {
  list: (siteId: string) => apiClient<PairedDisplay[]>(`/sites/${siteId}/displays`),
  async pair(siteId: string, code: string, terminalId?: string) {
    const r = await apiClient<{ id: string }>(`/sites/${siteId}/displays/pair`, { method: 'POST', body: JSON.stringify({ code, terminalId }) })
    displaysApi.remember(siteId, [...displaysApi.local(siteId), r.id])
    return r
  },
  async unpair(siteId: string, id: string) {
    await apiClient(`/sites/${siteId}/displays/${id}`, { method: 'DELETE' })
    displaysApi.remember(siteId, displaysApi.local(siteId).filter((x) => x !== id))
  },
  // Tablettes reliées à cette caisse (cet appareil)
  local: (siteId: string): string[] => {
    try {
      return JSON.parse(read(pairedKey(siteId)) ?? '[]') as string[]
    } catch {
      return []
    }
  },
  remember: (siteId: string, ids: string[]) => {
    write(pairedKey(siteId), JSON.stringify([...new Set(ids)]))
    window.dispatchEvent(new Event('flow-display-remote'))
  },
  connect: (): Socket =>
    io(`${WS()}/display`, {
      transports: ['websocket'],
      auth: (cb: (data: object) => void) => cb({ token: read('access_token') ?? '' }),
    }),
}
