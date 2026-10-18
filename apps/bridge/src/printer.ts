// Impression brute ESC/POS sur imprimante réseau (port 9100, « RAW »).
// Epson TM-m30/TM-T20, Star en émulation ESC/POS, Bixolon, Sunmi... :
// tous acceptent les octets tels quels sur ce port. Le ticket est mis en
// forme côté caisse ; le pont transporte et lit l'état de l'imprimante.

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

// État de l'imprimante lu en temps réel avant le ticket : DLE EOT n
// (0x10 0x04 n), une réponse d'un octet par demande, traitée dès réception,
// même hors ligne ou en erreur.
//
// Sources (signification des bits) :
// - Epson, ESC/POS Command Reference, DLE EOT :
//   https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/dle_eot.html
// - Epson, TM-T20II ESC/POS Quick Reference, « Status Commands » (n = 1 à 4)
// - Star, Line Thermal Printer ESC/POS Mode Command Specifications Rev. 2.52,
//   6-2-3 « DLE EOT Status » (bits fixes, fin proche du rouleau en n = 4) :
//   https://www.starmicronics.com/support/Mannualfolder/escpos_cm_en.pdf
//
//   n = 1 état de l'imprimante : bit 3 = hors ligne
//   n = 2 cause de l'arrêt     : bit 2 = capot ouvert, bit 3 = avance par le bouton,
//                                bit 5 = impression arrêtée faute de papier, bit 6 = erreur
//   n = 3 cause de l'erreur    : bit 3 = coupe-papier, bit 5 = erreur irrécupérable,
//                                bit 6 = erreur récupérable d'elle-même
//   n = 4 capteurs du rouleau  : bits 2 et 3 = fin proche, bits 5 et 6 = plus de papier
//   Bits fixes des quatre réponses : bit 0 = 0, bit 1 = 1, bit 4 = 1, bit 7 = 0.
//   Capot ouvert : Epson garde dans n = 4 les valeurs lues capot fermé ;
//   le capot passe donc avant le papier.
const DLE = 0x10
const EOT = 0x04
export const STATUS_QUERY = Buffer.from([DLE, EOT, 1, DLE, EOT, 2, DLE, EOT, 3, DLE, EOT, 4])
// Après le ticket : cause d'arrêt et capteurs du rouleau
const AFTER_ORDER = [2, 4]
const AFTER_QUERY = Buffer.from([DLE, EOT, 2, DLE, EOT, 4])

// Une réponse DLE EOT a ses bits fixes (0xx1xx10) : on écarte ainsi les
// octets d'un statut automatique (ASB) ou d'un écho parasite.
export const isStatusByte = (b: number) => (b & 0x93) === 0x12

export interface PrinterStatus {
  // false : l'imprimante n'a pas répondu (modèle sans retour d'état) ; le
  // ticket part quand même, sans confirmation
  known: boolean
  online?: boolean
  coverOpen?: boolean
  paperEnd?: boolean
  paperNearEnd?: boolean
  // Erreur du mécanisme ou du coupe-papier
  error?: boolean
  cutterError?: boolean
  unrecoverable?: boolean
  // Octets reçus, dans l'ordre des demandes
  raw: number[]
}

// bytes[i] : réponse à la i-ème demande de `order` (n = 1 à 4)
export function decodeStatus(bytes: number[], order: number[] = [1, 2, 3, 4]): PrinterStatus {
  const s: PrinterStatus = { known: bytes.length > 0, raw: bytes }
  bytes.forEach((b, i) => {
    switch (order[i]) {
      case 1:
        s.online = (b & 0x08) === 0
        break
      case 2:
        s.coverOpen = (b & 0x04) !== 0
        s.paperEnd = !!s.paperEnd || (b & 0x20) !== 0
        s.error = !!s.error || (b & 0x40) !== 0
        break
      case 3:
        s.cutterError = (b & 0x08) !== 0
        s.unrecoverable = (b & 0x20) !== 0
        s.error = !!s.error || (b & 0x68) !== 0
        break
      case 4:
        // Capot ouvert : valeurs d'avant l'ouverture, on ne s'y fie pas
        if (!s.coverOpen) {
          s.paperNearEnd = (b & 0x0c) !== 0
          s.paperEnd = !!s.paperEnd || (b & 0x60) !== 0
        }
        break
    }
  })
  return s
}

export const PAPER_NEAR_END_WARNING = 'Papier presque fini : prévoyez un rouleau.'

// Ce qui empêche d'imprimer, dans l'ordre où le vendeur doit agir.
// after : état relu une fois le ticket envoyé (ticket peut-être incomplet).
export function statusProblem(s: PrinterStatus, after = false): BridgeError | null {
  if (!s.known) return null
  if (s.coverOpen) {
    return new BridgeError(
      'printer_cover_open',
      after
        ? "Capot de l'imprimante ouvert pendant l'impression : ticket peut-être incomplet. Refermez-le et vérifiez avant de réimprimer."
        : "Capot de l'imprimante ouvert. Refermez-le puis réessayez.",
    )
  }
  if (s.paperEnd) {
    return new BridgeError(
      'printer_no_paper',
      after
        ? "Plus de papier dans l'imprimante : ticket peut-être incomplet. Changez le rouleau et vérifiez avant de réimprimer."
        : "Plus de papier dans l'imprimante. Changez le rouleau puis réessayez.",
    )
  }
  if (s.error) {
    return new BridgeError(
      'printer_error',
      s.cutterError
        ? "Imprimante en erreur (coupe-papier). Retirez le papier coincé, éteignez et rallumez l'imprimante, puis réessayez."
        : "Imprimante en erreur. Éteignez et rallumez l'imprimante, puis réessayez.",
    )
  }
  if (s.online === false) {
    return new BridgeError('printer_offline', 'Imprimante hors ligne. Vérifiez son voyant puis réessayez.')
  }
  return null
}

// Après notre fin d'envoi, l'imprimante ferme normalement sa connexion.
// Certaines la gardent ouverte : passé ce délai, les octets sont partis,
// on considère le travail terminé.
const CLOSE_GRACE_MS = 1500
// Délai de réponse à DLE EOT : une imprimante qui donne son état répond en
// quelques millisecondes ; au-delà, état inconnu, on imprime sans bloquer
export const DEFAULT_STATUS_TIMEOUT_MS = 500
// Laisse l'imprimante commencer le ticket avant de relire son état
export const DEFAULT_SETTLE_MS = 400

export interface SendOptions {
  // Lire l'état avant et après le ticket (pas pour l'impulsion du tiroir)
  checkStatus?: boolean
  statusTimeoutMs?: number
  settleMs?: number
}

export interface SendResult {
  // État lu avant l'envoi
  status: PrinterStatus
  // État relu après l'envoi (seulement si l'imprimante a répondu avant)
  after?: PrinterStatus
}

export function sendRaw(
  ip: string,
  port: number,
  data: Buffer,
  timeoutMs: number,
  label = `${ip}:${port}`,
  opts: SendOptions = {},
): Promise<SendResult> {
  const statusTimeoutMs = opts.statusTimeoutMs ?? DEFAULT_STATUS_TIMEOUT_MS
  const settleMs = opts.settleMs ?? DEFAULT_SETTLE_MS
  return new Promise((resolve, reject) => {
    const socket = new Socket()
    let done = false
    let grace: NodeJS.Timeout | undefined
    let settle: NodeJS.Timeout | undefined
    let sent = false
    // Demande d'état en attente de ses octets de réponse
    let wait: { want: number; got: number[]; timer: NodeJS.Timeout; end: () => void } | null = null
    const result: SendResult = { status: { known: false, raw: [] } }

    const finish = (err?: BridgeError) => {
      if (done) return
      done = true
      clearTimeout(timer)
      if (grace) clearTimeout(grace)
      if (settle) clearTimeout(settle)
      if (wait) clearTimeout(wait.timer)
      socket.destroy()
      if (err) reject(err)
      else resolve(result)
    }

    const timer = setTimeout(
      () => finish(new BridgeError('printer_timeout', `Délai dépassé : l'imprimante ${label} ne répond pas.`)),
      timeoutMs,
    )

    const ask = (query: Buffer, want: number) =>
      new Promise<number[]>((res) => {
        const got: number[] = []
        const end = () => {
          if (wait) clearTimeout(wait.timer)
          wait = null
          res(got)
        }
        wait = { want, got, timer: setTimeout(end, statusTimeoutMs), end }
        socket.write(query)
      })

    const endWith = (last?: Buffer) => {
      const armGrace = () => {
        grace = setTimeout(() => finish(), CLOSE_GRACE_MS)
      }
      if (last) socket.end(last, armGrace)
      else socket.end(armGrace)
    }

    socket.on('error', (err) => finish(describeError(err, label)))
    // Seuls les octets d'état DLE EOT comptent ; le reste (ASB) est ignoré
    socket.on('data', (chunk: Buffer) => {
      if (!wait) return
      for (const b of chunk) if (isStatusByte(b) && wait.got.length < wait.want) wait.got.push(b)
      if (wait.got.length >= wait.want) wait.end()
    })
    // Fermeture par l'imprimante : normale une fois le ticket parti
    socket.on('close', (hadError) => {
      if (!hadError) finish(sent ? undefined : new BridgeError('printer_reset', `L'imprimante ${label} a coupé la connexion avant le ticket.`))
    })

    const run = async () => {
      if (opts.checkStatus) {
        result.status = decodeStatus(await ask(STATUS_QUERY, 4))
        if (done) return
        const problem = statusProblem(result.status)
        if (problem) return finish(problem)
      }
      // Imprimante muette (ou impulsion du tiroir) : envoi comme avant
      sent = true
      if (!result.status.known) return endWith(data)
      socket.write(data)
      await new Promise((r) => (settle = setTimeout(r, settleMs)))
      if (done) return
      const after = await ask(AFTER_QUERY, AFTER_ORDER.length)
      if (done) return
      if (after.length) {
        result.after = decodeStatus(after, AFTER_ORDER)
        const problem = statusProblem(result.after, true)
        if (problem) return finish(problem)
      }
      endWith()
    }

    socket.connect({ host: ip, port }, () => {
      socket.setNoDelay(true)
      void run()
    })
  })
}

// Lecture seule de l'état (réglages, diagnostic)
export function readStatus(
  ip: string,
  port: number,
  timeoutMs: number,
  label = `${ip}:${port}`,
  statusTimeoutMs = DEFAULT_STATUS_TIMEOUT_MS,
): Promise<PrinterStatus> {
  return new Promise((resolve, reject) => {
    const socket = new Socket()
    const got: number[] = []
    let done = false
    let answer: NodeJS.Timeout | undefined
    const finish = (err?: BridgeError) => {
      if (done) return
      done = true
      clearTimeout(timer)
      if (answer) clearTimeout(answer)
      socket.destroy()
      if (err) reject(err)
      else resolve(decodeStatus(got))
    }
    const timer = setTimeout(
      () => finish(new BridgeError('printer_timeout', `Délai dépassé : l'imprimante ${label} ne répond pas.`)),
      timeoutMs,
    )
    socket.on('error', (err) => finish(describeError(err, label)))
    socket.on('data', (chunk: Buffer) => {
      for (const b of chunk) if (isStatusByte(b) && got.length < 4) got.push(b)
      if (got.length >= 4) finish()
    })
    socket.on('close', () => finish())
    socket.connect({ host: ip, port }, () => {
      socket.setNoDelay(true)
      socket.write(STATUS_QUERY)
      answer = setTimeout(() => finish(), statusTimeoutMs)
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

export interface PrintResult {
  bytes: number
  status: PrinterStatus
  // Avertissement à montrer sans bloquer (papier presque fini)
  warning?: string
}

export class PrinterService {
  readonly queues = new PrinterQueues()

  constructor(private readonly opts: Omit<SendOptions, 'checkStatus'> = {}) {}

  async print(host: string, port: number, data: Buffer, timeoutMs: number): Promise<PrintResult> {
    const ip = await resolveLanHost(host)
    const label = `${host}:${port}`
    const r = await this.queues.run(`${ip}:${port}`, () =>
      sendRaw(ip, port, data, timeoutMs, label, { ...this.opts, checkStatus: true }),
    )
    const nearEnd = r.status.paperNearEnd || r.after?.paperNearEnd
    return { bytes: data.length, status: r.status, ...(nearEnd ? { warning: PAPER_NEAR_END_WARNING } : {}) }
  }

  async status(host: string, port: number, timeoutMs: number): Promise<PrinterStatus> {
    const ip = await resolveLanHost(host)
    return this.queues.run(`${ip}:${port}`, () =>
      readStatus(ip, port, timeoutMs, `${host}:${port}`, this.opts.statusTimeoutMs),
    )
  }

  // L'impulsion du tiroir part sans lecture d'état : elle ne doit pas attendre
  async openDrawer(host: string, port: number, pin: 0 | 1, timeoutMs: number): Promise<void> {
    const ip = await resolveLanHost(host)
    await this.queues.run(`${ip}:${port}`, () =>
      sendRaw(ip, port, drawerKickBytes(pin), timeoutMs, `${host}:${port}`),
    )
  }
}
