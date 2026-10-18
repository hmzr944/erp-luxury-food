// Fausse imprimante réseau ESC/POS (port 9100, « RAW ») pour le banc
// d'essai : chaque connexion est un travail d'impression, lu et rendu en
// texte avec le tiroir, la coupe et les caractères mal codés. Elle répond
// aux demandes d'état DLE EOT n comme une Epson, selon un état réglable
// (papier, capot, fin de rouleau proche, hors ligne, ou muette).

import { createServer, type Server } from 'node:net'
import { readEscPos, type EscPosReading } from './escpos-reader.js'

export interface FakePrinterState {
  paperEnd?: boolean
  paperNearEnd?: boolean
  coverOpen?: boolean
  // Hors ligne sans autre cause (bouton, attente de reprise)
  offline?: boolean
  // Erreur du coupe-papier
  cutterError?: boolean
  // Ne répond pas aux demandes d'état (modèle sans retour d'état)
  silent?: boolean
}

// Octet de réponse à DLE EOT n, mêmes bits que le décodage du pont
// (src/printer.ts, sources Epson et Star citées là-bas). Bits fixes 0xx1xx10.
export function statusByte(n: number, s: FakePrinterState): number | null {
  const fixed = 0x12
  const stopped = !!(s.paperEnd || s.coverOpen || s.cutterError)
  switch (n) {
    case 1:
      return fixed | (s.offline || stopped ? 0x08 : 0)
    case 2:
      return fixed | (s.coverOpen ? 0x04 : 0) | (s.paperEnd ? 0x20 : 0) | (s.cutterError ? 0x40 : 0)
    case 3:
      return fixed | (s.cutterError ? 0x08 : 0)
    case 4:
      return fixed | (s.paperNearEnd || s.paperEnd ? 0x0c : 0) | (s.paperEnd ? 0x60 : 0)
    default:
      return null
  }
}

// Repère les DLE EOT n d'un flux (même coupé entre deux paquets), renvoie
// les réponses à envoyer et le flux sans ces demandes
export function statusResponder(getState: () => FakePrinterState) {
  let pending: number[] = []
  return (chunk: Buffer): { reply: Buffer; payload: Buffer; queries: number } => {
    const bytes = [...pending, ...chunk]
    pending = []
    const reply: number[] = []
    const payload: number[] = []
    let queries = 0
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0x10 && (i + 1 >= bytes.length || bytes[i + 1] === 0x04)) {
        if (i + 2 >= bytes.length) {
          pending = bytes.slice(i)
          break
        }
        const n = bytes[i + 2]
        if (n >= 1 && n <= 4) {
          queries++
          const s = getState()
          const b = s.silent ? null : statusByte(n, s)
          if (b !== null) reply.push(b)
          i += 2
          continue
        }
      }
      payload.push(bytes[i])
    }
    return { reply: Buffer.from(reply), payload: Buffer.from(payload), queries }
  }
}

export interface FakePrinterOptions {
  port?: number
  host?: string
  // État courant, relu à chaque demande (modifiable pendant le banc)
  state?: FakePrinterState | (() => FakePrinterState)
  // queries : nombre de demandes d'état reçues pendant le travail
  onJob: (reading: EscPosReading, raw: Uint8Array, info: { queries: number; state: FakePrinterState }) => void
}

export function startFakePrinter(opts: FakePrinterOptions): Promise<Server> {
  const getState = typeof opts.state === 'function' ? opts.state : () => (opts.state as FakePrinterState | undefined) ?? {}
  // allowHalfOpen : comme une vraie imprimante, la connexion reste ouverte
  // pour répondre aux demandes d'état jusqu'à la fin du ticket
  const server = createServer({ allowHalfOpen: true }, (socket) => {
    const chunks: Buffer[] = []
    const respond = statusResponder(getState)
    let queries = 0
    socket.on('data', (c: Buffer) => {
      const { reply, payload, queries: q } = respond(c)
      queries += q
      if (reply.length) socket.write(reply)
      if (payload.length) chunks.push(payload)
    })
    socket.on('end', () => {
      const raw = new Uint8Array(Buffer.concat(chunks))
      if (raw.length) opts.onJob(readEscPos(raw), raw, { queries, state: { ...getState() } })
      socket.end()
    })
    socket.on('error', () => socket.destroy())
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(opts.port ?? 9100, opts.host ?? '0.0.0.0', () => resolve(server))
  })
}

// État lisible, pour le terminal du banc
export function describeState(s: FakePrinterState): string {
  if (s.silent) return 'muette (ne donne pas son état)'
  const parts: string[] = []
  if (s.coverOpen) parts.push('capot ouvert')
  if (s.paperEnd) parts.push('sans papier')
  else if (s.paperNearEnd) parts.push('papier presque fini')
  if (s.cutterError) parts.push('erreur du coupe-papier')
  if (s.offline) parts.push('hors ligne')
  return parts.length ? parts.join(', ') : 'prête'
}

// Compte rendu lisible d'un travail reçu
export function describeJob(r: EscPosReading): string {
  const width = Math.max(32, ...r.lines.map((l) => l.length))
  const rule = '+' + '-'.repeat(width + 2) + '+'
  const out = [rule, ...r.lines.map((l) => `| ${l.padEnd(width)} |`), rule]
  out.push(`Page de code : ${r.codepage === 19 ? 'PC858 (accents et €)' : r.codepage === null ? 'non choisie' : `n° ${r.codepage}`}`)
  for (const d of r.drawer) out.push(`Tiroir : impulsion broche ${d.pin}, ${d.onMs} ms`)
  if (!r.drawer.length) out.push('Tiroir : aucune impulsion')
  out.push(`Coupe du papier : ${r.cuts ? 'oui' : 'non'}`)
  for (const q of r.qr) out.push(`QR code : ${q}`)
  if (r.unknownBytes.length) out.push(`Attention : ${r.unknownBytes.length} caractère(s) hors PC858, imprimés « ? »`)
  if (r.unknownCommands.length) out.push(`Commandes non reconnues : ${[...new Set(r.unknownCommands)].join(', ')}`)
  return out.join('\n')
}
