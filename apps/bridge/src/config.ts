// Réglages lus dans l'environnement, avec des valeurs sûres par défaut.

import { readFileSync } from 'node:fs'
import type { TlsMaterial } from './cert.js'
import { levelFromEnv, type LogLevel } from './log.js'
import { defaultHome } from './store.js'

export const DEFAULT_PORT = 51717

export interface BridgeConfig {
  port: number
  // Boucle locale ; « lan » ouvre aussi le pont aux iPad du magasin (0.0.0.0)
  host: '127.0.0.1'
  lan?: boolean
  origins: string[]
  home: string
  // Certificat servi en wss:// ; sans lui, le pont ne parle qu'en ws:// local
  tls?: TlsMaterial
  // Certificats fabriqués par le pont (cert.ts) quand aucun n'est fourni
  autoTls?: boolean
  logLevel: LogLevel | 'silent'
  maxMessageBytes: number
}

// « https://Caisse.Exemple.fr/ » et « https://caisse.exemple.fr » sont la même origine
export function normalizeOrigin(o: string): string {
  return o.trim().replace(/\/+$/, '').toLowerCase()
}

// Adresse de la caisse inscrite à la construction du paquet téléchargeable
// (scripts/package.mjs) : le pont téléchargé depuis la caisse l'accepte d'office
const BUILT_IN_ORIGINS = process.env.FLOW_BRIDGE_BUILD_ORIGINS || 'http://localhost:3000'

export function parseOrigins(value: string | undefined): string[] {
  const list = (value ?? BUILT_IN_ORIGINS)
    .split(',')
    .map(normalizeOrigin)
    .filter((o) => o.length > 0)
  // « * » ouvrirait le pont à n'importe quel site : refusé exprès
  return list.filter((o) => o !== '*' && o !== 'null')
}

// « 1 », « oui », « true » / « 0 », « non », « false » ; absent : undefined
export function parseSwitch(value: string | undefined, name: string): boolean | undefined {
  if (value === undefined || value.trim() === '') return undefined
  const v = value.trim().toLowerCase()
  if (['1', 'oui', 'true', 'on'].includes(v)) return true
  if (['0', 'non', 'false', 'off'].includes(v)) return false
  throw new Error(`${name} invalide : ${value} (1 ou 0 attendu)`)
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BridgeConfig {
  const port = Number(env.FLOW_BRIDGE_PORT ?? DEFAULT_PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`FLOW_BRIDGE_PORT invalide : ${env.FLOW_BRIDGE_PORT}`)
  }
  let tls: BridgeConfig['tls']
  if (env.FLOW_BRIDGE_CERT || env.FLOW_BRIDGE_KEY) {
    if (!env.FLOW_BRIDGE_CERT || !env.FLOW_BRIDGE_KEY) {
      throw new Error('FLOW_BRIDGE_CERT et FLOW_BRIDGE_KEY doivent être fournis ensemble')
    }
    tls = { cert: readFileSync(env.FLOW_BRIDGE_CERT), key: readFileSync(env.FLOW_BRIDGE_KEY) }
  }
  return {
    port,
    host: '127.0.0.1',
    lan: parseSwitch(env.FLOW_BRIDGE_LAN, 'FLOW_BRIDGE_LAN'),
    // FLOW_BRIDGE_TLS=0 : ancien fonctionnement, ws:// sur 127.0.0.1 seulement
    autoTls: !tls && parseSwitch(env.FLOW_BRIDGE_TLS, 'FLOW_BRIDGE_TLS') !== false,
    origins: parseOrigins(env.FLOW_BRIDGE_ORIGINS),
    home: env.FLOW_BRIDGE_HOME || defaultHome(),
    tls,
    logLevel: levelFromEnv(env.FLOW_BRIDGE_LOG),
    // 20 Mo : assez pour un PDF A4 de 14 Mo encodé en base64 (printer.printDocument)
    maxMessageBytes: 20 * 1024 * 1024,
  }
}
