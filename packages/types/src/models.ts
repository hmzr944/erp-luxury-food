import type { Role, Plan, Channel, OrderStatus, PaymentMode } from './enums'

export interface Organization {
  id: string
  name: string
  slug: string
  plan: Plan
  createdAt: Date
}

export interface Site {
  id: string
  organizationId: string
  name: string
  address?: string
  timezone: string
  createdAt: Date
}

export interface User {
  id: string
  organizationId: string
  email: string
  firstName: string
  lastName: string
  role: Role
  createdAt: Date
}

export interface SignedReceipt {
  id: string
  counter: number
  hash: string
  previousHash: string
  signedAt: Date
}

export interface Order {
  id: string
  siteId: string
  channel: Channel
  status: OrderStatus
  subtotal: number
  taxAmount: number
  total: number
  discount: number
  paymentMode: PaymentMode
  customerEmail?: string
  note?: string
  receiptChainId?: string
  createdAt: Date
  items: OrderItem[]
}

export interface OrderItem {
  id: string
  orderId: string
  productId: string
  variantId?: string
  name: string
  price: number
  taxRate: number
  quantity: number
  discount: number
}

export interface Product {
  id: string
  siteId: string
  name: string
  description?: string
  sku?: string
  barcode?: string
  price: number
  taxRate: number
  categoryId?: string
  isActive: boolean
  createdAt: Date
}
