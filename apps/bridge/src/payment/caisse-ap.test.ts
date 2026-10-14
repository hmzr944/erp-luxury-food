import { createServer, type Server } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { buildRequest, CaisseApAdapter, decodeMessage, encodeMessage, interpretAnswer } from './caisse-ap.js'

describe('Caisse-AP : format des messages', () => {
  it('encode TAG + longueur sur 3 chiffres + valeur, CZ en premier', () => {
    expect(encodeMessage({ CA: '01', CZ: '0300', CB: '1250' })).toBe('CZ0040300CA00201CB0041250')
  })

  it('décode un message complet et attend la suite d’un message tronqué', () => {
    expect(decodeMessage('CZ0040300AE00210')).toEqual({ CZ: '0300', AE: '10' })
    expect(decodeMessage('CZ0040300AE0021')).toBeNull()
    expect(decodeMessage('CZ004')).toBeNull()
  })

  it('construit une demande de débit en euros', () => {
    const req = buildRequest(1250, 'EUR', { host: '192.168.1.60' })
    expect(req).toEqual({ CZ: '0300', CJ: '012345678901', CA: '01', CE: '978', CD: '0', CB: '1250' })
    expect(buildRequest(500, 'EUR', { host: 'x', refund: true, mode: 'check' })).toMatchObject({ CD: '1', CC: '00C' })
    expect(() => buildRequest(100, 'GBP', { host: 'x' })).toThrow()
  })

  it('interprète succès, refus, abandon et réponse incohérente', () => {
    const req = buildRequest(1250, 'EUR', { host: 'x' })
    const ok = interpretAnswer({ AE: '10', CA: '01', CD: '0', CE: '978', CB: '000000001250', CC: '00B', CI: '2', AA: '123' }, req)
    expect(ok).toMatchObject({ status: 'approved', cardType: 'CB sans contact - sans contact' })
    expect(ok.transactionId).toBe('AA-123|CD-0')
    expect(interpretAnswer({ AE: '01', AF: '04' }, req)).toMatchObject({ status: 'declined', message: 'Paiement non abouti : Refusée.' })
    expect(interpretAnswer({ AE: '01', AF: '11' }, req)).toMatchObject({ status: 'cancelled' })
    expect(interpretAnswer({ AE: '10', CA: '01', CD: '0', CE: '978', CB: '999' }, req)).toMatchObject({ status: 'error' })
  })
})

describe('Caisse-AP : échange TCP avec un faux TPE', () => {
  let server: Server | undefined
  afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())))

  it('envoie la demande et lit une réponse arrivée en deux morceaux', async () => {
    let received = ''
    server = createServer((s) => {
      s.setEncoding('ascii')
      s.on('data', (d: string) => {
        received += d
        const answer = encodeMessage({ CZ: '0300', AE: '10', CA: '01', CD: '0', CE: '978', CB: '00000750', CC: '001' })
        s.write(answer.slice(0, 10))
        setTimeout(() => s.end(answer.slice(10)), 30)
      })
    })
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', () => r()))
    const port = (server.address() as { port: number }).port
    const events: string[] = []
    const adapter = new CaisseApAdapter({ host: '127.0.0.1', port })
    const r = await adapter.start(750, 'EUR', 'V-1', (e) => events.push(e.step))
    expect(received).toBe('CZ0040300CJ012012345678901CA00201CE003978CD0010CB003750')
    expect(r).toMatchObject({ status: 'approved', cardType: 'CB contact' })
    expect(events).toContain('card_wait')
    expect(adapter.cancel().accepted).toBe(false)
  })
})
