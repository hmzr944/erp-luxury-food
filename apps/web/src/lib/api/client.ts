const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

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

  if (res.status === 401) {
    // Tentative de refresh automatique
    const refreshed = await tryRefresh()
    if (refreshed) {
      return apiClient(path, options)
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
    throw new Error(body?.message ?? `HTTP ${res.status}`)
  }

  return res.json()
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
