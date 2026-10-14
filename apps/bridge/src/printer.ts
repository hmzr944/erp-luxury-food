// Impression brute ESC/POS sur imprimante réseau (port 9100, « RAW »).
// Epson TM-m30/TM-T20, Star en émulation ESC/POS, Bixolon, Sunmi... :
// tous acceptent les octets tels quels sur ce port. Le ticket est mis en
// forme côté caisse, le pont ne fait que transporter.

import { Socket } from 'node:net'
import { resolveLanHost } from './lan.js'
import { BridgeError } from './protocol.js'

export const DEFAULT_PRINTER_PORT = 9100

// ESC p m t1 t2 : impulsion sur la broche du tiroir (m=0 broche 2, m=1 broche 5),
// t1/t2 en pas de 2 ms. 0x19/0xFA : valeurs usuelles des pilotes Epson.
export function drawerKickBytes(pin: 0 | 1): Buffer {
  return Buffer.from([0x1b, 0x70, pin, 0x19, 0xfa])
}

function describeError(err: NodeJS.ErrnoException, target: string): BridgeError {
  switch (err.code) {
    case 'ECONNREFUSED':
      return new BridgeError('printer_unreachable', `Imprimante injoignable à ${target} (connexion refusée).`)
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
      return new BridgeError('printer_unreachable', `Imprimante injoignable à ${target} (appareil absent du réseau).`)
    case 'ETIMEDOUT':
      return new BridgeError('printer_timeout', `L'imprimante ${target} ne répond pas.`)
    case 'ECONNRESET':
    case 'EPIPE':
      return new BridgeError('printer_reset', `L'imprimante ${target} a coupé la connexion pendant l'envoi.`)
    default:
      return new BridgeError('printer_error', `Erreur d'impression sur ${target} : ${err.code ?? err.message}.`)
  }
}

// Après notre fin d'envoi, l'imprimante ferme normalement sa connexion.
// Certaines la gardent ouverte : passé ce délai, les octets sont partis,
// on considère le travail terminé.
const CLOSE_GRACE_MS = 1500

export function sendRaw(ip: string, port: number, data: Buffer, timeoutMs: number, label = `${ip}:${port}`): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new Socket()
    let done = false
    let grace: NodeJS.Timeout | undefined

    const finish = (err?: BridgeError) => {
      if (done) return
      done = true
      clearTimeout(timer)
      if (grace) clearTimeout(grace)
      socket.destroy()
      if (err) reject(err)
      else resolve()
    }

    const timer = setTimeout(
      () => finish(new BridgeError('printer_timeout', `Délai dépassé : l'imprimante ${label} ne répond pas.`)),
      timeoutMs,
    )

    socket.on('error', (err) => finish(describeError(err, label)))
    // On ignore ce que l'imprimante pourrait renvoyer (statut automatique)
    socket.on('data', () => {})
    socket.on('close', (hadError) => {
      if (!hadError) finish()
    })
    socket.connect({ host: ip, port }, () => {
      socket.setNoDelay(true)
      socket.end(data, () => {
        grace = setTimeout(() => finish(), CLOSE_GRACE_MS)
      })
    })
  })
}

export interface ProbeResult {
  reachable: boolean
  latencyMs: number | null
  message?: string
}

export async function probe(host: string, port: number, timeoutMs: number): Promise<ProbeResult> {
  const ip = await resolveLanHost(host)
  const started = performance.now()
  return new Promise((resolve) => {
    const socket = new Socket()
    const end = (r: ProbeResult) => {
      clearTimeout(timer)
      socket.destroy()
      resolve(r)
    }
    const timer = setTimeout(() => end({ reachable: false, latencyMs: null, message: 'Délai dépassé.' }), timeoutMs)
    socket.on('error', (err) =>
      end({ reachable: false, latencyMs: null, message: describeError(err, `${host}:${port}`).message }),
    )
    socket.connect({ host: ip, port }, () =>
      end({ reachable: true, latencyMs: Math.round(performance.now() - started) }),
    )
  })
}

// File par imprimante : deux tickets envoyés en même temps ne doivent
// jamais s'entremêler sur le papier. Les imprimantes différentes
// travaillent en parallèle.
export class PrinterQueues {
  private tails = new Map<string, Promise<unknown>>()

  run<T>(key: string, job: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(key) ?? Promise.resolve()
    const next = prev.then(job, job)
    const tail = next.catch(() => {})
    this.tails.set(key, tail)
    // Ménage : la file disparaît une fois vide
    void tail.then(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key)
    })
    return next
  }

  get size(): number {
    return this.tails.size
  }

  // Attendre la fin des impressions en cours (arrêt propre)
  async drain(): Promise<void> {
    await Promise.all([...this.tails.values()])
  }
}

export class PrinterService {
  readonly queues = new PrinterQueues()

  async print(host: string, port: number, data: Buffer, timeoutMs: number): Promise<{ bytes: number }> {
    const ip = await resolveLanHost(host)
    const label = `${host}:${port}`
    await this.queues.run(`${ip}:${port}`, () => sendRaw(ip, port, data, timeoutMs, label))
    return { bytes: data.length }
  }

  async openDrawer(host: string, port: number, pin: 0 | 1, timeoutMs: number): Promise<void> {
    await this.print(host, port, drawerKickBytes(pin), timeoutMs)
  }
}
