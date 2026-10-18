// Adresse du pont FLŌW pour CET appareil (réglage local, comme le TPE) :
// vide = le pont tourne sur cet ordinateur ; sur iPad, l'adresse de
// l'ordinateur de la boutique, par exemple 192.168.1.20.
// Aucune API Node ici, et rien ne s'exécute à l'import (rendu serveur sûr).

export const DEFAULT_BRIDGE_PORT = 51717
const KEY = 'flow-bridge-address'

export interface BridgeAddress {
  host: string
  port: number
  // 127.0.0.1, localhost, ::1 : le pont tourne sur cet appareil
  local: boolean
}

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1'])

function isIPv4(h: string): boolean {
  const parts = h.split('.')
  return parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)
}

function isPrivateIPv4(h: string): boolean {
  const [a, b] = h.split('.').map(Number)
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254)
}

// « 192.168.1.20 », « caisse.local:51717 », « https://192.168.1.20:51717/ » → adresse ;
// null si illisible. Vide → cet ordinateur.
export function parseBridgeAddress(input: string): BridgeAddress | null {
  let v = input.trim().toLowerCase()
  if (!v) return { host: '127.0.0.1', port: DEFAULT_BRIDGE_PORT, local: true }
  v = v.replace(/^(wss?|https?):\/\//, '').replace(/\/.*$/, '')
  const m = /^(\[[0-9a-f:]+\]|[^:]+)(?::(\d{1,5}))?$/.exec(v)
  if (!m) return null
  const host = m[1]
  const port = m[2] ? Number(m[2]) : DEFAULT_BRIDGE_PORT
  if (port < 1 || port > 65535) return null
  // « 192.168.1.300 » ressemble à un nom mais n'est qu'une adresse fausse
  if (/^[\d.]+$/.test(host) && !isIPv4(host)) return null
  const hostname = /^[a-z0-9]([a-z0-9-]{0,62})(\.[a-z0-9]([a-z0-9-]{0,62}))*$/.test(host)
  if (!isIPv4(host) && !hostname && host !== '[::1]') return null
  // Le jeton d'appairage ne part jamais vers Internet : adresses privées,
  // noms en .local ou cet ordinateur seulement (comme le certificat du pont)
  if (isIPv4(host) ? !isPrivateIPv4(host) : hostname && host !== 'localhost' && !host.endsWith('.local')) return null
  return { host, port, local: LOCAL_HOSTS.has(host) }
}

export function formatBridgeAddress(a: BridgeAddress): string {
  if (a.local && a.host === '127.0.0.1' && a.port === DEFAULT_BRIDGE_PORT) return ''
  return a.port === DEFAULT_BRIDGE_PORT ? a.host : `${a.host}:${a.port}`
}

// Ordre des essais : wss d'abord (Safari l'exige depuis une caisse en https),
// puis ws, que Chrome, Edge et Firefox acceptent vers cet ordinateur sans
// certificat. Vers une autre machine, wss seulement : le pont refuse le
// clair sur le réseau et les navigateurs le bloquent depuis une page https.
export function bridgeUrls(a: BridgeAddress): string[] {
  const hostPort = `${a.host}:${a.port}`
  return a.local ? [`wss://${hostPort}`, `ws://${hostPort}`] : [`wss://${hostPort}`]
}

// Pages servies par le pont : certificat à installer, vérification
export function bridgePageUrl(a: BridgeAddress, path = '/', secure = false): string {
  return `${secure ? 'https' : 'http'}://${a.host}:${a.port}${path}`
}

export function readBridgeAddress(): string {
  try {
    return typeof window !== 'undefined' ? (window.localStorage.getItem(KEY) ?? '') : ''
  } catch {
    return ''
  }
}

export function writeBridgeAddress(value: string) {
  try {
    if (value) window.localStorage.setItem(KEY, value)
    else window.localStorage.removeItem(KEY)
  } catch {
    // Stockage indisponible : réglage gardé le temps de la session
  }
}
