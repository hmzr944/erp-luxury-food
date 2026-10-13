import { describe, expect, it } from 'vitest'
import { cutoffFor, matchProduct, nextDelivery, suggestQuantity, zonedTime } from './supply-plan'

const TZ = 'Europe/Paris'

describe('heure de clôture', () => {
  it('convertit une heure de Paris en UTC, été comme hiver', () => {
    expect(zonedTime('2026-07-01', '18:00', TZ).toISOString()).toBe('2026-07-01T16:00:00.000Z')
    expect(zonedTime('2026-12-01', '18:00', TZ).toISOString()).toBe('2026-12-01T17:00:00.000Z')
  })

  it('avant 18 h : livraison demain ; après : après-demain', () => {
    const before = nextDelivery(new Date('2026-10-13T15:00:00Z'), '18:00', 1, TZ) // 17 h à Paris
    expect(before.deliveryDay).toBe('2026-10-14')
    expect(before.cutoffAt.toISOString()).toBe('2026-10-13T16:00:00.000Z')
    const after = nextDelivery(new Date('2026-10-13T16:30:00Z'), '18:00', 1, TZ)
    expect(after.deliveryDay).toBe('2026-10-15')
  })

  it('délai de deux jours', () => {
    expect(cutoffFor('2026-10-16', '12:00', 2, TZ).toISOString()).toBe('2026-10-14T10:00:00.000Z')
  })

  it('la nuit du changement d’heure', () => {
    // 25 octobre 2026 : 3 h devient 2 h à Paris
    expect(zonedTime('2026-10-25', '18:00', TZ).toISOString()).toBe('2026-10-25T17:00:00.000Z')
    expect(zonedTime('2026-10-24', '18:00', TZ).toISOString()).toBe('2026-10-24T16:00:00.000Z')
  })
})

describe('quantité suggérée', () => {
  it('moyenne du même jour + marge, moins le stock', () => {
    const s = suggestQuantity({ weekday: 2, sameWeekdaySales: [110, 100, 120, 110], stock: 5, lastOrdered: 90 })
    expect(s.quantity).toBe(Math.ceil(110 * 1.1) - 5)
    expect(s.reason).toContain('110 vendus en moyenne les 4 derniers mardis')
    expect(s.reason).toContain('5 en stock')
  })
  it('sans ventes : la dernière commande, sinon zéro', () => {
    expect(suggestQuantity({ weekday: 1, sameWeekdaySales: [0, 0], stock: null, lastOrdered: 40 })).toEqual({ quantity: 40, reason: 'Comme la dernière commande' })
    expect(suggestQuantity({ weekday: 1, sameWeekdaySales: [], stock: null, lastOrdered: null }).quantity).toBe(0)
  })
  it('jamais négative', () => {
    expect(suggestQuantity({ weekday: 3, sameWeekdaySales: [10], stock: 50, lastOrdered: null }).quantity).toBe(0)
  })
})

describe('correspondance des produits', () => {
  const shop = [
    { id: 'a', name: 'Croissant', sku: null, barcode: null },
    { id: 'b', name: 'Tarte citron', sku: 'TC-01', barcode: null },
    { id: 'c', name: 'Pain', sku: null, barcode: '3760001' },
  ]
  it('par référence, code-barres puis nom (accents et casse ignorés)', () => {
    expect(matchProduct({ id: 'x', name: 'Tartelette', sku: 'tc-01', barcode: null }, shop)?.id).toBe('b')
    expect(matchProduct({ id: 'x', name: 'Baguette', sku: null, barcode: '3760001' }, shop)?.id).toBe('c')
    expect(matchProduct({ id: 'x', name: '  CROISSANT ', sku: null, barcode: null }, shop)?.id).toBe('a')
    expect(matchProduct({ id: 'x', name: 'Éclair', sku: null, barcode: null }, shop)).toBeNull()
  })
})
