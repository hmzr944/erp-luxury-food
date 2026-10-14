import { request } from 'node:http'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { createPendingCode } from './pairing.js'
import { findAttribute, TAG_JOB } from './ipp.js'
import { fakePrinter, ORIGIN, pairClient, startBridge, startFakeIpp, TestClient, type FakePrinter } from './test-utils.js'

type Bridge = Awaited<ReturnType<typeof startBridge>>

function httpGet(port: number, path: string, headers: Record<string, string> = {}, method = 'GET') {
  return new Promise<{ status: number; headers: Record<string, unknown>; body: string }>((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method, headers }, (res) => {
      let body = ''
      res.on('data', (c) => (body += c))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }))
    })
    req.on('error', reject)
    req.end()
  })
}

describe('serveur du pont', () => {
  let b: Bridge
  let printers: FakePrinter[] = []

  beforeEach(async () => {
    b = await startBridge()
  })
  afterEach(async () => {
    await Promise.all(printers.map((p) => p.close()))
    printers = []
    await b.stop()
  })

  describe('HTTP', () => {
    it('/health répond avec nom, version et capacités, CORS pour une origine autorisée', async () => {
      const r = await httpGet(b.server.port, '/health', { Origin: ORIGIN })
      expect(r.status).toBe(200)
      const body = JSON.parse(r.body)
      expect(body.name).toBe('FLŌW-Bridge')
      expect(body.capabilities).toContain('printer.escpos')
      expect(body.capabilities).toContain('printer.discover')
      expect(body.capabilities).toContain('printer.ipp')
      expect(r.headers['access-control-allow-origin']).toBe(ORIGIN)
    })

    it("/health n'envoie pas d'en-tête CORS pour une origine inconnue", async () => {
      const r = await httpGet(b.server.port, '/health', { Origin: 'https://pirate.example' })
      expect(r.status).toBe(200)
      expect(r.headers['access-control-allow-origin']).toBeUndefined()
    })

    it('accepte la pré-requête Private Network Access des origines autorisées', async () => {
      const r = await httpGet(
        b.server.port,
        '/health',
        { Origin: ORIGIN, 'Access-Control-Request-Private-Network': 'true' },
        'OPTIONS',
      )
      expect(r.status).toBe(204)
      expect(r.headers['access-control-allow-private-network']).toBe('true')
      const bad = await httpGet(b.server.port, '/health', { Origin: 'https://pirate.example' }, 'OPTIONS')
      expect(bad.status).toBe(403)
    })

    it('refuse un en-tête Host étranger (DNS rebinding)', async () => {
      const r = await httpGet(b.server.port, '/health', { Host: 'pirate.example:51717' })
      expect(r.status).toBe(403)
    })
  })

  describe('origine et authentification', () => {
    it('ferme avec 4003 une connexion venant d’une origine non autorisée', async () => {
      const ws = new WebSocket(b.server.url, { origin: 'https://pirate.example' })
      const code = await new Promise<number>((resolve) => ws.on('close', (c) => resolve(c)))
      expect(code).toBe(4003)
    })

    it('ferme avec 4003 une connexion sans origine', async () => {
      const ws = new WebSocket(b.server.url)
      const code = await new Promise<number>((resolve) => ws.on('close', (c) => resolve(c)))
      expect(code).toBe(4003)
    })

    it('exige une authentification pour les méthodes du matériel', async () => {
      const c = await TestClient.open(b.server.url)
      const r = await c.call('bridge.info')
      expect(r.error?.code).toBe('unauthorized')
      const p = await c.call('printer.print', { host: '127.0.0.1', data: 'AA==' })
      expect(p.error?.code).toBe('unauthorized')
      expect((await c.call('printer.discover')).error?.code).toBe('unauthorized')
      expect((await c.call('printer.printDocument', { host: '127.0.0.1', data: 'AA==' })).error?.code).toBe('unauthorized')
      c.close()
    })

    it('gère JSON invalide, requête mal formée et méthode inconnue sans planter', async () => {
      const c = await TestClient.open(b.server.url)
      const bad = await c.sendRaw('{pas du json')
      expect(bad.error?.code).toBe('parse_error')
      const inv = await c.sendRaw(JSON.stringify({ method: 'bridge.info' }))
      expect(inv.error?.code).toBe('invalid_request')
      const unk = await c.call('nexiste.pas')
      expect(unk.error?.code).toBe('unknown_method')
      const proto = await c.call('__proto__')
      expect(proto.error?.code).toBe('unknown_method')
      c.close()
    })
  })

  describe('appairage', () => {
    it('affiche un code au démarrage quand aucune caisse n’est appairée', () => {
      expect(b.server.pairing.currentCode).toMatch(/^\d{6}$/)
    })

    it('échange le bon code contre un jeton, stocké seulement haché', async () => {
      const { client, token } = await pairClient(b.server.url, b.server)
      expect(Buffer.from(token, 'base64url')).toHaveLength(32)
      const stored = b.server.store.listClients()
      expect(stored).toHaveLength(1)
      expect(stored[0].name).toBe('Caisse test')
      expect(JSON.stringify(stored)).not.toContain(token)
      // Code à usage unique
      expect(b.server.pairing.currentCode).toBeNull()
      // La connexion qui vient d'appairer est authentifiée
      const info = await client.call('bridge.info')
      expect(info.result).toMatchObject({ name: 'FLŌW-Bridge', platform: process.platform })
      client.close()
    })

    it('authentifie une nouvelle connexion avec bridge.hello, refuse un faux jeton', async () => {
      const { client, token } = await pairClient(b.server.url, b.server)
      client.close()
      const c2 = await TestClient.open(b.server.url)
      const bad = await c2.call('bridge.hello', { token: 'faux' })
      expect(bad.error?.code).toBe('invalid_token')
      const ok = await c2.call('bridge.hello', { token })
      expect(ok.result).toMatchObject({ name: 'Caisse test' })
      expect((await c2.call('bridge.info')).result).toBeTruthy()
      c2.close()
    })

    it('invalide le code après 5 essais ratés et en affiche un nouveau', async () => {
      const c = await TestClient.open(b.server.url)
      const first = b.server.pairing.currentCode!
      const wrong = first === '000000' ? '111111' : '000000'
      for (let i = 1; i <= 4; i++) {
        const r = await c.call('bridge.pair', { code: wrong, name: 'X' })
        expect(r.error?.code).toBe('pairing_code_invalid')
      }
      const fifth = await c.call('bridge.pair', { code: wrong, name: 'X' })
      expect(fifth.error?.code).toBe('pairing_code_invalidated')
      const second = b.server.pairing.currentCode!
      expect(second).toMatch(/^\d{6}$/)
      // L'ancien code ne marche plus (sauf tirage identique, improbable)
      if (second !== first) {
        const old = await c.call('bridge.pair', { code: first, name: 'X' })
        expect(old.error?.code).toBe('pairing_code_invalid')
      }
      const ok = await c.call('bridge.pair', { code: second, name: 'Caisse 2' })
      expect(ok.result).toHaveProperty('token')
      c.close()
    })

    it('impose une pause après trop d’essais ratés', async () => {
      await b.stop()
      b = await startBridge({ pairing: { lockMs: 60_000 } })
      const c = await TestClient.open(b.server.url)
      for (let i = 0; i < 5; i++) await c.call('bridge.pair', { code: 'abcdef', name: 'X' })
      const r = await c.call('bridge.pair', { code: b.server.pairing.currentCode, name: 'X' })
      expect(r.error?.code).toBe('pairing_locked')
      c.close()
    })

    it('accepte un code créé par « flow-bridge pair » pendant que le pont tourne', async () => {
      await pairClient(b.server.url, b.server).then(({ client }) => client.close())
      const c = await TestClient.open(b.server.url)
      expect((await c.call('bridge.pair', { code: '123456', name: 'X' })).error?.code).toBe('pairing_closed')
      const code = createPendingCode(b.server.store)
      const r = await c.call('bridge.pair', { code: `${code.slice(0, 3)} ${code.slice(3)}`, name: 'Caisse 2' })
      expect(r.result).toHaveProperty('token')
      expect(b.server.store.readPendingPairing()).toBeNull()
      c.close()
    })

    it('bridge.unpair supprime le jeton de la connexion', async () => {
      const { client, token } = await pairClient(b.server.url, b.server)
      expect((await client.call('bridge.unpair')).result).toEqual({ ok: true })
      expect(b.server.store.listClients()).toHaveLength(0)
      expect((await client.call('bridge.info')).error?.code).toBe('unauthorized')
      expect((await client.call('bridge.hello', { token })).error?.code).toBe('invalid_token')
      // Plus aucune caisse : un nouveau code est proposé
      expect(b.server.pairing.currentCode).toMatch(/^\d{6}$/)
      client.close()
    })
  })

  describe('imprimante et tiroir', () => {
    it('envoie les octets exacts du ticket à l’imprimante', async () => {
      const p = await fakePrinter()
      printers.push(p)
      const { client } = await pairClient(b.server.url, b.server)
      const ticket = Buffer.from([0x1b, 0x40, ...Buffer.from('Bonjour FLŌW\n', 'latin1'), 0x1d, 0x56, 0x00, 0xff, 0x00])
      const r = await client.call('printer.print', { host: '127.0.0.1', port: p.port, data: ticket.toString('base64') })
      expect(r.result).toEqual({ ok: true, bytes: ticket.length })
      expect(p.jobs[0].equals(ticket)).toBe(true)
      client.close()
    })

    it('ouvre le tiroir avec ESC p m t1 t2', async () => {
      const p = await fakePrinter()
      printers.push(p)
      const { client } = await pairClient(b.server.url, b.server)
      expect((await client.call('drawer.open', { host: '127.0.0.1', port: p.port })).result).toEqual({ ok: true })
      expect([...p.jobs[0]]).toEqual([0x1b, 0x70, 0x00, 0x19, 0xfa])
      await client.call('drawer.open', { host: '127.0.0.1', port: p.port, pin: 1 })
      expect([...p.jobs[1]]).toEqual([0x1b, 0x70, 0x01, 0x19, 0xfa])
      client.close()
    })

    it('refuse une adresse publique (pas de relais TCP vers Internet)', async () => {
      const { client } = await pairClient(b.server.url, b.server)
      for (const host of ['8.8.8.8', '1.1.1.1', 'example.com', '172.32.0.1']) {
        const r = await client.call('printer.print', { host, data: 'AA==' })
        expect(r.error?.code).toBe('host_not_allowed')
      }
      expect((await client.call('drawer.open', { host: '93.184.216.34' })).error?.code).toBe('host_not_allowed')
      expect((await client.call('printer.probe', { host: '8.8.8.8' })).error?.code).toBe('host_not_allowed')
      client.close()
    })

    it('traduit une connexion refusée en message français', async () => {
      const p = await fakePrinter()
      const port = p.port
      await p.close()
      const { client } = await pairClient(b.server.url, b.server)
      const r = await client.call('printer.print', { host: '127.0.0.1', port, data: 'AA==' })
      expect(r.error?.code).toBe('printer_unreachable')
      expect(r.error?.message).toContain(`Imprimante injoignable à 127.0.0.1:${port}`)
      client.close()
    })

    it('refuse des données qui ne sont pas du base64', async () => {
      const { client } = await pairClient(b.server.url, b.server)
      const r = await client.call('printer.print', { host: '127.0.0.1', data: 'pas du base64 !' })
      expect(r.error?.code).toBe('invalid_params')
      client.close()
    })

    it('sonde une imprimante joignable et une injoignable', async () => {
      const p = await fakePrinter()
      printers.push(p)
      const { client } = await pairClient(b.server.url, b.server)
      const ok = await client.call('printer.probe', { host: '127.0.0.1', port: p.port })
      expect(ok.result).toMatchObject({ reachable: true })
      expect(typeof (ok.result as { latencyMs: number }).latencyMs).toBe('number')
      const dead = await fakePrinter()
      const deadPort = dead.port
      await dead.close()
      const ko = await client.call('printer.probe', { host: '127.0.0.1', port: deadPort })
      expect(ko.result).toMatchObject({ reachable: false, latencyMs: null })
      client.close()
    })

    it('sérialise les tickets d’une même imprimante, sans les entremêler', async () => {
      const p = await fakePrinter({ holdMs: 150 })
      printers.push(p)
      const { client } = await pairClient(b.server.url, b.server)
      const a = Buffer.alloc(2000, 0x41).toString('base64')
      const bb = Buffer.alloc(2000, 0x42).toString('base64')
      const [r1, r2] = await Promise.all([
        client.call('printer.print', { host: '127.0.0.1', port: p.port, data: a }),
        client.call('printer.print', { host: '127.0.0.1', port: p.port, data: bb }),
      ])
      expect(r1.result).toBeTruthy()
      expect(r2.result).toBeTruthy()
      // La 2e connexion ne s'ouvre qu'une fois la 1re terminée
      expect(p.log).toEqual(['open0', 'close0', 'open1', 'close1'])
      expect(p.jobs[0].every((x) => x === 0x41)).toBe(true)
      expect(p.jobs[1].every((x) => x === 0x42)).toBe(true)
      client.close()
    })
  })

  describe('impression A4 (IPP)', () => {
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\n%%EOF\n')

    it('vérifie le format puis envoie le PDF par Print-Job', async () => {
      const ipp = await startFakeIpp()
      const { client } = await pairClient(b.server.url, b.server)
      try {
        const r = await client.call('printer.printDocument', {
          host: '127.0.0.1',
          port: ipp.port,
          data: pdf.toString('base64'),
          jobName: 'Facture F-2026-0001',
          copies: 2,
        })
        expect(r.result).toEqual({ ok: true, jobId: 123, printer: 'HP LaserJet Pro M404' })
        expect(ipp.requests.map((q) => q.msg.code)).toEqual([0x000b, 0x0002])
        const job = ipp.requests[1]
        expect(job.contentType).toBe('application/ipp')
        expect(findAttribute(job.msg, 'printer-uri')?.values).toEqual([`ipp://127.0.0.1:${ipp.port}/ipp/print`])
        expect(findAttribute(job.msg, 'job-name')?.values).toEqual(['Facture F-2026-0001'])
        expect(findAttribute(job.msg, 'copies', TAG_JOB)?.values).toEqual([2])
        expect(job.msg.data?.equals(pdf)).toBe(true)
      } finally {
        client.close()
        await ipp.close()
      }
    })

    it('suit le chemin rp annoncé par la découverte', async () => {
      const ipp = await startFakeIpp({ path: '/printers/bureau' })
      const { client } = await pairClient(b.server.url, b.server)
      try {
        const r = await client.call('printer.printDocument', { host: '127.0.0.1', port: ipp.port, path: 'printers/bureau', data: pdf.toString('base64') })
        expect(r.result).toMatchObject({ ok: true })
        const ko = await client.call('printer.printDocument', { host: '127.0.0.1', port: ipp.port, data: pdf.toString('base64') })
        expect(ko.error?.code).toBe('printer_error')
        expect(ko.error?.message).toContain('HTTP 404')
      } finally {
        client.close()
        await ipp.close()
      }
    })

    it('refuse une imprimante qui ne lit pas le PDF', async () => {
      const ipp = await startFakeIpp({ formats: ['image/urf', 'image/pwg-raster'] })
      const { client } = await pairClient(b.server.url, b.server)
      try {
        const r = await client.call('printer.printDocument', { host: '127.0.0.1', port: ipp.port, data: pdf.toString('base64') })
        expect(r.error?.code).toBe('format_unsupported')
        expect(r.error?.message).toContain("fenêtre d'impression du navigateur")
        expect(r.error?.message).not.toContain('—')
        // Aucun travail envoyé
        expect(ipp.requests).toHaveLength(1)
      } finally {
        client.close()
        await ipp.close()
      }
    })

    it('traduit un statut IPP d’erreur', async () => {
      const ipp = await startFakeIpp({ printStatus: 0x0507 })
      const { client } = await pairClient(b.server.url, b.server)
      try {
        const r = await client.call('printer.printDocument', { host: '127.0.0.1', port: ipp.port, data: pdf.toString('base64') })
        expect(r.error?.code).toBe('printer_busy')
        expect(r.error?.message).toContain('server-error-busy')
      } finally {
        client.close()
        await ipp.close()
      }
    })

    it('refuse adresse publique, non-PDF et paramètres invalides', async () => {
      const { client } = await pairClient(b.server.url, b.server)
      const data = pdf.toString('base64')
      expect((await client.call('printer.printDocument', { host: '8.8.8.8', data })).error?.code).toBe('host_not_allowed')
      expect((await client.call('printer.printDocument', { host: 'imprimante.example.com', data })).error?.code).toBe('host_not_allowed')
      const notPdf = await client.call('printer.printDocument', { host: '127.0.0.1', data: Buffer.from('bonjour').toString('base64') })
      expect(notPdf.error).toMatchObject({ code: 'invalid_params', message: "Le document n'est pas un PDF." })
      expect((await client.call('printer.printDocument', { host: '127.0.0.1', data, copies: 50 })).error?.code).toBe('invalid_params')
      expect((await client.call('printer.printDocument', { host: '127.0.0.1', data, tls: 'oui' })).error?.code).toBe('invalid_params')
      expect((await client.call('printer.printDocument', { host: '127.0.0.1', data, path: '/../x?y' })).error?.code).toBe('invalid_params')
      client.close()
    })

    it('connexion refusée : message français', async () => {
      const ipp = await startFakeIpp()
      const port = ipp.port
      await ipp.close()
      const { client } = await pairClient(b.server.url, b.server)
      const r = await client.call('printer.printDocument', { host: '127.0.0.1', port, data: pdf.toString('base64') })
      expect(r.error?.code).toBe('printer_unreachable')
      expect(r.error?.message).toContain(`127.0.0.1:${port}`)
      client.close()
    })
  })

  describe('découverte des imprimantes', () => {
    it('printer.discover passe par les accès réseau injectés', async () => {
      await b.stop()
      const scanned: string[] = []
      b = await startBridge({
        discovery: {
          interfaces: () => [{ address: '10.0.0.5', netmask: '255.255.255.0' }],
          createSocket: () => ({ on: () => {}, bind: (_a, cb) => cb(), send: () => {}, close: () => {} }),
          connect: async (ip) => {
            scanned.push(ip)
            return ip === '10.0.0.9'
          },
        },
      })
      const { client } = await pairClient(b.server.url, b.server)
      const r = await client.call('printer.discover', { timeoutMs: 500 })
      expect(r.result).toEqual({ printers: [{ name: '10.0.0.9', host: '10.0.0.9', port: 9100, protocols: ['escpos'], source: 'scan' }] })
      expect(scanned).toHaveLength(253)
      const noScan = await client.call('printer.discover', { timeoutMs: 500, scan: false })
      expect(noScan.result).toEqual({ printers: [] })
      expect((await client.call('printer.discover', { timeoutMs: 60_000 })).error?.code).toBe('invalid_params')
      client.close()
    })
  })

  describe('paiement', () => {
    it('simulateur : paiement accepté avec événements de progression', async () => {
      const { client } = await pairClient(b.server.url, b.server)
      const r = await client.call('payment.start', { adapter: 'simulator', amountCents: 4250, currency: 'EUR', reference: 'V-1' })
      expect(r.result).toMatchObject({ status: 'approved' })
      const res = r.result as { authorizationCode: string; paymentId: string }
      expect(res.authorizationCode).toMatch(/^\d{6}$/)
      const messages = client.events.filter((e) => e.event === 'payment.progress').map((e) => (e.data as { message: string }).message)
      expect(messages).toContain('Présentez la carte')
      expect(messages).toContain('Code saisi')
      const st = await client.call('payment.status', { paymentId: res.paymentId })
      expect(st.result).toMatchObject({ state: 'done', result: { status: 'approved' } })
      client.close()
    })

    it('simulateur : les montants en ,13 sont refusés', async () => {
      const { client } = await pairClient(b.server.url, b.server)
      const r = await client.call('payment.start', { adapter: 'simulator', amountCents: 1013 })
      expect(r.result).toMatchObject({ status: 'declined' })
      client.close()
    })

    it('un seul paiement à la fois par terminal, annulation par identifiant', async () => {
      const { client } = await pairClient(b.server.url, b.server)
      const pending = client.call('payment.start', { adapter: 'simulator', amountCents: 500, paymentId: 'p-1' })
      await new Promise((r) => setTimeout(r, 20))
      const busy = await client.call('payment.start', { adapter: 'simulator', amountCents: 500 })
      expect(busy.error?.code).toBe('payment_busy')
      expect((await client.call('payment.status', { paymentId: 'p-1' })).result).toEqual({ state: 'pending' })
      const cancel = await client.call('payment.cancel', { paymentId: 'p-1' })
      expect(cancel.result).toMatchObject({ accepted: true })
      expect((await pending).result).toMatchObject({ status: 'cancelled', paymentId: 'p-1' })
      client.close()
    })

    it('refuse un terminal inconnu', async () => {
      const { client } = await pairClient(b.server.url, b.server)
      const r = await client.call('payment.start', { adapter: 'magique', amountCents: 100 })
      expect(r.error?.code).toBe('unknown_adapter')
      client.close()
    })
  })
})
