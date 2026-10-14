'use client'

import { useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { localChannel, type DisplayMessage, type DisplayState } from './state'
import { displaysApi } from './remote'

// La caisse publie ce que voit le client : dans le navigateur pour un second
// écran (sans réseau), par le serveur pour une tablette appairée. Un écran
// ouvert en retard reçoit aussitôt l'état courant.
export function useDisplayPublisher(siteId: string, state: DisplayState) {
  const latest = useRef(state)
  const channel = useRef<BroadcastChannel | null>(null)
  const socket = useRef<Socket | null>(null)
  const [remote, setRemote] = useState<string[]>([])

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

  // Tablettes reliées à cette caisse
  useEffect(() => {
    const refresh = () => setRemote(displaysApi.local(siteId))
    refresh()
    window.addEventListener('flow-display-remote', refresh)
    return () => window.removeEventListener('flow-display-remote', refresh)
  }, [siteId])

  const remoteKey = remote.join(',')
  useEffect(() => {
    if (!remote.length) return
    const s = displaysApi.connect()
    const sendAll = () => remote.forEach((displayId) => s.emit('state', { displayId, state: latest.current }))
    s.on('connect', sendAll)
    socket.current = s
    return () => {
      s.disconnect()
      socket.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteKey])

  const serialized = JSON.stringify(state)
  useEffect(() => {
    latest.current = state
    channel.current?.postMessage({ type: 'state', state } satisfies DisplayMessage)
    const s = socket.current
    if (s?.connected) remote.forEach((displayId) => s.emit('state', { displayId, state }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized])
}
