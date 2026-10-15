import { describe, it, expect } from 'vitest'
import { canonicalSaleContent } from '@erp/utils'
import { computeCartTotals, saleItems, signedItem, type CartLine } from './cart.store'

const menuLine: CartLine = {
  key: 'menu',
  product: { id: 'menu', name: 'Formule midi', price: 16, taxRate: 10 },
  quantity: 2,
  discount: 1,
  menu: {
    price: 15,
    parts: [
      { productId: 'burger', name: 'Burger', taxRate: 10, alaCarte: 12, supplement: 0, modifiers: [{ id: 'cheddar', name: 'Cheddar', price: 1 }], mealVoucher: true },
      { productId: 'beer', name: 'Bière', taxRate: 20, alaCarte: 5, supplement: 0, modifiers: [] },
    ],
  },
}
const cheese: CartLine = {
  key: 'comte',
  product: { id: 'comte', name: 'Comté', price: 11.25, taxRate: 5.5 },
  quantity: 1,
  discount: 0,
  weight: 0.452,
  pricePerKg: 24.9,
  label: '2300045004529',
}

describe('panier vers lignes vendues', () => {
  it('une formule devient ses composants, remise comprise', () => {
    const items = saleItems([menuLine, cheese])
    expect(items.map((i) => [i.productId, i.unitPrice, i.taxRate, i.discount ?? 0, i.menu?.group ?? null])).toEqual([
      ['burger', 11.58, 10, 0.72, 0],
      ['beer', 4.42, 20, 0.28, 0],
      ['comte', 11.25, 5.5, 0, null],
    ])
    // Ce que le client voit sur la ligne = somme des composants
    const totals = computeCartTotals([menuLine, cheese], 0, true)
    expect(totals.total).toBe(16 * 2 - 1 + 11.25)
    expect(totals.taxBreakdown.map((t) => t.rate)).toEqual([5.5, 10, 20])
    // Titre-restaurant : par composant
    expect(items.map((i) => i.mealVoucher)).toEqual([true, false, false])
  })

  it('le contenu signé ne garde que les champs du format', () => {
    const signed = saleItems([menuLine, cheese]).map(signedItem)
    expect(Object.keys(signed[0]).sort()).toEqual(['discount', 'menu', 'modifiers', 'productId', 'quantity', 'taxRate', 'unitPrice'])
    expect(canonicalSaleContent({ items: signed, payments: [] })).toBe(
      'items:burger,,2,11.58,10.00,0.72,,mods=cheddar,menu=menu.0;beer,,2,4.42,20.00,0.28,,menu=menu.0;comte,,1,11.25,5.50,0.00,,w=0.452,ean=2300045004529|payments:|discount:0.00',
    )
  })
})

describe('withLoyalty', () => {
  it('répartit la récompense hors cartes cadeaux', () => {
    const lines: CartLine[] = [
      { key: 'g', product: { id: 'g', name: 'Carte cadeau', price: 50, taxRate: 0, giftCard: true }, customName: 'Carte cadeau', quantity: 1, discount: 0 },
      { key: 'b', product: { id: 'b', name: 'Ceinture', price: 45, taxRate: 20 }, quantity: 1, discount: 0 },
    ]
    const t = computeCartTotals(lines, 0, true, 5)
    expect(t.total).toBe(90)
    expect(t.items.map((i) => i.discount ?? 0)).toEqual([0, 5])
    expect(t.taxAmount).toBe(6.67)
  })
})
