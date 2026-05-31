import type { Channel, PaymentMode } from './enums'

export interface CheckoutItem {
  productId: string
  variantId?: string
  quantity: number
  discount?: number
}

export interface CheckoutPayload {
  siteId: string
  items: CheckoutItem[]
  paymentMode: PaymentMode
  channel?: Channel
  customerEmail?: string
  note?: string
  orderDiscount?: number
  printerId?: string
}

export interface UpdateStatusPayload {
  orderId: string
  status: string
}

export type POSCommand =
  | { type: 'CHECKOUT'; payload: CheckoutPayload }
  | { type: 'UPDATE_ORDER_STATUS'; payload: UpdateStatusPayload }
