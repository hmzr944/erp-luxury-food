import { describe, expect, it } from 'vitest'
import { TYPE_A, TYPE_PTR, TYPE_SRV } from './dns.js'
import { discoverPrinters, MDNS_ADDRESS, MDNS_PORT, subnetHosts, type DiscoveryDeps, type MdnsSocket } from './discovery.js'

// Réponse mDNS minimale sans compression : PTR + SRV + A
function response(): Buffer {
  const name = (s: string) => Buffer.concat([...s.split('.').map((l) => Buffer.concat([Buffer.from([l.length]), Buffer.from(l)])), Buffer.from([0])])
  const rr = (n: string, type: number, rdata: Buffer) => {
    const h = Buffer.alloc(10)
    h.writeUInt16BE(type, 0)
    h.writeUInt16BE(1, 2)
    h.writeUInt32BE(120, 4)
    h.writeUInt16BE(rdata.length, 8)
    return Buffer.concat([name(n), h, rdata])
  }
  const head = Buffer.from([0, 0, 0x84, 0, 0, 0, 0, 1, 0, 0, 0, 2])
  const srv = Buffer.concat([Buffer.from([0, 0, 0, 0, 0x23, 0x8c]), name('star.local')])
  return Buffer.concat([
    head,
    rr('_pdl-datastream._tcp.local', TYPE_PTR, name('Star mC-Print3._pdl-datastream._tcp.local')),
    rr('Star mC-Print3._pdl-datastream._tcp.local', TYPE_SRV, srv),
    rr('star.local', TYPE_A, Buffer.from([192, 168, 1, 77])),
  ])
}

function fakeDeps(open: string[]): DiscoveryDeps & { sent: Array<{ port: number; address: string }>; scanned: string[] } {
  const sent: Array<{ port: number; address: string }> = []
  const scanned: string[] = []
  return {
    sent,
    scanned,
    interfaces: () => [{ address: '192.168.1.10', netmask: '255.255.0.0' }],
    createSocket: () => {
      let onMessage: ((m: Buffer, r: { address: string }) => void) | undefined
      const s: MdnsSocket = {
        on: ((event: string, cb: never) => {
          if (event === 'message') onMessage = cb
        }) as MdnsSocket['on'],
        bind: (_a, cb) => cb(),
        send: (_msg, port, address) => {
          sent.push({ port, address })
          if (sent.length === 1) setTimeout(() => onMessage?.(response(), { address: '192.168.1.77' }), 10)
        },
        close: () => {},
      }
      return s
    },
    connect: async (ip) => {
      scanned.push(ip)
      return open.includes(ip)
    },
  }
}

describe('sous-réseaux à balayer', () => {
  it('limite un grand réseau privé au /24 de l’adresse, sans soi-même', () => {
    const hosts = subnetHosts('192.168.1.10', '255.255.0.0')
    expect(hosts).toHaveLength(253)
    expect(hosts[0]).toBe('192.168.1.1')
    expect(hosts.at(-1)).toBe('192.168.1.254')
    expect(hosts).not.toContain('192.168.1.10')
  })

  it('garde un sous-réseau plus petit qu’un /24', () => {
    expect(subnetHosts('10.1.2.130', '255.255.255.192')).toHaveLength(61)
    expect(subnetHosts('10.1.2.130', '255.255.255.254')).toEqual([])
  })

  it('ne balaie jamais une plage publique ni le lien local', () => {
    expect(subnetHosts('8.8.8.8', '255.255.255.0')).toEqual([])
    expect(subnetHosts('169.254.3.4', '255.255.0.0')).toEqual([])
    expect(subnetHosts('172.32.0.5', '255.255.255.0')).toEqual([])
  })
})

describe('découverte', () => {
  it('combine mDNS et balayage du port 9100', async () => {
    const deps = fakeDeps(['192.168.1.77', '192.168.1.200'])
    const r = await discoverPrinters({ timeoutMs: 100 }, deps)
    expect(deps.sent[0]).toEqual({ port: MDNS_PORT, address: MDNS_ADDRESS })
    expect(deps.scanned).toHaveLength(253)
    expect(r.printers).toEqual([
      { name: 'Star mC-Print3', host: '192.168.1.77', port: 9100, protocols: ['escpos'], source: 'mdns' },
      { name: '192.168.1.200', host: '192.168.1.200', port: 9100, protocols: ['escpos'], source: 'scan' },
    ])
  })

  it('sans balayage si scan: false', async () => {
    const deps = fakeDeps(['192.168.1.200'])
    const r = await discoverPrinters({ timeoutMs: 100, scan: false }, deps)
    expect(deps.scanned).toEqual([])
    expect(r.printers.map((p) => p.host)).toEqual(['192.168.1.77'])
  })
})
