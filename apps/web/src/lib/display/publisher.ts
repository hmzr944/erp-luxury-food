'use client'

import { useEffect, useRef } from 'react'
import { localChannel, type DisplayMessage, type DisplayState } from './state'

// La caisse publie ce que voit le client. Un écran ouvert en retard demande
// l'état courant (« hello ») et le reçoit aussitôt.
export function useDisplayPublisher(siteId: string, state: DisplayState) {
  const latest = useRef(state)
  const channel = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    const c = localChannel(siteId)
    channel.current = c
    if (!c) return
    c.onmessage = (e: MessageEvent<DisplayMessage>) => {
      if (e.data?.type === 'hello') c.postMessage({ type: 'state', state: latest.current } satisfies DisplayMessage)
    }
    return () => {
      c.close()
      channel.current = null
    }
  }, [siteId])

  const serialized = JSON.stringify(state)
  useEffect(() => {
    latest.current = state
    channel.current?.postMessage({ type: 'state', state } satisfies DisplayMessage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized])
}
