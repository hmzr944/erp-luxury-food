'use client'

import { db } from '@/lib/offline/db'

// Reprise de la caisse sans réseau (verrouillage, changement de vendeur).
//
// Ce que la caisse garde, par boutique, dans IndexedDB :
// - le sel de caisse et, pour chaque personne qui a déjà tapé son code ici
//   avec le réseau, un vérificateur : HMAC(PBKDF2(code, sel de caisse), sel de
//   la personne). Jamais le code, jamais l'empreinte du serveur.
// - le nombre d'erreurs hors ligne, avec un blocage qui s'allonge, puis
//   l'effacement de tout le cache après 10 erreurs.
//
// Limite assumée : un code à 4 chiffres n'a que 10 000 valeurs. Quelqu'un qui
// copie le stockage de l'appareil peut toutes les essayer hors de la caisse,
// la dérivation lente ne fait que ralentir. Les parades : vérificateur lié à
// cette caisse (inutile ailleurs), effacé après 7 jours sans confirmation du
// serveur, dès que le code change ou que la personne quitte la boutique, et
// désactivation de la caisse dans les réglages si l'appareil est perdu.

export const OFFLINE_PIN_ITERATIONS = 300_000
export const OFFLINE_PIN_TTL_MS = 7 * 86_400_000
export const OFFLINE_FREE_ATTEMPTS = 5
export const OFFLINE_PURGE_AFTER = 10

export type OfflineRole = 'OWNER' | 'MANAGER' | 'SELLER'
const OFFLINE_ROLES: readonly string[] = ['OWNER', 'MANAGER', 'SELLER']

export interface OfflineProfile {
  id: string
  firstName: string
  lastName: string
  role: OfflineRole
  organizationId: string
}

interface OfflinePinEntry {
  user: OfflineProfile
  salt: string // sel de la personne, fourni par le serveur
  verifier: string // base64
  iterations: number
  confirmedAt: number // dernière confirmation par le serveur
}

export interface OfflinePinState {
  terminalId: string
  terminalSalt: string
  entries: OfflinePinEntry[]
  failures: number
  lockedUntil: number
}

const key = (siteId: string) => `offline-pins:${siteId}`

async function load(siteId: string): Promise<OfflinePinState | null> {
  const row = await db.config.get(key(siteId))
  return (row?.value as OfflinePinState | undefined) ?? null
}

async function save(siteId: string, state: OfflinePinState | null) {
  if (!state || state.entries.length === 0) {
    // Plus personne à reconnaître : on ne garde que les erreurs en cours
    if (state && (state.failures > 0 || state.lockedUntil > 0)) await db.config.put({ key: key(siteId), value: { ...state, entries: [] }, cachedAt: Date.now() })
    else await db.config.delete(key(siteId))
    return
  }
  await db.config.put({ key: key(siteId), value: state, cachedAt: Date.now() })
}

const enc = new TextEncoder()

function toB64(buf: ArrayBuffer): string {
  let s = ''
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b)
  return btoa(s)
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// Dérivation lente, une fois par essai quel que soit le nombre de personnes
export async function deriveOfflineKey(pin: string, terminalSalt: string, iterations = OFFLINE_PIN_ITERATIONS): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(`flow-offline-pin:${terminalSalt}`), iterations }, base, 256)
  return crypto.subtle.importKey('raw', bits, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function offlineVerifier(k: CryptoKey, salt: string): Promise<string> {
  return toB64(await crypto.subtle.sign('HMAC', k, enc.encode(salt)))
}

// Comparaison à temps constant, faite par WebCrypto
function matches(k: CryptoKey, entry: OfflinePinEntry): Promise<boolean> {
  return crypto.subtle.verify('HMAC', k, fromB64(entry.verifier) as BufferSource, enc.encode(entry.salt)).catch(() => false)
}

// Blocage après une erreur hors ligne : 5 essais libres, puis 30 s, 1 min,
// 2 min, 4 min, 8 min ; à 10 erreurs, le cache est effacé.
export function offlineLockMs(failures: number): number {
  if (failures < OFFLINE_FREE_ATTEMPTS) return 0
  return Math.min(30_000 * 2 ** (failures - OFFLINE_FREE_ATTEMPTS), 30 * 60_000)
}

const fresh = (e: OfflinePinEntry, now: number) => now - e.confirmedAt < OFFLINE_PIN_TTL_MS && e.iterations === OFFLINE_PIN_ITERATIONS

// Code accepté par le serveur sur cette caisse : on garde son vérificateur
export async function rememberOfflinePin(
  siteId: string,
  terminalId: string,
  pin: string,
  user: { id: string; firstName: string; lastName: string; role: string; organizationId: string },
  offline: { terminalSalt: string; salt: string },
  now = Date.now(),
) {
  if (!OFFLINE_ROLES.includes(user.role)) return
  const k = await deriveOfflineKey(pin, offline.terminalSalt)
  const verifier = await offlineVerifier(k, offline.salt)
  await db.transaction('rw', db.config, async () => {
    const prev = await load(siteId)
    const same = prev && prev.terminalId === terminalId && prev.terminalSalt === offline.terminalSalt
    const entries = (same ? prev.entries : []).filter((e) => e.user.id !== user.id && fresh(e, now))
    entries.push({
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, role: user.role as OfflineRole, organizationId: user.organizationId },
      salt: offline.salt,
      verifier,
      iterations: OFFLINE_PIN_ITERATIONS,
      confirmedAt: now,
    })
    // Un code juste confirmé par le serveur remet les erreurs à zéro
    await save(siteId, { terminalId, terminalSalt: offline.terminalSalt, entries, failures: 0, lockedUntil: 0 })
  })
}

export interface OfflineRoster {
  terminalId: string
  active: boolean
  terminalSalt: string | null
  users: Array<OfflineProfile & { salt: string }>
}

// Liste du serveur : garde seulement les personnes encore là, avec le même
// sel (même code, sessions non révoquées), et met à jour nom et rôle
export async function applyOfflineRoster(siteId: string, roster: OfflineRoster, now = Date.now()) {
  await db.transaction('rw', db.config, async () => {
    const prev = await load(siteId)
    if (!prev) return
    if (!roster.active || roster.terminalId !== prev.terminalId || roster.terminalSalt !== prev.terminalSalt) {
      await save(siteId, { ...prev, entries: [] })
      return
    }
    const byId = new Map(roster.users.map((u) => [u.id, u]))
    const entries = prev.entries.flatMap((e) => {
      const u = byId.get(e.user.id)
      if (!u || u.salt !== e.salt || !OFFLINE_ROLES.includes(u.role) || e.iterations !== OFFLINE_PIN_ITERATIONS) return []
      return [{ ...e, user: { id: u.id, firstName: u.firstName, lastName: u.lastName, role: u.role, organizationId: u.organizationId }, confirmedAt: now }]
    })
    await save(siteId, { ...prev, entries })
  })
}

export async function purgeOfflinePins(siteId: string) {
  await db.config.delete(key(siteId))
}

export async function forgetOfflineUser(siteId: string, userId: string) {
  await db.transaction('rw', db.config, async () => {
    const prev = await load(siteId)
    if (prev) await save(siteId, { ...prev, entries: prev.entries.filter((e) => e.user.id !== userId) })
  })
}

export type OfflineCheck =
  | { ok: true; user: OfflineProfile }
  | { ok: false; reason: 'none' }
  | { ok: false; reason: 'locked'; retryInMs: number }
  | { ok: false; reason: 'wrong'; freeLeft: number; lockMs: number }
  | { ok: false; reason: 'purged' }

// Vérifie un code sans réseau. Ne dit jamais à qui appartient un code faux.
export async function verifyOfflinePin(siteId: string, pin: string, now = Date.now()): Promise<OfflineCheck> {
  const state = await load(siteId)
  if (state && state.lockedUntil > now) return { ok: false, reason: 'locked', retryInMs: state.lockedUntil - now }
  if (state && state.failures >= OFFLINE_PURGE_AFTER) return { ok: false, reason: 'purged' }
  const entries = state?.entries.filter((e) => fresh(e, now)) ?? []
  if (!state || entries.length === 0) {
    if (state && state.entries.length) await save(siteId, { ...state, entries: [] })
    return { ok: false, reason: 'none' }
  }

  const k = await deriveOfflineKey(pin, state.terminalSalt)
  let found: OfflinePinEntry | undefined
  for (const e of entries) if (await matches(k, e)) found = e

  return db.transaction('rw', db.config, async (): Promise<OfflineCheck> => {
    const cur = (await load(siteId)) ?? state
    if (found) {
      await save(siteId, { ...cur, entries: cur.entries.filter((e) => fresh(e, now)), failures: 0, lockedUntil: 0 })
      return { ok: true, user: found.user }
    }
    const failures = cur.failures + 1
    if (failures >= OFFLINE_PURGE_AFTER) {
      await save(siteId, { ...cur, entries: [], failures, lockedUntil: 0 })
      return { ok: false, reason: 'purged' }
    }
    const lockMs = offlineLockMs(failures)
    await save(siteId, { ...cur, failures, lockedUntil: lockMs ? now + lockMs : 0 })
    return { ok: false, reason: 'wrong', freeLeft: Math.max(0, OFFLINE_FREE_ATTEMPTS - failures), lockMs }
  })
}

// Pour l'écran : la caisse sait-elle reconnaître quelqu'un sans réseau ?
export async function offlinePinCount(siteId: string, now = Date.now()): Promise<number> {
  const state = await load(siteId)
  return state?.entries.filter((e) => fresh(e, now)).length ?? 0
}

export function offlineCheckMessage(r: Exclude<OfflineCheck, { ok: true }>): string {
  const minutes = (ms: number) => Math.max(1, Math.ceil(ms / 60_000))
  switch (r.reason) {
    case 'none':
      return 'Pas de réseau : cette caisse ne connaît encore aucun code hors ligne. Il faut s’être connecté ici avec le réseau dans les 7 derniers jours.'
    case 'locked':
      return `Trop d’essais sans réseau : réessayez dans ${minutes(r.retryInMs)} min, ou rétablissez la connexion.`
    case 'purged':
      return 'Trop d’essais sans réseau : la reprise hors ligne est désactivée sur cette caisse jusqu’au retour de la connexion.'
    case 'wrong':
      if (r.lockMs) return `Code inconnu de cette caisse hors ligne. Prochain essai dans ${minutes(r.lockMs)} min.`
      return r.freeLeft <= 2
        ? `Code inconnu de cette caisse hors ligne. Encore ${r.freeLeft} essai${r.freeLeft > 1 ? 's' : ''} avant blocage.`
        : 'Code inconnu de cette caisse hors ligne, ou code changé depuis la dernière connexion.'
  }
}
