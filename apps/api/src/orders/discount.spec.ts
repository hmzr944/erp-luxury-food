import { describe, it, expect } from 'vitest'
import {
  SELLER_DISCOUNT_MAX_PERCENT, discountCents, discountPercent, isDiscountManager, layoutTicket, priceOrder,
  sellerDiscountExcess, splitDiscountCents, ticketLinesFromItems, buildSaleTicket, soldItemView,
} from '@erp/utils'
import { discountExcessNotes } from './orders.service'
import type { OrderDraft } from './order-draft'

describe('discountCents', () => {
  it('pourcentage arrondi au centime, plafonné à la base', () => {
    expect(discountCents({ mode: 'percent', value: 15 }, 1290)).toBe(194)
    expect(discountCents({ mode: 'percent', value: 100 }, 1290)).toBe(1290)
    expect(discountCents({ mode: 'percent', value: 400 }, 1290)).toBe(1290)
  })
  it('montant plafonné, jamais négatif', () => {
    expect(discountCents({ mode: 'amount', value: 5 }, 300)).toBe(300)
    expect(discountCents({ mode: 'amount', value: -5 }, 300)).toBe(0)
    expect(discountCents({ mode: 'amount', value: NaN }, 300)).toBe(0)
    expect(discountCents({ mode: 'percent', value: 10 }, 0)).toBe(0)
  })
  it('pourcentage d affichage', () => {
    expect(discountPercent(1.94, 12.9)).toBe(15)
    expect(discountPercent(0, 12.9)).toBe(0)
  })
})

describe('splitDiscountCents', () => {
  it('la somme des parts est exactement la remise, reliquat sur la dernière ligne', () => {
    expect(splitDiscountCents(1001, [3333, 6667])).toEqual([333, 668])
    expect(splitDiscountCents(100, [100, 100, 100])).toEqual([33, 33, 34])
  })
  it('une base nulle (carte cadeau) ne reçoit rien et ne reçoit pas le reliquat', () => {
    expect(splitDiscountCents(101, [100, 100, 0])).toEqual([50, 51, 0])
  })
  it('jamais au-delà d une base, même avec un reliquat', () => {
    const shares = splitDiscountCents(3, [1, 1, 1000])
    expect(shares.reduce((a, b) => a + b, 0)).toBe(3)
    shares.forEach((s, i) => expect(s).toBeLessThanOrEqual([1, 1, 1000][i]))
    expect(splitDiscountCents(500, [100, 100])).toEqual([100, 100])
  })
})

describe('TVA après remise répartie (ligne par ligne, comme signé)', () => {
  it('total exact au centime et TVA par taux', () => {
    const bases = [3333, 6667]
    const shares = splitDiscountCents(discountCents({ mode: 'percent', value: 12.5 }, 10000), bases)
    const r = priceOrder(
      [
        { unitPrice: 33.33, quantity: 1, discount: shares[0] / 100, taxRate: 5.5 },
        { unitPrice: 66.67, quantity: 1, discount: shares[1] / 100, taxRate: 20 },
      ],
      { priceIncludesTax: true },
    )
    expect(r.total).toBe(87.5)
    expect(r.taxBreakdown.reduce((a, t) => a + t.ht + t.tax, 0)).toBeCloseTo(87.5, 10)
  })
})

describe('limite du vendeur côté serveur', () => {
  it('constante nommée à 20 %', () => expect(SELLER_DISCOUNT_MAX_PERCENT).toBe(20))
  it('20 % pile permis, au-delà signalé', () => {
    expect(sellerDiscountExcess([{ unitPrice: 10, quantity: 1, discount: 2 }])).toEqual([])
    expect(sellerDiscountExcess([{ name: 'Vin', unitPrice: 10, quantity: 1, discount: 3.5 }])).toEqual([{ index: 0, name: 'Vin', percent: 35 }])
  })
  it('remise globale de l ancien format répartie sur les lignes', () => {
    const items = [{ unitPrice: 10, quantity: 1 }, { unitPrice: 10, quantity: 1 }]
    expect(sellerDiscountExcess(items, 4)).toEqual([])
    expect(sellerDiscountExcess(items, 6)).toHaveLength(2)
  })
  it('rôles sans limite', () => {
    expect(isDiscountManager('OWNER')).toBe(true)
    expect(isDiscountManager('MANAGER')).toBe(true)
    expect(isDiscountManager('SELLER')).toBe(false)
    expect(isDiscountManager(undefined)).toBe(false)
  })
  it('une vente signée hors limite est décrite pour la note et le journal, jamais refusée', () => {
    const draft = {
      items: [{ name: 'Foie gras', price: 40, quantity: 1, discount: 20 }, { name: 'Pain', price: 1.2, quantity: 1, discount: 0 }],
    } as unknown as OrderDraft
    expect(discountExcessNotes(draft)).toEqual(['Foie gras : 50 %'])
    expect(discountExcessNotes({ items: [{ name: 'Pain', price: 1.2, quantity: 1, discount: 0 }] } as unknown as OrderDraft)).toEqual([])
  })
})

describe('remise sur le ticket imprimé', () => {
  it('une ligne remisée porte son pourcentage, les autres ne changent pas', () => {
    const items = [
      soldItemView({ name: 'Vin', quantity: 1, taxRate: 20, price: 12.9, discount: 1.29 }),
      soldItemView({ name: 'Pain', quantity: 2, taxRate: 5.5, price: 1.2, discount: 0 }),
    ]
    const lines = ticketLinesFromItems(items, [11.61, 2.4])
    expect(lines[0].discountPercent).toBe(10)
    expect('discountPercent' in lines[1]).toBe(false)
    const ticket = buildSaleTicket({
      siteName: 'Boutique', terminalName: 'Caisse 1', number: '12', signedAt: new Date('2026-10-20T10:00:00Z'), lines,
      total: 14.01, taxBreakdown: [{ rate: 5.5, ht: 2.27, tax: 0.13 }, { rate: 20, ht: 9.68, tax: 1.93 }], payments: [{ label: 'Espèces', amount: 14.01 }], software: 'FLŌW 1.0.0',
    })
    const text = layoutTicket(ticket, 48).map((l) => l.text)
    expect(text.some((t) => t.includes('dont remise 10 %'))).toBe(true)
    expect(text.filter((t) => t.includes('dont remise'))).toHaveLength(1)
  })
})
