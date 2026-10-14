'use client'

import { useQuery } from '@tanstack/react-query'
import type { Pack, PaymentKind, Sector, TrackingMode } from '@erp/types'
import type { ScaleBarcodeRule } from '@erp/utils'
import { apiClient } from './client'
import { db } from '@/lib/offline/db'

export interface ReceiptSettings {
  legalName: string
  siret: string | null
  vatNumber: string | null
  legalForm: string | null
  rcs: string | null
  address: string | null
  // Ticket sur demande (loi AGEC), toujours ou jamais
  policy: 'ASK' | 'ALWAYS' | 'NEVER'
  // Note de service dès 25 € TTC (restauration, prestations)
  serviceNote: boolean
  footer: string | null
}

export interface PaymentMethodConfig {
  id: string
  code: string
  label: string
  kind: PaymentKind
  isActive: boolean
  position: number
  // Règles françaises (titre-restaurant, chèque, espèces)
  mealVoucher?: boolean
  giveChange?: boolean
  maxAmount?: string | null
  requiresReference?: boolean
}

export interface PlatformConfig {
  name?: string
  receipt?: ReceiptSettings
  sector: Sector
  packs: Pack[]
  priceIncludesTax: boolean
  currency: string
  defaultTracking: TrackingMode
  suggestedOptions: Array<{ name: string; values: string[] }>
  taxRates: Array<{ id: string; label: string; rate: string; isDefault: boolean }>
  paymentMethods: PaymentMethodConfig[]
  // Étiquettes de balance (EAN-13 à prix ou poids intégré)
  scaleBarcodes?: ScaleBarcodeRule[]
  attributeDefinitions: Array<{
    id: string
    key: string
    label: string
    type: string
    options: string[]
    pack: Pack | null
    required: boolean
  }>
}

const CACHE_KEY = 'platform-config'

// Configuration de l'organisation, gardée sur l'appareil : la caisse doit
// connaître ses moyens de paiement et son mode TTC/HT même hors ligne
export async function fetchPlatformConfig(): Promise<PlatformConfig> {
  try {
    const config = await apiClient<PlatformConfig>('/organizations/me/platform')
    await db.config.put({ key: CACHE_KEY, value: config, cachedAt: Date.now() })
    return config
  } catch (e) {
    const cached = await db.config.get(CACHE_KEY)
    if (cached) return cached.value as PlatformConfig
    throw e
  }
}

export function usePlatformConfig() {
  return useQuery({
    queryKey: ['platform-config'],
    queryFn: fetchPlatformConfig,
    staleTime: 5 * 60_000,
  })
}

export const hasPack = (config: PlatformConfig | undefined, pack: Pack) => !!config?.packs.includes(pack)
