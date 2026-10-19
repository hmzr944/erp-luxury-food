import { describe, it, expect } from 'vitest'
import { mealCardTpe } from './MealCardPayment'
import type { PaymentDevice } from '@/lib/api/payments'

const device = (provider: PaymentDevice['provider']): PaymentDevice => ({ id: 'd1', provider, name: 'TPE', createdAt: '2026-01-01' })
const card = { code: 'TICKET_RESTO_CARD' }

describe('mealCardTpe', () => {
  it('passe la carte titre-restaurant par le TPE relié', () => {
    expect(mealCardTpe(card, device('SUMUP'), false, true)).toEqual({ kind: 'device', device: device('SUMUP') })
    expect(mealCardTpe(card, null, true, false)).toEqual({ kind: 'bridge' })
  })
  it('garde la saisie manuelle sans TPE, hors ligne ou sur un TPE sans source Conecs', () => {
    expect(mealCardTpe(card, null, false, true)).toBeNull()
    expect(mealCardTpe(card, device('SUMUP'), false, false)).toBeNull()
    expect(mealCardTpe(card, device('STRIPE'), false, true)).toBeNull()
    expect(mealCardTpe(card, device('STRIPE'), true, true)).toEqual({ kind: 'bridge' })
  })
  it('ne touche pas au titre-restaurant papier', () => {
    expect(mealCardTpe({ code: 'TICKET_RESTO' }, device('SUMUP'), true, true)).toBeNull()
  })
})
