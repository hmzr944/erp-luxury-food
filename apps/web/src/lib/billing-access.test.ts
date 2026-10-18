import { describe, expect, it } from 'vitest'
import { accessNotice, effectiveAccess, type AccessSnapshot } from './billing-access'

const DAY = 86_400_000
const now = new Date('2026-11-01T10:00:00Z')
const iso = (offset: number) => new Date(now.getTime() + offset).toISOString()

describe("accès à la caisse côté appareil", () => {
  it('sans statut connu, rien n’est bloqué', () => {
    expect(effectiveAccess(null, now)).toBeNull()
    expect(accessNotice(null, now)).toBeNull()
  })

  it('un délai de grâce écoulé hors ligne devient un verrou', () => {
    const grace: AccessSnapshot = { access: 'grace', lockAt: iso(DAY), trialEndsAt: iso(-6 * DAY) }
    expect(effectiveAccess(grace, now)).toBe('grace')
    expect(effectiveAccess(grace, new Date(now.getTime() + DAY))).toBe('locked')
    expect(effectiveAccess({ ...grace, lockAt: null }, new Date(now.getTime() + 99 * DAY))).toBe('grace')
  })

  it('bandeau d’essai seulement dans les 7 derniers jours', () => {
    const trial = (days: number): AccessSnapshot => ({ access: 'trial', lockAt: null, trialEndsAt: iso(days * DAY) })
    expect(accessNotice(trial(10), now)).toBeNull()
    expect(accessNotice(trial(7), now)).toMatch(/dans 7 jours/)
    expect(accessNotice(trial(1), now)).toMatch(/dans 1 jour,/)
    expect(accessNotice({ access: 'active', lockAt: null, trialEndsAt: iso(DAY) }, now)).toBeNull()
  })

  it('bandeau de grâce avec la date de verrouillage et la raison', () => {
    expect(accessNotice({ access: 'grace', status: 'PAST_DUE', lockAt: '2026-11-05T10:00:00Z', trialEndsAt: null }, now)).toMatch(/^Le dernier paiement a échoué\./)
    expect(accessNotice({ access: 'grace', lockAt: '2026-11-05T10:00:00Z', trialEndsAt: null }, now)).toBe(
      "Votre essai est terminé. La caisse reste ouverte jusqu'au 5 novembre.",
    )
  })
})
