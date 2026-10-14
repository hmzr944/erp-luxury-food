// Paquets DNS minimaux pour la découverte mDNS / DNS-SD (RFC 1035, 6762, 6763).
// Fonctions pures : construction d'une requête PTR, lecture d'une réponse
// (noms compressés compris) et regroupement des enregistrements en imprimantes.

import { isIPv4 } from 'node:net'
import { isPrivateIPv4 } from './lan.js'

export const TYPE_A = 1
export const TYPE_PTR = 12
export const TYPE_TXT = 16
export const TYPE_SRV = 33
const CLASS_IN = 1

// Services annoncés par les imprimantes réseau
export const PRINTER_SERVICES = {
  // Port RAW 9100 (JetDirect), celui des imprimantes ticket ESC/POS
  escpos: '_pdl-datastream._tcp.local',
  // IPP et IPP sur TLS : imprimantes de bureau, AirPrint
  ipp: '_ipp._tcp.local',
  ipps: '_ipps._tcp.local',
  // LPD (port 515) : seulement pour compléter le nom et le modèle
  lpd: '_printer._tcp.local',
} as const

export type PrinterProtocol = 'escpos' | 'ipp' | 'ipps'

export interface DiscoveredPrinter {
  name: string
  host: string
  port: number
  protocols: PrinterProtocol[]
  // Port IPP/IPPS annoncé (souvent 631), utile à printer.printDocument
  ippPort?: number
  model?: string
  airprint?: boolean
  rp?: string
  source: 'mdns' | 'scan'
}

export type DnsRecord =
  | { type: typeof TYPE_PTR; name: string; ttl: number; target: string }
  | { type: typeof TYPE_SRV; name: string; ttl: number; priority: number; weight: number; port: number; target: string }
  | { type: typeof TYPE_TXT; name: string; ttl: number; txt: Record<string, string> }
  | { type: typeof TYPE_A; name: string; ttl: number; address: string }
  | { type: number; name: string; ttl: number; raw: Buffer }

export interface DnsPacket {
  id: number
  flags: number
  questions: Array<{ name: string; type: number }>
  records: DnsRecord[]
}

function encodeName(name: string): Buffer {
  const parts: Buffer[] = []
  for (const label of name.replace(/\.$/, '').split('.')) {
    const b = Buffer.from(label, 'utf8')
    if (b.length === 0 || b.length > 63) throw new Error(`Étiquette DNS invalide : ${label}`)
    parts.push(Buffer.from([b.length]), b)
  }
  parts.push(Buffer.from([0]))
  return Buffer.concat(parts)
}

// Requête « one-shot » (RFC 6762 §5.1) : envoyée depuis un port quelconque,
// les répondeurs renvoient leur réponse en unicast vers ce port.
export function buildPtrQuery(names: readonly string[], id = 0): Buffer {
  const header = Buffer.alloc(12)
  header.writeUInt16BE(id, 0)
  header.writeUInt16BE(0, 2)
  header.writeUInt16BE(names.length, 4)
  const questions = names.map((n) => {
    const tail = Buffer.alloc(4)
    tail.writeUInt16BE(TYPE_PTR, 0)
    tail.writeUInt16BE(CLASS_IN, 2)
    return Buffer.concat([encodeName(n), tail])
  })
  return Buffer.concat([header, ...questions])
}

class Reader {
  constructor(
    readonly buf: Buffer,
    public pos = 0,
  ) {}

  need(n: number) {
    if (this.pos + n > this.buf.length) throw new Error('Paquet DNS tronqué')
  }
  u8() {
    this.need(1)
    return this.buf[this.pos++]
  }
  u16() {
    this.need(2)
    const v = this.buf.readUInt16BE(this.pos)
    this.pos += 2
    return v
  }
  u32() {
    this.need(4)
    const v = this.buf.readUInt32BE(this.pos)
    this.pos += 4
    return v
  }

  // Nom avec compression (pointeurs 0xC0) ; on borne les sauts contre les boucles
  name(): string {
    const labels: string[] = []
    let pos = this.pos
    let jumped = false
    let jumps = 0
    for (;;) {
      if (pos >= this.buf.length) throw new Error('Nom DNS tronqué')
      const len = this.buf[pos]
      if (len === 0) {
        pos += 1
        break
      }
      if ((len & 0xc0) === 0xc0) {
        if (pos + 1 >= this.buf.length) throw new Error('Pointeur DNS tronqué')
        const ptr = ((len & 0x3f) << 8) | this.buf[pos + 1]
        if (!jumped) this.pos = pos + 2
        jumped = true
        if (++jumps > 32 || ptr >= this.buf.length) throw new Error('Pointeur DNS invalide')
        pos = ptr
        continue
      }
      if ((len & 0xc0) !== 0) throw new Error('Étiquette DNS invalide')
      if (pos + 1 + len > this.buf.length) throw new Error('Étiquette DNS tronquée')
      labels.push(this.buf.toString('utf8', pos + 1, pos + 1 + len))
      pos += 1 + len
      if (labels.length > 128) throw new Error('Nom DNS trop long')
    }
    if (!jumped) this.pos = pos
    return labels.join('.')
  }
}

function parseTxt(data: Buffer): Record<string, string> {
  const txt: Record<string, string> = {}
  let i = 0
  while (i < data.length) {
    const len = data[i]
    const entry = data.toString('utf8', i + 1, Math.min(data.length, i + 1 + len))
    i += 1 + len
    if (!entry) continue
    const eq = entry.indexOf('=')
    const key = (eq === -1 ? entry : entry.slice(0, eq)).toLowerCase()
    // RFC 6763 §6.4 : la première occurrence d'une clé l'emporte
    if (key && !Object.hasOwn(txt, key)) txt[key] = eq === -1 ? '' : entry.slice(eq + 1)
  }
  return txt
}

export function parseDnsPacket(buf: Buffer): DnsPacket {
  const r = new Reader(buf)
  const id = r.u16()
  const flags = r.u16()
  const qd = r.u16()
  const an = r.u16()
  const ns = r.u16()
  const ar = r.u16()
  const questions: DnsPacket['questions'] = []
  for (let i = 0; i < qd; i++) {
    const name = r.name()
    const type = r.u16()
    r.u16()
    questions.push({ name, type })
  }
  const records: DnsRecord[] = []
  for (let i = 0; i < an + ns + ar; i++) {
    const name = r.name()
    const type = r.u16()
    r.u16() // classe (bit 15 = « cache flush » en mDNS)
    const ttl = r.u32()
    const len = r.u16()
    r.need(len)
    const start = r.pos
    const end = start + len
    switch (type) {
      case TYPE_PTR:
        records.push({ type, name, ttl, target: r.name() })
        break
      case TYPE_SRV: {
        const priority = r.u16()
        const weight = r.u16()
        const port = r.u16()
        records.push({ type, name, ttl, priority, weight, port, target: r.name() })
        break
      }
      case TYPE_TXT:
        records.push({ type, name, ttl, txt: parseTxt(buf.subarray(start, end)) })
        break
      case TYPE_A:
        if (len === 4) records.push({ type, name, ttl, address: [...buf.subarray(start, end)].join('.') })
        break
      default:
        records.push({ type, name, ttl, raw: Buffer.from(buf.subarray(start, end)) })
    }
    r.pos = end
  }
  return { id, flags, questions, records }
}

// Enregistrements reçus, avec l'adresse de l'appareil qui les a envoyés
export interface ReceivedRecord {
  record: DnsRecord
  from: string
}

const key = (n: string) => n.toLowerCase().replace(/\.$/, '')

const SERVICE_PROTOCOL: Record<string, PrinterProtocol | 'lpd'> = {
  [key(PRINTER_SERVICES.escpos)]: 'escpos',
  [key(PRINTER_SERVICES.ipp)]: 'ipp',
  [key(PRINTER_SERVICES.ipps)]: 'ipps',
  [key(PRINTER_SERVICES.lpd)]: 'lpd',
}

// Réseau local sans la boucle locale : une imprimante n'est pas sur 127.x
const isPrivateLan = (ip: string) => isPrivateIPv4(ip) && !ip.startsWith('127.')

const PROTOCOL_ORDER: PrinterProtocol[] = ['escpos', 'ipp', 'ipps']

// « Epson TM-m30._pdl-datastream._tcp.local » -> « Epson TM-m30 »
function instanceLabel(instance: string, service: string): string {
  const suffix = `.${service}`
  return instance.toLowerCase().endsWith(suffix) ? instance.slice(0, instance.length - suffix.length) : instance
}

// Regroupe PTR, SRV, TXT et A en une imprimante par adresse IP.
// Seules les adresses privées sont retenues.
export function printersFromRecords(received: readonly ReceivedRecord[]): DiscoveredPrinter[] {
  const ptrs: Array<{ service: string; instance: string; from: string }> = []
  const srv = new Map<string, { port: number; target: string; from: string }>()
  const txt = new Map<string, Record<string, string>>()
  const addr = new Map<string, string>()
  for (const { record, from } of received) {
    if (record.ttl === 0) continue // « au revoir » : service retiré
    if ('target' in record && record.type === TYPE_PTR) {
      const service = key(record.name)
      if (service in SERVICE_PROTOCOL) ptrs.push({ service, instance: record.target, from })
    } else if (record.type === TYPE_SRV && 'port' in record) {
      if (!srv.has(key(record.name))) srv.set(key(record.name), { port: record.port, target: record.target, from })
    } else if (record.type === TYPE_TXT && 'txt' in record) {
      if (!txt.has(key(record.name))) txt.set(key(record.name), record.txt)
    } else if (record.type === TYPE_A && 'address' in record) {
      if (!addr.has(key(record.name))) addr.set(key(record.name), record.address)
    }
  }

  const byHost = new Map<string, DiscoveredPrinter & { ports: Partial<Record<PrinterProtocol, number>> }>()
  for (const { service, instance, from } of ptrs) {
    const s = srv.get(key(instance))
    if (!s) continue
    // Sans enregistrement A, l'adresse d'origine du paquet est celle de l'imprimante
    const ip = addr.get(key(s.target)) ?? (s.from || from)
    if (!isIPv4(ip) || !isPrivateLan(ip)) continue
    const proto = SERVICE_PROTOCOL[service]
    const t = txt.get(key(instance)) ?? {}
    let p = byHost.get(ip)
    if (!p) {
      p = { name: instanceLabel(instance, service), host: ip, port: 0, protocols: [], source: 'mdns', ports: {} }
      byHost.set(ip, p)
    }
    const model = t.ty || (t.product ? t.product.replace(/^\((.*)\)$/, '$1') : '')
    if (model && !p.model) p.model = model
    if (proto === 'lpd') continue
    if (!p.protocols.includes(proto)) p.protocols.push(proto)
    p.ports[proto] ??= s.port
    if (proto === 'ipp' || proto === 'ipps') {
      if ('urf' in t) p.airprint = true
      if (t.rp !== undefined && p.rp === undefined) p.rp = t.rp
      // Nom IPP préféré : c'est celui affiché par les ordinateurs du magasin
      if (proto === 'ipp') p.name = instanceLabel(instance, service)
    }
  }

  return [...byHost.values()].map(({ ports, ...p }) => {
    p.protocols.sort((a, b) => PROTOCOL_ORDER.indexOf(a) - PROTOCOL_ORDER.indexOf(b))
    // LPD seul : le port 515 n'est pas imprimable par le pont, protocols reste vide
    p.port = ports.escpos ?? ports.ipp ?? ports.ipps ?? 515
    const ippPort = ports.ipp ?? ports.ipps
    if (ippPort !== undefined) p.ippPort = ippPort
    return p
  })
}

// Fusionne mDNS et balayage : une entrée par adresse, mDNS prioritaire
export function mergePrinters(mdns: readonly DiscoveredPrinter[], scanned: readonly DiscoveredPrinter[]): DiscoveredPrinter[] {
  const out = new Map<string, DiscoveredPrinter>()
  for (const p of mdns) out.set(p.host, { ...p, protocols: [...p.protocols] })
  for (const s of scanned) {
    const p = out.get(s.host)
    if (!p) {
      out.set(s.host, { ...s, protocols: [...s.protocols] })
      continue
    }
    // Le port principal est celui du ticket ESC/POS quand l'appareil en a un
    if (s.protocols.includes('escpos') && !p.protocols.includes('escpos')) p.port = s.port
    for (const proto of s.protocols) if (!p.protocols.includes(proto)) p.protocols.push(proto)
    p.protocols.sort((a, b) => PROTOCOL_ORDER.indexOf(a) - PROTOCOL_ORDER.indexOf(b))
  }
  return [...out.values()].sort((a, b) => ipNum(a.host) - ipNum(b.host))
}

function ipNum(ip: string): number {
  return ip.split('.').reduce((n, o) => n * 256 + Number(o), 0)
}
