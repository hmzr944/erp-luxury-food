import { X509Certificate } from 'node:crypto'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { mkdtempSync, rmSync } from 'node:fs'
import { networkInterfaces, tmpdir } from 'node:os'
import { join } from 'node:path'
import { connect } from 'node:tls'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { ensureCertificates, type TlsMaterial } from './cert.js'
import { CLOSE_INSECURE_LAN } from './server.js'
import { ORIGIN, startBridge, TestClient } from './test-utils.js'

type Bridge = Awaited<ReturnType<typeof startBridge>>

const NAMES = { dns: ['localhost'], ips: ['127.0.0.1', '::1'] }

// Une adresse non locale de cette machine, pour simuler un iPad du réseau
function externalIPv4(): string | null {
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) return a.address
  }
  return null
}
const EXTERNAL = externalIPv4()

function get(url: string, opts: { ca?: string; headers?: Record<string, string> } = {}) {
  return new Promise<{ status: number; headers: Record<string, unknown>; body: Buffer }>((resolve, reject) => {
    const u = new URL(url)
    const fn = u.protocol === 'https:' ? httpsRequest : httpRequest
    const req = fn(
      { host: u.hostname, port: u.port, path: u.pathname, headers: { Host: `localhost:${u.port}`, ...opts.headers }, ca: opts.ca, servername: 'localhost' },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }))
      },
    )
    req.on('error', reject)
    req.end()
  })
}

function waitClose(ws: WebSocket): Promise<number> {
  return new Promise((resolve) => ws.once('close', (code) => resolve(code)))
}

describe('pont en TLS (wss://)', () => {
  let tlsHome: string
  let material: TlsMaterial
  let b: Bridge

  beforeAll(() => {
    tlsHome = mkdtempSync(join(tmpdir(), 'flow-bridge-tls-srv-'))
    material = ensureCertificates(tlsHome, { names: NAMES })
  })
  afterAll(() => rmSync(tlsHome, { recursive: true, force: true }))

  beforeEach(async () => {
    b = await startBridge({ refreshTls: () => ensureCertificates(tlsHome, { names: NAMES }) }, { tls: material })
  })
  afterEach(async () => {
    await b.stop()
  })

  it('wss:// avec l’autorité du pont : connexion vérifiée, appairage, hello', async () => {
    const url = `wss://localhost:${b.server.port}`
    const client = await TestClient.open(url, ORIGIN, { ca: material.ca!.pem, rejectUnauthorized: true })
    const code = b.server.pairing.currentCode!
    const paired = await client.call('bridge.pair', { code, name: 'iPad' })
    expect(paired.error).toBeUndefined()
    const hello = await client.call('bridge.hello', { token: (paired.result as { token: string }).token })
    expect((hello.result as { capabilities: string[] }).capabilities).toContain('bridge.tls')
    client.close()
  })

  it('wss:// sans l’autorité : refusé par le client (certificat inconnu)', async () => {
    const ws = new WebSocket(`wss://localhost:${b.server.port}`, { origin: ORIGIN, rejectUnauthorized: true })
    const err = await new Promise<Error>((resolve) => ws.once('error', resolve))
    expect(String((err as NodeJS.ErrnoException).code ?? err.message)).toMatch(/SELF_SIGNED|UNABLE_TO_VERIFY|unable to verify/i)
  })

  it('ws:// reste accepté sur le même port depuis cet ordinateur (Chrome, Edge, Firefox)', async () => {
    const client = await TestClient.open(`ws://127.0.0.1:${b.server.port}`)
    const r = await client.call('bridge.hello', { token: 'inconnu' })
    expect(r.error?.code).toBe('invalid_token')
    client.close()
  })

  it('le certificat présenté est celui du pont, émis par son autorité', async () => {
    const peer = await new Promise<Buffer>((resolve, reject) => {
      const s = connect({ host: '127.0.0.1', port: b.server.port, servername: 'localhost', ca: material.ca!.pem }, () => {
        resolve(s.getPeerX509Certificate()!.raw)
        s.end()
      })
      s.on('error', reject)
    })
    expect(new X509Certificate(peer).checkIssued(new X509Certificate(material.ca!.pem))).toBe(true)
  })

  it('sert le certificat de l’autorité en .cer, en PEM et en profil iOS, en clair comme en TLS', async () => {
    const port = b.server.port
    const cer = await get(`http://127.0.0.1:${port}/certificat/flow-bridge.cer`)
    expect(cer.status).toBe(200)
    expect(cer.headers['content-type']).toBe('application/x-x509-ca-cert')
    expect(cer.body.equals(material.ca!.der)).toBe(true)
    const profile = await get(`https://127.0.0.1:${port}/certificat`, { ca: material.ca!.pem })
    expect(profile.headers['content-type']).toBe('application/x-apple-aspen-config')
    expect(profile.body.toString()).toContain('com.apple.security.root')
    const pem = await get(`http://127.0.0.1:${port}/certificat/flow-bridge.pem`)
    expect(pem.body.toString()).toBe(material.ca!.pem)
    const home = await get(`https://127.0.0.1:${port}/`, { ca: material.ca!.pem })
    expect(home.body.toString()).toContain('Connexion chiffrée établie')
    expect(home.headers['content-security-policy']).toContain("default-src 'none'")
    const plainHome = await get(`http://127.0.0.1:${port}/`)
    expect(plainHome.body.toString()).toContain('Connexion non chiffrée')
    expect(plainHome.body.toString()).toContain(material.ca!.fingerprint)
  })

  it('/health répond aussi en https', async () => {
    const r = await get(`https://127.0.0.1:${b.server.port}/health`, { ca: material.ca!.pem, headers: { Origin: ORIGIN } })
    expect(r.status).toBe(200)
    expect(JSON.parse(r.body.toString()).tls).toBe(true)
  })

  it('refuse un Host étranger (DNS rebinding), même en TLS', async () => {
    const r = await get(`https://127.0.0.1:${b.server.port}/health`, { ca: material.ca!.pem, headers: { Host: 'pirate.example' } })
    expect(r.status).toBe(403)
  })

  it('bridge.info décrit la connexion sécurisée et l’accès réseau', async () => {
    const client = await TestClient.open(`ws://127.0.0.1:${b.server.port}`)
    const paired = await client.call('bridge.pair', { code: b.server.pairing.currentCode!, name: 'Mac' })
    expect(paired.error).toBeUndefined()
    const info = await client.call('bridge.info')
    const network = (info.result as { network: { lan: boolean; tls: boolean; certificate: { fingerprint: string } } }).network
    expect(network.lan).toBe(false)
    expect(network.tls).toBe(true)
    expect(network.certificate.fingerprint).toBe(material.ca!.fingerprint)
    client.close()
  })

  it('recharge un certificat renouvelé sans redémarrer', async () => {
    // Le pont lit le dossier tlsHome : on y force un nouveau certificat serveur
    ensureCertificates(tlsHome, { names: { ...NAMES, ips: [...NAMES.ips, '10.9.8.7'] } })
    let next: TlsMaterial | null = null
    b.server['opts'].refreshTls = () => (next = ensureCertificates(tlsHome, { names: { ...NAMES, ips: [...NAMES.ips, '10.9.8.7'] } }))
    expect(b.server.refreshCertificate()).toBe(true)
    const peer = await new Promise<X509Certificate>((resolve, reject) => {
      const s = connect({ host: '127.0.0.1', port: b.server.port, servername: 'localhost', ca: material.ca!.pem }, () => {
        resolve(s.getPeerX509Certificate()!)
        s.end()
      })
      s.on('error', reject)
    })
    expect(peer.checkIP('10.9.8.7')).toBe('10.9.8.7')
    expect(next).not.toBeNull()
    // Rien de neuf : pas de rechargement
    expect(b.server.refreshCertificate()).toBe(false)
  })

  describe.runIf(EXTERNAL)('accès réseau (iPad)', () => {
    // servername : SNI et vérification du nom « localhost » (transmis tel quel à tls.connect par ws)
    const lanTls = () => ({ ca: material.ca!.pem, servername: 'localhost' }) as WebSocket.ClientOptions
    async function openLan(scheme: 'ws' | 'wss') {
      await b.server.setLan(true)
      return new WebSocket(`${scheme}://${EXTERNAL}:${b.server.port}`, {
        origin: ORIGIN,
        headers: { Host: `localhost:${b.server.port}` },
        ...lanTls(),
      })
    }

    it('fermé par défaut : injoignable depuis une autre adresse', async () => {
      const ws = new WebSocket(`wss://${EXTERNAL}:${b.server.port}`, { origin: ORIGIN, ...lanTls() })
      const err = await new Promise<NodeJS.ErrnoException>((resolve) => ws.once('error', resolve))
      expect(err.code).toBe('ECONNREFUSED')
    })

    it('ouvert : wss accepté, ws en clair refusé (4004)', async () => {
      const plain = await openLan('ws')
      expect(await waitClose(plain)).toBe(CLOSE_INSECURE_LAN)
      const secure = await openLan('wss')
      await new Promise((resolve, reject) => secure.once('open', resolve).once('error', reject))
      secure.close()
    })

    it('depuis le réseau : /health masqué, certificat téléchargeable', async () => {
      await b.server.setLan(true)
      const health = await get(`http://${EXTERNAL}:${b.server.port}/health`)
      expect(health.status).toBe(404)
      const cer = await get(`http://${EXTERNAL}:${b.server.port}/certificat/flow-bridge.cer`)
      expect(cer.status).toBe(200)
    })

    it('limite les essais d’appairage par appareil et interdit bridge.setLan depuis le réseau', async () => {
      await b.server.setLan(true)
      const c = await TestClient.open(`wss://${EXTERNAL}:${b.server.port}`, ORIGIN, {
        headers: { Host: `localhost:${b.server.port}` },
        ...lanTls(),
      })
      const codes: string[] = []
      for (let i = 0; i < 11; i++) {
        const r = await c.call('bridge.pair', { code: '000000', name: 'x' })
        codes.push(r.error!.code)
      }
      expect(codes.at(-1)).toBe('rate_limited')
      // Même appairé, un iPad ne peut pas changer l'accès réseau
      const mac = await TestClient.open(`ws://127.0.0.1:${b.server.port}`)
      const paired = await mac.call('bridge.pair', { code: b.server.pairing.currentCode ?? b.server.pairing.renew(), name: 'Mac' })
      const hello = await c.call('bridge.hello', { token: (paired.result as { token: string }).token })
      expect(hello.error).toBeUndefined()
      const setLan = await c.call('bridge.setLan', { enabled: false })
      expect(setLan.error?.code).toBe('forbidden')
      mac.close()
      c.close()
    })

    it('se referme : les iPad connectés sont coupés', async () => {
      const secure = await openLan('wss')
      await new Promise((resolve, reject) => secure.once('open', resolve).once('error', reject))
      const closed = waitClose(secure)
      await b.server.setLan(false)
      await closed
      expect(b.server.lanEnabled).toBe(false)
    })
  })

  it('bridge.setLan depuis cet ordinateur ouvre l’accès et le mémorise', async () => {
    let saved: boolean | null = null
    b.server['opts'].persistLan = (v) => (saved = v)
    const client = await TestClient.open(`ws://127.0.0.1:${b.server.port}`)
    await client.call('bridge.pair', { code: b.server.pairing.currentCode!, name: 'Mac' })
    const r = await client.call('bridge.setLan', { enabled: true })
    expect((r.result as { lan: boolean }).lan).toBe(true)
    expect(saved).toBe(true)
    // L'ordinateur lui-même reste joignable après le changement d'écoute
    const again = await TestClient.open(`ws://127.0.0.1:${b.server.port}`)
    again.close()
    client.close()
  })
})
