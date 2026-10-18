import { hasOfflineSession } from '@/lib/auth/offline-session'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// Erreur de l'API avec son statut et les champs utiles (ex. écart de caisse)
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: Record<string, unknown>,
  ) {
    super(message)
  }
}

interface FetchOptions extends RequestInit {
  skipAuth?: boolean
}

export async function apiClient<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { skipAuth, ...fetchOptions } = options

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null

  const res = await fetch(`${BASE}/api${path}`, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(!skipAuth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchOptions.headers,
    },
  })

  // Connexion, inscription : un 401 veut dire « identifiants refusés », pas « session expirée »
  if (res.status === 401 && !skipAuth) {
    // Tentative de refresh automatique
    const refreshed = await tryRefresh()
    if (refreshed) {
      return apiClient(path, options)
    }
    // Caisse reprise sans réseau : pas de jeton tant que la reconnexion
    // n'est pas faite. On ne quitte pas la caisse (vente en cours).
    if (hasOfflineSession()) {
      throw new ApiError('Reconnexion en cours : cette action attend la confirmation de votre code', 401, {})
    }
    // Refresh échoué — déconnexion
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token')
      window.location.href = '/login'
    }
    throw new Error('Session expirée')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message
    throw new ApiError(message ?? `HTTP ${res.status}`, res.status, body ?? {})
  }

  // Certaines routes renvoient « rien » (null) : corps vide
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

// Requête authentifiée qui renvoie la réponse brute, sans jamais rediriger
// vers la connexion : utilisée par la synchronisation en arrière-plan, qui ne
// doit pas interrompre une vente en cours
export async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const send = () =>
    fetch(`${BASE}/api${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}`,
        ...init.headers,
      },
    })
  const res = await send()
  if (res.status === 401 && (await tryRefresh())) return send()
  return res
}

async function tryRefresh(): Promise<boolean> {
  try {
    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) return false

    const res = await fetch(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refreshToken}`,
      },
    })

    if (!res.ok) return false
    const { accessToken } = await res.json()
    localStorage.setItem('access_token', accessToken)
    return true
  } catch {
    return false
  }
}
