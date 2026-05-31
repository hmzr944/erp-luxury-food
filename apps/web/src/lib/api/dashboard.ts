import { apiClient } from './client'

export interface DashboardSummary {
  revenue: number
  orderCount: number
  avgBasket: number
  inProgress: number
  revenueByHour: Array<{ hour: string; revenue: number }>
  topProducts: Array<{ name: string; quantity: number; revenue: number }>
  recentOrders: Array<{
    id: string
    total: number
    status: string
    paymentMode: string
    createdAt: string
    items: Array<{ name: string; quantity: number }>
    receiptChain: { counter: number } | null
  }>
}

export const dashboardApi = {
  getSummary: (siteId: string) =>
    apiClient<DashboardSummary>(`/sites/${siteId}/dashboard/summary`),

  getRealtime: (siteId: string) =>
    apiClient<{ pending: number; preparing: number; ready: number; total: number }>(
      `/sites/${siteId}/dashboard/realtime`,
    ),
}
