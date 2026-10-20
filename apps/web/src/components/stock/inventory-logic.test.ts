import { describe, expect, it } from 'vitest'
import type { InventoryLineApi } from '@/lib/api/inventory'
import { afterScan, filterLines, findScanMatch, lineGap, summarize } from './inventory-logic'
import { formatGap, formatQty, gapOf, isLow, matchesQuery, movementEffect, parseQty } from './stock-format'

const line = (o: Partial<InventoryLineApi> & Pick<InventoryLineApi, 'id' | 'name'>): InventoryLineApi => ({
  countId: 'c1', productId: o.id, variantId: null, sku: null, barcode: null, unit: 'unité',
  expectedQty: '10', countedQty: null, reasonCode: null, note: null, gap: null, ...o,
})

const lines = [
  line({ id: 'a', name: 'Confiture de figues', sku: 'CF-01', barcode: '3760001' }),
  line({ id: 'b', name: 'Miel de lavande', sku: 'ML-01', barcode: '3760003', expectedQty: '4', countedQty: '6' }),
  line({ id: 'c', name: 'Vin rouge (75 cl)', sku: 'VR-75', barcode: '3760075', expectedQty: '6', countedQty: '6' }),
  line({ id: 'd', name: 'Vin rouge (150 cl)', sku: 'VR-150', barcode: '3760150', expectedQty: '0', countedQty: '0' }),
  line({ id: 'e', name: 'Éclair café', sku: null, barcode: null, expectedQty: '3', countedQty: '1' }),
]

describe('écart d’une ligne', () => {
  it('absent tant que la ligne n’est pas comptée', () => {
    expect(lineGap(lines[0])).toBeNull()
    expect(lineGap(lines[1])).toBe(2)
    expect(lineGap(lines[2])).toBe(0)
    expect(lineGap(lines[4])).toBe(-2)
  })
  it('sans bruit de virgule', () => expect(gapOf(0.3, 0.1)).toBe(0.2))
})

describe('bilan', () => {
  it('comptées, non comptées, écarts, surplus, manquants', () => {
    expect(summarize(lines)).toEqual({ total: 5, counted: 4, uncounted: 1, withGap: 2, surplus: 2, missing: -2 })
  })
})

describe('filtres et recherche', () => {
  it('à compter et écarts', () => {
    expect(filterLines(lines, '', 'todo').map((l) => l.id)).toEqual(['a'])
    expect(filterLines(lines, '', 'gaps').map((l) => l.id)).toEqual(['b', 'e'])
  })
  it('par nom sans accents ni casse, par SKU, par code-barres', () => {
    expect(filterLines(lines, 'eclair', 'all').map((l) => l.id)).toEqual(['e'])
    expect(filterLines(lines, 'vr-', 'all').map((l) => l.id)).toEqual(['c', 'd'])
    expect(filterLines(lines, '3760003', 'all').map((l) => l.id)).toEqual(['b'])
  })
})

describe('douchette', () => {
  it('un code-barres ou un SKU entier désigne une seule ligne', () => {
    expect(findScanMatch(lines, '3760001')?.id).toBe('a')
    expect(findScanMatch(lines, ' cf-01 ')?.id).toBe('a')
    // « 3760075 » est aussi un début de code ailleurs : l’exact l’emporte
    expect(findScanMatch(lines, '3760075')?.id).toBe('c')
  })
  it('un nom partiel ne désigne une ligne que s’il n’y en a qu’une', () => {
    expect(findScanMatch(lines, 'miel')?.id).toBe('b')
    expect(findScanMatch(lines, 'vin rouge')).toBeNull()
    expect(findScanMatch(lines, 'introuvable')).toBeNull()
    expect(findScanMatch(lines, '   ')).toBeNull()
  })
  it('chaque passage ajoute 1, en partant de zéro', () => {
    expect(afterScan(lines[0])).toBe(1)
    expect(afterScan(lines[1])).toBe(7)
  })
})

describe('saisie et affichage', () => {
  it('virgule ou point, jamais négatif', () => {
    expect(parseQty('2,5')).toBe(2.5)
    expect(parseQty(' 12 ')).toBe(12)
    expect(parseQty('0')).toBe(0)
    expect(parseQty('-1')).toBeNull()
    expect(parseQty('1,2345')).toBeNull()
    expect(parseQty('abc')).toBeNull()
    expect(parseQty('')).toBeNull()
  })
  it('écart signé et quantité en français', () => {
    expect(formatGap(5)).toBe('+5')
    expect(formatGap(-2.5)).toBe('-2,5')
    expect(formatGap(0)).toBe('0')
    expect(formatQty('1234.5').replace(/\s/g, ' ')).toBe('1 234,5')
  })
  it('stock bas : au seuil ou en dessous, jamais sans seuil', () => {
    expect(isLow({ quantity: 5, alertAt: 5 })).toBe(true)
    expect(isLow({ quantity: '4', alertAt: '5' })).toBe(true)
    expect(isLow({ quantity: 6, alertAt: 5 })).toBe(false)
    expect(isLow({ quantity: 0, alertAt: null })).toBe(false)
  })
  it('signe d’un mouvement : l’ajustement suit son signe, les sorties baissent', () => {
    expect(movementEffect('ADJUSTMENT', -3)).toBe(-3)
    expect(movementEffect('ADJUSTMENT', 3)).toBe(3)
    expect(movementEffect('LOSS', 2)).toBe(-2)
    expect(movementEffect('SALE', 1)).toBe(-1)
    expect(movementEffect('RESTOCK', 4)).toBe(4)
  })
  it('recherche d’une ligne de stock : nom de variante compris', () => {
    const item = { product: { name: 'Vin rouge', sku: 'VR', barcode: '376' }, variantName: '75 cl' } as any
    expect(matchesQuery(item, '75 cl')).toBe(true)
    expect(matchesQuery(item, 'blanc')).toBe(false)
    expect(matchesQuery(item, '')).toBe(true)
  })
})
