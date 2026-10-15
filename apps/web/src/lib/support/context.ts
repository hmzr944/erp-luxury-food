'use client'

import { create } from 'zustand'
import type { SupportContext } from '@/lib/api/support'
import { useSiteStore } from '@/stores/site.store'
import { pushError } from './format'

// --- Ouverture du panneau « Aide et support » depuis n'importe où ----------

interface SupportPanelState {
  open: boolean
  // Ouvre directement le parcours d'urgence ou une conversation
  start: { urgent?: boolean; threadId?: string } | null
  show: (start?: { urgent?: boolean; threadId?: string }) => void
  hide: () => void
}

export const useSupportPanel = create<SupportPanelState>()((set) => ({
  open: false,
  start: null,
  show: (start) => set({ open: true, start: start ?? null }),
  hide: () => set({ open: false, start: null }),
}))

export const openSupport = (start?: { urgent?: boolean; threadId?: string }) => useSupportPanel.getState().show(start)

// --- Dernières erreurs de l'application, jointes à la demande -------------

let recent: string[] = []
let installed = false

export function installErrorCapture() {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('error', (e) => {
    recent = pushError(recent, `${e.message}${e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno})` : ''}`)
  })
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as { message?: string } | string | undefined
    recent = pushError(recent, typeof r === 'string' ? r : (r?.message ?? 'Promesse rejetée'))
  })
}

// --- Contexte joint automatiquement ------------------------------------

// Boutique de la page (caisse, atelier) ou boutique choisie au back-office
export function currentSiteId(pathname: string): string | undefined {
  const m = /^\/(?:pos|atelier)\/([^/?#]+)/.exec(pathname)
  return m?.[1] ?? useSiteStore.getState().currentSite?.id ?? undefined
}

export async function collectContext(pathname: string): Promise<{ siteId?: string; context: SupportContext }> {
  const siteId = currentSiteId(pathname)
  let terminalName: string | undefined
  if (siteId) {
    try {
      // Nom de cette caisse, si l'appareil est enregistré comme caisse du site
      const { getTerminal } = await import('@/lib/terminal/terminal')
      terminalName = (await getTerminal(siteId))?.name
    } catch {
      terminalName = undefined
    }
  }
  const site = useSiteStore.getState().sites.find((s) => s.id === siteId) ?? useSiteStore.getState().currentSite
  return {
    siteId,
    context: {
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION?.slice(0, 40),
      page: pathname.slice(0, 300),
      ...(site?.name ? { siteName: site.name.slice(0, 120) } : {}),
      ...(terminalName ? { terminalName: terminalName.slice(0, 120) } : {}),
      online: navigator.onLine,
      userAgent: navigator.userAgent.slice(0, 400),
      screen: `${window.innerWidth}×${window.innerHeight}`,
      ...(recent.length ? { errors: [...recent] } : {}),
    },
  }
}
