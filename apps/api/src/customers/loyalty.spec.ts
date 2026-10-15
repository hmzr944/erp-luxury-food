import { describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { GIFT_CARD_CODE, giftCardCode, normalizePhone, pointsEarned, pointsToReverse, rewardsAvailable } from '@erp/utils'
import { giftCardsOf } from './customers.service'

const rules = { enabled: true, pointsPerEuro: 1, threshold: 100, reward: 5 }

describe('Fidélité', () => {
  it('un point par euro payé, arrondi à l’inférieur ; rien si désactivée', () => {
    expect(pointsEarned(49.99, rules)).toBe(49)
    expect(pointsEarned(12.5, { ...rules, pointsPerEuro: 2 })).toBe(25)
    expect(pointsEarned(80, { ...rules, enabled: false })).toBe(0)
    expect(pointsEarned(-10, rules)).toBe(0)
  })

  it('récompenses par palier', () => {
    expect(rewardsAvailable(99, rules)).toEqual({ count: 0, points: 0, amount: 0 })
    expect(rewardsAvailable(250, rules)).toEqual({ count: 2, points: 200, amount: 10 })
  })

  it('points repris au prorata d’un remboursement', () => {
    expect(pointsToReverse(40, -20, 40)).toBe(20)
    expect(pointsToReverse(40, -100, 40)).toBe(40)
  })

  it('téléphones français normalisés', () => {
    expect(normalizePhone('06 12 34 56 78')).toBe('+33612345678')
    expect(normalizePhone('+33 6 12 34 56 78')).toBe('+33612345678')
    expect(normalizePhone('0033612345678')).toBe('+33612345678')
    expect(normalizePhone('1234')).toBeNull()
  })

  it('codes de carte cadeau reconnaissables', () => {
    const code = giftCardCode((n) => new Uint8Array(randomBytes(n)))
    expect(code).toMatch(GIFT_CARD_CODE)
    expect(`Carte cadeau ${code}`.match(GIFT_CARD_CODE)?.[0]).toBe(code)
  })
})

describe('giftCardsOf', () => {
  it('ne retient que les lignes carte cadeau avec un code valide', () => {
    expect(
      giftCardsOf([
        { name: 'Carte cadeau CC-AB23-CD45-EF67', price: 40, quantity: 1, isGiftCard: true },
        { name: 'Carte cadeau', price: 10, quantity: 1, isGiftCard: true },
        { name: 'Pull CC-AB23-CD45-EF67', price: 90, quantity: 1 },
      ]),
    ).toEqual([{ code: 'CC-AB23-CD45-EF67', amount: 40 }])
  })
})
