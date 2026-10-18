import { describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:net'
import { decodeStatus, isStatusByte, readStatus, sendRaw, statusProblem, STATUS_QUERY } from './printer.js'

describe('état ESC/POS (DLE EOT)', () => {
  it('demande les états 1 à 4', () => {
    expect([...STATUS_QUERY]).toEqual([0x10, 0x04, 1, 0x10, 0x04, 2, 0x10, 0x04, 3, 0x10, 0x04, 4])
  })

  it('reconnaît les octets de réponse par leurs bits fixes', () => {
    expect(isStatusByte(0x12)).toBe(true)
    expect(isStatusByte(0x16)).toBe(true) // capot ouvert
    expect(isStatusByte(0x72)).toBe(true) // fin de papier, n = 4
    expect(isStatusByte(0x10)).toBe(false) // premier octet d'un ASB (bit 1 à 0)
    expect(isStatusByte(0x00)).toBe(false)
    expect(isStatusByte(0x92)).toBe(false) // bit 7 à 1
  })

  it('imprimante prête', () => {
    const s = decodeStatus([0x12, 0x12, 0x12, 0x12])
    expect(s).toMatchObject({ known: true, online: true, coverOpen: false, paperEnd: false, paperNearEnd: false, error: false })
    expect(statusProblem(s)).toBeNull()
  })

  it('capot ouvert : passe avant le papier (n = 4 figé capot ouvert)', () => {
    const s = decodeStatus([0x1a, 0x16, 0x12, 0x72])
    expect(s).toMatchObject({ online: false, coverOpen: true })
    expect(s.paperEnd).toBe(false)
    expect(statusProblem(s)?.code).toBe('printer_cover_open')
    expect(statusProblem(s)?.message).toBe("Capot de l'imprimante ouvert. Refermez-le puis réessayez.")
  })

  it('plus de papier : bit 5 de n = 2 ou bits 5 et 6 de n = 4', () => {
    expect(decodeStatus([0x1a, 0x32, 0x12, 0x12]).paperEnd).toBe(true)
    const s = decodeStatus([0x1a, 0x12, 0x12, 0x7e])
    expect(s).toMatchObject({ paperEnd: true, paperNearEnd: true })
    expect(statusProblem(s)?.message).toBe("Plus de papier dans l'imprimante. Changez le rouleau puis réessayez.")
    expect(statusProblem(s, true)?.message).toContain('ticket peut-être incomplet')
  })

  it('papier presque fini : avertissement seulement', () => {
    const s = decodeStatus([0x12, 0x12, 0x12, 0x1e])
    expect(s).toMatchObject({ paperNearEnd: true, paperEnd: false })
    expect(statusProblem(s)).toBeNull()
  })

  it('erreur du coupe-papier et hors ligne', () => {
    const cutter = decodeStatus([0x1a, 0x52, 0x1a, 0x12])
    expect(cutter).toMatchObject({ error: true, cutterError: true })
    expect(statusProblem(cutter)?.code).toBe('printer_error')
    expect(statusProblem(decodeStatus([0x1a, 0x12, 0x12, 0x12]))?.code).toBe('printer_offline')
  })

  it('réponse partielle ou absente', () => {
    expect(decodeStatus([])).toEqual({ known: false, raw: [] })
    expect(statusProblem(decodeStatus([]))).toBeNull()
    expect(decodeStatus([0x12, 0x16])).toMatchObject({ known: true, coverOpen: true })
    expect(decodeStatus([0x32, 0x12], [2, 4])).toMatchObject({ paperEnd: true })
  })
})

// Imprimante qui reçoit tout sans jamais répondre
async function mute(): Promise<{ server: Server; port: number; received: () => Buffer }> {
  const chunks: Buffer[] = []
  const server = createServer({ allowHalfOpen: true }, (s) => {
    s.on('data', (c) => chunks.push(c))
    s.on('end', () => s.end())
    s.on('error', () => {})
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
  return { server, port: (server.address() as { port: number }).port, received: () => Buffer.concat(chunks) }
}

describe('envoi avec lecture d’état', () => {
  it('imprimante muette : attend le délai puis imprime sans bloquer', async () => {
    const m = await mute()
    const started = Date.now()
    const r = await sendRaw('127.0.0.1', m.port, Buffer.from([0x1b, 0x40]), 5000, undefined, { checkStatus: true, statusTimeoutMs: 120 })
    const took = Date.now() - started
    expect(r.status.known).toBe(false)
    expect(r.after).toBeUndefined()
    expect(took).toBeGreaterThanOrEqual(110)
    expect(took).toBeLessThan(1500)
    expect([...m.received()]).toEqual([...STATUS_QUERY, 0x1b, 0x40])
    await new Promise((r) => m.server.close(r))
  })

  it('readStatus : état inconnu si pas de réponse', async () => {
    const m = await mute()
    expect(await readStatus('127.0.0.1', m.port, 3000, undefined, 80)).toEqual({ known: false, raw: [] })
    await new Promise((r) => m.server.close(r))
  })
})
