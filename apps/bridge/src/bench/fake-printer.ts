// Fausse imprimante réseau ESC/POS (port 9100, « RAW ») pour le banc
// d'essai : chaque connexion est un travail d'impression, lu et rendu en
// texte avec le tiroir, la coupe et les caractères mal codés.

import { createServer, type Server } from 'node:net'
import { readEscPos, type EscPosReading } from './escpos-reader.js'

export interface FakePrinterOptions {
  port?: number
  host?: string
  onJob: (reading: EscPosReading, raw: Uint8Array) => void
}

export function startFakePrinter(opts: FakePrinterOptions): Promise<Server> {
  const server = createServer((socket) => {
    const chunks: Buffer[] = []
    socket.on('data', (c: Buffer) => chunks.push(c))
    socket.on('end', () => {
      const raw = new Uint8Array(Buffer.concat(chunks))
      if (raw.length) opts.onJob(readEscPos(raw), raw)
    })
    socket.on('error', () => socket.destroy())
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(opts.port ?? 9100, opts.host ?? '0.0.0.0', () => resolve(server))
  })
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
