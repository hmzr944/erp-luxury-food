import { beforeEach, describe, expect, it, vi } from 'vitest'

// Vente en cours gardée sur l'appareil : stockage en mémoire pour le test
vi.hoisted(() => {
  const mem = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  } as Storage
})

import { useCartStore } from './cart.store'

const pain = { id: 'pain', name: 'Pain', price: 1.2, taxRate: 5.5 }
const cafe = { id: 'cafe', name: 'Café', price: 2, taxRate: 10 }

describe('compte verrouillé', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart()
    useCartStore.getState().setSalesLocked(false)
  })

  it('ne commence pas de nouvelle vente', () => {
    useCartStore.getState().setSalesLocked(true)
    useCartStore.getState().addProduct(pain)
    expect(useCartStore.getState().lines).toHaveLength(0)
  })

  it('laisse terminer une vente déjà commencée', () => {
    useCartStore.getState().addProduct(pain)
    useCartStore.getState().setSalesLocked(true)
    useCartStore.getState().addProduct(cafe)
    useCartStore.getState().addProduct(pain)
    expect(useCartStore.getState().lines.map((l) => [l.product.id, l.quantity])).toEqual([['pain', 2], ['cafe', 1]])
  })

  it('reprend normalement une fois abonné', () => {
    useCartStore.getState().setSalesLocked(true)
    useCartStore.getState().setSalesLocked(false)
    useCartStore.getState().addProduct(pain)
    expect(useCartStore.getState().lines).toHaveLength(1)
  })
})
