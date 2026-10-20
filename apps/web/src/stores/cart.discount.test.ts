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

import { canonicalSaleContent, priceOrder, ticketLinesFromItems } from '@erp/utils'
import { computeCartTotals, discountExcess, discountNote, hasManualDiscount, saleItems, signedItem, soldView, ticketDiscountRoom, useCartStore, withTicketDiscount, type CartLine } from './cart.store'

const pain = { id: 'pain', name: 'Pain', price: 1.2, taxRate: 5.5 }
const vin = { id: 'vin', name: 'Vin', price: 12.9, taxRate: 20 }
const carte = { id: 'carte', name: 'Carte cadeau ABCD', price: 50, taxRate: 0, giftCard: true }

const store = () => useCartStore.getState()
const line = (id: string) => store().lines.find((l) => l.product.id === id)!

describe('remise manuelle de ligne', () => {
  beforeEach(() => {
    store().clearCart()
    store().addProduct(pain)
    store().addProduct(pain)
    store().addProduct(vin)
  })

  it('pourcentage : montant arrondi au centime, total exact', () => {
    store().setLineDiscountSpec(line('vin').key, { mode: 'percent', value: 15, reason: 'DLC' })
    expect(line('vin').discount).toBe(1.94) // 12,90 x 15 % = 1,935
    expect(line('vin').discountSpec?.reason).toBe('DLC')
    expect(computeCartTotals(store().lines, 0, true).total).toBeCloseTo(2.4 + 12.9 - 1.94, 10)
  })

  it('montant : plafonné au prix de la ligne, jamais de total négatif', () => {
    store().setLineDiscountSpec(line('pain').key, { mode: 'amount', value: 50 })
    expect(line('pain').discount).toBe(2.4)
    expect(computeCartTotals(store().lines, 0, true).total).toBe(12.9)
    store().setLineDiscountSpec(line('vin').key, { mode: 'percent', value: 250 })
    expect(line('vin').discount).toBe(12.9)
    expect(computeCartTotals(store().lines, 0, true).total).toBe(0)
  })

  it('un pourcentage suit la quantité, un montant reste plafonné', () => {
    store().setLineDiscountSpec(line('pain').key, { mode: 'percent', value: 50 })
    expect(line('pain').discount).toBe(1.2)
    store().setQuantity(line('pain').key, 4)
    expect(line('pain').discount).toBe(2.4)
    store().setLineDiscountSpec(line('pain').key, { mode: 'amount', value: 4 })
    store().setQuantity(line('pain').key, 1)
    expect(line('pain').discount).toBe(1.2)
  })

  it('suppression de la remise, valeur nulle ou négative', () => {
    store().setLineDiscountSpec(line('vin').key, { mode: 'percent', value: 10 })
    store().setLineDiscountSpec(line('vin').key, null)
    expect(line('vin').discount).toBe(0)
    expect(line('vin').discountSpec).toBeUndefined()
    store().setLineDiscountSpec(line('vin').key, { mode: 'amount', value: -3 })
    expect(line('vin').discount).toBe(0)
  })

  it('une carte cadeau ne se remise jamais', () => {
    store().addProduct(carte, { customName: 'Carte cadeau ABCD' })
    const key = store().lines.find((l) => l.product.giftCard)!.key
    store().setLineDiscountSpec(key, { mode: 'percent', value: 10 })
    expect(store().lines.find((l) => l.key === key)!.discount).toBe(0)
  })
})

describe('remise sur le ticket', () => {
  const lines: CartLine[] = [
    { key: 'a', product: { id: 'a', name: 'A', price: 33.33, taxRate: 5.5 }, quantity: 1, discount: 0 },
    { key: 'b', product: { id: 'b', name: 'B', price: 66.67, taxRate: 20 }, quantity: 1, discount: 0 },
    { key: 'c', product: { id: 'c', name: 'Carte cadeau', price: 50, taxRate: 0, giftCard: true }, quantity: 1, discount: 0 },
  ]

  it('répartie au prorata, carte cadeau exclue, centime exact', () => {
    expect(ticketDiscountRoom(lines)).toBe(100)
    const sold = withTicketDiscount(lines, { mode: 'amount', value: 10.01 })
    expect(sold.map((l) => l.discount)).toEqual([3.33, 6.68, 0]) // reliquat sur la dernière ligne remisable
    expect(sold.reduce((a, l) => a + l.discount, 0)).toBeCloseTo(10.01, 10)
    // Le total à encaisser perd exactement la remise : la carte reste à 50
    const totals = computeCartTotals(lines, 0, true, 0, { mode: 'amount', value: 10.01 })
    expect(totals.total).toBeCloseTo(139.99, 10)
    expect(totals.lines[2].ttc).toBe(50)
  })

  it('TVA mixte : la TVA de chaque taux suit sa part de remise', () => {
    const totals = computeCartTotals(lines, 0, true, 0, { mode: 'percent', value: 10 })
    const byRate = Object.fromEntries(totals.taxBreakdown.map((t) => [t.rate, t]))
    // 33,33 - 3,33 = 30 à 5,5 % ; 66,67 - 6,67 = 60 à 20 % ; carte à 0 %
    expect(byRate[5.5].ht + byRate[5.5].tax).toBeCloseTo(30, 10)
    expect(byRate[20].ht + byRate[20].tax).toBeCloseTo(60, 10)
    expect(byRate[0].ht + byRate[0].tax).toBeCloseTo(50, 10)
    expect(totals.total).toBeCloseTo(140, 10)
  })

  it('remise de ticket plafonnée aux articles remisables', () => {
    const totals = computeCartTotals(lines, 0, true, 0, { mode: 'amount', value: 999 })
    expect(totals.total).toBe(50) // seule la carte cadeau reste à payer
  })

  it('ne touche qu à ce qui reste après les remises de ligne', () => {
    const withLine = [{ ...lines[0], discount: 33.33 }, lines[1], lines[2]]
    const sold = withTicketDiscount(withLine, { mode: 'percent', value: 100 })
    expect(sold[0].discount).toBe(33.33)
    expect(sold[1].discount).toBe(66.67)
  })

  it('formule : la remise du ticket se répartit sur les composants au centime', () => {
    const menu: CartLine = {
      key: 'm',
      product: { id: 'menu', name: 'Formule', price: 10, taxRate: 10 },
      quantity: 1,
      discount: 0,
      menu: {
        price: 10,
        parts: [
          { productId: 'p1', name: 'Plat', taxRate: 10, alaCarte: 7, supplement: 0, modifiers: [] },
          { productId: 'p2', name: 'Vin', taxRate: 20, alaCarte: 3, supplement: 0, modifiers: [] },
        ],
      },
    }
    const items = saleItems(withTicketDiscount([menu], { mode: 'amount', value: 1.01 }))
    expect(items.reduce((a, i) => a + (i.discount ?? 0), 0)).toBeCloseTo(1.01, 10)
    expect(computeCartTotals([menu], 0, true, 0, { mode: 'amount', value: 1.01 }).total).toBe(8.99)
  })

  it('sans remise de ticket, rien ne change', () => {
    expect(withTicketDiscount(lines, null)).toBe(lines)
    expect(computeCartTotals(lines, 0, true, 0, null).total).toBe(computeCartTotals(lines, 0, true).total)
  })
})

describe('fidélité et remise manuelle', () => {
  const l: CartLine = { key: 'a', product: pain, quantity: 1, discount: 0 }
  it('exclusives : une remise manuelle est détectée', () => {
    expect(hasManualDiscount([l], null)).toBe(false)
    expect(hasManualDiscount([{ ...l, discount: 0.1 }], null)).toBe(true)
    expect(hasManualDiscount([l], { mode: 'percent', value: 5 })).toBe(true)
  })

  it('motifs reportés dans la note de la vente, hors ticket signé', () => {
    const note = discountNote([{ ...l, discount: 0.12, discountSpec: { mode: 'percent', value: 10, reason: 'ABIME' } }], { mode: 'amount', value: 2, reason: 'GESTE' })
    expect(note?.split('\n')).toEqual([expect.stringMatching(/^Remise sur le ticket : 2,00\s€, Geste commercial$/), 'Remise Pain : 10 %, Produit abîmé'])
  })
})

describe('limite du vendeur', () => {
  const lines: CartLine[] = [
    { key: 'a', product: { id: 'a', name: 'Vin', price: 10, taxRate: 20 }, quantity: 1, discount: 2 }, // 20 % : permis
    { key: 'b', product: { id: 'b', name: 'Fromage', price: 10, taxRate: 5.5 }, quantity: 1, discount: 2.1 }, // 21 % : refusé
  ]
  it('un vendeur ne dépasse pas 20 % d une ligne', () => {
    expect(discountExcess(lines, null, 'SELLER').map((e) => e.name)).toEqual(['Fromage'])
    expect(discountExcess([lines[0]], null, 'SELLER')).toEqual([])
  })
  it('responsable et propriétaire : sans limite', () => {
    expect(discountExcess(lines, { mode: 'percent', value: 90 }, 'MANAGER')).toEqual([])
    expect(discountExcess(lines, { mode: 'percent', value: 90 }, 'OWNER')).toEqual([])
  })
  it('remise de ligne et de ticket cumulées', () => {
    // 20 % de ligne puis 10 % de ticket : 28 % sur la ligne
    expect(discountExcess([lines[0]], { mode: 'percent', value: 10 }, 'SELLER')).toHaveLength(1)
    expect(discountExcess([{ ...lines[0], discount: 0 }], { mode: 'percent', value: 20 }, 'SELLER')).toEqual([])
  })
  it('20 % sur un ticket de plusieurs lignes ne bute pas sur l arrondi', () => {
    const many: CartLine[] = Array.from({ length: 7 }, (_, i) => ({ key: `k${i}`, product: { id: `p${i}`, name: `P${i}`, price: 1.99 + i * 0.33, taxRate: 10 }, quantity: 1, discount: 0 }))
    expect(discountExcess(many, { mode: 'percent', value: 20 }, 'SELLER')).toEqual([])
    expect(discountExcess(many, { mode: 'amount', value: 3 }, 'SELLER')).toEqual([])
  })
  it('rôle inconnu (hors ligne, caisse déverrouillée) : traité comme un vendeur', () => {
    expect(discountExcess(lines, null, undefined)).toHaveLength(1)
  })
})

describe('hors ligne : le ticket signé garde son format', () => {
  it('la remise est portée par le champ discount de la ligne, champs en fin de ligne inchangés', () => {
    store().clearCart()
    store().addProduct(vin)
    store().setLineDiscountSpec(line('vin').key, { mode: 'percent', value: 10, reason: 'GESTE' })
    store().setTicketDiscount({ mode: 'amount', value: 1 })
    const items = saleItems(withTicketDiscount(store().lines, store().ticketDiscount))
    const signed = items.map(signedItem)
    expect(signed[0].discount).toBe(2.29) // 1,29 de ligne + 1,00 de ticket
    // Ni motif ni pourcentage dans le contenu signé
    expect(JSON.stringify(signed)).not.toMatch(/reason|percent|GESTE/)
    const content = canonicalSaleContent({ items: signed, payments: [{ code: 'CASH', amount: 10.61 }] })
    expect(content).toBe('items:vin,,1,12.90,20.00,2.29,|payments:CASH,10.61|discount:0.00')
    // Même total qu'à l'écran, sans serveur
    const pricing = priceOrder(signed.map((i) => ({ unitPrice: i.unitPrice, quantity: i.quantity, discount: i.discount, taxRate: i.taxRate })), { priceIncludesTax: true })
    expect(pricing.total).toBe(10.61)
    // Le ticket imprimé montre la part remisée sans changer le signé
    const printed = ticketLinesFromItems(items.map(soldView), pricing.lines.map((l) => l.ttc))
    expect(printed[0].discountPercent).toBe(17.8)
    expect(printed[0].total).toBe(10.61)
  })

  it('persistée avec la vente en cours, vidée avec elle', () => {
    store().setTicketDiscount({ mode: 'percent', value: 5 })
    expect(JSON.parse(localStorage.getItem('flow-vente-en-cours')!).state.ticketDiscount.value).toBe(5)
    store().clearCart()
    expect(store().ticketDiscount).toBeNull()
  })
})
