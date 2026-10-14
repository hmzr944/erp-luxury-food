import { describe, it, expect } from 'vitest'
import {
  canonicalSaleContent,
  ean13CheckDigit,
  layoutTicket,
  buildSaleTicket,
  parseScaleBarcode,
  priceForWeight,
  priceMenu,
  priceOrder,
  splitCents,
  splitDiscount,
  ticketLinesFromItems,
} from '@erp/utils'
import { buildOrderDraft, type DraftInput, type DraftProduct } from './order-draft'

const ean = (first12: string) => first12 + ean13CheckDigit(first12)

describe('répartition du prix d’une formule', () => {
  it('au prorata des prix à la carte, au centime près', () => {
    // Burger 12 € (10 %), bière 5 € (20 %), formule à 15 €
    const r = priceMenu(15, [
      { productId: 'b', name: 'Burger', taxRate: 10, alaCarte: 12 },
      { productId: 'k', name: 'Bière', taxRate: 20, alaCarte: 5 },
    ])
    expect(r.unitPrices).toEqual([10.58, 4.42])
    expect(r.total).toBe(15)
  })

  it('supplément et options payantes reviennent au composant', () => {
    const r = priceMenu(10, [
      { productId: 'p', name: 'Plat', taxRate: 10, alaCarte: 8, modifiers: [{ id: 'c', name: 'Cheddar', price: 1 }] },
      { productId: 'd', name: 'Dessert du jour', taxRate: 10, alaCarte: 4, supplement: 1.5 },
    ])
    // 10 € répartis 6,66 / 3,34, puis +1 et +1,50
    expect(r.unitPrices).toEqual([7.66, 4.84])
    expect(r.total).toBe(12.5)
  })

  it('composants gratuits à la carte : parts égales', () => {
    expect(splitCents(1000, [0, 0, 0])).toEqual([333, 333, 334])
  })

  it('la remise d’une formule se répartit sans perdre un centime', () => {
    const d = splitDiscount(1, [10.58, 4.42])
    expect(d.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
  })

  it('la TVA de la vente est ventilée par taux', () => {
    const p = priceOrder(
      [
        { unitPrice: 10.58, quantity: 1, taxRate: 10 },
        { unitPrice: 4.42, quantity: 1, taxRate: 20 },
      ],
      { priceIncludesTax: true },
    )
    expect(p.total).toBe(15)
    expect(p.taxBreakdown).toEqual([
      { rate: 10, ht: 9.62, tax: 0.96 },
      { rate: 20, ht: 3.68, tax: 0.74 },
    ])
  })
})

describe('étiquettes de balance', () => {
  it('lit un prix intégré (préfixe 20)', () => {
    const code = ean('200012301250')
    expect(parseScaleBarcode(code)).toMatchObject({ code: '123', price: 12.5 })
  })

  it('lit un poids intégré (préfixe 23)', () => {
    const code = ean('230004500452')
    expect(parseScaleBarcode(code)).toMatchObject({ code: '45', weight: 0.452 })
  })

  it('refuse une clé fausse, un EAN ordinaire et un préfixe non configuré', () => {
    const good = ean('200012301250')
    const bad = good.slice(0, 12) + ((Number(good[12]) + 1) % 10)
    expect(parseScaleBarcode(bad)).toBeNull()
    expect(parseScaleBarcode(ean('300000000000'))).toBeNull()
    expect(parseScaleBarcode(ean('250012301250'))).toBeNull()
  })

  it('suit le réglage de l’organisation', () => {
    const code = ean('210012301250')
    expect(parseScaleBarcode(code, [{ prefix: '21', mode: 'WEIGHT', codeLength: 4 }])).toMatchObject({ code: '12', weight: 301.25 })
  })

  it('prix d’un poids au centime', () => {
    expect(priceForWeight(0.452, 24.9)).toBe(11.25)
  })
})

describe('format signé', () => {
  const plain = { productId: 'p', quantity: 1, unitPrice: 4, taxRate: 10 }
  it('une ligne simple garde exactement l’ancien format', () => {
    expect(canonicalSaleContent({ items: [plain], payments: [{ code: 'CARD', amount: 4 }] })).toBe('items:p,,1,4.00,10.00,0.00,|payments:CARD,4.00|discount:0.00')
  })

  it('options, formule et pesée sont signées', () => {
    const s = canonicalSaleContent({
      items: [{ ...plain, modifiers: ['m1', 'm2'], menu: { productId: 'menu', group: 0 }, weight: 0.452, label: '2300045004521' }],
      payments: [],
    })
    expect(s).toContain(',mods=m1+m2,menu=menu.0,w=0.452,ean=2300045004521')
  })
})

const methods = [{ code: 'CARD', label: 'Carte', kind: 'CARD' }]
const burger: DraftProduct = {
  id: 'burger', name: 'Burger', price: 12, taxRate: 10, tracking: 'NONE', variants: [],
  modifiers: [{ id: 'cheddar', name: 'Cheddar', price: 1 }, { id: 'saignant', name: 'Saignant', price: 0 }],
}
const beer: DraftProduct = { id: 'beer', name: 'Bière', price: 5, taxRate: 20, tracking: 'NONE', variants: [] }
const soda: DraftProduct = { id: 'soda', name: 'Limonade', price: 3, taxRate: 5.5, tracking: 'NONE', variants: [] }
const menu: DraftProduct = {
  id: 'menu', name: 'Formule midi', price: 15, taxRate: 10, tracking: 'NONE', variants: [], isMenu: true,
  menuSteps: [
    { name: 'Plat', minSelect: 1, maxSelect: 1, choices: [{ productId: 'burger', variantId: null, supplement: 0 }] },
    { name: 'Boisson', minSelect: 1, maxSelect: 1, choices: [{ productId: 'beer', variantId: null, supplement: 0 }, { productId: 'soda', variantId: null, supplement: 0 }] },
  ],
}
const cheese: DraftProduct = { id: 'comte', name: 'Comté 18 mois', price: 24.9, taxRate: 5.5, tracking: 'NONE', variants: [], soldByWeight: true, scaleCode: '45' }

const draft = (over: Partial<DraftInput>) =>
  buildOrderDraft({ items: [], products: [burger, beer, soda, menu, cheese], priceIncludesTax: true, paymentMethods: methods, ...over })

describe('vente avec formule, options et pesée', () => {
  it('formule : chaque composant à sa part et à son taux', () => {
    const d = draft({
      items: [
        { productId: 'burger', quantity: 2, menu: { productId: 'menu', group: 0 }, modifiers: ['cheddar', 'saignant'] },
        { productId: 'beer', quantity: 2, menu: { productId: 'menu', group: 0 } },
      ],
    })
    expect(d.items.map((i) => [i.name, i.price, i.taxRate, i.menuName, i.menuGroup])).toEqual([
      ['Burger', 11.58, 10, 'Formule midi', 0],
      ['Bière', 4.42, 20, 'Formule midi', 0],
    ])
    expect(d.items[0].modifiers).toEqual([{ id: 'cheddar', name: 'Cheddar', price: 1 }, { id: 'saignant', name: 'Saignant', price: 0 }])
    expect(d.pricing.total).toBe(32)
  })

  it('formule incomplète refusée au serveur', () => {
    expect(() => draft({ items: [{ productId: 'burger', quantity: 1, menu: { productId: 'menu', group: 0 } }] })).toThrow('choisissez boisson')
  })

  it('article hors formule refusé, signalé pour une vente signée', () => {
    const items = [
      { productId: 'burger', quantity: 1, menu: { productId: 'menu', group: 0 } },
      { productId: 'comte', quantity: 1, weight: 0.2, menu: { productId: 'menu', group: 0 } },
    ]
    expect(() => draft({ items })).toThrow()
    const signed = draft({
      useSignedPrices: true,
      items: [
        { productId: 'burger', quantity: 1, menu: { productId: 'menu', group: 0 }, unitPrice: 10.58, taxRate: 10 },
        { productId: 'soda', quantity: 1, menu: { productId: 'menu', group: 0 }, unitPrice: 4.42, taxRate: 5.5 },
        { productId: 'beer', quantity: 1, menu: { productId: 'menu', group: 0 }, unitPrice: 0, taxRate: 20 },
      ],
    })
    expect(signed.priceDifferences.join(' ')).toContain('hors formule')
  })

  it('une formule ne se vend pas comme un article', () => {
    expect(() => draft({ items: [{ productId: 'menu', quantity: 1 }] })).toThrow('formule')
  })

  it('choix obligatoire et maximum d’un groupe d’options', () => {
    const steak: DraftProduct = {
      ...burger, id: 'steak', name: 'Steak',
      modifierGroups: [{ name: 'Cuisson', minSelect: 1, maxSelect: 1, modifierIds: ['saignant', 'cheddar'] }],
    }
    const run = (modifiers: string[]) => buildOrderDraft({ items: [{ productId: 'steak', quantity: 1, modifiers }], products: [steak], priceIncludesTax: true, paymentMethods: methods })
    expect(() => run([])).toThrow('choisissez cuisson')
    expect(() => run(['saignant', 'cheddar'])).toThrow('1 choix au plus')
    expect(run(['saignant']).items[0].price).toBe(12)
  })

    it('option inconnue refusée', () => {
    expect(() => draft({ items: [{ productId: 'beer', quantity: 1, modifiers: ['cheddar'] }] })).toThrow('Option inconnue')
  })

  it('pesée : prix calculé au kilo, ou lu sur l’étiquette', () => {
    const byWeight = draft({ items: [{ productId: 'comte', quantity: 1, label: ean('230004500452') }] })
    expect(byWeight.items[0]).toMatchObject({ price: 11.25, weight: 0.452, pricePerKg: 24.9 })
    const byPrice = draft({ items: [{ productId: 'comte', quantity: 1, label: ean('200004501125') }] })
    expect(byPrice.items[0]).toMatchObject({ price: 11.25, weight: null })
    expect(() => draft({ items: [{ productId: 'comte', quantity: 1 }] })).toThrow('Poids manquant')
    expect(() => draft({ items: [{ productId: 'comte', quantity: 1, label: ean('230009900452') }] })).toThrow('ne correspond pas')
  })
})

describe('ticket d’une formule', () => {
  it('regroupe les composants avec leur taux', () => {
    const lines = ticketLinesFromItems(
      [
        { name: 'Burger', quantity: 1, taxRate: 10, menuGroup: 0, menuName: 'Formule midi', modifiers: [{ name: 'Cheddar', price: 1 }] },
        { name: 'Bière', quantity: 1, taxRate: 20, menuGroup: 0, menuName: 'Formule midi' },
        { name: 'Comté', quantity: 1, taxRate: 5.5, weight: 0.452, pricePerKg: 24.9 },
      ],
      [11.58, 4.42, 11.25],
    )
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ name: 'Formule midi', total: 16 })
    expect(lines[0].parts?.map((p) => p.name)).toEqual(['Burger (Cheddar +1,00)', 'Bière'])
    expect(lines[1].detail).toBe('0,452 kg à 24,90 €/kg')

    const text = layoutTicket(
      buildSaleTicket({
        siteName: 'Test', terminalName: 'Caisse 1', number: '1', signedAt: new Date('2026-10-14T12:00:00Z'), software: 'FLŌW',
        lines, total: 27.25, taxBreakdown: [{ rate: 5.5, ht: 10.66, tax: 0.59 }, { rate: 10, ht: 10.53, tax: 1.05 }, { rate: 20, ht: 3.68, tax: 0.74 }], payments: [],
      }),
      48,
    ).map((l) => l.text)
    expect(text.find((t) => t.includes('Formule midi'))).toMatch(/16,00$/)
    expect(text.find((t) => t.includes('Bière'))).toMatch(/4,42 C$/)
  })
})
