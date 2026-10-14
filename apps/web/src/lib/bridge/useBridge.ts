'use client'

import { useSyncExternalStore } from 'react'
import { getBridge, type BridgeClient } from './client'
import type { BridgeStatus } from './types'

// Côté serveur, le pont n'existe pas : statut « éteint »
const serverStatus = (): BridgeStatus => 'off'
const noopSubscribe = () => () => {}

export function useBridge(): { status: BridgeStatus; bridge: BridgeClient | null } {
  const bridge = typeof window === 'undefined' ? null : getBridge()
  const status = useSyncExternalStore(
    bridge ? bridge.subscribe : noopSubscribe,
    bridge ? bridge.getStatus : serverStatus,
    serverStatus,
  )
  return { status, bridge }
}
