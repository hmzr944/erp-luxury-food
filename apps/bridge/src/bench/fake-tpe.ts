// Faux TPE Caisse-AP sur IP pour le banc d'essai : il écoute comme un
// terminal Ingenico ou Verifone (port 8888), lit la demande de la caisse et
// répond « accepté » ou « refusé ». Même format que l'adaptateur réel
// (src/payment/caisse-ap.ts) : TAG(2) + longueur(3) + valeur, CZ en premier.

import { createServer, type Server } from 'node:net'
import { decodeMessage, encodeMessage } from '../payment/caisse-ap.js'

export interface FakeTpeRequest {
  amountCents: number
  currency: string
  credit: boolean
  register: string
}

export type FakeTpeDecision = { accept: true } | { accept: false; reason: '04' | '06' | '07' }

export interface FakeTpeOptions {
  port?: number
  host?: string
  delayMs?: number
  // Décision pour chaque demande ; par défaut, montants en ,13 refusés (comme le simulateur du pont)
  decide?: (req: FakeTpeRequest) => FakeTpeDecision | Promise<FakeTpeDecision>
  onRequest?: (req: FakeTpeRequest) => void
  onResponse?: (req: FakeTpeRequest, decision: FakeTpeDecision) => void
}

export const defaultDecision = (req: FakeTpeRequest): FakeTpeDecision =>
  req.amountCents % 100 === 13 ? { accept: false, reason: '04' } : { accept: true }

let sequence = 0

export function startFakeTpe(opts: FakeTpeOptions = {}): Promise<Server> {
  const server = createServer((socket) => {
    let buffer = ''
    socket.setEncoding('latin1')
    socket.on('data', async (chunk: string) => {
      buffer += chunk
      const fields = decodeMessage(buffer)
      if (!fields) return
      buffer = ''
      const req: FakeTpeRequest = {
        amountCents: Number(fields.CB ?? 0),
        currency: fields.CE ?? '',
        credit: fields.CD === '1',
        register: fields.CA ?? '',
      }
      opts.onRequest?.(req)
      const decision = await (opts.decide ?? defaultDecision)(req)
      await new Promise((r) => setTimeout(r, opts.delayMs ?? 2000))
      sequence++
      const common = { CA: fields.CA ?? '01', CD: fields.CD ?? '0', CE: fields.CE ?? '978', CB: fields.CB ?? '0' }
      const reply = decision.accept
        ? { CZ: '0300', AE: '10', ...common, CC: '001', CI: '1', AA: String(sequence).padStart(6, '0') }
        : { CZ: '0300', AE: '01', AF: decision.reason, ...common }
      opts.onResponse?.(req, decision)
      if (!socket.destroyed) socket.end(encodeMessage(reply))
    })
    socket.on('error', () => socket.destroy())
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(opts.port ?? 8888, opts.host ?? '0.0.0.0', () => resolve(server))
  })
}
