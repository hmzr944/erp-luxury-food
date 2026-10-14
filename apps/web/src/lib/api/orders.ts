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

export interface ApiOrderPayment {
  code: string
  label: string
  kind: string
  amount: number | string
  reference: string | null
}

export interface ApiOrder {
  // Identifiant de la vente tiré par la caisse : lien du ticket en ligne
  clientId?: string | null
  id: string
  siteId: string
  kind?: 'SALE' | 'REFUND'
  refundOfId?: string | null
  refundReason?: string | null
  note?: string | null
  payments?: ApiOrderPayment[]
  refunds?: Array<{ id: string; total: number | string; createdAt: string }>
  refundOf?: { id: string; receiptChain: { counter: number } | null } | null
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
    // Numéro et empreinte de la caisse qui a signé le ticket
    terminalCounter?: number | null
    terminalHash?: string | null
    terminal?: { name: string } | null
  } | null
  items: ApiOrderItem[]
}

export interface ApiOrderItem {
  id: string
  name: string
  variantName?: string | null
  serialNumber?: string | null
  refundOfItemId?: string | null
  price: number
  taxRate: number
  quantity: number
  discount: number
  // Options, composant de formule, pesée
  modifiers?: Array<{ id: string; name: string; price: number }> | null
  menuName?: string | null
  menuGroup?: number | null
  weight?: number | string | null
  pricePerKg?: number | string | null
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

  getAll: (
    siteId: string,
    params?: { limit?: number; status?: string; q?: string; kind?: 'SALE' | 'REFUND'; from?: string; before?: string },
  ) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== '') qs.set(k, String(v))
    return apiClient<ApiOrder[]>(`/sites/${siteId}/orders?${qs}`)
  },

  getById: (siteId: string, id: string) =>
    apiClient<ApiOrderDetail>(`/sites/${siteId}/orders/${id}`),

  refund: (siteId: string, id: string, body: RefundPayload) =>
    apiClient<ApiOrder & { credit: StoreCreditView | null }>(`/sites/${siteId}/orders/${id}/refund`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  credit: (siteId: string, code: string) =>
    apiClient<StoreCreditView & { initialAmount: number; expired: boolean }>(
      `/sites/${siteId}/credits/${encodeURIComponent(code.trim())}`,
    ),

  updateStatus: (siteId: string, id: string, status: string) =>
    apiClient<ApiOrder>(`/sites/${siteId}/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
}

export interface ApiOrderDetail extends Omit<ApiOrder, 'refunds'> {
  site?: { name: string }
  refunds: Array<ApiOrder>
}

export type RefundTo = 'ORIGINAL' | 'CASH' | 'CREDIT'

export interface RefundPayload {
  lines: Array<{ orderItemId: string; quantity: number }>
  refundTo: RefundTo
  restock: boolean
  reason?: string
  customerEmail?: string
  creditMonths?: number
}

export interface StoreCreditView {
  code: string
  balance: number
  expiresAt: string | null
}
