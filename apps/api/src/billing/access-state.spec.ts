import { describe, expect, it } from 'vitest'
import { accessState, GRACE_DAYS } from './access-state'

const DAY = 86_400_000
const trialEnd = new Date('2026-11-01T10:00:00Z')
const at = (offsetMs: number) => new Date(trialEnd.getTime() + offsetMs)
const trialing = { subscriptionStatus: 'TRIALING' as const, trialEndsAt: trialEnd, currentPeriodEnd: null }

describe("accès selon l'abonnement", () => {
  it("essai en cours jusqu'à la dernière milliseconde", () => {
    expect(accessState(trialing, at(-10 * DAY))).toEqual({ state: 'trial', lockAt: at(GRACE_DAYS * DAY) })
    expect(accessState(trialing, at(-1)).state).toBe('trial')
  })

  it("délai de grâce de 7 jours après l'essai, puis verrou", () => {
    expect(accessState(trialing, at(0))).toEqual({ state: 'grace', lockAt: at(7 * DAY) })
    expect(accessState(trialing, at(7 * DAY - 1)).state).toBe('grace')
    expect(accessState(trialing, at(7 * DAY))).toEqual({ state: 'locked', lockAt: at(7 * DAY) })
    expect(accessState(trialing, at(400 * DAY)).state).toBe('locked')
  })

  it("abonnement actif : jamais de verrou, même pendant ou après l'essai", () => {
    const active = { ...trialing, subscriptionStatus: 'ACTIVE' as const }
    expect(accessState(active, at(-5 * DAY))).toEqual({ state: 'active', lockAt: null })
    expect(accessState(active, at(100 * DAY))).toEqual({ state: 'active', lockAt: null })
  })

  it("paiement en échec : délai de grâce jusqu'à 7 jours après la période payée", () => {
    const periodEnd = at(30 * DAY)
    const pastDue = { subscriptionStatus: 'PAST_DUE' as const, trialEndsAt: trialEnd, currentPeriodEnd: periodEnd }
    expect(accessState(pastDue, at(31 * DAY))).toEqual({ state: 'grace', lockAt: at(37 * DAY) })
    expect(accessState(pastDue, at(37 * DAY)).state).toBe('locked')
    // Échec du premier paiement pendant l'essai : pas d'essai, mais un délai
    expect(accessState({ ...pastDue, currentPeriodEnd: null }, at(-2 * DAY))).toEqual({ state: 'grace', lockAt: at(7 * DAY) })
  })

  it("abonnement arrêté : grâce après la dernière période, essai conservé s'il court encore", () => {
    const canceled = { subscriptionStatus: 'CANCELED' as const, trialEndsAt: trialEnd, currentPeriodEnd: at(60 * DAY) }
    expect(accessState(canceled, at(62 * DAY))).toEqual({ state: 'grace', lockAt: at(67 * DAY) })
    expect(accessState(canceled, at(67 * DAY)).state).toBe('locked')
    expect(accessState({ ...canceled, currentPeriodEnd: null }, at(-3 * DAY)).state).toBe('trial')
  })

  it('sans date de référence, pas de verrou', () => {
    expect(accessState({ ...trialing, trialEndsAt: null }, at(999 * DAY))).toEqual({ state: 'trial', lockAt: null })
    expect(accessState({ subscriptionStatus: 'CANCELED', trialEndsAt: null, currentPeriodEnd: null }, at(0))).toEqual({ state: 'grace', lockAt: null })
  })

  it("sans paiement en ligne sur le serveur, l'essai continue", () => {
    expect(accessState(trialing, at(400 * DAY), { billingEnabled: false })).toEqual({ state: 'trial', lockAt: null })
    expect(accessState({ ...trialing, subscriptionStatus: 'ACTIVE' }, at(0), { billingEnabled: false }).state).toBe('active')
  })
})
