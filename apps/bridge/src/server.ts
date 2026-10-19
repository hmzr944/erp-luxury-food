// Serveur du pont : HTTP(S) et WebSocket sur un seul port (51717).
//
// Un même port parle wss:// (certificat du pont, cert.ts) et ws:// : le
// premier octet de chaque connexion dit s'il s'agit de TLS. Chrome, Edge et
// Firefox gardent ainsi ws://127.0.0.1 sans rien installer ; Safari, qui
// exige wss://, passe par le certificat approuvé une fois sur l'appareil.
//
// N'importe quel site ouvert dans le navigateur du magasin peut tenter de
// joindre le pont : trois barrières successives.
// 1. En-tête Host : seulement les noms de cet ordinateur (contre le « DNS rebinding »).
// 2. Origin : seulement les origines déclarées dans FLOW_BRIDGE_ORIGINS.
// 3. Jeton d'appairage : obtenu une fois avec le code affiché sur l'ordinateur.
//
// Accès réseau (iPad, « flow-bridge reseau oui ») : le pont écoute aussi sur
// le réseau local. Depuis une autre machine, seul wss:// est accepté, sauf le
// téléchargement du certificat de l'autorité (public par nature) ; les essais
// d'appairage sont limités par appareil.

import { randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { createServer as createHttpsServer, type Server as HttpsServer } from 'node:https'
import { createServer as createNetServer, isIPv4, type AddressInfo, type Server as NetServer, type Socket } from 'node:net'
import type { Duplex } from 'node:stream'
import type { TLSSocket } from 'node:tls'
import { WebSocketServer, type WebSocket } from 'ws'
import { currentLocalNames, lanIPv4, mobileconfig, type TlsMaterial } from './cert.js'
import { normalizeOrigin, type BridgeConfig } from './config.js'
import { pairingPageUrl } from './autostart.js'
import {
  defaultDiscoveryDeps,
  DEFAULT_DISCOVER_TIMEOUT_MS,
  DEFAULT_TPE_DISCOVER_TIMEOUT_MS,
  discoverPrinters,
  discoverTerminals,
  MAX_DISCOVER_TIMEOUT_MS,
  type DiscoveryDeps,
} from './discovery.js'
import { DEFAULT_IPP_PORT, MAX_DOCUMENT_BYTES, printDocument } from './ipp.js'
import { isLanHostSyntax, resolveLanHost } from './lan.js'
import { createLogger, type Logger } from './log.js'
import { NEW_CODE_PATH, renderHomePage, type LocalStatus } from './pages.js'
import { PairingManager, type PairingOptions } from './pairing.js'
import { CAISSE_AP_DEFAULT_PORT } from './payment/caisse-ap.js'
import { PaymentManager, PAYMENT_ADAPTERS, type PaymentManagerOptions } from './payment/manager.js'
import { DEFAULT_PRINTER_PORT, PrinterService, probe } from './printer.js'
import { BridgeError, bool, int, isRecord, requireParams, str, type RpcErrorBody, type RpcEvent } from './protocol.js'
import { ConfigStore, type PairedClient, type SavedTpe } from './store.js'
import { NAME, VERSION } from './version.js'

export const CAPABILITIES = [
  'printer.escpos',
  'printer.probe',
  'printer.status',
  'printer.discover',
  'printer.ipp',
  'drawer',
  'bridge.tls',
  'bridge.lan',
  'tpe.discover',
  'tpe.config',
  ...PAYMENT_ADAPTERS.map((a) => `payment.${a}`),
]

// Codes de fermeture WebSocket propres au pont
export const CLOSE_ORIGIN_REFUSED = 4003
export const CLOSE_INSECURE_LAN = 4004

// Chemins publics : le certificat de l'autorité, à installer sur les appareils
export const CERT_PATH = '/certificat'
export const CERT_CER_PATH = '/certificat/flow-bridge.cer'
export const CERT_PEM_PATH = '/certificat/flow-bridge.pem'

// Limites côté réseau local
const MAX_CONNECTIONS = 64
const LAN_PAIR_ATTEMPTS = 10
const LAN_PAIR_WINDOW_MS = 15 * 60 * 1000
// Premier octet attendu dans ce délai, sinon la connexion est fermée
const FIRST_BYTE_TIMEOUT_MS = 10_000
const TLS_REFRESH_MS = 5 * 60 * 1000

interface Conn {
  ws: WebSocket
  client: PairedClient | null
  origin: string
  remote: string
  local: boolean
  secure: boolean
}

type Handler = (params: Record<string, unknown>, conn: Conn) => Promise<unknown> | unknown

export interface BridgeServerOptions {
  logger?: Logger
  pairing?: PairingOptions
  payments?: PaymentManagerOptions
  // Imprime un nouveau code même si des caisses sont déjà appairées
  forcePairingCode?: boolean
  // Accès réseau de printer.discover (remplacé en test)
  discovery?: DiscoveryDeps
  // Relit ou renouvelle les certificats (nouvelle adresse IP, échéance proche)
  refreshTls?: () => TlsMaterial
  // Mémorise le choix d'accès réseau (bridge.setLan)
  persistLan?: (enabled: boolean) => void
  // Délais de lecture de l'état de l'imprimante (raccourcis en test)
  printer?: { statusTimeoutMs?: number; settleMs?: number }
}

export function isLoopback(address: string | undefined): boolean {
  if (!address) return false
  const a = address.replace(/^::ffff:/, '')
  return a === '::1' || (isIPv4(a) && a.startsWith('127.'))
}

function hostnameOf(hostHeader: string | undefined): string | null {
  if (!hostHeader) return null
  try {
    return new URL(`http://${hostHeader}`).hostname.toLowerCase()
  } catch {
    return null
  }
}

// Nom d'hôte de la boucle locale (en-têtes Host et Origin de la page du pont)
function isLoopbackName(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '[::1]' || (isIPv4(hostname) && hostname.startsWith('127.'))
}

function tpeLabel(t: SavedTpe): string {
  if (t.adapter === 'simulator') return 'TPE simulé par le pont (essai)'
  return `TPE Caisse-AP ${t.host}:${t.port ?? CAISSE_AP_DEFAULT_PORT}${t.posNumber ? `, caisse n° ${t.posNumber}` : ''}`
}

function ports(p: Record<string, unknown>, key: string): number[] | undefined {
  const v = p[key]
  if (v === undefined || v === null) return undefined
  if (!Array.isArray(v) || v.length === 0 || v.length > 4 || !v.every((x) => Number.isInteger(x) && x >= 1 && x <= 65535)) {
    throw new BridgeError('invalid_params', `Paramètre « ${key} » invalide (1 à 4 ports attendus).`)
  }
  return v as number[]
}

function decodeBase64(data: string): Buffer {
  const clean = data.replace(/\s+/g, '')
  if (clean.length === 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4 === 1) {
    throw new BridgeError('invalid_params', "Données d'impression invalides (base64 attendu).")
  }
  return Buffer.from(clean, 'base64')
}

function decodePdf(data: string): Buffer {
  // Contrôle de taille avant décodage : 4 caractères base64 = 3 octets
  if (data.length > Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4 + 1024) {
    throw new BridgeError('document_too_large', `Document trop volumineux (${Math.round(MAX_DOCUMENT_BYTES / 1024 / 1024)} Mo au plus).`)
  }
  const pdf = decodeBase64(data)
  if (pdf.length > MAX_DOCUMENT_BYTES) {
    throw new BridgeError('document_too_large', `Document trop volumineux (${Math.round(MAX_DOCUMENT_BYTES / 1024 / 1024)} Mo au plus).`)
  }
  if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new BridgeError('invalid_params', "Le document n'est pas un PDF.")
  }
  return pdf
}

export class BridgeServer {
  readonly log: Logger
  readonly store: ConfigStore
  readonly pairing: PairingManager
  readonly printers: PrinterService
  readonly payments: PaymentManager
  private readonly origins: Set<string>
  private readonly http: Server
  private readonly https: HttpsServer | null
  private net: NetServer | null = null
  private readonly sockets = new Set<Socket>()
  private readonly wss: WebSocketServer
  private readonly conns = new Set<Conn>()
  private readonly methods: Record<string, Handler>
  private readonly publicMethods = new Set(['bridge.pair', 'bridge.hello'])
  private tls: TlsMaterial | undefined
  private lan: boolean
  private refreshTimer: NodeJS.Timeout | undefined
  private readonly pairAttempts = new Map<string, number[]>()
  private hostCache: { at: number; names: Set<string> } | null = null
  // Jeton du formulaire de la page locale (nouveau code), propre à ce lancement
  private readonly formToken = randomBytes(24).toString('base64url')
  // Dernier ticket envoyé, pour la page locale
  private lastPrinter: LocalStatus['printer'] = null

  constructor(
    private readonly config: BridgeConfig,
    private readonly opts: BridgeServerOptions = {},
  ) {
    this.log = opts.logger ?? createLogger(config.logLevel)
    this.store = new ConfigStore(config.home)
    this.pairing = new PairingManager(this.store, this.log, opts.pairing)
    this.payments = new PaymentManager(opts.payments)
    this.printers = new PrinterService(opts.printer)
    this.origins = new Set(config.origins.map(normalizeOrigin))
    this.tls = config.tls
    this.lan = config.lan === true

    const onRequest = (req: IncomingMessage, res: ServerResponse) => this.onHttp(req, res)
    const onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) => this.onUpgrade(req, socket, head)
    this.http = createHttpServer(onRequest)
    this.http.on('upgrade', onUpgrade)
    this.https = config.tls ? createHttpsServer({ cert: config.tls.cert, key: config.tls.key }, onRequest) : null
    this.https?.on('upgrade', onUpgrade)
    this.https?.on('tlsClientError', (err) => this.log.debug('Poignée de main TLS refusée', { erreur: err.message }))
    // Ces serveurs ne font pas listen() eux-mêmes (le port est partagé) :
    // « listening » met en place leur suivi des connexions et délais d'en-têtes
    this.http.emit('listening')
    this.https?.emit('listening')
    this.wss = new WebSocketServer({ noServer: true, maxPayload: config.maxMessageBytes })
    this.methods = this.buildMethods()
  }

  get port(): number {
    return (this.net?.address() as AddressInfo | null)?.port ?? this.config.port
  }

  get secure(): boolean {
    return !!this.https
  }

  get url(): string {
    return `${this.https ? 'wss' : 'ws'}://127.0.0.1:${this.port}`
  }

  get lanEnabled(): boolean {
    return this.lan
  }

  get certificate(): TlsMaterial | undefined {
    return this.tls
  }

  isOriginAllowed(origin: string | undefined): boolean {
    return !!origin && this.origins.has(normalizeOrigin(origin))
  }

  // Adresses à donner aux iPad : https://192.168.1.20:51717
  lanAddresses(): string[] {
    return lanIPv4()
  }

  networkInfo() {
    const addresses = this.lan ? this.lanAddresses() : []
    return {
      lan: this.lan,
      tls: this.secure,
      port: this.port,
      addresses,
      certificate: this.tls?.ca
        ? {
            fingerprint: this.tls.ca.fingerprint,
            label: this.tls.ca.label,
            paths: { profile: CERT_PATH, cer: CERT_CER_PATH, pem: CERT_PEM_PATH },
          }
        : null,
    }
  }

  private listenOn(host: string, port = this.config.port): Promise<NetServer> {
    const server = createNetServer((socket) => this.onSocket(socket))
    server.maxConnections = MAX_CONNECTIONS * 2
    return new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, host, () => {
        server.off('error', reject)
        server.on('error', (err) => this.log.error('Erreur du serveur', { erreur: err.message }))
        resolve(server)
      })
    })
  }

  async listen(): Promise<void> {
    this.net = await this.listenOn(this.lan ? '0.0.0.0' : this.config.host)
    this.log.info(`${NAME} ${VERSION} à l'écoute`, { url: this.url, origines: [...this.origins].join(',') })
    if (this.opts.refreshTls && this.https) {
      this.refreshTimer = setInterval(() => this.refreshCertificate(), TLS_REFRESH_MS)
      this.refreshTimer.unref()
    }
    if (this.opts.forcePairingCode || !this.store.hasClients()) this.pairing.renew()
    else this.log.info('Caisses appairées', { nombre: this.store.listClients().length })
  }

  // Nouvelle adresse IP, échéance proche ou « flow-bridge cert --renouveler » :
  // le nouveau certificat sert aux connexions suivantes, sans redémarrer
  refreshCertificate(): boolean {
    if (!this.opts.refreshTls || !this.https) return false
    try {
      const next = this.opts.refreshTls()
      if (this.tls && next.cert.equals(this.tls.cert) && next.key.equals(this.tls.key)) return false
      this.https.setSecureContext({ cert: next.cert, key: next.key })
      const caChanged = next.ca?.fingerprint !== this.tls?.ca?.fingerprint
      this.tls = next
      this.hostCache = null
      this.log.info('Certificat du pont renouvelé', { noms: [...(next.names?.dns ?? []), ...(next.names?.ips ?? [])].join(',') })
      if (caChanged) this.log.warn("Nouvelle autorité : approuvez à nouveau le certificat sur les Mac et iPad", { empreinte: next.ca?.fingerprint })
      return true
    } catch (err) {
      this.log.error('Renouvellement du certificat impossible', { erreur: err instanceof Error ? err.message : String(err) })
      return false
    }
  }

  // Ouvre ou ferme le pont aux autres appareils du réseau local
  async setLan(enabled: boolean): Promise<void> {
    if (enabled === this.lan) return
    if (enabled && !this.https) {
      throw new BridgeError('tls_required', "L'accès réseau demande une connexion sécurisée : le certificat du pont est désactivé (FLOW_BRIDGE_TLS=0).")
    }
    const old = this.net
    const port = this.port
    // Le port doit être libéré avant d'écouter ailleurs : les connexions en cours restent
    await new Promise<void>((resolve) => {
      if (!old) return resolve()
      old.close()
      setImmediate(resolve)
    })
    try {
      this.net = await this.listenOn(enabled ? '0.0.0.0' : this.config.host, port)
    } catch (err) {
      this.net = await this.listenOn(this.lan ? '0.0.0.0' : this.config.host, port)
      throw new BridgeError('lan_failed', `Impossible de changer l'accès réseau : ${(err as Error).message}`)
    }
    this.lan = enabled
    if (!enabled) {
      // Les iPad déjà connectés sont coupés
      for (const s of this.sockets) if (!isLoopback(s.remoteAddress)) s.destroy()
    }
    this.log.info(enabled ? 'Accès réseau ouvert' : 'Accès réseau fermé', { adresses: enabled ? this.lanAddresses().join(',') : undefined })
  }

  async close(): Promise<void> {
    this.pairing.stop()
    clearInterval(this.refreshTimer)
    for (const c of this.conns) c.ws.close(1001, 'Arrêt du pont')
    // Laisser finir les tickets en cours d'envoi, sans bloquer l'arrêt
    await Promise.race([this.printers.queues.drain(), new Promise((r) => setTimeout(r, 5000).unref())])
    await new Promise<void>((resolve) => this.wss.close(() => resolve()))
    for (const c of this.conns) c.ws.terminate()
    const net = this.net
    this.net = null
    await new Promise<void>((resolve) => {
      if (!net) return resolve()
      net.close(() => resolve())
      for (const s of this.sockets) s.destroy()
    })
    this.http.close()
    this.https?.close()
  }

  // --- Aiguillage TLS / clair -------------------------------------------

  private onSocket(socket: Socket) {
    if (this.sockets.size >= MAX_CONNECTIONS * 2) {
      socket.destroy()
      return
    }
    this.sockets.add(socket)
    socket.once('close', () => this.sockets.delete(socket))
    socket.on('error', () => socket.destroy())
    if (!this.https) {
      this.http.emit('connection', socket)
      return
    }
    socket.setTimeout(FIRST_BYTE_TIMEOUT_MS, () => socket.destroy())
    socket.once('data', (chunk: Buffer) => {
      socket.setTimeout(0)
      socket.pause()
      socket.unshift(chunk)
      // 0x16 : enregistrement TLS « handshake » (ClientHello)
      const target = chunk[0] === 0x16 ? this.https! : this.http
      target.emit('connection', socket)
      process.nextTick(() => socket.resume())
    })
  }

  // --- HTTP -------------------------------------------------------------

  private allowedHostnames(): Set<string> {
    const now = Date.now()
    if (this.hostCache && now - this.hostCache.at < 30_000) return this.hostCache.names
    const local = currentLocalNames()
    const names = new Set(['127.0.0.1', 'localhost', '[::1]', ...local.dns, ...local.ips.filter((ip) => isIPv4(ip))])
    this.hostCache = { at: now, names }
    return names
  }

  private hostAllowed(req: IncomingMessage): boolean {
    const host = hostnameOf(req.headers.host)
    return !!host && this.allowedHostnames().has(host)
  }

  private cors(req: IncomingMessage, res: ServerResponse): boolean {
    const origin = req.headers.origin
    if (!this.isOriginAllowed(origin)) return false
    res.setHeader('Access-Control-Allow-Origin', origin!)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    // Chrome (Private Network Access) demande cet accord avant qu'un site
    // public joigne une adresse locale
    if (req.headers['access-control-request-private-network'] === 'true') {
      res.setHeader('Access-Control-Allow-Private-Network', 'true')
    }
    return true
  }

  private onHttp(req: IncomingMessage, res: ServerResponse) {
    if (!this.hostAllowed(req)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Hôte refusé')
      return
    }
    const path = (req.url ?? '/').split('?')[0]
    const local = isLoopback(req.socket.remoteAddress)
    const secure = (req.socket as TLSSocket).encrypted === true

    if (path === NEW_CODE_PATH && local) {
      this.onNewCode(req, res)
      return
    }
    if (path === '/' || path === CERT_PATH || path.startsWith(`${CERT_PATH}/`)) {
      this.onCertificateRequest(req, res, path, secure, local)
      return
    }
    // Depuis le réseau local : rien d'autre sans authentification
    if (path !== '/health' || !local) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Introuvable')
      return
    }
    if (req.method === 'OPTIONS') {
      const ok = this.cors(req, res)
      res.writeHead(ok ? 204 : 403).end()
      return
    }
    if (req.method !== 'GET') {
      res.writeHead(405, { Allow: 'GET, OPTIONS' }).end()
      return
    }
    this.cors(req, res)
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify({ name: NAME, version: VERSION, capabilities: CAPABILITIES, tls: this.secure }))
  }

  // Page d'accueil et certificat de l'autorité : publics, en clair comme en
  // TLS, pour qu'un iPad puisse l'installer avant de l'avoir approuvé
  private onCertificateRequest(req: IncomingMessage, res: ServerResponse, path: string, secure: boolean, local: boolean) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end()
      return
    }
    const common = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
    const ca = this.tls?.ca
    if (path === '/') {
      const html = renderHomePage({
        secure,
        ca,
        port: this.port,
        lan: this.lan,
        addresses: this.lan ? this.lanAddresses() : [],
        // Code et état : seulement pour cet ordinateur, jamais pour le réseau
        local: local ? this.localStatus() : undefined,
      })
      res.writeHead(200, {
        ...common,
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
        'Referrer-Policy': 'no-referrer',
      })
      res.end(req.method === 'HEAD' ? undefined : html)
      return
    }
    if (!ca) {
      res
        .writeHead(404, { ...common, 'Content-Type': 'text/plain; charset=utf-8' })
        .end("Ce pont utilise un certificat fourni par l'administrateur (FLOW_BRIDGE_CERT) : rien à installer ici.")
      return
    }
    let body: string | Buffer
    let type: string
    let file: string
    if (path === CERT_PATH) {
      body = mobileconfig(ca)
      type = 'application/x-apple-aspen-config'
      file = 'FLOW-Bridge.mobileconfig'
    } else if (path === CERT_CER_PATH) {
      body = ca.der
      type = 'application/x-x509-ca-cert'
      file = 'flow-bridge.cer'
    } else if (path === CERT_PEM_PATH) {
      body = ca.pem
      type = 'application/x-pem-file'
      file = 'flow-bridge.pem'
    } else {
      res.writeHead(404, { ...common, 'Content-Type': 'text/plain; charset=utf-8' }).end('Introuvable')
      return
    }
    res.writeHead(200, { ...common, 'Content-Type': type, 'Content-Disposition': `attachment; filename="${file}"` })
    res.end(req.method === 'HEAD' ? undefined : body)
  }

  localStatus(): LocalStatus {
    const code = this.pairing.currentCode
    const tpe = this.store.getTpe()
    const appUrl = this.config.appUrl
    return {
      code,
      expiresAt: this.pairing.currentExpiresAt,
      clients: this.store.listClients().map((c) => ({ name: c.name, lastSeenAt: c.lastSeenAt })),
      printer: this.lastPrinter,
      tpe: tpe ? { label: tpeLabel(tpe), at: tpe.updatedAt } : null,
      openUrl: appUrl ? (code ? pairingPageUrl(appUrl, code, this.port) : appUrl) : undefined,
      formToken: this.formToken,
    }
  }

  // « Nouveau code » depuis la page locale. Un autre site ouvert dans le
  // navigateur pourrait poster ce formulaire à l'aveugle : il faut le jeton
  // de la page (illisible depuis un autre site) et, quand le navigateur les
  // envoie, une origine et un Sec-Fetch-Site de la page elle-même.
  private onNewCode(req: IncomingMessage, res: ServerResponse) {
    const deny = (status: number, text: string) => res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }).end(text)
    if (req.method !== 'POST') {
      res.writeHead(405, { Allow: 'POST' }).end()
      return
    }
    const site = req.headers['sec-fetch-site']
    if (site !== undefined && site !== 'same-origin') return deny(403, 'Requête refusée')
    const origin = req.headers.origin
    if (origin !== undefined) {
      let o: URL | null = null
      try {
        o = new URL(origin)
      } catch {
        o = null
      }
      if (!o || o.host !== (req.headers.host ?? '').toLowerCase() || !isLoopbackName(o.hostname)) return deny(403, 'Requête refusée')
    }
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > 2048) req.destroy()
      else chunks.push(c)
    })
    req.on('end', () => {
      const given = Buffer.from(new URLSearchParams(Buffer.concat(chunks).toString('utf8')).get('jeton') ?? '')
      const expected = Buffer.from(this.formToken)
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) return deny(403, 'Requête refusée')
      this.pairing.renew()
      this.log.info("Nouveau code d'appairage demandé depuis la page du pont")
      res.writeHead(303, { Location: '/', 'Cache-Control': 'no-store' }).end()
    })
  }

  // --- WebSocket --------------------------------------------------------

  private onUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    if (!this.hostAllowed(req)) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
      return
    }
    const remote = req.socket.remoteAddress ?? ''
    const local = isLoopback(remote)
    const secure = (req.socket as TLSSocket).encrypted === true
    if (this.conns.size >= MAX_CONNECTIONS) {
      socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n')
      return
    }
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      const origin = req.headers.origin
      if (!this.isOriginAllowed(origin)) {
        // Connexion acceptée puis fermée aussitôt : le navigateur reçoit un
        // code explicite (4003) au lieu d'un échec réseau muet
        this.log.warn('Connexion refusée : origine non autorisée', { origine: origin ?? 'absente' })
        ws.close(CLOSE_ORIGIN_REFUSED, 'Origine non autorisée')
        return
      }
      if (!local && !secure) {
        // Jeton et code d'appairage ne circulent jamais en clair sur le réseau
        ws.close(CLOSE_INSECURE_LAN, 'Connexion sécurisée (wss) exigée')
        return
      }
      this.onConnection(ws, origin!, remote, local, secure)
    })
  }

  private onConnection(ws: WebSocket, origin: string, remote: string, local: boolean, secure: boolean) {
    const conn: Conn = { ws, client: null, origin, remote, local, secure }
    this.conns.add(conn)
    this.log.info('Caisse connectée', { origine: origin, adresse: local ? undefined : remote, tls: secure })
    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        this.send(conn, { id: null, error: { code: 'invalid_request', message: 'Message texte JSON attendu.' } })
        return
      }
      void this.onMessage(conn, data.toString())
    })
    ws.on('close', () => {
      this.conns.delete(conn)
      this.log.info('Caisse déconnectée', { caisse: conn.client?.name })
    })
    ws.on('error', (err) => this.log.warn('Erreur WebSocket', { erreur: err.message }))
  }

  private send(conn: Conn, payload: unknown) {
    if (conn.ws.readyState === conn.ws.OPEN) conn.ws.send(JSON.stringify(payload))
  }

  emit(conn: Conn, event: RpcEvent) {
    this.send(conn, event)
  }

  // Limite par appareil des essais d'appairage venus du réseau local
  private checkLanPairRate(conn: Conn) {
    if (conn.local) return
    const now = Date.now()
    const recent = (this.pairAttempts.get(conn.remote) ?? []).filter((t) => now - t < LAN_PAIR_WINDOW_MS)
    if (recent.length >= LAN_PAIR_ATTEMPTS) {
      const wait = Math.ceil((recent[0] + LAN_PAIR_WINDOW_MS - now) / 60_000)
      this.log.warn("Trop d'essais d'appairage depuis le réseau", { adresse: conn.remote })
      throw new BridgeError('rate_limited', `Trop d'essais d'appairage depuis cet appareil. Réessayez dans ${wait} minute${wait > 1 ? 's' : ''}.`)
    }
    recent.push(now)
    this.pairAttempts.set(conn.remote, recent)
    if (this.pairAttempts.size > 1000) this.pairAttempts.delete(this.pairAttempts.keys().next().value!)
  }

  private async onMessage(conn: Conn, text: string) {
    let msg: unknown
    try {
      msg = JSON.parse(text)
    } catch {
      this.send(conn, { id: null, error: { code: 'parse_error', message: 'Message illisible (JSON invalide).' } })
      return
    }
    if (!isRecord(msg) || typeof msg.method !== 'string' || (typeof msg.id !== 'string' && typeof msg.id !== 'number')) {
      const id = isRecord(msg) && (typeof msg.id === 'string' || typeof msg.id === 'number') ? msg.id : null
      this.send(conn, { id, error: { code: 'invalid_request', message: 'Requête invalide (id et method attendus).' } })
      return
    }
    const { id, method } = msg
    try {
      const handler = Object.hasOwn(this.methods, method) ? this.methods[method] : undefined
      if (!handler) throw new BridgeError('unknown_method', `Méthode inconnue : ${method}.`)
      if (!this.publicMethods.has(method) && !conn.client) {
        throw new BridgeError('unauthorized', "Caisse non authentifiée auprès du pont. Appairez-la d'abord.")
      }
      const result = await handler(requireParams(msg.params), conn)
      this.send(conn, { id, result: result ?? null })
    } catch (err) {
      let error: RpcErrorBody
      if (err instanceof BridgeError) {
        error = { code: err.code, message: err.message }
        this.log.warn('Requête refusée', { methode: method, code: err.code })
      } else {
        error = { code: 'internal_error', message: 'Erreur interne du pont.' }
        this.log.error('Erreur interne', { methode: method, erreur: err instanceof Error ? err.message : String(err) })
      }
      this.send(conn, { id, error })
    }
  }

  // --- Méthodes ---------------------------------------------------------

  private buildMethods(): Record<string, Handler> {
    return {
      'bridge.pair': (p, conn) => {
        const code = str(p, 'code', { required: true, max: 16 })!
        const name = (str(p, 'name', { max: 64 }) ?? 'Caisse').trim() || 'Caisse'
        this.checkLanPairRate(conn)
        this.pairing.attempt(code)
        const { client, token } = this.store.addClient(name)
        conn.client = client
        this.log.info('Caisse appairée', { caisse: name, origine: conn.origin, adresse: conn.local ? undefined : conn.remote })
        return { token, clientId: client.id, name: client.name }
      },

      'bridge.hello': (p, conn) => {
        const token = str(p, 'token', { required: true, max: 128 })!
        const client = this.store.findByToken(token)
        if (!client) {
          throw new BridgeError('invalid_token', "Ce poste n'est plus appairé au pont. Saisissez un nouveau code d'appairage.")
        }
        conn.client = client
        this.store.touch(client.id)
        this.log.info('Caisse authentifiée', { caisse: client.name })
        return { clientId: client.id, name: client.name, version: VERSION, capabilities: CAPABILITIES }
      },

      'bridge.unpair': (_p, conn) => {
        const client = conn.client!
        this.store.removeClient(client.id)
        conn.client = null
        this.log.info('Caisse désappairée', { caisse: client.name })
        if (!this.store.hasClients()) this.pairing.renew()
        return { ok: true }
      },

      'bridge.info': () => ({
        name: NAME,
        version: VERSION,
        capabilities: CAPABILITIES,
        platform: process.platform,
        arch: process.arch,
        node: process.version,
        network: this.networkInfo(),
      }),

      // Accès des iPad : seulement depuis cet ordinateur, pas depuis le réseau
      'bridge.setLan': async (p, conn) => {
        if (!conn.local) {
          throw new BridgeError('forbidden', "L'accès réseau se règle depuis l'ordinateur où tourne le pont.")
        }
        const enabled = bool(p, 'enabled', false)
        await this.setLan(enabled)
        this.opts.persistLan?.(enabled)
        return this.networkInfo()
      },

      'printer.print': async (p) => {
        const host = str(p, 'host', { required: true, max: 253 })!
        const port = int(p, 'port', { min: 1, max: 65535, def: DEFAULT_PRINTER_PORT })
        const timeoutMs = int(p, 'timeoutMs', { min: 500, max: 60_000, def: 8000 })
        const data = decodeBase64(str(p, 'data', { required: true })!)
        try {
          const r = await this.printers.print(host, port, data, timeoutMs)
          this.lastPrinter = { host, port, ok: true, at: new Date().toISOString() }
          this.log.info(r.status.known ? 'Ticket imprimé' : 'Ticket envoyé (état de l’imprimante inconnu)', {
            imprimante: `${host}:${port}`,
            octets: r.bytes,
            ...(r.warning ? { avertissement: r.warning } : {}),
          })
          return { ok: true, ...r }
        } catch (e) {
          if (e instanceof BridgeError) {
            this.log.warn('Ticket non imprimé', { imprimante: `${host}:${port}`, cause: e.code })
            if (e.code !== 'host_not_allowed') this.lastPrinter = { host, port, ok: false, at: new Date().toISOString() }
          }
          throw e
        }
      },

      'printer.status': (p) => {
        const host = str(p, 'host', { required: true, max: 253 })!
        const port = int(p, 'port', { min: 1, max: 65535, def: DEFAULT_PRINTER_PORT })
        const timeoutMs = int(p, 'timeoutMs', { min: 500, max: 10_000, def: 3000 })
        return this.printers.status(host, port, timeoutMs)
      },

      'printer.probe': (p) => {
        const host = str(p, 'host', { required: true, max: 253 })!
        const port = int(p, 'port', { min: 1, max: 65535, def: DEFAULT_PRINTER_PORT })
        const timeoutMs = int(p, 'timeoutMs', { min: 200, max: 10_000, def: 2000 })
        return probe(host, port, timeoutMs)
      },

      'printer.discover': async (p) => {
        const timeoutMs = int(p, 'timeoutMs', { min: 500, max: MAX_DISCOVER_TIMEOUT_MS, def: DEFAULT_DISCOVER_TIMEOUT_MS })
        const scan = bool(p, 'scan', true)
        const r = await discoverPrinters({ timeoutMs, scan }, this.opts.discovery ?? defaultDiscoveryDeps)
        this.log.info('Recherche des imprimantes', { trouvees: r.printers.length })
        return r
      },

      'printer.printDocument': async (p) => {
        const host = str(p, 'host', { required: true, max: 253 })!
        const port = int(p, 'port', { min: 1, max: 65535, def: DEFAULT_IPP_PORT })
        const path = str(p, 'path', { max: 255 })
        if (path !== undefined && !/^\/?[A-Za-z0-9._~\-/]*$/.test(path)) {
          throw new BridgeError('invalid_params', 'Paramètre « path » invalide.')
        }
        const tls = bool(p, 'tls', false)
        const jobName = str(p, 'jobName', { max: 255 })
        const copies = int(p, 'copies', { min: 1, max: 20, def: 1 })
        const timeoutMs = int(p, 'timeoutMs', { min: 1000, max: 120_000, def: 30_000 })
        const pdf = decodePdf(str(p, 'data', { required: true })!)
        // Même file que les tickets : un seul travail à la fois par imprimante
        const ip = await resolveLanHost(host)
        const r = await this.printers.queues.run(`ipp:${ip}:${port}`, () =>
          printDocument({ host, port, path, tls, pdf, jobName, copies, timeoutMs }),
        )
        this.log.info('Document imprimé', { imprimante: `${host}:${port}`, octets: pdf.length, travail: r.jobId })
        return r
      },

      'drawer.open': async (p) => {
        const host = str(p, 'host', { required: true, max: 253 })!
        const port = int(p, 'port', { min: 1, max: 65535, def: DEFAULT_PRINTER_PORT })
        const pin = int(p, 'pin', { min: 0, max: 1, def: 0 }) as 0 | 1
        const timeoutMs = int(p, 'timeoutMs', { min: 500, max: 60_000, def: 8000 })
        await this.printers.openDrawer(host, port, pin, timeoutMs)
        this.log.info('Tiroir ouvert', { imprimante: `${host}:${port}` })
        return { ok: true }
      },

      // TPE Caisse-AP du réseau local : connexion ouverte puis refermée,
      // aucun octet envoyé, donc aucun paiement
      'tpe.discover': async (p) => {
        const timeoutMs = int(p, 'timeoutMs', { min: 500, max: MAX_DISCOVER_TIMEOUT_MS, def: DEFAULT_TPE_DISCOVER_TIMEOUT_MS })
        const r = await discoverTerminals({ timeoutMs, ports: ports(p, 'ports') }, this.opts.discovery ?? defaultDiscoveryDeps)
        this.log.info('Recherche des TPE', { trouves: r.terminals.length })
        return r
      },

      'tpe.get': () => ({ tpe: this.store.getTpe() }),

      // TPE choisi sur la caisse, gardé par le pont ; adapter: null l'oublie
      'tpe.set': (p) => {
        if (p.adapter === null) return { tpe: this.store.setTpe(null) }
        const adapter = str(p, 'adapter', { required: true })
        if (adapter === 'simulator') return { tpe: this.store.setTpe({ adapter }) }
        if (adapter !== 'caisse-ap') throw new BridgeError('unknown_adapter', `Terminal de paiement inconnu : ${adapter}.`)
        const host = str(p, 'host', { required: true, max: 253 })!.trim().toLowerCase()
        if (!isLanHostSyntax(host)) {
          throw new BridgeError('host_not_allowed', `Adresse refusée : ${host}. Seules les adresses du réseau local ou les noms en .local sont acceptés.`)
        }
        const port = int(p, 'port', { min: 1, max: 65535, def: CAISSE_AP_DEFAULT_PORT })
        const posNumber = str(p, 'posNumber', { max: 2 })
        if (posNumber !== undefined && !/^\d{1,2}$/.test(posNumber)) throw new BridgeError('invalid_params', 'Paramètre « posNumber » invalide (1 ou 2 chiffres).')
        const tpe = this.store.setTpe({ adapter, host, port, ...(posNumber ? { posNumber } : {}) })
        this.log.info('TPE enregistré', { tpe: `${host}:${port}` })
        return { tpe }
      },

      'payment.start': async (p, conn) => {
        const result = await this.payments.start(p, (e) => this.emit(conn, { event: 'payment.progress', data: e }))
        this.log.info('Paiement terminé', { statut: result.status, terminal: String(p.adapter), id: result.paymentId })
        return result
      },

      'payment.cancel': (p) => {
        const paymentId = str(p, 'paymentId', { required: true, max: 64 })!
        return this.payments.cancel(paymentId)
      },

      'payment.status': (p) => {
        const paymentId = str(p, 'paymentId', { required: true, max: 64 })!
        return this.payments.status(paymentId)
      },
    }
  }
}
