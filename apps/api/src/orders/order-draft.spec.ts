import { describe, it, expect } from 'vitest'
import { buildOrderDraft, OrderDraftError, type DraftInput } from './order-draft'

const methods = [
  { code: 'CARD', label: 'Carte', kind: 'CARD' },
  { code: 'CASH', label: 'Espèces', kind: 'CASH' },
  { code: 'GIFT_CARD', label: 'Carte cadeau', kind: 'VOUCHER' },
]

const pull = {
  id: 'pull',
  name: 'Pull cachemire',
  price: 290,
  taxRate: 20,
  tracking: 'NONE',
  variants: [
    { id: 'pull-s', name: 'S / Noir', price: 290 },
    { id: 'pull-xl', name: 'XL / Noir', price: 310 },
  ],
}
const ring = { id: 'ring', name: 'Bague Solitaire', price: 1200, taxRate: 20, tracking: 'SERIAL', variants: [] }

const base = (over: Partial<DraftInput>): DraftInput => ({
  items: [],
  products: [pull, ring],
  priceIncludesTax: true,
  paymentMethods: methods,
  ...over,
})

describe('buildOrderDraft', () => {
  it('vend deux tailles du même produit, chacune à son prix', () => {
    const d = buildOrderDraft(
      base({
        items: [
          { productId: 'pull', variantId: 'pull-s', quantity: 1 },
          { productId: 'pull', variantId: 'pull-xl', quantity: 1 },
        ],
      }),
    )
    expect(d.items.map((i) => [i.variantName, i.price])).toEqual([
      ['S / Noir', 290],
      ['XL / Noir', 310],
    ])
    expect(d.pricing.total).toBe(600)
    expect(d.paymentMode).toBe('CARD')
  })

  it('exige une variante quand le produit en a', () => {
    expect(() => buildOrderDraft(base({ items: [{ productId: 'pull', quantity: 1 }] }))).toThrow(
      'Choisissez une variante pour Pull cachemire',
    )
  })

  it('refuse une variante d\'un autre produit', () => {
    expect(() =>
      buildOrderDraft(base({ items: [{ productId: 'ring', variantId: 'pull-s', quantity: 1, serialNumber: 'A1' }] })),
    ).toThrow(OrderDraftError)
  })

  it('exige un numéro de série unique par pièce suivie', () => {
    expect(() => buildOrderDraft(base({ items: [{ productId: 'ring', quantity: 1 }] }))).toThrow(
      'Numéro de série requis',
    )
    expect(() =>
      buildOrderDraft(
        base({
          items: [
            { productId: 'ring', quantity: 1, serialNumber: 'SN-1' },
            { productId: 'ring', quantity: 1, serialNumber: 'SN-1' },
          ],
          payments: [{ code: 'CARD', amount: 2400 }],
        }),
      ),
    ).toThrow('deux fois')
  })

  it('accepte un paiement fractionné exact et le marque MIXED', () => {
    const d = buildOrderDraft(
      base({
        items: [{ productId: 'ring', quantity: 1, serialNumber: 'SN-9' }],
        payments: [
          { code: 'GIFT_CARD', amount: 200 },
          { code: 'CARD', amount: 1000 },
        ],
      }),
    )
    expect(d.paymentMode).toBe('MIXED')
    expect(d.payments.map((p) => p.label)).toEqual(['Carte cadeau', 'Carte'])
  })

  it('refuse des paiements qui ne couvrent pas le total', () => {
    expect(() =>
      buildOrderDraft(
        base({
          items: [{ productId: 'pull', variantId: 'pull-s', quantity: 1 }],
          payments: [{ code: 'CARD', amount: 200 }],
        }),
      ),
    ).toThrow('ne correspondent pas')
  })

  it('refuse un moyen de paiement que l\'organisation n\'a pas', () => {
    expect(() =>
      buildOrderDraft(base({ items: [{ productId: 'pull', variantId: 'pull-s', quantity: 1 }], paymentMode: 'TICKET_RESTO' })),
    ).toThrow('Moyen de paiement inconnu')
  })
})
