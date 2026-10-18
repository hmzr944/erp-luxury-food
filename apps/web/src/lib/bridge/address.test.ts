import { afterEach, describe, expect, it, vi } from 'vitest'
import { bridgePageUrl, bridgeUrls, formatBridgeAddress, parseBridgeAddress } from './address'
import { BridgeClient, probeBridge } from './client'
import { detectBridgePlatform } from './platform'

describe('adresse du pont', () => {
  it('vide : cet ordinateur, wss puis ws', () => {
    const a = parseBridgeAddress('')!
    expect(a).toEqual({ host: '127.0.0.1', port: 51717, local: true })
    expect(bridgeUrls(a)).toEqual(['wss://127.0.0.1:51717', 'ws://127.0.0.1:51717'])
    expect(formatBridgeAddress(a)).toBe('')
  })

  it('adresse du réseau : wss seulement', () => {
    const a = parseBridgeAddress(' 192.168.1.20 ')!
    expect(a.local).toBe(false)
    expect(bridgeUrls(a)).toEqual(['wss://192.168.1.20:51717'])
    expect(bridgePageUrl(a, '/certificat')).toBe('http://192.168.1.20:51717/certificat')
    expect(bridgePageUrl(a, '/', true)).toBe('https://192.168.1.20:51717/')
  })

  it('accepte port, schéma et nom .local ; refuse le reste', () => {
    expect(parseBridgeAddress('https://Caisse.local:51800/')).toEqual({ host: 'caisse.local', port: 51800, local: false })
    expect(formatBridgeAddress(parseBridgeAddress('caisse.local:51800')!)).toBe('caisse.local:51800')
    expect(parseBridgeAddress('localhost')!.local).toBe(true)
    expect(parseBridgeAddress('192.168.1.300')).toBeNull()
    expect(parseBridgeAddress('caisse local')).toBeNull()
    expect(parseBridgeAddress('10.0.0.2:99999')).toBeNull()
    expect(parseBridgeAddress('javascript:alert(1)')).toBeNull()
    // Jamais vers Internet : le jeton d'appairage ne doit pas en sortir
    expect(parseBridgeAddress('8.8.8.8')).toBeNull()
    expect(parseBridgeAddress('pont.example.com')).toBeNull()
    expect(parseBridgeAddress('172.20.0.4')!.host).toBe('172.20.0.4')
  })
})

describe('navigateur à guider', () => {
  const SAFARI_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15'
  const CHROME_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
  it('distingue Safari Mac, iPad (même déguisé en Mac), iPhone et les autres', () => {
    expect(detectBridgePlatform(SAFARI_MAC, 0)).toBe('macos-safari')
    expect(detectBridgePlatform(SAFARI_MAC, 5)).toBe('ipados')
    expect(detectBridgePlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/141.0 Mobile/15E148 Safari/604.1')).toBe('ios')
    expect(detectBridgePlatform(CHROME_MAC, 0)).toBe('other')
    expect(detectBridgePlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0')).toBe('other')
  })
})

// Faux WebSocket : wss échoue (certificat non approuvé), ws répond
class FakeSocket {
  static OPEN = 1
  static instances: FakeSocket[] = []
  static behaviour: (url: string) => 'open' | 'fail' | 'throw' = () => 'open'
  readyState = 0
  onopen: (() => void) | null = null
  onclose: ((ev: { code: number }) => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  sent: string[] = []
  constructor(readonly url: string) {
    const b = FakeSocket.behaviour(url)
    if (b === 'throw') throw new Error('SecurityError')
    FakeSocket.instances.push(this)
    setTimeout(() => {
      if (b === 'open') {
        this.readyState = 1
        this.onopen?.()
      } else this.onclose?.({ code: 1006 })
    }, 0)
  }
  send(text: string) {
    this.sent.push(text)
    const msg = JSON.parse(text) as { id: number; method: string }
    if (msg.method === 'bridge.hello') {
      setTimeout(() => this.onmessage?.({ data: JSON.stringify({ id: msg.id, error: { code: 'invalid_token', message: 'x' } }) }), 0)
    }
  }
  close() {
    this.readyState = 3
  }
}

describe('client du pont', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    FakeSocket.instances = []
  })

  it('essaie wss puis se replie sur ws, et le dit', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('WebSocket', FakeSocket)
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })
    FakeSocket.behaviour = (url) => (url.startsWith('wss:') ? 'fail' : 'open')
    const c = new BridgeClient(['wss://127.0.0.1:51717', 'ws://127.0.0.1:51717'])
    c.connect()
    await vi.waitFor(() => expect(c.status).toBe('unpaired'))
    expect(FakeSocket.instances.map((s) => s.url)).toEqual(['wss://127.0.0.1:51717', 'ws://127.0.0.1:51717'])
    expect(c.url).toBe('ws://127.0.0.1:51717')
    expect(c.secure).toBe(false)
    c.disconnect()
  })

  it('wss accepté : connexion sécurisée, sans essayer ws', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('WebSocket', FakeSocket)
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })
    FakeSocket.behaviour = () => 'open'
    const c = new BridgeClient(['wss://127.0.0.1:51717', 'ws://127.0.0.1:51717'])
    c.connect()
    await vi.waitFor(() => expect(c.status).toBe('unpaired'))
    expect(FakeSocket.instances).toHaveLength(1)
    expect(c.secure).toBe(true)
    c.disconnect()
  })

  it('test de connexion : appairage nécessaire, ou échec', async () => {
    vi.stubGlobal('WebSocket', FakeSocket)
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })
    FakeSocket.behaviour = () => 'open'
    expect(await probeBridge('wss://192.168.1.20:51717')).toBe('pairing')
    FakeSocket.behaviour = () => 'fail'
    expect(await probeBridge('wss://192.168.1.20:51717')).toBe('failed')
    FakeSocket.behaviour = () => 'throw'
    expect(await probeBridge('ws://192.168.1.20:51717')).toBe('failed')
  })
})
