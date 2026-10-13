'use client'

import { useCallback, useEffect, useState } from 'react'
import { countSales, flushSales } from '@/lib/terminal/terminal'

export interface SaleQueueState {
  online: boolean
  pending: number
  rejected: number
  flush: () => void
}

// État de la file des ventes signées : en attente d'envoi, refusées
export function useSaleQueue(siteId: string): SaleQueueState {
  const [online, setOnline] = useState(true)
  const [counts, setCounts] = useState({ pending: 0, rejected: 0 })

  const refresh = useCallback(() => {
    countSales(siteId).then(setCounts).catch(() => {})
  }, [siteId])

  const flush = useCallback(() => {
    flushSales(siteId)
      .catch(() => {})
      .finally(refresh)
  }, [siteId, refresh])

  useEffect(() => {
    setOnline(navigator.onLine)
    const up = () => {
      setOnline(true)
      flush()
    }
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    const sync = window.setInterval(flush, 30_000)
    const poll = window.setInterval(refresh, 2_000)
    refresh()
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
      window.clearInterval(sync)
      window.clearInterval(poll)
    }
  }, [flush, refresh])

  return { online, ...counts, flush }
}
