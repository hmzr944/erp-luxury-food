import { createHmac, randomInt, webcrypto } from 'node:crypto'
import { ECDSA_PARAMS, ECDSA_SIGN_PARAMS } from '@erp/utils'

// Code vendeur à 4 chiffres. Seule une empreinte HMAC est stockée, avec une
// clé qui reste sur le serveur : la base seule ne permet pas de retrouver
// les codes. Le code ne fonctionne que sur une caisse enregistrée, qui signe
// la demande avec sa clé privée (impossible à copier hors de l'appareil).

export const PIN_RE = /^\d{4}$/

export function pinLookup(secret: string, organizationId: string, pin: string): string {
  return createHmac('sha256', secret).update(`${organizationId}:${pin}`).digest('hex')
}

export const randomPin = () => String(randomInt(0, 10_000)).padStart(4, '0')

export const pinChallenge = (terminalId: string, signedAt: string) => `pin-login:${terminalId}:${signedAt}`

export async function verifyTerminalSignature(publicKeyJwk: webcrypto.JsonWebKey, message: string, signatureB64: string) {
  try {
    const key = await webcrypto.subtle.importKey('jwk', publicKeyJwk, ECDSA_PARAMS, false, ['verify'])
    return await webcrypto.subtle.verify(ECDSA_SIGN_PARAMS, key, Buffer.from(signatureB64, 'base64'), new TextEncoder().encode(message))
  } catch {
    return false
  }
}

// Après 5 codes faux, la caisse est bloquée 5 minutes (10 000 combinaisons :
// impossible à deviner en essayant). Mémoire du processus : une seule
// instance d'API ; à déplacer dans Redis si l'API est répartie.
export class PinAttempts {
  private failures = new Map<string, { count: number; until: number }>()
  private used = new Map<string, number>()

  constructor(
    private max = 5,
    private lockMs = 5 * 60_000,
  ) {}

  lockedFor(terminalId: string, now = Date.now()): number {
    const f = this.failures.get(terminalId)
    return f && f.until > now ? Math.ceil((f.until - now) / 60_000) : 0
  }

  fail(terminalId: string, now = Date.now()) {
    const f = this.failures.get(terminalId)
    const count = (f && f.until <= now && f.count >= this.max ? 0 : (f?.count ?? 0)) + 1
    this.failures.set(terminalId, { count, until: count >= this.max ? now + this.lockMs : 0 })
  }

  succeed(terminalId: string) {
    this.failures.delete(terminalId)
  }

  // Une signature ne sert qu'une fois (pas de rejeu d'une demande interceptée)
  firstUse(signature: string, now = Date.now()): boolean {
    for (const [s, at] of this.used) if (now - at > 5 * 60_000) this.used.delete(s)
    if (this.used.has(signature)) return false
    this.used.set(signature, now)
    return true
  }
}

// --- Badges vendeur : carte à QR code ou badge NFC ---------------------------
// Le QR contient « FLOW1:<jeton aléatoire> ». Un badge NFC est reconnu par son
// identifiant (lu par Web NFC ou par un lecteur USB qui le « tape » au clavier).
export const BADGE_QR_PREFIX = 'FLOW1:'

export function newBadgeToken(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 24 }, () => alphabet[randomInt(alphabet.length)]).join('')
}

export function normalizeBadge(raw: string): { kind: 'QR' | 'NFC'; value: string } | null {
  const s = raw.trim()
  if (s.toUpperCase().startsWith(BADGE_QR_PREFIX)) {
    const value = s.slice(BADGE_QR_PREFIX.length).toUpperCase()
    return /^[A-Z0-9]{16,64}$/.test(value) ? { kind: 'QR', value } : null
  }
  const uid = s.toUpperCase().replace(/[\s:-]/g, '')
  return /^[0-9A-F]{6,32}$/.test(uid) ? { kind: 'NFC', value: uid } : null
}

export function badgeLookup(secret: string, organizationId: string, badge: { kind: string; value: string }): string {
  return createHmac('sha256', secret).update(`${organizationId}:badge:${badge.kind}:${badge.value}`).digest('hex')
}
