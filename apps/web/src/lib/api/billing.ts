import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { PlanCode, SubscriptionStatus } from '@erp/types'
import { apiClient } from './client'
import { accessNotice, effectiveAccess, readAccessSnapshot, saveAccessSnapshot, type AccessSnapshot, type AccessState } from '../billing-access'

export interface BillingStatus {
  plan: PlanCode
  planName: string
  status: SubscriptionStatus
  trialEndsAt: string | null
  trialDaysLeft: number | null
  currentPeriodEnd: string | null
  sites: number
  monthlyEstimate: number
  onlinePayment: boolean
  hasPaymentMethod: boolean
  canManage: boolean
  // Accès à la caisse et date du verrou (absents d'un serveur plus ancien)
  access?: AccessState
  lockAt?: string | null
}

export const billingApi = {
  status: () => apiClient<BillingStatus>('/billing'),
  checkout: (plan: PlanCode) => apiClient<{ url: string }>('/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) }),
  portal: () => apiClient<{ url: string }>('/billing/portal', { method: 'POST' }),
}

// Chaque statut reçu est gardé sur l'appareil : la caisse hors ligne le connaît
const fetchStatus = async () => {
  const s = await billingApi.status()
  if (s.access) saveAccessSnapshot({ access: s.access, status: s.status, lockAt: s.lockAt ?? null, trialEndsAt: s.trialEndsAt })
  return s
}

export const useBilling = () => useQuery({ queryKey: ['billing'], queryFn: fetchStatus, staleTime: 5 * 60_000 })

// Accès à la caisse : statut du serveur, sinon le dernier connu sur l'appareil.
// state null : statut inconnu, rien n'est bloqué
export function useAccess() {
  const { data } = useBilling()
  const [cached, setCached] = useState<AccessSnapshot | null>(null)
  useEffect(() => setCached(readAccessSnapshot()), [])
  const snapshot: AccessSnapshot | null = data?.access
    ? { access: data.access, status: data.status, lockAt: data.lockAt ?? null, trialEndsAt: data.trialEndsAt }
    : cached
  return { snapshot, state: effectiveAccess(snapshot), notice: accessNotice(snapshot) }
}
