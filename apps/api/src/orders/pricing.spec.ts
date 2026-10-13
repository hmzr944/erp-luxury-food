import { describe, it, expect } from 'vitest'
import { priceOrder } from '@erp/utils'

describe('priceOrder', () => {
  it('prix TTC : la TVA est extraite du prix affiché', () => {
    const r = priceOrder([{ unitPrice: 120, quantity: 1, taxRate: 20 }], { priceIncludesTax: true })
    expect(r.total).toBe(120)
    expect(r.subtotal).toBe(100)
    expect(r.taxAmount).toBe(20)
  })

  it('prix HT : la TVA est ajoutée (comportement historique)', () => {
    const r = priceOrder([{ unitPrice: 24.5, quantity: 2, taxRate: 5.5 }], { priceIncludesTax: false })
    expect(r.subtotal).toBe(49)
    expect(r.taxAmount).toBe(2.7) // 2,695 arrondi
    expect(r.total).toBe(51.7)
  })

  it('remise de ligne dans la base de saisie', () => {
    const r = priceOrder([{ unitPrice: 50, quantity: 2, discount: 10, taxRate: 20 }], { priceIncludesTax: true })
    expect(r.total).toBe(90)
    expect(r.subtotal + r.taxAmount).toBeCloseTo(90, 10)
  })

  it('remise globale répartie au prorata sur plusieurs taux, sans centime perdu', () => {
    const r = priceOrder(
      [
        { unitPrice: 33.33, quantity: 1, taxRate: 5.5 },
        { unitPrice: 66.67, quantity: 1, taxRate: 20 },
      ],
      { priceIncludesTax: true, orderDiscount: 10 },
    )
    expect(r.total).toBe(90)
    expect(r.discount).toBe(10)
    const lineSum = r.lines.reduce((a, l) => a + Math.round(l.ttc * 100), 0)
    expect(lineSum).toBe(9000)
    expect(r.taxBreakdown.map((t) => t.rate)).toEqual([5.5, 20])
  })

  it('une remise globale ne rend jamais le total négatif', () => {
    const r = priceOrder([{ unitPrice: 5, quantity: 1, taxRate: 20 }], { priceIncludesTax: true, orderDiscount: 50 })
    expect(r.total).toBe(0)
    expect(r.discount).toBe(5)
  })

  it('évite les erreurs de virgule flottante (0,1 + 0,2)', () => {
    const r = priceOrder(
      [
        { unitPrice: 0.1, quantity: 1, taxRate: 0 },
        { unitPrice: 0.2, quantity: 1, taxRate: 0 },
      ],
      { priceIncludesTax: true },
    )
    expect(r.total).toBe(0.3)
  })

  it('panier vide', () => {
    const r = priceOrder([], { priceIncludesTax: true, orderDiscount: 5 })
    expect(r.total).toBe(0)
    expect(r.discount).toBe(0)
  })
})
