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
}

export interface CartLine {
  product: CartProduct
  variantId?: string
  variantName?: string
  quantity: number
  discount: number  // remise en euros sur la ligne
}

interface CartState {
  lines: CartLine[]
  orderDiscount: number
  // Actions
  addProduct: (product: CartProduct, variantId?: string, variantName?: string) => void
  removeProduct: (productId: string, variantId?: string) => void
  setQuantity: (productId: string, quantity: number, variantId?: string) => void
  setLineDiscount: (productId: string, discount: number, variantId?: string) => void
  setOrderDiscount: (discount: number) => void
  clearCart: () => void
}

function lineKey(productId: string, variantId?: string) {
  return variantId ? `${productId}:${variantId}` : productId
}

export const useCartStore = create<CartState>()((set, get) => ({
  lines: [],
  orderDiscount: 0,

  addProduct: (product, variantId, variantName) => {
    set((state) => {
      const key = lineKey(product.id, variantId)
      const existing = state.lines.find(
        (l) => lineKey(l.product.id, l.variantId) === key,
      )

      if (existing) {
        return {
          lines: state.lines.map((l) =>
            lineKey(l.product.id, l.variantId) === key
              ? { ...l, quantity: l.quantity + 1 }
              : l,
          ),
        }
      }

      return {
        lines: [
          ...state.lines,
          { product, variantId, variantName, quantity: 1, discount: 0 },
        ],
      }
    })
  },

  removeProduct: (productId, variantId) => {
    const key = lineKey(productId, variantId)
    set((state) => ({
      lines: state.lines.filter((l) => lineKey(l.product.id, l.variantId) !== key),
    }))
  },

  setQuantity: (productId, quantity, variantId) => {
    const key = lineKey(productId, variantId)
    if (quantity <= 0) {
      set((state) => ({
        lines: state.lines.filter((l) => lineKey(l.product.id, l.variantId) !== key),
      }))
      return
    }
    set((state) => ({
      lines: state.lines.map((l) =>
        lineKey(l.product.id, l.variantId) === key ? { ...l, quantity } : l,
      ),
    }))
  },

  setLineDiscount: (productId, discount, variantId) => {
    const key = lineKey(productId, variantId)
    set((state) => ({
      lines: state.lines.map((l) =>
        lineKey(l.product.id, l.variantId) === key
          ? { ...l, discount: Math.max(0, discount) }
          : l,
      ),
    }))
  },

  setOrderDiscount: (discount) => set({ orderDiscount: Math.max(0, discount) }),
  clearCart: () => set({ lines: [], orderDiscount: 0 }),
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
