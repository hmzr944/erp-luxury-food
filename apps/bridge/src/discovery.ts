// Détection des imprimantes du réseau local, sans réglage :
// 1. mDNS / DNS-SD (Bonjour, AirPrint) : requêtes PTR en multicast 224.0.0.251:5353 ;
// 2. en complément, balayage TCP du port 9100 sur le /24 de chaque carte réseau
//    privée de l'ordinateur (jamais une plage publique).
// Les TPE Caisse-AP sur IP sont cherchés de la même façon (port 8888) :
// connexion TCP ouverte puis refermée sans rien envoyer, donc aucun paiement.

import { createSocket, type Socket as UdpSocket } from 'node:dgram'
import { Socket } from 'node:net'
import { networkInterfaces } from 'node:os'
import {
  buildPtrQuery,
  mergePrinters,
  parseDnsPacket,
  PRINTER_SERVICES,
  printersFromRecords,
  type DiscoveredPrinter,
  type ReceivedRecord,
} from './dns.js'
import { CAISSE_AP_DEFAULT_PORT } from './payment/caisse-ap.js'
import { DEFAULT_PRINTER_PORT } from './printer.js'

export const MDNS_ADDRESS = '224.0.0.251'
export const MDNS_PORT = 5353
export const DEFAULT_DISCOVER_TIMEOUT_MS = 2500
export const MAX_DISCOVER_TIMEOUT_MS = 10_000
const SCAN_CONNECT_TIMEOUT_MS = 300
const SCAN_CONCURRENCY = 64

export interface LocalAddress {
  address: string
  netmask: string
}

// Prise UDP réduite à ce dont la découverte a besoin (remplaçable en test)
export interface MdnsSocket {
  on(event: 'message', cb: (msg: Buffer, rinfo: { address: string }) => void): unknown
  on(event: 'error', cb: (err: Error) => void): unknown
  bind(address: string | undefined, cb: () => void): void
  send(msg: Buffer, port: number, address: string): void
  close(): void
}

export interface DiscoveryDeps {
  interfaces: () => LocalAddress[]
  createSocket: (local: LocalAddress | null) => MdnsSocket
  // Le port 9100 répond-il sur cette adresse ?
  connect: (ip: string, port: number, timeoutMs: number) => Promise<boolean>
}

export interface DiscoverOptions {
  timeoutMs?: number
  scan?: boolean
}

// RFC 1918 seulement : le balayage ne touche jamais le lien local ni Internet
export function isRfc1918(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number)
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}

function toNum(ip: string): number {
  return ip.split('.').reduce((n, o) => n * 256 + Number(o), 0) >>> 0
}

function toIp(n: number): string {
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
}

// Adresses à balayer autour d'une carte réseau : le sous-réseau réel s'il est
// plus petit qu'un /24, sinon seulement le /24 qui contient l'adresse.
// Sans l'adresse réseau, la diffusion ni l'ordinateur lui-même.
export function subnetHosts(address: string, netmask: string): string[] {
  if (!isRfc1918(address)) return []
  const mask = Math.max(toNum(netmask), 0xffffff00) >>> 0
  const self = toNum(address)
  const network = (self & mask) >>> 0
  const broadcast = (network | (~mask >>> 0)) >>> 0
  const hosts: string[] = []
  for (let n = network + 1; n < broadcast; n++) if (n !== self) hosts.push(toIp(n))
  return hosts
}

export function privateInterfaces(): LocalAddress[] {
  const out: LocalAddress[] = []
  for (const list of Object.values(networkInterfaces())) {
    for (const i of list ?? []) {
      if (i.family === 'IPv4' && !i.internal && isRfc1918(i.address)) out.push({ address: i.address, netmask: i.netmask })
    }
  }
  return out
}

export function tcpConnect(ip: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new Socket()
    const end = (ok: boolean) => {
      clearTimeout(timer)
      socket.destroy()
      resolve(ok)
    }
    const timer = setTimeout(() => end(false), timeoutMs)
    socket.on('error', () => end(false))
    socket.connect({ host: ip, port }, () => end(true))
  })
}

function udpSocket(local: LocalAddress | null): MdnsSocket {
  const s: UdpSocket = createSocket({ type: 'udp4', reuseAddr: true })
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on: (event: string, cb: (...a: any[]) => void) => s.on(event, cb),
    bind: (address, cb) =>
      s.bind({ port: 0, address }, () => {
        try {
          s.setMulticastTTL(255)
          // Envoyer la requête sur cette carte réseau précise
          if (local) s.setMulticastInterface(local.address)
        } catch {
          // Réglage refusé par le système : on garde l'interface par défaut
        }
        cb()
      }),
    send: (msg, port, address) => s.send(msg, port, address, () => {}),
    close: () => {
      try {
        s.close()
      } catch {
        // déjà fermée
      }
    },
  } as MdnsSocket
}

export const defaultDiscoveryDeps: DiscoveryDeps = {
  interfaces: privateInterfaces,
  createSocket: udpSocket,
  connect: tcpConnect,
}

// Navigation mDNS : une prise par carte réseau privée (ou une seule par
// défaut), requête envoyée à 0, 1 s puis 2 s comme le recommande la RFC 6762.
// On ne s'abonne pas au groupe multicast : en « one-shot », les répondeurs
// répondent en unicast, ce qui évite de disputer le port 5353 à Bonjour/Avahi.
export async function browseMdns(timeoutMs: number, deps: DiscoveryDeps = defaultDiscoveryDeps): Promise<DiscoveredPrinter[]> {
  const received: ReceivedRecord[] = []
  const locals = deps.interfaces()
  const targets: Array<LocalAddress | null> = locals.length > 0 ? locals : [null]
  const query = buildPtrQuery(Object.values(PRINTER_SERVICES))
  const sockets: MdnsSocket[] = []
  const timers: NodeJS.Timeout[] = []

  await Promise.all(
    targets.map(
      (local) =>
        new Promise<void>((resolve) => {
          let s: MdnsSocket
          try {
            s = deps.createSocket(local)
          } catch {
            resolve()
            return
          }
          sockets.push(s)
          s.on('error', () => resolve())
          s.on('message', (msg, rinfo) => {
            try {
              for (const record of parseDnsPacket(msg).records) received.push({ record, from: rinfo.address })
            } catch {
              // Paquet illisible : ignoré
            }
          })
          s.bind(local?.address, () => {
            const send = () => {
              try {
                s.send(query, MDNS_PORT, MDNS_ADDRESS)
              } catch {
                // Réseau indisponible : on attend quand même la fin du délai
              }
            }
            send()
            for (const at of [1000, 2000]) if (at < timeoutMs - 200) timers.push(setTimeout(send, at))
            resolve()
          })
        }),
    ),
  )

  await new Promise((r) => setTimeout(r, timeoutMs))
  for (const t of timers) clearTimeout(t)
  for (const s of sockets) s.close()
  return printersFromRecords(received)
}

async function pool<T>(items: readonly T[], limit: number, job: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const worker = async () => {
    while (next < items.length) await job(items[next++])
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

// Ports ouverts sur le /24 de chaque carte privée, triés par adresse
export async function scanPorts(
  ports: readonly number[],
  deps: DiscoveryDeps = defaultDiscoveryDeps,
  deadlineMs = MAX_DISCOVER_TIMEOUT_MS,
): Promise<Array<{ host: string; port: number }>> {
  const hosts = new Set<string>()
  for (const i of deps.interfaces()) for (const h of subnetHosts(i.address, i.netmask)) hosts.add(h)
  const targets = [...hosts].flatMap((host) => ports.map((port) => ({ host, port })))
  const found: Array<{ host: string; port: number }> = []
  const stopAt = Date.now() + deadlineMs
  await pool(targets, SCAN_CONCURRENCY, async (t) => {
    if (Date.now() > stopAt) return
    if (await deps.connect(t.host, t.port, SCAN_CONNECT_TIMEOUT_MS)) found.push(t)
  })
  return found.sort((a, b) => toNum(a.host) - toNum(b.host) || a.port - b.port)
}

// Balayage du port 9100 (imprimantes ticket) sur le /24 de chaque carte privée
export async function scanSubnets(deps: DiscoveryDeps = defaultDiscoveryDeps, deadlineMs = MAX_DISCOVER_TIMEOUT_MS): Promise<DiscoveredPrinter[]> {
  const open = await scanPorts([DEFAULT_PRINTER_PORT], deps, deadlineMs)
  return open.map(({ host, port }) => ({ name: host, host, port, protocols: ['escpos'], source: 'scan' }))
}

export interface DiscoveredTerminal {
  host: string
  port: number
  protocol: 'caisse-ap'
}

export const DEFAULT_TPE_DISCOVER_TIMEOUT_MS = 3000

// TPE Caisse-AP sur IP : le port répond. La sonde n'envoie aucun octet ; un
// autre appareil qui écouterait sur le même port apparaîtrait aussi, c'est à
// la caisse de faire choisir puis d'essayer un petit paiement.
export async function discoverTerminals(
  opts: { timeoutMs?: number; ports?: readonly number[] } = {},
  deps: DiscoveryDeps = defaultDiscoveryDeps,
): Promise<{ terminals: DiscoveredTerminal[] }> {
  const timeoutMs = Math.min(Math.max(opts.timeoutMs ?? DEFAULT_TPE_DISCOVER_TIMEOUT_MS, 0), MAX_DISCOVER_TIMEOUT_MS)
  const ports = opts.ports?.length ? [...new Set(opts.ports)] : [CAISSE_AP_DEFAULT_PORT]
  const open = await scanPorts(ports, deps, Math.max(timeoutMs, 1500))
  return { terminals: open.map(({ host, port }) => ({ host, port, protocol: 'caisse-ap' })) }
}

export async function discoverPrinters(opts: DiscoverOptions = {}, deps: DiscoveryDeps = defaultDiscoveryDeps): Promise<{ printers: DiscoveredPrinter[] }> {
  const timeoutMs = Math.min(Math.max(opts.timeoutMs ?? DEFAULT_DISCOVER_TIMEOUT_MS, 0), MAX_DISCOVER_TIMEOUT_MS)
  const [mdns, scanned] = await Promise.all([
    browseMdns(timeoutMs, deps),
    // Le balayage ne doit pas trop dépasser la fenêtre mDNS
    opts.scan === false ? Promise.resolve([]) : scanSubnets(deps, Math.max(timeoutMs, 1500)),
  ])
  return { printers: mergePrinters(mdns, scanned) }
}
