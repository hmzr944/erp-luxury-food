'use client'

// Session reprise sans réseau par une autre personne que celle du jeton :
// la caisse n'a alors aucun jeton (celui de la personne précédente est
// retiré), elle vend hors ligne et se reconnecte en silence au retour du
// réseau avec le code gardé en mémoire. Rien de secret n'est écrit : le
// repère dans localStorage ne contient que la boutique, la personne et l'heure.

const KEY = 'flow-offline-session'

export interface OfflineSessionMark {
  siteId: string
  userId: string
  at: string // heure de la reprise (ISO)
}

// Le code ne quitte jamais la mémoire de l'onglet ; perdu au rechargement
let pending: { siteId: string; userId: string; pin: string } | null = null

export function startOfflineSession(mark: OfflineSessionMark, pin: string) {
  pending = { siteId: mark.siteId, userId: mark.userId, pin }
  try {
    localStorage.setItem(KEY, JSON.stringify(mark))
  } catch {
    // stockage indisponible : la reconnexion demandera le code
  }
}

export function offlineSession(): OfflineSessionMark | null {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(KEY) : null
    return raw ? (JSON.parse(raw) as OfflineSessionMark) : null
  } catch {
    return null
  }
}

export const hasOfflineSession = () => offlineSession() !== null

export function pendingPin(siteId: string, userId: string): string | null {
  return pending && pending.siteId === siteId && pending.userId === userId ? pending.pin : null
}

export function endOfflineSession() {
  pending = null
  try {
    localStorage.removeItem(KEY)
  } catch {
    // rien à faire
  }
}

// Le serveur n'a pas pu être joint (et non « code refusé ») : coupure,
// délai dépassé, passerelle en panne
export function isUnreachable(err: unknown): boolean {
  if (err instanceof TypeError) return true
  const name = (err as { name?: string })?.name
  if (name === 'TimeoutError' || name === 'AbortError') return true
  const status = (err as { status?: number })?.status
  return status === 502 || status === 503 || status === 504
}
