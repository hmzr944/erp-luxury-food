import { describe, it, expect } from 'vitest'
import { pendingAlert, PENDING_MAX_AGE_MINUTES, PENDING_MAX_COUNT, type PendingAlertInput } from './pending-alert'

const NOW = 1_700_000_000_000
const base: PendingAlertInput = { pending: 0, oldestPendingAt: null, now: NOW, online: false, persisted: true, nearlyFull: false }
const minutesAgo = (m: number) => NOW - m * 60_000

describe('bandeau des ventes en attente', () => {
  it("n'affiche rien quand tout va bien", () => {
    expect(pendingAlert(base)).toBeNull()
    expect(pendingAlert({ ...base, pending: 2, oldestPendingAt: minutesAgo(5) })).toBeNull()
  })

  it('prévient quand une vente attend depuis trop longtemps', () => {
    const a = pendingAlert({ ...base, pending: 1, oldestPendingAt: minutesAgo(PENDING_MAX_AGE_MINUTES) })
    expect(a?.kind).toBe('old')
    expect(a?.message).toContain('Reconnectez-vous au réseau pour envoyer vos ventes')
    expect(pendingAlert({ ...base, pending: 1, oldestPendingAt: minutesAgo(PENDING_MAX_AGE_MINUTES - 1) })).toBeNull()
  })

  it('prévient quand elles sont nombreuses', () => {
    expect(pendingAlert({ ...base, pending: PENDING_MAX_COUNT, oldestPendingAt: minutesAgo(1) })?.kind).toBe('many')
    expect(pendingAlert({ ...base, pending: PENDING_MAX_COUNT - 1, oldestPendingAt: minutesAgo(1) })).toBeNull()
  })

  it('prévient quand le stockage peut être vidé, seulement avec des ventes en attente', () => {
    expect(pendingAlert({ ...base, persisted: false, pending: 1, oldestPendingAt: minutesAgo(1) })?.kind).toBe('volatile')
    expect(pendingAlert({ ...base, persisted: false })).toBeNull()
    // API absente : inconnu, pas d'alarme
    expect(pendingAlert({ ...base, persisted: null, pending: 1, oldestPendingAt: minutesAgo(1) })).toBeNull()
  })

  it("en ligne, propose d'envoyer au lieu de demander le réseau", () => {
    const a = pendingAlert({ ...base, online: true, pending: 12, oldestPendingAt: minutesAgo(1) })
    expect(a?.message).toContain('Envoyer maintenant')
  })

  it("signale un espace presque plein, et n'utilise aucun tiret cadratin", () => {
    const a = pendingAlert({ ...base, nearlyFull: true })
    expect(a?.kind).toBe('near-full')
    const all = [a, pendingAlert({ ...base, pending: 11 }), pendingAlert({ ...base, persisted: false, pending: 1 })]
    for (const x of all) expect(x?.message).not.toMatch(/[—–]/)
  })
})
