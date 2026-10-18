'use client'

import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { syncOfflineRoster } from '@/lib/terminal/terminal'
import { hasOfflineSession } from '@/lib/auth/offline-session'

// Reprise de la caisse sans réseau, côté écran :
// - avec le réseau, la liste des personnes reconnues hors ligne est tenue à
//   jour (départs, codes changés) au démarrage puis toutes les 15 minutes ;
// - après une reprise hors ligne, reconnexion silencieuse dès que le serveur
//   répond, puis envoi des ventes en attente.
export function useOfflineTill(
  siteId: string,
  online: boolean,
  handlers: { onConfirmed: () => void; onNeedsPin: (refused: boolean) => void },
) {
  const h = useRef(handlers)
  h.current = handlers

  useEffect(() => {
    if (!online) return
    let stopped = false
    const roster = () => void syncOfflineRoster(siteId).catch(() => {})
    const reconfirm = async () => {
      if (!hasOfflineSession()) return
      const r = await useAuthStore.getState().reconfirmOffline(siteId)
      if (stopped) return
      if (r === 'confirmed') {
        h.current.onConfirmed()
        roster()
      } else if (r === 'needs-pin' || r === 'refused') h.current.onNeedsPin(r === 'refused')
    }
    // Le navigateur peut se croire en ligne quand seule la box répond : on
    // réessaie la reconnexion régulièrement, sans bruit
    void reconfirm().finally(() => !hasOfflineSession() && roster())
    const fast = window.setInterval(() => void reconfirm(), 20_000)
    const slow = window.setInterval(roster, 15 * 60_000)
    return () => {
      stopped = true
      window.clearInterval(fast)
      window.clearInterval(slow)
    }
  }, [siteId, online])
}
