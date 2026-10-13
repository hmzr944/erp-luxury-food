import { describe, it, expect } from 'vitest'
import { planRefund, RefundPlanError } from './refund-plan'

const items = [
  { id: 'pull', name: 'Pull', quantity: 2, price: 100, discount: 0, taxRate: 20 },
  { id: 'echarpe', name: 'Écharpe', quantity: 1, price: 50, discount: 0, taxRate: 20 },
]

describe('planRefund', () => {
  it('rembourse ce qui a été payé, remise globale comprise', () => {
    // Vente de 250 € avec 25 € de remise globale : 225 € payés
    const r = planRefund({ total: 225, items, alreadyRefundedQty: {}, alreadyRefundedAmount: 0, lines: [{ orderItemId: 'pull', quantity: 1 }] })
    expect(r.total).toBe(90) // 100 × 225/250
    expect(r.subtotal).toBe(75)
    expect(r.taxAmount).toBe(15)
    expect(r.closesSale).toBe(false)
  })

  it('le dernier retour solde exactement le reste', () => {
    const odd = [{ id: 'a', name: 'A', quantity: 3, price: 10, discount: 0, taxRate: 20 }]
    const first = planRefund({ total: 10, items: odd, alreadyRefundedQty: {}, alreadyRefundedAmount: 0, lines: [{ orderItemId: 'a', quantity: 1 }] })
    expect(first.total).toBe(3.33)
    const second = planRefund({ total: 10, items: odd, alreadyRefundedQty: { a: 1 }, alreadyRefundedAmount: 3.33, lines: [{ orderItemId: 'a', quantity: 1 }] })
    const last = planRefund({ total: 10, items: odd, alreadyRefundedQty: { a: 2 }, alreadyRefundedAmount: 3.33 + second.total, lines: [{ orderItemId: 'a', quantity: 1 }] })
    expect(Math.round((first.total + second.total + last.total) * 100)).toBe(1000)
    expect(last.closesSale).toBe(true)
  })

  it('refuse de rembourser plus que vendu', () => {
    expect(() =>
      planRefund({ total: 250, items, alreadyRefundedQty: { pull: 2 }, alreadyRefundedAmount: 200, lines: [{ orderItemId: 'pull', quantity: 1 }] }),
    ).toThrow('Pull : déjà entièrement remboursé')
    expect(() => planRefund({ total: 250, items, alreadyRefundedQty: {}, alreadyRefundedAmount: 0, lines: [] })).toThrow(RefundPlanError)
    expect(() =>
      planRefund({ total: 250, items, alreadyRefundedQty: {}, alreadyRefundedAmount: 0, lines: [{ orderItemId: 'autre', quantity: 1 }] }),
    ).toThrow('introuvable')
  })

  it('TVA recalculée par taux', () => {
    const mixed = [
      { id: 'choco', name: 'Chocolat', quantity: 1, price: 10.55, discount: 0, taxRate: 5.5 },
      { id: 'tasse', name: 'Tasse', quantity: 1, price: 12, discount: 0, taxRate: 20 },
    ]
    const r = planRefund({ total: 22.55, items: mixed, alreadyRefundedQty: {}, alreadyRefundedAmount: 0, lines: [{ orderItemId: 'choco', quantity: 1 }, { orderItemId: 'tasse', quantity: 1 }] })
    expect(r.total).toBe(22.55)
    expect(r.lines.map((l) => [l.ht, l.tax])).toEqual([[10, 0.55], [10, 2]])
  })
})
