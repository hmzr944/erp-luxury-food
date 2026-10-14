'use client'

import { create } from 'zustand'
import { priceOrder } from '@erp/utils'

export interface CartProduct {
  id: string
  name: string
  subtitle?: string
  price: number // prix de la variante choisie s'il y en a une
  taxRate: number
  categoryId?: string
  // Payable en titre-restaurant
  mealVoucher?: boolean
}

export interface CartLine {
  key: string
  product: CartProduct
  variantId?: string
  variantName?: string
  serialNumber?: string
  customName?: string // article libre
  quantity: number
  discount: number // remise en euros sur la ligne
}

interface AddOptions {
  variantId?: string
  variantName?: string
  serialNumber?: string
  customName?: string
}

interface CartState {
  lines: CartLine[]
  orderDiscount: number
  lastAddedKey: string | null
  addProduct: (product: CartProduct, options?: AddOptions) => void
  removeLine: (key: string) => void
  setQuantity: (key: string, quantity: number) => void
  setLineDiscount: (key: string, discount: number) => void
  setOrderDiscount: (discount: number) => void
  clearCart: () => void
}

// Une pièce numérotée est toujours une ligne à part, en un exemplaire
function lineKey(productId: string, options: AddOptions = {}, price?: number) {
  // Un article libre se distingue par son nom et son prix
  const custom = options.customName ? `${options.customName}@${price}` : ''
  return [productId, options.variantId ?? '', options.serialNumber ?? '', custom].join(':')
}

export const useCartStore = create<CartState>()((set) => ({
  lines: [],
  orderDiscount: 0,
  lastAddedKey: null,

  addProduct: (product, options = {}) => {
    const key = lineKey(product.id, options, product.price)
    set((state) => {
      const existing = state.lines.find((l) => l.key === key)
      if (existing && !options.serialNumber) {
        return {
          lastAddedKey: key,
          lines: state.lines.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l)),
        }
      }
      if (existing) return { lastAddedKey: key }
      return {
        lastAddedKey: key,
        lines: [...state.lines, { key, product, ...options, quantity: 1, discount: 0 }],
      }
    })
  },

  removeLine: (key) => set((state) => ({ lines: state.lines.filter((l) => l.key !== key) })),

  setQuantity: (key, quantity) =>
    set((state) => ({
      lines:
        quantity <= 0
          ? state.lines.filter((l) => l.key !== key)
          : state.lines.map((l) => (l.key === key && !l.serialNumber ? { ...l, quantity } : l)),
    })),

  setLineDiscount: (key, discount) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.key === key ? { ...l, discount: Math.max(0, discount) } : l)),
    })),

  setOrderDiscount: (discount) => set({ orderDiscount: Math.max(0, discount) }),
  clearCart: () => set({ lines: [], orderDiscount: 0, lastAddedKey: null }),
}))

// Totaux calculés avec la même fonction que le serveur : le montant affiché
// est exactement celui qui sera signé sur le ticket
export function computeCartTotals(lines: CartLine[], orderDiscount: number, priceIncludesTax: boolean) {
  const pricing = priceOrder(
    lines.map((l) => ({ unitPrice: l.product.price, quantity: l.quantity, discount: l.discount, taxRate: l.product.taxRate })),
    { priceIncludesTax, orderDiscount },
  )
  return { ...pricing, itemCount: lines.reduce((sum, l) => sum + l.quantity, 0) }
}
