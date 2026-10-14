'use client'

import { useEffect, useState } from 'react'
import { CustomerDisplay } from '@/components/display/CustomerDisplay'
import { localChannel, type DisplayMessage, type DisplayState } from '@/lib/display/state'

// Second écran du même appareil (/display?site=…) : la caisse publie l'état
// dans le navigateur, sans réseau
export function DisplayClient() {
  const [siteId, setSiteId] = useState<string | null>(null)
  const [state, setState] = useState<DisplayState | null>(null)

  useEffect(() => {
    setSiteId(new URLSearchParams(window.location.search).get('site'))
  }, [])

  useEffect(() => {
    if (!siteId) return
    const channel = localChannel(siteId)
    if (!channel) return
    channel.onmessage = (e: MessageEvent<DisplayMessage>) => {
      if (e.data?.type === 'state') setState(e.data.state)
    }
    // Ouvert après la caisse : on demande l'état courant
    channel.postMessage({ type: 'hello' } satisfies DisplayMessage)
    return () => channel.close()
  }, [siteId])

  return <CustomerDisplay state={state} waiting="En attente de la caisse" />
}
