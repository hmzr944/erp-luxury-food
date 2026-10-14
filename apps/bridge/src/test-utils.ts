// Outils partagés par les tests (exclu du build par tsconfig.json)

import { mkdtempSync, rmSync } from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import { createServer, type Server, type Socket } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import WebSocket from 'ws'
import type { BridgeConfig } from './config.js'
import {
  decodeIpp,
  encodeIpp,
  OP_GET_PRINTER_ATTRIBUTES,
  TAG_JOB,
  TAG_OPERATION,
  TAG_PRINTER,
  VT_CHARSET,
  VT_ENUM,
  VT_INTEGER,
  VT_LANGUAGE,
  VT_MIME,
  VT_TEXT,
  type IppMessage,
} from './ipp.js'
import { createLogger } from './log.js'
import { BridgeServer, type BridgeServerOptions } from './server.js'

export const ORIGIN = 'http://localhost:3000'

export async function startBridge(opts: BridgeServerOptions = {}, cfg: Partial<BridgeConfig> = {}) {
  const home = mkdtempSync(join(tmpdir(), 'flow-bridge-test-'))
  const server = new BridgeServer(
    { port: 0, host: '127.0.0.1', origins: [ORIGIN], home, logLevel: 'silent', maxMessageBytes: 1024 * 1024, ...cfg },
    { logger: createLogger('silent'), payments: { simulatorDurationMs: 120 }, pairing: { lockMs: 0 }, ...opts },
  )
  await server.listen()
  return {
    server,
    home,
    async stop() {
      await server.close()
      rmSync(home, { recursive: true, force: true })
    },
  }
}

export interface RpcReply {
  id: string | number | null
  result?: unknown
  error?: { code: string; message: string }
}

// Client de test minimal : requêtes numérotées, événements collectés
export class TestClient {
  private nextId = 1
  private waiting = new Map<number, (r: RpcReply) => void>()
  readonly events: Array<{ event: string; data: unknown }> = []
  readonly orphans: RpcReply[] = []

  private constructor(readonly ws: WebSocket) {
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString())
      if ('event' in msg) {
        this.events.push(msg)
        return
      }
      const cb = typeof msg.id === 'number' ? this.waiting.get(msg.id) : undefined
      if (cb) {
        this.waiting.delete(msg.id)
        cb(msg)
      } else this.orphans.push(msg)
    })
  }

  static open(url: string, origin: string | undefined = ORIGIN): Promise<TestClient> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, origin ? { origin } : {})
      const client = new TestClient(ws)
      ws.once('open', () => resolve(client))
      ws.once('error', reject)
    })
  }

  call(method: string, params?: unknown): Promise<RpcReply> {
    const id = this.nextId++
    return new Promise((resolve) => {
      this.waiting.set(id, resolve)
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  sendRaw(text: string): Promise<RpcReply> {
    return new Promise((resolve) => {
      const before = this.orphans.length
      const check = () => {
        if (this.orphans.length > before) resolve(this.orphans[before])
        else setTimeout(check, 10)
      }
      this.ws.send(text)
      check()
    })
  }

  close() {
    this.ws.close()
  }
}

// Fausse imprimante réseau : enregistre les octets reçus par connexion
export interface FakePrinter {
  port: number
  jobs: Buffer[]
  log: string[]
  close(): Promise<void>
}

export async function fakePrinter(opts: { holdMs?: number } = {}): Promise<FakePrinter> {
  const jobs: Buffer[] = []
  const log: string[] = []
  const sockets = new Set<Socket>()
  let n = 0
  // allowHalfOpen : comme une vraie imprimante, on ne ferme qu'une fois le ticket « imprimé »
  const server: Server = createServer({ allowHalfOpen: true }, (socket) => {
    sockets.add(socket)
    const i = n++
    const chunks: Buffer[] = []
    log.push(`open${i}`)
    socket.on('data', (c) => chunks.push(c))
    socket.on('end', () => {
      jobs[i] = Buffer.concat(chunks)
      // Simule une imprimante lente qui met du temps à finir le ticket
      setTimeout(() => {
        log.push(`close${i}`)
        socket.end()
      }, opts.holdMs ?? 0)
    })
    socket.on('close', () => sockets.delete(socket))
    socket.on('error', () => {})
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
  const port = (server.address() as { port: number }).port
  return {
    port,
    jobs,
    log,
    close: () =>
      new Promise<void>((r) => {
        for (const s of sockets) s.destroy()
        server.close(() => r())
      }),
  }
}

export async function pairClient(url: string, server: BridgeServer, name = 'Caisse test'): Promise<{ client: TestClient; token: string }> {
  const client = await TestClient.open(url)
  const code = server.pairing.currentCode ?? server.pairing.renew()
  const r = await client.call('bridge.pair', { code, name })
  if (r.error) throw new Error(r.error.message)
  return { client, token: (r.result as { token: string }).token }
}

// Fausse imprimante IPP (HTTP sur 127.0.0.1) : répond à Get-Printer-Attributes
// et Print-Job, garde les requêtes décodées
export interface FakeIpp {
  port: number
  requests: Array<{ path: string; contentType?: string; msg: IppMessage }>
  close(): Promise<void>
}

export async function startFakeIpp(
  opts: { formats?: string[]; printStatus?: number; model?: string; path?: string } = {},
): Promise<FakeIpp> {
  const requests: FakeIpp['requests'] = []
  const server = createHttpServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      if (req.method !== 'POST' || req.url !== (opts.path ?? '/ipp/print')) {
        res.writeHead(404).end()
        return
      }
      const msg = decodeIpp(Buffer.concat(chunks))
      requests.push({ path: req.url, contentType: req.headers['content-type'], msg })
      const op = {
        tag: TAG_OPERATION,
        attributes: [
          { tag: VT_CHARSET, name: 'attributes-charset', values: ['utf-8'] },
          { tag: VT_LANGUAGE, name: 'attributes-natural-language', values: ['fr'] },
        ],
      }
      let reply: IppMessage
      if (msg.code === OP_GET_PRINTER_ATTRIBUTES) {
        reply = {
          version: [1, 1],
          code: 0,
          requestId: msg.requestId,
          groups: [
            op,
            {
              tag: TAG_PRINTER,
              attributes: [
                { tag: VT_MIME, name: 'document-format-supported', values: opts.formats ?? ['application/octet-stream', 'application/pdf', 'image/urf'] },
                { tag: VT_ENUM, name: 'printer-state', values: [3] },
                { tag: VT_TEXT, name: 'printer-make-and-model', values: [opts.model ?? 'HP LaserJet Pro M404'] },
              ],
            },
          ],
        }
      } else {
        const status = opts.printStatus ?? 0
        reply = {
          version: [1, 1],
          code: status,
          requestId: msg.requestId,
          groups: status < 0x100 ? [op, { tag: TAG_JOB, attributes: [{ tag: VT_INTEGER, name: 'job-id', values: [123] }] }] : [op],
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/ipp' }).end(encodeIpp(reply))
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
  return {
    port: (server.address() as { port: number }).port,
    requests,
    close: () =>
      new Promise<void>((r) => {
        server.close(() => r())
        server.closeAllConnections()
      }),
  }
}
