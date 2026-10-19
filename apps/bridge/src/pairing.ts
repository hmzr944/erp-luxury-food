// Appairage : un code à 6 chiffres affiché sur l'ordinateur du pont, saisi
// une fois sur la caisse, échangé contre un jeton long. Le code prouve
// que la personne qui appaire a physiquement accès à l'ordinateur.

import { randomInt, timingSafeEqual } from 'node:crypto'
import type { Logger } from './log.js'
import { BridgeError } from './protocol.js'
import { sha256, type ConfigStore } from './store.js'

export const PAIRING_TTL_MS = 10 * 60 * 1000
export const MAX_ATTEMPTS = 5
export const MAX_LOCK_MS = 60 * 60 * 1000

export function newPairingCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export function formatCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`
}

function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex')
  const y = Buffer.from(b, 'hex')
  return x.length === y.length && timingSafeEqual(x, y)
}

// Utilisé par « flow-bridge pair » : le code est déposé (haché) dans le
// dossier du pont, que le service en marche relit à chaque tentative.
export function createPendingCode(store: ConfigStore, ttlMs = PAIRING_TTL_MS): string {
  const code = newPairingCode()
  store.writePendingPairing({ codeHash: sha256(code), expiresAt: Date.now() + ttlMs })
  return code
}

export function printCode(log: Logger, code: string, ttlMs = PAIRING_TTL_MS) {
  log.banner([
    `Code d'appairage : ${formatCode(code)}`,
    `Saisissez-le sur la caisse FLŌW (valable ${Math.round(ttlMs / 60000)} minutes).`,
  ])
}

export interface PairingOptions {
  ttlMs?: number
  // Pause imposée après trop d'essais ratés : rend la force brute inutile
  lockMs?: number
}

export class PairingManager {
  private codeHash: string | null = null
  private expiresAt = 0
  private failures = 0
  private lockedUntil = 0
  // Blocages successifs : la pause double à chaque fois (jusqu'à une heure),
  // ce qui rend la force brute vaine même depuis le réseau local
  private locks = 0
  private expiryTimer: NodeJS.Timeout | undefined
  private readonly ttlMs: number
  private readonly lockMs: number
  // Dernier code en clair, pour les tests et l'affichage local uniquement
  private lastCode: string | null = null

  constructor(
    private readonly store: ConfigStore,
    private readonly log: Logger,
    opts: PairingOptions = {},
  ) {
    this.ttlMs = opts.ttlMs ?? PAIRING_TTL_MS
    this.lockMs = opts.lockMs ?? 30_000
  }

  // Nouveau code affiché dans la console du pont
  renew(): string {
    const code = newPairingCode()
    this.codeHash = sha256(code)
    this.lastCode = code
    this.expiresAt = Date.now() + this.ttlMs
    this.failures = 0
    clearTimeout(this.expiryTimer)
    this.expiryTimer = setTimeout(() => this.onExpired(), this.ttlMs)
    this.expiryTimer.unref()
    printCode(this.log, code, this.ttlMs)
    return code
  }

  private onExpired() {
    this.codeHash = null
    this.lastCode = null
    // Tant qu'aucune caisse n'est appairée, on garde toujours un code valable
    if (!this.store.hasClients()) {
      this.log.info("Code d'appairage expiré, nouveau code")
      this.renew()
    } else {
      this.log.info("Code d'appairage expiré")
    }
  }

  get currentCode(): string | null {
    return this.codeHash && Date.now() < this.expiresAt ? this.lastCode : null
  }

  // Fin de validité du code courant (page locale du pont)
  get currentExpiresAt(): number | null {
    return this.currentCode ? this.expiresAt : null
  }

  private invalidateAll() {
    this.codeHash = null
    this.lastCode = null
    clearTimeout(this.expiryTimer)
    this.store.clearPendingPairing()
  }

  // Vérifie le code ; lève une BridgeError explicite sinon
  attempt(code: string): void {
    const now = Date.now()
    if (now < this.lockedUntil) {
      const s = Math.ceil((this.lockedUntil - now) / 1000)
      const wait = s > 120 ? `${Math.ceil(s / 60)} minutes` : `${s} secondes`
      throw new BridgeError('pairing_locked', `Trop d'essais. Réessayez dans ${wait} avec le nouveau code.`)
    }
    const hashes: string[] = []
    if (this.codeHash && now < this.expiresAt) hashes.push(this.codeHash)
    const pending = this.store.readPendingPairing()
    if (pending && now < pending.expiresAt) hashes.push(pending.codeHash)
    if (hashes.length === 0) {
      throw new BridgeError(
        'pairing_closed',
        "Aucun code d'appairage actif. Lancez « flow-bridge pair » sur l'ordinateur du pont.",
      )
    }

    const given = sha256(code.replace(/\s/g, ''))
    if (hashes.some((h) => sameHash(h, given))) {
      // Code à usage unique
      this.invalidateAll()
      this.failures = 0
      this.locks = 0
      return
    }

    this.failures += 1
    this.log.warn("Code d'appairage incorrect", { essai: this.failures, max: MAX_ATTEMPTS })
    if (this.failures >= MAX_ATTEMPTS) {
      this.invalidateAll()
      this.locks += 1
      this.lockedUntil = now + Math.min(MAX_LOCK_MS, this.lockMs * 2 ** (this.locks - 1))
      this.log.warn("Trop d'essais : code d'appairage annulé")
      this.renew()
      throw new BridgeError(
        'pairing_code_invalidated',
        "Code incorrect. Trop d'essais : un nouveau code est affiché sur l'ordinateur du pont.",
      )
    }
    const left = MAX_ATTEMPTS - this.failures
    throw new BridgeError(
      'pairing_code_invalid',
      `Code incorrect (${left} essai${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''}).`,
    )
  }

  stop() {
    clearTimeout(this.expiryTimer)
  }
}
