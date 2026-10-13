import { describe, expect, it } from 'vitest'
import { CashCountError, closingPlan, countCash } from '@erp/utils'

describe('fond de caisse', () => {
  it('compte par coupures', () => {
    expect(countCash({ '5000': 3, '2000': 5, '200': 10 })).toBe(27000)
    expect(countCash({})).toBe(0)
    expect(() => countCash({ '300': 1 })).toThrow(CashCountError)
    expect(() => countCash({ '200': -1 })).toThrow(CashCountError)
  })
  it('garde le fond cible, dépose le reste', () => {
    const p = closingPlan({ counted: 45000, expected: 45050, floatTarget: 15000, tolerance: 200 })
    expect(p).toMatchObject({ keep: 15000, deposit: 30000, difference: -50, withinTolerance: true })
  })
  it('écart au-delà de la tolérance', () => {
    expect(closingPlan({ counted: 40000, expected: 45000, floatTarget: 15000, tolerance: 200 }).withinTolerance).toBe(false)
  })
  it('moins que le fond cible : tout reste dans le tiroir', () => {
    expect(closingPlan({ counted: 9000, expected: 9000, floatTarget: 15000, tolerance: 200 })).toMatchObject({ keep: 9000, deposit: 0 })
  })
})

import { describeCash, recommendCash, splitFloat } from '@erp/utils'

describe('composition du fond', () => {
  it('garde le fond exact en gardant la monnaie, dépose les gros billets', () => {
    // 2×50, 5×20, 4×10, 6×2, 10×1 = 262 € ; fond 150 €
    const s = splitFloat({ '5000': 2, '2000': 5, '1000': 4, '200': 6, '100': 10 }, 15000)
    expect(s.keepTotal).toBe(15000)
    expect(s.exact).toBe(true)
    expect(s.keep['100']).toBe(10)
    expect(s.keep['200']).toBe(5) // 6 pièces laisseraient 128 €, impossible en billets de 10 et 20
    expect(s.deposit['5000']).toBe(2)
    expect(s.keepTotal + s.depositTotal).toBe(26200)
  })
  it('au plus près en dessous quand la somme exacte est impossible', () => {
    const s = splitFloat({ '5000': 4 }, 15000)
    expect(s).toMatchObject({ keepTotal: 15000, exact: true })
    const t = splitFloat({ '2000': 3, '5000': 2 }, 15000) // 20,20,20,50,50 → 140 max sous 150
    expect(t.keepTotal).toBe(14000)
    expect(t.exact).toBe(false)
  })
  it('moins que le fond : tout reste', () => {
    expect(splitFloat({ '1000': 3 }, 15000)).toMatchObject({ keepTotal: 3000, depositTotal: 0 })
  })
  it('se lit en français', () => {
    expect(describeCash({ '2000': 2, '100': 1 })).toEqual(['2 billets de 20 €', '1 pièce de 1 €'])
  })
})

describe('réglage automatique', () => {
  it('fond et tolérance tirés des ventes', () => {
    const r = recommendCash({ days: 28, cashTickets: 1400, cashTotal: 1400 * 12.4, fallbackFloat: 150 })
    expect(r.floatTarget).toBe(250) // 50 ventes en espèces par jour : 100 + 125 → 250
    expect(r.tolerance).toBe(1.5) // 620 €/jour × 0,2 % = 1,24 → 1,5
  })
  it('sans historique : réglage du métier', () => {
    expect(recommendCash({ days: 28, cashTickets: 3, cashTotal: 30, fallbackFloat: 100 }).floatTarget).toBe(100)
  })
})
