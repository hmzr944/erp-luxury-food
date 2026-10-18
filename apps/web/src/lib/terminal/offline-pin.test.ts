import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/offline/db'
import {
  OFFLINE_PIN_TTL_MS,
  applyOfflineRoster,
  deriveOfflineKey,
  offlineCheckMessage,
  offlineLockMs,
  offlinePinCount,
  offlineVerifier,
  rememberOfflinePin,
  verifyOfflinePin,
} from './offline-pin'

const SITE = 'site-1'
const T0 = Date.parse('2026-10-18T10:00:00Z')
const lea = { id: 'u-lea', firstName: 'Léa', lastName: 'Martin', role: 'SELLER', organizationId: 'org1' }
const paul = { id: 'u-paul', firstName: 'Paul', lastName: 'Durand', role: 'MANAGER', organizationId: 'org1' }
const salts = { terminalSalt: 'sel-caisse', lea: 'sel-lea', paul: 'sel-paul' }

async function remember() {
  await rememberOfflinePin(SITE, 'term-1', '1234', lea, { terminalSalt: salts.terminalSalt, salt: salts.lea }, T0)
  await rememberOfflinePin(SITE, 'term-1', '9876', paul, { terminalSalt: salts.terminalSalt, salt: salts.paul }, T0)
}

beforeEach(async () => {
  await db.config.clear()
})

describe('vérificateur hors ligne', () => {
  it('dépend du code, du sel de caisse et du sel de la personne', async () => {
    const k = await deriveOfflineKey('1234', 'a', 1000)
    const v = await offlineVerifier(k, 's')
    expect(v).toBe(await offlineVerifier(await deriveOfflineKey('1234', 'a', 1000), 's'))
    expect(v).not.toBe(await offlineVerifier(await deriveOfflineKey('1235', 'a', 1000), 's'))
    expect(v).not.toBe(await offlineVerifier(await deriveOfflineKey('1234', 'b', 1000), 's'))
    expect(v).not.toBe(await offlineVerifier(k, 't'))
  })

  it('ne garde jamais le code en clair', async () => {
    await remember()
    const raw = JSON.stringify(await db.config.toArray())
    expect(raw).not.toContain('1234')
    expect(raw).not.toContain('9876')
  })

  it('reconnaît la bonne personne, refuse un code inconnu', async () => {
    await remember()
    expect(await verifyOfflinePin(SITE, '9876', T0 + 1000)).toEqual({ ok: true, user: paul })
    expect(await verifyOfflinePin(SITE, '1234', T0 + 1000)).toEqual({ ok: true, user: lea })
    const wrong = await verifyOfflinePin(SITE, '0000', T0 + 1000)
    expect(wrong).toMatchObject({ ok: false, reason: 'wrong' })
  })

  it('caisse sans personne connue : message clair', async () => {
    const r = await verifyOfflinePin(SITE, '1234', T0)
    expect(r).toEqual({ ok: false, reason: 'none' })
    expect(offlineCheckMessage(r as never)).toContain('7 derniers jours')
  })

  it('expire 7 jours après la dernière confirmation du serveur', async () => {
    await remember()
    expect(await offlinePinCount(SITE, T0 + OFFLINE_PIN_TTL_MS - 1000)).toBe(2)
    expect(await verifyOfflinePin(SITE, '1234', T0 + OFFLINE_PIN_TTL_MS + 1000)).toEqual({ ok: false, reason: 'none' })
  })
})

describe('liste du serveur', () => {
  it('efface une personne partie ou dont le code a changé, prolonge les autres', async () => {
    await remember()
    const later = T0 + 6 * 86_400_000
    await applyOfflineRoster(SITE, { terminalId: 'term-1', active: true, terminalSalt: salts.terminalSalt, users: [{ ...lea, role: 'SELLER', salt: salts.lea }, { ...paul, role: 'MANAGER', salt: 'nouveau-sel' }] }, later)
    expect(await verifyOfflinePin(SITE, '9876', later)).toMatchObject({ ok: false, reason: 'wrong' })
    // Confirmée par le serveur : encore valable 7 jours après la liste
    expect(await verifyOfflinePin(SITE, '1234', later + 5 * 86_400_000)).toMatchObject({ ok: true, user: { id: 'u-lea' } })
  })

  it('met à jour le rôle et le nom', async () => {
    await remember()
    await applyOfflineRoster(SITE, { terminalId: 'term-1', active: true, terminalSalt: salts.terminalSalt, users: [{ ...lea, lastName: 'Bernard', role: 'MANAGER', salt: salts.lea }] }, T0)
    expect(await verifyOfflinePin(SITE, '1234', T0)).toMatchObject({ ok: true, user: { lastName: 'Bernard', role: 'MANAGER' } })
  })

  it('caisse désactivée ou autre caisse : tout est effacé', async () => {
    await remember()
    await applyOfflineRoster(SITE, { terminalId: 'term-1', active: false, terminalSalt: null, users: [] }, T0)
    expect(await offlinePinCount(SITE, T0)).toBe(0)
    await remember()
    await applyOfflineRoster(SITE, { terminalId: 'term-2', active: true, terminalSalt: 'autre', users: [{ ...lea, role: 'SELLER', salt: salts.lea }] }, T0)
    expect(await offlinePinCount(SITE, T0)).toBe(0)
  })

  it('atelier : jamais gardé', async () => {
    await rememberOfflinePin(SITE, 'term-1', '5555', { ...lea, id: 'u-atelier', role: 'PRODUCTION' }, { terminalSalt: salts.terminalSalt, salt: 's' }, T0)
    expect(await offlinePinCount(SITE, T0)).toBe(0)
  })
})

describe('essais hors ligne', () => {
  it('blocage qui s’allonge après 5 erreurs', () => {
    expect([1, 4, 5, 6, 7, 9].map(offlineLockMs)).toEqual([0, 0, 30_000, 60_000, 120_000, 480_000])
  })

  it('bloque, puis efface tout après 10 erreurs ; un code juste remet à zéro', async () => {
    await remember()
    let now = T0
    for (let i = 1; i <= 4; i++) expect(await verifyOfflinePin(SITE, '0000', now)).toMatchObject({ reason: 'wrong', lockMs: 0 })
    // Un code juste remet le compteur à zéro
    expect(await verifyOfflinePin(SITE, '1234', now)).toMatchObject({ ok: true })
    for (let i = 1; i <= 4; i++) await verifyOfflinePin(SITE, '0000', now)
    expect(await verifyOfflinePin(SITE, '0000', now)).toMatchObject({ reason: 'wrong', lockMs: 30_000 })
    // Pendant le blocage, même le bon code attend (et rien n'est dérivé)
    expect(await verifyOfflinePin(SITE, '1234', now + 1000)).toMatchObject({ reason: 'locked' })
    for (let i = 6; i <= 9; i++) {
      now += 60 * 60_000
      expect(await verifyOfflinePin(SITE, '0000', now)).toMatchObject({ reason: 'wrong' })
    }
    now += 60 * 60_000
    expect(await verifyOfflinePin(SITE, '0000', now)).toEqual({ ok: false, reason: 'purged' })
    now += 60 * 60_000
    expect(await verifyOfflinePin(SITE, '1234', now)).toEqual({ ok: false, reason: 'purged' })
    expect(await offlinePinCount(SITE, now)).toBe(0)
    // Une connexion en ligne réussie rétablit la reprise hors ligne
    await rememberOfflinePin(SITE, 'term-1', '1234', lea, { terminalSalt: salts.terminalSalt, salt: salts.lea }, now)
    expect(await verifyOfflinePin(SITE, '1234', now)).toMatchObject({ ok: true })
  })
}, 60_000)
