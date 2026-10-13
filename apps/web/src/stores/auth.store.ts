'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiClient } from '@/lib/api/client'

interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'OWNER' | 'MANAGER' | 'SELLER'
  organizationId: string
}

export interface RegisterInput {
  sector: string
  businessName: string
  siteName?: string
  firstName: string
  lastName: string
  email: string
  password: string
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterInput) => Promise<{ siteId: string }>
  logout: () => void
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
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
