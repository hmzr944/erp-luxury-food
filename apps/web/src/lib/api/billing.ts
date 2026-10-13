import { useQuery } from '@tanstack/react-query'
import type { PlanCode, SubscriptionStatus } from '@erp/types'
import { apiClient } from './client'

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
}

export const billingApi = {
  status: () => apiClient<BillingStatus>('/billing'),
  checkout: (plan: PlanCode) => apiClient<{ url: string }>('/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) }),
  portal: () => apiClient<{ url: string }>('/billing/portal', { method: 'POST' }),
}

export const useBilling = () => useQuery({ queryKey: ['billing'], queryFn: billingApi.status, staleTime: 5 * 60_000 })
