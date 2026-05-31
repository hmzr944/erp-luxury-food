'use client'

import { useEffect } from 'react'
import { flushPendingCommands } from '@/lib/offline/queue'

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // Enregistre le service worker
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.debug('[SW] Registered:', reg.scope)
      })
      .catch((err) => {
        console.warn('[SW] Registration failed:', err)
      })

    // Écoute les messages du SW (ex: SYNC_PENDING)
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SYNC_PENDING') {
        flushPendingCommands()
      }
    })

    // Sync au retour online
    const handleOnline = () => {
      flushPendingCommands()
      // Demande un background sync si disponible
      navigator.serviceWorker.ready.then((reg) => {
        if ('sync' in reg) {
          ;(reg as any).sync.register('sync-pending-commands').catch(() => {})
        }
      })
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  return null
}
