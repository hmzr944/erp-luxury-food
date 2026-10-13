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
