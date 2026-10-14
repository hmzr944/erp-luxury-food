import { describe, expect, it } from 'vitest'
import {
  buildPtrQuery,
  mergePrinters,
  parseDnsPacket,
  PRINTER_SERVICES,
  printersFromRecords,
  TYPE_A,
  TYPE_PTR,
  TYPE_SRV,
  TYPE_TXT,
  type ReceivedRecord,
} from './dns.js'

// Petit assembleur de paquets DNS de réponse, avec pointeurs de compression explicites
class PacketWriter {
  bytes: number[] = []
  get offset() {
    return this.bytes.length
  }
  u16(v: number) {
    this.bytes.push(v >> 8, v & 255)
  }
  u32(v: number) {
    this.u16(v >>> 16)
    this.u16(v & 0xffff)
  }
  // Étiquettes puis, soit un pointeur, soit la fin du nom. Renvoie l'offset du nom.
  name(labels: string[], pointer?: number): number {
    const start = this.offset
    for (const l of labels) {
      const b = Buffer.from(l, 'utf8')
      this.bytes.push(b.length, ...b)
    }
    if (pointer !== undefined) this.u16(0xc000 | pointer)
    else this.bytes.push(0)
    return start
  }
  // En-tête de ressource ; rdata écrit ensuite par fill(), longueur corrigée après
  record(writeName: () => void, type: number, ttl: number, fill: () => void) {
    writeName()
    this.u16(type)
    this.u16(0x8001) // IN + cache flush
    this.u32(ttl)
    const lenAt = this.offset
    this.u16(0)
    const start = this.offset
    fill()
    const len = this.offset - start
    this.bytes[lenAt] = len >> 8
    this.bytes[lenAt + 1] = len & 255
  }
  buffer() {
    return Buffer.from(this.bytes)
  }
}

function header(w: PacketWriter, an: number, ar: number) {
  w.u16(0)
  w.u16(0x8400)
  w.u16(0)
  w.u16(an)
  w.u16(0)
  w.u16(ar)
}

// Réponse type d'une imprimante ticket : PTR + SRV/TXT/A en « additional », noms compressés
function escposResponse(): Buffer {
  const w = new PacketWriter()
  header(w, 1, 3)
  let service = 0
  let instance = 0
  let target = 0
  let local = 0
  w.record(
    () => {
      service = w.name(['_pdl-datastream', '_tcp', 'local'])
      local = service + 1 + '_pdl-datastream'.length + 1 + '_tcp'.length
    },
    TYPE_PTR,
    4500,
    () => {
      instance = w.name(['EPSON TM-m30 (Caisse)'], service)
    },
  )
  w.record(() => w.name([], instance), TYPE_SRV, 120, () => {
    w.u16(0)
    w.u16(0)
    w.u16(9100)
    target = w.name(['EPSON-TM'], local)
  })
  w.record(() => w.name([], instance), TYPE_TXT, 4500, () => {
    for (const s of ['txtvers=1', 'ty=EPSON TM-m30', 'product=(TM-m30)']) {
      const b = Buffer.from(s)
      w.bytes.push(b.length, ...b)
    }
  })
  w.record(() => w.name([], target), TYPE_A, 120, () => w.bytes.push(192, 168, 1, 50))
  return w.buffer()
}

function ippResponse(opts: { withA: boolean }): Buffer {
  const w = new PacketWriter()
  header(w, 1, opts.withA ? 3 : 2)
  let instance = 0
  let local = 0
  let target = 0
  w.record(
    () => {
      const s = w.name(['_ipp', '_tcp', 'local'])
      local = s + 1 + 4 + 1 + 4
      instance = s // remplacé ci-dessous
    },
    TYPE_PTR,
    4500,
    () => {
      instance = w.name(['HP LaserJet Bureau'], instance)
    },
  )
  w.record(() => w.name([], instance), TYPE_SRV, 120, () => {
    w.u16(0)
    w.u16(0)
    w.u16(631)
    target = w.name(['hp-bureau'], local)
  })
  w.record(() => w.name([], instance), TYPE_TXT, 4500, () => {
    for (const s of ['rp=ipp/print', 'ty=HP LaserJet Pro M404', 'URF=W8,SRGB24,RS600', 'pdl=application/pdf']) {
      const b = Buffer.from(s)
      w.bytes.push(b.length, ...b)
    }
  })
  if (opts.withA) w.record(() => w.name([], target), TYPE_A, 120, () => w.bytes.push(10, 0, 0, 20))
  return w.buffer()
}

const received = (buf: Buffer, from: string): ReceivedRecord[] => parseDnsPacket(buf).records.map((record) => ({ record, from }))

describe('paquets DNS (mDNS)', () => {
  it('construit une requête PTR lisible par le lecteur', () => {
    const q = buildPtrQuery(Object.values(PRINTER_SERVICES))
    expect(q.readUInt16BE(4)).toBe(4)
    const parsed = parseDnsPacket(q)
    expect(parsed.questions).toEqual(Object.values(PRINTER_SERVICES).map((name) => ({ name, type: TYPE_PTR })))
    expect(parsed.records).toEqual([])
  })

  it('lit PTR, SRV, TXT et A avec noms compressés', () => {
    const p = parseDnsPacket(escposResponse())
    expect(p.flags).toBe(0x8400)
    expect(p.records).toHaveLength(4)
    expect(p.records[0]).toMatchObject({ type: TYPE_PTR, name: '_pdl-datastream._tcp.local', target: 'EPSON TM-m30 (Caisse)._pdl-datastream._tcp.local' })
    expect(p.records[1]).toMatchObject({ type: TYPE_SRV, name: 'EPSON TM-m30 (Caisse)._pdl-datastream._tcp.local', port: 9100, target: 'EPSON-TM.local' })
    expect(p.records[2]).toMatchObject({ type: TYPE_TXT, txt: { txtvers: '1', ty: 'EPSON TM-m30', product: '(TM-m30)' } })
    expect(p.records[3]).toMatchObject({ type: TYPE_A, name: 'EPSON-TM.local', address: '192.168.1.50' })
  })

  it('refuse un paquet tronqué ou une boucle de pointeurs sans planter', () => {
    const full = escposResponse()
    expect(() => parseDnsPacket(full.subarray(0, full.length - 3))).toThrow()
    // En-tête avec 1 réponse dont le nom pointe sur lui-même
    const loop = Buffer.from([0, 0, 0x84, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0xc0, 12, 0, 1, 0, 1, 0, 0, 0, 1, 0, 4, 1, 2, 3, 4])
    expect(() => parseDnsPacket(loop)).toThrow()
  })
})

describe('regroupement des enregistrements', () => {
  it('donne une imprimante ESC/POS avec modèle', () => {
    const printers = printersFromRecords(received(escposResponse(), '192.168.1.50'))
    expect(printers).toEqual([
      { name: 'EPSON TM-m30 (Caisse)', host: '192.168.1.50', port: 9100, protocols: ['escpos'], model: 'EPSON TM-m30', source: 'mdns' },
    ])
  })

  it('donne une imprimante AirPrint avec chemin rp, et retombe sur l’adresse source sans A', () => {
    const withA = printersFromRecords(received(ippResponse({ withA: true }), '10.0.0.99'))
    expect(withA).toEqual([
      {
        name: 'HP LaserJet Bureau',
        host: '10.0.0.20',
        port: 631,
        ippPort: 631,
        protocols: ['ipp'],
        model: 'HP LaserJet Pro M404',
        airprint: true,
        rp: 'ipp/print',
        source: 'mdns',
      },
    ])
    const noA = printersFromRecords(received(ippResponse({ withA: false }), '10.0.0.21'))
    expect(noA[0].host).toBe('10.0.0.21')
  })

  it('fusionne deux services du même appareil et ignore les adresses publiques', () => {
    const recs = [...received(escposResponse(), '192.168.1.50'), ...received(ippResponse({ withA: false }), '192.168.1.50')]
    const printers = printersFromRecords(recs)
    expect(printers).toHaveLength(1)
    expect(printers[0]).toMatchObject({ host: '192.168.1.50', port: 9100, ippPort: 631, protocols: ['escpos', 'ipp'], airprint: true })
    expect(printersFromRecords(received(ippResponse({ withA: false }), '8.8.8.8'))).toEqual([])
  })

  it('mergePrinters complète mDNS par le balayage, par adresse', () => {
    const mdns = printersFromRecords(received(ippResponse({ withA: true }), '10.0.0.20'))
    const merged = mergePrinters(mdns, [
      { name: '10.0.0.20', host: '10.0.0.20', port: 9100, protocols: ['escpos'], source: 'scan' },
      { name: '10.0.0.3', host: '10.0.0.3', port: 9100, protocols: ['escpos'], source: 'scan' },
    ])
    expect(merged.map((p) => [p.host, p.source, p.protocols])).toEqual([
      ['10.0.0.3', 'scan', ['escpos']],
      ['10.0.0.20', 'mdns', ['escpos', 'ipp']],
    ])
  })
})
