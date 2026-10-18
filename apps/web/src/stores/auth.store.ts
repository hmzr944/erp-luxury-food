'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiClient } from '@/lib/api/client'
import { getTerminal, signPinChallenge } from '@/lib/terminal/terminal'
import { forgetOfflineUser, offlineCheckMessage, rememberOfflinePin, verifyOfflinePin } from '@/lib/terminal/offline-pin'
import { endOfflineSession, isUnreachable, offlineSession, pendingPin, startOfflineSession } from '@/lib/auth/offline-session'

interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'OWNER' | 'MANAGER' | 'SELLER' | 'PRODUCTION'
  organizationId: string
}

export interface RegisterInput {
  sector: string
  businessName: string
  siteName?: string
  // Métier choisi : catalogue d'exemple et réglages fins
  metier?: string
  firstName?: string
  lastName?: string
  email: string
  password: string
  // Case « J'accepte les conditions » cochée
  acceptTerms: true
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  // Code vendeur sur la caisse de cette boutique (change la personne connectée).
  // offline : reconnu par la caisse sans réseau, pour vendre seulement.
  pinLogin: (siteId: string, pin: string) => Promise<{ offline: boolean }>
  // Retour du réseau après une reprise hors ligne : reconnexion silencieuse
  reconfirmOffline: (siteId: string) => Promise<'none' | 'confirmed' | 'offline' | 'needs-pin' | 'refused'>
  badgeLogin: (siteId: string, code: string) => Promise<void>
  register: (data: RegisterInput) => Promise<{ siteId: string }>
  logout: () => void
  clearError: () => void
}

interface PinLoginResponse {
  accessToken: string
  refreshToken: string
  user: AuthUser
  offline?: { terminalSalt: string; salt: string }
}

type SetAuth = (partial: Partial<AuthState>) => void

// Un serveur qui ne répond pas ne doit pas figer le pavé : on passe hors ligne
const timeout = () => (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(8_000) : undefined)

async function postPin(siteId: string, pin: string, extra: { offlineAt?: string; offlineUserId?: string } = {}) {
  const challenge = await signPinChallenge(siteId)
  return apiClient<PinLoginResponse>('/auth/pin', {
    method: 'POST',
    body: JSON.stringify({ ...challenge, pin, ...extra }),
    skipAuth: true,
    signal: timeout(),
  })
}

function applyTillSession(siteId: string, pin: string, data: PinLoginResponse, set: SetAuth) {
  localStorage.setItem('access_token', data.accessToken)
  localStorage.setItem('refresh_token', data.refreshToken)
  set({ user: data.user, accessToken: data.accessToken, isAuthenticated: true, error: null })
  // Vérificateur pour la prochaine reprise sans réseau (dérivation lente, en arrière-plan)
  if (data.offline) {
    const offline = data.offline
    void getTerminal(siteId)
      .then((t) => t && rememberOfflinePin(siteId, t.terminalId, pin, data.user, offline))
      .catch(() => {})
  }
}

async function unlockOffline(siteId: string, pin: string, get: () => AuthState, set: SetAuth): Promise<{ offline: true }> {
  const r = await verifyOfflinePin(siteId, pin)
  if (!r.ok) throw new Error(offlineCheckMessage(r))
  const mark = offlineSession()
  const sameSession = !mark && get().user?.id === r.user.id && !!localStorage.getItem('access_token')
  if (!sameSession) {
    // Autre personne : le jeton de la précédente est retiré, rien ne part au
    // serveur en son nom. Reconnexion au retour du réseau.
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    startOfflineSession({ siteId, userId: r.user.id, at: mark?.userId === r.user.id ? mark.at : new Date().toISOString() }, pin)
    set({ user: { ...r.user, email: '' }, accessToken: null, isAuthenticated: true, error: null })
  }
  return { offline: true }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const data = await apiClient<{
            accessToken: string
            refreshToken: string
            user: AuthUser
          }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
            skipAuth: true,
          })

          if (typeof window !== 'undefined') {
            localStorage.setItem('access_token', data.accessToken)
            localStorage.setItem('refresh_token', data.refreshToken)
            endOfflineSession()
            // E-mail et mot de passe : preuve plus forte que le code, la caisse est déverrouillée
            for (const k of Object.keys(localStorage)) if (k.startsWith('flow-locked:')) localStorage.removeItem(k)
          }

          set({
            user: data.user,
            accessToken: data.accessToken,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Identifiants invalides',
            isLoading: false,
          })
          throw err
        }
      },

      // En ligne d'abord. Si le serveur est injoignable (et seulement dans ce
      // cas : un code refusé reste refusé), vérification sur la caisse.
      pinLogin: async (siteId, pin) => {
        let data: PinLoginResponse
        try {
          data = await postPin(siteId, pin)
        } catch (err) {
          if (!isUnreachable(err)) throw err
          return unlockOffline(siteId, pin, get, set)
        }
        endOfflineSession()
        applyTillSession(siteId, pin, data, set)
        return { offline: false }
      },

      reconfirmOffline: async (siteId) => {
        const mark = offlineSession()
        if (!mark) return 'none'
        // Reprise faite sur une autre boutique : le code n'est plus en mémoire ici
        if (mark.siteId !== siteId) return 'needs-pin'
        const pin = pendingPin(siteId, mark.userId)
        if (!pin) return 'needs-pin'
        let data: PinLoginResponse
        try {
          data = await postPin(siteId, pin, { offlineAt: mark.at, offlineUserId: mark.userId })
        } catch (err) {
          if (isUnreachable(err)) return 'offline'
          // Code changé, compte retiré de la boutique, caisse désactivée...
          endOfflineSession()
          await forgetOfflineUser(siteId, mark.userId).catch(() => {})
          return 'refused'
        }
        endOfflineSession()
        applyTillSession(siteId, pin, data, set)
        return 'confirmed'
      },

      badgeLogin: async (siteId, code) => {
        const challenge = await signPinChallenge(siteId)
        const data = await apiClient<{ accessToken: string; refreshToken: string; user: AuthUser }>('/auth/badge', {
          method: 'POST',
          body: JSON.stringify({ ...challenge, code }),
          skipAuth: true,
          signal: timeout(),
        }).catch((err) => {
          if (isUnreachable(err)) throw new Error('Pas de réseau : le badge demande la connexion. Utilisez votre code.')
          throw err
        })
        endOfflineSession()
        localStorage.setItem('access_token', data.accessToken)
        localStorage.setItem('refresh_token', data.refreshToken)
        set({ user: data.user, accessToken: data.accessToken, isAuthenticated: true, error: null })
      },

      register: async (input) => {
        set({ isLoading: true, error: null })
        try {
          const data = await apiClient<{ accessToken: string; refreshToken: string; user: AuthUser; siteId: string }>(
            '/auth/register',
            { method: 'POST', body: JSON.stringify(input), skipAuth: true },
          )
          localStorage.setItem('access_token', data.accessToken)
          localStorage.setItem('refresh_token', data.refreshToken)
          set({ user: data.user, accessToken: data.accessToken, isAuthenticated: true, isLoading: false })
          return { siteId: data.siteId }
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Inscription impossible', isLoading: false })
          throw err
        }
      },

      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          endOfflineSession()
        }
        set({ user: null, accessToken: null, isAuthenticated: false })
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'erp-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)
