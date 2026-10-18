import { afterEach, describe, expect, it } from 'vitest'
import { connect, type Server } from 'node:net'
import { readEscPos } from './escpos-reader.js'
import { startFakePrinter, describeJob, describeState, type FakePrinterState } from './fake-printer.js'
import { sendRaw } from '../printer.js'
import { startFakeTpe } from './fake-tpe.js'
import { CaisseApAdapter } from '../payment/caisse-ap.js'

let servers: Server[] = []
afterEach(async () => {
  await Promise.all(servers.map((s) => new Promise((r) => s.close(r))))
  servers = []
})

// Ce que la caisse envoie (apps/web/src/lib/printing/escpos.ts) : init, PC858, tiroir, texte, QR, coupe
const ESC = 0x1b, GS = 0x1d
const ticket = new Uint8Array([
  ESC, 0x40, ESC, 0x74, 19, ESC, 0x70, 0, 0x19, 0xfa,
  ESC, 0x61, 1, ESC, 0x45, 1, GS, 0x21, 1, ...Buffer.from('Caf', 'latin1'), 0x82, 0x0a,
  ESC, 0x45, 0, ...Buffer.from('Total 12,50 ', 'latin1'), 0xd5, 0x0a,
  GS, 0x28, 0x6b, 0x0b, 0x00, 0x31, 0x50, 0x30, ...Buffer.from('https:/x'), 0x0a,
  ESC, 0x64, 1, 0xff, 0x0a, GS, 0x56, 0x42, 0x00,
])

describe('lecture ESC/POS', () => {
  it('rend le texte, les accents, le tiroir, le QR et la coupe', () => {
    const r = readEscPos(ticket)
    expect(r.lines.slice(0, 2)).toEqual(['Café', 'Total 12,50 €'])
    expect(r.codepage).toBe(19)
    expect(r.drawer).toEqual([{ pin: 2, onMs: 50, offMs: 500 }])
    expect(r.qr).toEqual(['https:/x'])
    expect(r.cuts).toBe(1)
    expect(r.unknownBytes).toEqual([0xff])
    expect(describeJob(r)).toContain('Tiroir : impulsion broche 2')
  })
})

describe('banc d’essai réseau', () => {
  it('la fausse imprimante reçoit un travail sur le port RAW', async () => {
    let got: string[] = []
    const s = await startFakePrinter({ port: 0, host: '127.0.0.1', onJob: (r) => (got = r.lines) })
    servers.push(s)
    const port = (s.address() as { port: number }).port
    await new Promise<void>((done) => {
      const c = connect(port, '127.0.0.1', () => c.end(Buffer.from(ticket)))
      c.on('close', () => setTimeout(done, 20))
    })
    expect(got[0]).toBe('Café')
  })

  it('le faux TPE accepte, puis refuse un montant en ,13, avec le vrai adaptateur Caisse-AP', async () => {
    const s = await startFakeTpe({ port: 0, host: '127.0.0.1', delayMs: 10 })
    servers.push(s)
    const port = (s.address() as { port: number }).port
    const tpe = new CaisseApAdapter({ host: '127.0.0.1', port })
    const ok = await tpe.start(1250, 'EUR', 'v1', () => {})
    expect(ok.status).toBe('approved')
    const ko = await tpe.start(1213, 'EUR', 'v2', () => {})
    expect(ko).toMatchObject({ status: 'declined' })
  })

  it('la fausse imprimante répond à DLE EOT selon son état, de bout en bout avec le pont', async () => {
    const state: FakePrinterState = {}
    const jobs: Array<{ lines: string[]; queries: number }> = []
    const s = await startFakePrinter({ port: 0, host: '127.0.0.1', state: () => state, onJob: (r, _raw, info) => jobs.push({ lines: r.lines, queries: info.queries }) })
    servers.push(s)
    const port = (s.address() as { port: number }).port
    const send = () => sendRaw('127.0.0.1', port, Buffer.from(ticket), 5000, undefined, { checkStatus: true, settleMs: 10 })

    const ok = await send()
    expect(ok.status).toMatchObject({ known: true, online: true, paperEnd: false })
    await new Promise((r) => setTimeout(r, 20))
    expect(jobs[0]).toMatchObject({ queries: 6 })
    expect(jobs[0].lines[0]).toBe('Café')

    state.paperEnd = true
    expect(describeState(state)).toBe('sans papier')
    await expect(send()).rejects.toMatchObject({ code: 'printer_no_paper' })
    state.paperEnd = false
    state.coverOpen = true
    await expect(send()).rejects.toMatchObject({ code: 'printer_cover_open' })
    state.coverOpen = false
    state.paperNearEnd = true
    expect((await send()).status.paperNearEnd).toBe(true)
    state.silent = true
    expect((await send()).status.known).toBe(false)
    await new Promise((r) => setTimeout(r, 20))
    // Seuls les tickets acceptés sont « imprimés » : prête, presque fini, muette
    expect(jobs).toHaveLength(3)
  })
})
