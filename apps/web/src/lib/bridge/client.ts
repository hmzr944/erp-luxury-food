// Client navigateur de FLŌW-Bridge, le petit agent installé sur l'ordinateur
// du magasin qui pilote imprimantes, tiroir et terminal de paiement.
// Aucune API Node ici, et rien ne s'exécute à l'import (rendu serveur sûr).

import { bridgeUrls, parseBridgeAddress, readBridgeAddress, writeBridgeAddress } from './address'
import {
  CLOSE_INSECURE_LAN,
  CLOSE_ORIGIN_REFUSED,
  type BridgeErrorBody,
  type BridgeEvents,
  type BridgeMethods,
  type BridgeStatus,
  type PairResult,
} from './types'

export const DEFAULT_BRIDGE_URL = 'ws://127.0.0.1:51717'
const TOKEN_KEY = 'flow-bridge-token'
const MAX_BACKOFF_MS = 10_000
const DEFAULT_TIMEOUT_MS = 15_000
// Un paiement par carte peut durer : le TPE attend jusqu'à 3 minutes
const PAYMENT_TIMEOUT_MS = 200_000

export class BridgeCallError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'BridgeCallError'
  }
}

// Le stockage peut être bloqué (navigation privée, politique du navigateur)
function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Sans stockage, il faudra appairer à nouveau au prochain chargement
  }
}

interface Pending {
  resolve: (v: unknown) => void
  reject: (e: Error) => void
  timer: ReturnType<typeof setTimeout>
}

type Listener = (data: unknown) => void

export class BridgeClient {
  private ws: WebSocket | null = null
  private _status: BridgeStatus = 'off'
  private nextId = 1
  private pending = new Map<number, Pending>()
  private listeners = new Map<string, Set<Listener>>()
  private statusListeners = new Set<() => void>()
  private attempts = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private wanted = false
  // Dernière erreur lisible (origine refusée, jeton révoqué...) pour l'écran de réglages
  lastError: BridgeErrorBody | null = null

  // Adresses essayées dans l'ordre (wss puis ws) ; on garde celle qui a répondu
  private urls: string[]
  private urlIndex = 0
  // Essais ratés d'affilée sur la liste, pour savoir quand faire une pause
  private misses = 0
  private _secure = false

  constructor(urls: string | string[] = DEFAULT_BRIDGE_URL) {
    this.urls = Array.isArray(urls) ? urls : [urls]
  }

  get url(): string {
    return this.urls[this.urlIndex] ?? this.urls[0]
  }

  // Connecté en wss:// (certificat du pont approuvé par cet appareil)
  get secure(): boolean {
    return this._secure
  }

  // Nouvel essai sans attendre la fin de la pause (certificat tout juste approuvé)
  reconnect() {
    if (typeof window === 'undefined' || this.ws) return
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
    this.wanted = true
    this.attempts = 0
    this.urlIndex = 0
    this.misses = 0
    this.open()
  }

  // Nouvelle adresse du pont (réglage de l'appareil) : reconnexion immédiate
  setUrls(urls: string[]) {
    if (urls.join() === this.urls.join()) return
    const wanted = this.wanted
    this.disconnect()
    this.urls = urls
    this.urlIndex = 0
    this.misses = 0
    this.attempts = 0
    this.lastError = null
    if (wanted) this.connect()
  }

  get status(): BridgeStatus {
    return this._status
  }

  // Pour useSyncExternalStore : fonctions stables, sans `this` perdu
  readonly getStatus = (): BridgeStatus => this._status

  readonly subscribe = (cb: () => void): (() => void) => {
    this.statusListeners.add(cb)
    return () => {
      this.statusListeners.delete(cb)
    }
  }

  private setStatus(s: BridgeStatus) {
    if (s === this._status) return
    this._status = s
    for (const cb of [...this.statusListeners]) cb()
  }

  on<E extends keyof BridgeEvents>(event: E, cb: (data: BridgeEvents[E]) => void): () => void
  on(event: string, cb: (data: unknown) => void): () => void
  on(event: string, cb: (data: never) => void): () => void {
    const set = this.listeners.get(event) ?? new Set<Listener>()
    set.add(cb as Listener)
    this.listeners.set(event, set)
    return () => {
      set.delete(cb as Listener)
    }
  }

  connect(): void {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return
    this.wanted = true
    if (this.ws || this.retryTimer) return
    this.open()
  }

  disconnect(): void {
    this.wanted = false
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
    const ws = this.ws
    this.ws = null
    ws?.close(1000)
    this.failPending('disconnected', 'Pont déconnecté.')
    this.setStatus('off')
  }

  private open() {
    // Tant que le pont n'a jamais répondu, on reste « éteint » plutôt que de
    // clignoter entre « connexion » et « éteint » à chaque nouvel essai
    if (this.attempts === 0) this.setStatus('connecting')
    let ws: WebSocket
    const url = this.url
    try {
      ws = new WebSocket(url)
    } catch {
      // Safari refuse ws:// depuis une page https : on passe à l'adresse suivante
      this.nextUrl()
      return
    }
    this.ws = ws
    let opened = false
    ws.onopen = () => {
      opened = true
      this.attempts = 0
      this.misses = 0
      this._secure = url.startsWith('wss:')
      void this.authenticate()
    }
    ws.onmessage = (ev) => this.onMessage(ev.data)
    ws.onclose = (ev) => {
      if (this.ws !== ws) return
      this.ws = null
      if (ev.code === CLOSE_ORIGIN_REFUSED) {
        this.lastError = {
          code: 'origin_refused',
          message: "Ce site n'est pas autorisé par le pont (FLOW_BRIDGE_ORIGINS).",
        }
      } else if (ev.code === CLOSE_INSECURE_LAN) {
        this.lastError = { code: 'insecure_lan', message: 'Le pont exige une connexion sécurisée depuis le réseau.' }
      }
      this.failPending('disconnected', 'Connexion au pont perdue.')
      this.setStatus('off')
      if (opened) this.scheduleRetry()
      else this.nextUrl()
    }
    // onerror est toujours suivi de onclose : rien à faire de plus
    ws.onerror = () => {}
  }

  // Adresse suivante tout de suite ; pause seulement après un tour complet
  private nextUrl() {
    this.urlIndex = (this.urlIndex + 1) % this.urls.length
    this.misses += 1
    if (this.misses < this.urls.length && this.wanted) {
      this.open()
      return
    }
    this.misses = 0
    this.scheduleRetry()
  }

  private scheduleRetry() {
    if (!this.wanted || this.retryTimer) return
    const delay = Math.min(MAX_BACKOFF_MS, 500 * 2 ** this.attempts)
    this.attempts += 1
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      if (this.wanted && !this.ws) this.open()
    }, delay)
  }

  private async authenticate() {
    const token = readToken()
    if (!token) {
      this.setStatus('unpaired')
      return
    }
    try {
      await this.send('bridge.hello', { token })
      this.lastError = null
      this.setStatus('ready')
    } catch (err) {
      if (err instanceof BridgeCallError && err.code === 'invalid_token') {
        // Jeton révoqué côté pont : il faut appairer à nouveau
        writeToken(null)
        this.lastError = { code: err.code, message: err.message }
        this.setStatus('unpaired')
      }
      // Autre erreur (coupure) : onclose relancera la connexion
    }
  }

  private onMessage(raw: unknown) {
    if (typeof raw !== 'string') return
    let msg: { id?: unknown; result?: unknown; error?: BridgeErrorBody; event?: string; data?: unknown }
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }
    if (typeof msg.event === 'string') {
      for (const cb of [...(this.listeners.get(msg.event) ?? [])]) {
        try {
          cb(msg.data)
        } catch {
          // Un abonné défaillant ne doit pas casser les autres
        }
      }
      return
    }
    if (typeof msg.id !== 'number') return
    const p = this.pending.get(msg.id)
    if (!p) return
    this.pending.delete(msg.id)
    clearTimeout(p.timer)
    if (msg.error) p.reject(new BridgeCallError(msg.error.code, msg.error.message))
    else p.resolve(msg.result)
  }

  private failPending(code: string, message: string) {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer)
      p.reject(new BridgeCallError(code, message))
    }
    this.pending.clear()
  }

  // Envoi brut, sans exiger l'état « prêt » (utilisé pour pair/hello)
  private send(method: string, params?: unknown, timeoutMs?: number): Promise<unknown> {
    const ws = this.ws
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new BridgeCallError('not_connected', "Le pont FLŌW n'est pas joignable sur cet ordinateur."))
    }
    const id = this.nextId++
    const ms = timeoutMs ?? (method === 'payment.start' ? PAYMENT_TIMEOUT_MS : DEFAULT_TIMEOUT_MS)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new BridgeCallError('timeout', 'Le pont ne répond pas.'))
      }, ms)
      this.pending.set(id, { resolve, reject, timer })
      ws.send(JSON.stringify({ id, method, params }))
    })
  }

  call<M extends keyof BridgeMethods>(method: M, params?: BridgeMethods[M][0], timeoutMs?: number): Promise<BridgeMethods[M][1]>
  call<T>(method: string, params?: unknown, timeoutMs?: number): Promise<T>
  call(method: string, params?: unknown, timeoutMs?: number): Promise<unknown> {
    if (this._status !== 'ready') {
      return Promise.reject(
        new BridgeCallError(
          this._status === 'unpaired' ? 'unpaired' : 'not_connected',
          this._status === 'unpaired'
            ? "Cette caisse n'est pas encore appairée au pont FLŌW."
            : "Le pont FLŌW n'est pas joignable sur cet ordinateur.",
        ),
      )
    }
    return this.send(method, params, timeoutMs)
  }

  // Saisie du code affiché sur l'ordinateur du pont
  async pair(code: string, name: string): Promise<PairResult> {
    const result = (await this.send('bridge.pair', { code: code.replace(/\s/g, ''), name })) as PairResult
    writeToken(result.token)
    this.lastError = null
    this.setStatus('ready')
    return result
  }

  async unpair(): Promise<void> {
    try {
      if (this._status === 'ready') await this.send('bridge.unpair')
    } finally {
      writeToken(null)
      if (this.ws) this.setStatus('unpaired')
    }
  }
}

let singleton: BridgeClient | null = null

// Adresses à essayer : réglage de l'appareil, sinon NEXT_PUBLIC_BRIDGE_URL,
// sinon cet ordinateur (wss puis ws)
export function currentBridgeUrls(): string[] {
  const saved = readBridgeAddress()
  if (!saved && process.env.NEXT_PUBLIC_BRIDGE_URL) return [process.env.NEXT_PUBLIC_BRIDGE_URL]
  return bridgeUrls(parseBridgeAddress(saved) ?? parseBridgeAddress('')!)
}

// Enregistre l'adresse du pont pour cet appareil et s'y reconnecte
export function setBridgeAddress(value: string) {
  writeBridgeAddress(value)
  singleton?.setUrls(currentBridgeUrls())
}

// Un seul socket partagé par tous les composants de la caisse
export function getBridge(): BridgeClient {
  if (!singleton) singleton = new BridgeClient(currentBridgeUrls())
  if (typeof window !== 'undefined') singleton.connect()
  return singleton
}

export type BridgeProbe =
  // Certificat approuvé (ou ws local), pont joignable, cette caisse est appairée
  | 'paired'
  // Connexion établie : il reste à saisir le code d'appairage
  | 'pairing'
  // Connexion établie mais site non autorisé par le pont
  | 'origin_refused'
  // Échec avant toute réponse : certificat non approuvé ou pont injoignable
  | 'failed'

// Essai isolé d'une adresse, sans toucher à la connexion de la caisse.
// Le navigateur ne dit jamais pourquoi une connexion wss échoue : un échec
// veut dire certificat non approuvé OU pont injoignable.
export function probeBridge(url: string, timeoutMs = 8000): Promise<BridgeProbe> {
  return new Promise((resolve) => {
    let ws: WebSocket
    try {
      ws = new WebSocket(url)
    } catch {
      resolve('failed')
      return
    }
    let done = false
    const finish = (r: BridgeProbe) => {
      if (done) return
      done = true
      clearTimeout(timer)
      try {
        ws.close(1000)
      } catch {
        // déjà fermé
      }
      resolve(r)
    }
    const timer = setTimeout(() => finish('failed'), timeoutMs)
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'bridge.hello', params: { token: readToken() || '-' } }))
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { id?: number; result?: unknown; error?: { code: string } }
        if (msg.id !== 1) return
        finish(msg.result ? 'paired' : 'pairing')
      } catch {
        finish('pairing')
      }
    }
    ws.onclose = (ev) => finish(ev.code === CLOSE_ORIGIN_REFUSED ? 'origin_refused' : 'failed')
    ws.onerror = () => {}
  })
}

// Encodage base64 des octets ESC/POS pour printer.print
export function bytesToBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(s)
}
