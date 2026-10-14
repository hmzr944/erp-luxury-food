// Serveur du pont : HTTP (/health) et WebSocket sur la boucle locale.
//
// N'importe quel site ouvert dans le navigateur du magasin peut tenter de
// joindre 127.0.0.1 : trois barrières successives.
// 1. En-tête Host : seulement 127.0.0.1 ou localhost (contre le « DNS rebinding »).
// 2. Origin : seulement les origines déclarées dans FLOW_BRIDGE_ORIGINS.
// 3. Jeton d'appairage : obtenu une fois avec le code affiché sur l'ordinateur.

import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import type { AddressInfo } from 'node:net'
import type { Duplex } from 'node:stream'
import { WebSocketServer, type WebSocket } from 'ws'
import { normalizeOrigin, type BridgeConfig } from './config.js'
import { defaultDiscoveryDeps, DEFAULT_DISCOVER_TIMEOUT_MS, discoverPrinters, MAX_DISCOVER_TIMEOUT_MS, type DiscoveryDeps } from './discovery.js'
import { DEFAULT_IPP_PORT, MAX_DOCUMENT_BYTES, printDocument } from './ipp.js'
import { resolveLanHost } from './lan.js'
import { createLogger, type Logger } from './log.js'
import { PairingManager, type PairingOptions } from './pairing.js'
import { PaymentManager, PAYMENT_ADAPTERS, type PaymentManagerOptions } from './payment/manager.js'
import { DEFAULT_PRINTER_PORT, PrinterService, probe } from './printer.js'
import { BridgeError, bool, int, isRecord, requireParams, str, type RpcErrorBody, type RpcEvent } from './protocol.js'
import { ConfigStore, type PairedClient } from './store.js'
import { NAME, VERSION } from './version.js'

export const CAPABILITIES = [
  'printer.escpos',
  'printer.probe',
  'printer.discover',
  'printer.ipp',
  'drawer',
  ...PAYMENT_ADAPTERS.map((a) => `payment.${a}`),
]

// Codes de fermeture WebSocket propres au pont
export const CLOSE_ORIGIN_REFUSED = 4003

interface Conn {
  ws: WebSocket
  client: PairedClient | null
  origin: string
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
}

const ALLOWED_HOSTNAMES = new Set(['127.0.0.1', 'localhost'])

function hostnameOf(hostHeader: string | undefined): string | null {
  if (!hostHeader) return null
  try {
    return new URL(`http://${hostHeader}`).hostname.toLowerCase()
  } catch {
    return null
  }
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
  readonly printers = new PrinterService()
  readonly payments: PaymentManager
  private readonly origins: Set<string>
  private readonly http: Server
  private readonly wss: WebSocketServer
  private readonly conns = new Set<Conn>()
  private readonly methods: Record<string, Handler>
  private readonly publicMethods = new Set(['bridge.pair', 'bridge.hello'])

  constructor(
    private readonly config: BridgeConfig,
    private readonly opts: BridgeServerOptions = {},
  ) {
    this.log = opts.logger ?? createLogger(config.logLevel)
    this.store = new ConfigStore(config.home)
    this.pairing = new PairingManager(this.store, this.log, opts.pairing)
    this.payments = new PaymentManager(opts.payments)
    this.origins = new Set(config.origins.map(normalizeOrigin))

    const onRequest = (req: IncomingMessage, res: ServerResponse) => this.onHttp(req, res)
    this.http = config.tls ? createHttpsServer({ cert: config.tls.cert, key: config.tls.key }, onRequest) : createHttpServer(onRequest)
    this.wss = new WebSocketServer({ noServer: true, maxPayload: config.maxMessageBytes })
    this.http.on('upgrade', (req, socket, head) => this.onUpgrade(req, socket, head))
    this.methods = this.buildMethods()
  }

  get port(): number {
    return (this.http.address() as AddressInfo | null)?.port ?? this.config.port
  }

  get url(): string {
    return `${this.config.tls ? 'wss' : 'ws'}://127.0.0.1:${this.port}`
  }

  isOriginAllowed(origin: string | undefined): boolean {
    return !!origin && this.origins.has(normalizeOrigin(origin))
  }

  async listen(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.http.once('error', reject)
      // Jamais 0.0.0.0 : le pont n'est joignable que depuis cet ordinateur
      this.http.listen(this.config.port, this.config.host, () => {
        this.http.off('error', reject)
        resolve()
      })
    })
    this.log.info(`${NAME} ${VERSION} à l'écoute`, { url: this.url, origines: [...this.origins].join(',') })
    if (this.opts.forcePairingCode || !this.store.hasClients()) this.pairing.renew()
    else this.log.info('Caisses appairées', { nombre: this.store.listClients().length })
  }

  async close(): Promise<void> {
    this.pairing.stop()
    for (const c of this.conns) c.ws.close(1001, 'Arrêt du pont')
    // Laisser finir les tickets en cours d'envoi, sans bloquer l'arrêt
    await Promise.race([this.printers.queues.drain(), new Promise((r) => setTimeout(r, 5000).unref())])
    await new Promise<void>((resolve) => this.wss.close(() => resolve()))
    for (const c of this.conns) c.ws.terminate()
    await new Promise<void>((resolve) => {
      this.http.close(() => resolve())
      this.http.closeAllConnections?.()
    })
  }

  // --- HTTP -------------------------------------------------------------

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
    const host = hostnameOf(req.headers.host)
    if (!host || !ALLOWED_HOSTNAMES.has(host)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Hôte refusé')
      return
    }
    const path = (req.url ?? '/').split('?')[0]
    if (path !== '/health') {
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
    res.end(JSON.stringify({ name: NAME, version: VERSION, capabilities: CAPABILITIES }))
  }

  // --- WebSocket --------------------------------------------------------

  private onUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    const host = hostnameOf(req.headers.host)
    if (!host || !ALLOWED_HOSTNAMES.has(host)) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
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
      this.onConnection(ws, origin!)
    })
  }

  private onConnection(ws: WebSocket, origin: string) {
    const conn: Conn = { ws, client: null, origin }
    this.conns.add(conn)
    this.log.info('Caisse connectée', { origine: origin })
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
        this.pairing.attempt(code)
        const { client, token } = this.store.addClient(name)
        conn.client = client
        this.log.info('Caisse appairée', { caisse: name, origine: conn.origin })
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
      }),

      'printer.print': async (p) => {
        const host = str(p, 'host', { required: true, max: 253 })!
        const port = int(p, 'port', { min: 1, max: 65535, def: DEFAULT_PRINTER_PORT })
        const timeoutMs = int(p, 'timeoutMs', { min: 500, max: 60_000, def: 8000 })
        const data = decodeBase64(str(p, 'data', { required: true })!)
        const r = await this.printers.print(host, port, data, timeoutMs)
        this.log.info('Ticket imprimé', { imprimante: `${host}:${port}`, octets: r.bytes })
        return { ok: true, bytes: r.bytes }
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
