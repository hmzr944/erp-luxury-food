'use client'

import { useEffect, useState } from 'react'
import { CustomerDisplay } from '@/components/display/CustomerDisplay'
import { PairingCode } from '@/components/display/PairingCode'
import { localChannel, type DisplayMessage, type DisplayState } from '@/lib/display/state'
import { displayDevice } from '@/lib/display/remote'

type Mode = { kind: 'loading' } | { kind: 'local'; siteId: string } | { kind: 'remote' }

// /display?site=… : second écran du même appareil, état reçu dans le navigateur.
// /display : tablette séparée, appairée à une caisse par un code.
export function DisplayClient() {
  const [mode, setMode] = useState<Mode>({ kind: 'loading' })
  useEffect(() => {
    const site = new URLSearchParams(window.location.search).get('site')
    setMode(site ? { kind: 'local', siteId: site } : { kind: 'remote' })
  }, [])
  if (mode.kind === 'local') return <LocalDisplay siteId={mode.siteId} />
  if (mode.kind === 'remote') return <RemoteDisplay />
  return <CustomerDisplay state={null} />
}

function LocalDisplay({ siteId }: { siteId: string }) {
  const [state, setState] = useState<DisplayState | null>(null)
  useEffect(() => {
    const channel = localChannel(siteId)
    if (!channel) return
    channel.onmessage = (e: MessageEvent<DisplayMessage>) => {
      if (e.data?.type === 'state') setState(e.data.state)
    }
    channel.postMessage({ type: 'hello' } satisfies DisplayMessage)
    return () => channel.close()
  }, [siteId])
  return <CustomerDisplay state={state} waiting="En attente de la caisse" />
}

type Remote =
  | { kind: 'starting' }
  | { kind: 'code'; code: string; expiresAt: string }
  | { kind: 'paired'; token: string }
  | { kind: 'offline' }

function RemoteDisplay() {
  const [remote, setRemote] = useState<Remote>({ kind: 'starting' })
  const [state, setState] = useState<DisplayState | null>(null)
  const [online, setOnline] = useState(true)

  // Jeton de la tablette, puis code à afficher tant qu'elle n'est pas reliée
  useEffect(() => {
    let stopped = false
    let timer = 0
    const check = async () => {
      try {
        const token = await displayDevice.ensure()
        const s = await displayDevice.status(token)
        if (stopped) return
        if (s.paired) return setRemote({ kind: 'paired', token })
        setRemote({ kind: 'code', code: s.code, expiresAt: s.expiresAt })
      } catch (e) {
        // Jeton inconnu (écran délié) : on repart de zéro
        if ((e as { status?: number }).status === 404) displayDevice.forget()
        if (!stopped) setRemote({ kind: 'offline' })
      }
      if (!stopped) timer = window.setTimeout(check, 4000)
    }
    void check()
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [])

  const token = remote.kind === 'paired' ? remote.token : null
  useEffect(() => {
    if (!token) return
    const socket = displayDevice.connect(token)
    socket.on('state', (s: DisplayState) => setState(s))
    socket.on('connect', () => setOnline(true))
    socket.on('disconnect', () => setOnline(false))
    socket.on('unpaired', () => {
      displayDevice.forget()
      setState(null)
      window.location.reload()
    })
    return () => {
      socket.disconnect()
    }
  }, [token])

  if (remote.kind === 'code') return <PairingCode code={remote.code} />
  if (remote.kind === 'paired') return <CustomerDisplay state={state} waiting={online ? 'En attente de la caisse' : 'Connexion à la caisse…'} />
  return <CustomerDisplay state={null} waiting={remote.kind === 'offline' ? 'Connexion au réseau…' : undefined} />
}
