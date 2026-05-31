'use client'

import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

type SocketStatus = 'connecting' | 'connected' | 'disconnected'

export function useSocket(siteId: string | null) {
  const socketRef = useRef<Socket | null>(null)
  const [status, setStatus] = useState<SocketStatus>('disconnected')

  useEffect(() => {
    if (!siteId) return

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001'
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null

    setStatus('connecting')

    const socket = io(`${wsUrl}/orders`, {
      transports: ['websocket'],
      auth: token ? { token } : undefined,
    })

    socket.on('connect', () => {
      setStatus('connected')
      socket.emit('join-site', { siteId })
    })

    socket.on('disconnect', () => setStatus('disconnected'))
    socket.on('connect_error', () => setStatus('disconnected'))

    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
      setStatus('disconnected')
    }
  }, [siteId])

  function on<T>(event: string, handler: (data: T) => void) {
    socketRef.current?.on(event, handler)
    return () => socketRef.current?.off(event, handler)
  }

  function off(event: string, handler?: (...args: any[]) => void) {
    socketRef.current?.off(event, handler)
  }

  return { status, on, off, socket: socketRef.current }
}
