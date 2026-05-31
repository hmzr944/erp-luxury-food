import { apiClient } from './client'
import type { CartLine } from '@/stores/cart.store'
import type { PaymentMode } from '@erp/types'

export interface CheckoutPayload {
  items: Array<{
    productId: string
    variantId?: string
    quantity: number
    discount?: number
  }>
  paymentMode: PaymentMode
  customerEmail?: string
  note?: string
  orderDiscount?: number
  printerId?: number
}

export interface ApiOrder {
  id: string
  siteId: string
  status: string
  channel: string
  subtotal: number
  taxAmount: number
  total: number
  discount: number
  paymentMode: string
  customerEmail: string | null
  createdAt: string
  receiptChain: {
    id: string
    counter: number
    hash: string
    signedAt: string
  } | null
  items: ApiOrderItem[]
}

export interface ApiOrderItem {
  id: string
  name: string
  price: number
  taxRate: number
  quantity: number
  discount: number
}

export function buildCheckoutPayload(
  lines: CartLine[],
  opts: {
    paymentMode: PaymentMode
    customerEmail?: string
    note?: string
    orderDiscount?: number
    printerId?: number
  },
): CheckoutPayload {
  return {
    items: lines.map((l) => ({
      productId: l.product.id,
      variantId: l.variantId,
      quantity: l.quantity,
      discount: l.discount > 0 ? l.discount : undefined,
    })),
    ...opts,
  }
}

export const ordersApi = {
  checkout: (siteId: string, payload: CheckoutPayload) =>
    apiClient<ApiOrder>(`/sites/${siteId}/orders/checkout`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAll: (siteId: string, params?: { limit?: number; status?: string }) => {
    const qs = new URLSearchParams()
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.status) qs.set('status', params.status)
    return apiClient<ApiOrder[]>(`/sites/${siteId}/orders?${qs}`)
  },

  getById: (siteId: string, id: string) =>
    apiClient<ApiOrder>(`/sites/${siteId}/orders/${id}`),

  updateStatus: (siteId: string, id: string, status: string) =>
    apiClient<ApiOrder>(`/sites/${siteId}/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
}
