'use client'

import { useSyncExternalStore } from 'react'
import type { PaymentAdapterName } from './types'

// TPE bancaire de CETTE caisse, piloté par FLŌW-Bridge (réglage de l'appareil)
// caisse-ap : protocole Caisse-AP sur IP (Ingenico, Verifone... selon la banque)
// simulator : TPE simulé par le pont, pour essayer sans matériel
export interface BridgeTpeConfig {
  enabled: boolean
  adapter: PaymentAdapterName
  host?: string
  port?: number
  posNumber?: string
}

const KEY = 'flow-bridge-tpe'
const DEFAULT: BridgeTpeConfig = { enabled: false, adapter: 'caisse-ap', port: 8888 }
const listeners = new Set<() => void>()
let cached: BridgeTpeConfig | null = null

export function getBridgeTpe(): BridgeTpeConfig {
  if (cached) return cached
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null
    cached = raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT
  } catch {
    cached = DEFAULT
  }
  return cached!
}

export function setBridgeTpe(next: BridgeTpeConfig) {
  cached = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // stockage indisponible : réglage gardé le temps de la session
  }
  listeners.forEach((l) => l())
}

export function useBridgeTpe(): BridgeTpeConfig {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    getBridgeTpe,
    () => DEFAULT,
  )
}
