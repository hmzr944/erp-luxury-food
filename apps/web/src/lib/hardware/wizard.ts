// Assistant matériel : logique pure (lien d'appairage ouvert par le pont,
// choix automatique de l'imprimante et du TPE, étapes déjà faites).
// Aucune API du navigateur ici : testé tel quel par vitest.

import { DEFAULT_BRIDGE_PORT } from '@/lib/bridge/address'
import type { BridgeTpeConfig } from '@/lib/bridge/tpe'
import type { BridgeStatus, DiscoveredPrinter } from '@/lib/bridge/types'
import type { PrinterConfig } from '@/lib/printing/printer'

export type HardwareStep = 'pont' | 'appairage' | 'detection' | 'essai' | 'fini'

// Étapes affichées dans le suivi, dans l'ordre ; « fini » n'en est pas une
export const STEPS: Array<{ key: Exclude<HardwareStep, 'fini'>; label: string }> = [
  { key: 'pont', label: 'Pont' },
  { key: 'appairage', label: 'Appairage' },
  { key: 'detection', label: 'Détection' },
  { key: 'essai', label: 'Essai' },
]

export const stepIndex = (s: HardwareStep) => (s === 'fini' ? STEPS.length : STEPS.findIndex((x) => x.key === s))

// Lien ouvert par FLŌW-Bridge au démarrage : /materiel#pont=<CODE6>&port=<PORT>
export interface PairingLink {
  code: string
  port: number
}

export function parsePairingFragment(hash: string): PairingLink | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const code = (params.get('pont') ?? '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(code)) return null
  const raw = params.get('port')
  if (raw === null || raw === '') return { code, port: DEFAULT_BRIDGE_PORT }
  const port = Number(raw)
  if (!/^\d{1,5}$/.test(raw) || port < 1 || port > 65535) return null
  return { code, port }
}

// Imprimante de tickets déjà enregistrée sur cet appareil
export const printerSaved = (c: PrinterConfig) => (c.mode === 'bridge' || c.mode === 'epos') && !!c.host

// Empreinte de l'imprimante validée par un ticket d'essai : si l'adresse
// change, l'essai est à refaire
export const printerKey = (c: PrinterConfig) => (printerSaved(c) ? `${c.mode}:${c.host}:${c.port ?? 9100}` : '')

export interface StepContext {
  status: BridgeStatus
  printer: PrinterConfig
  // Empreinte de la dernière imprimante validée (printerKey), vide sinon
  verified: string
  // « Refaire la détection » : on ne saute pas la détection
  redo?: boolean
}

// Première étape qui reste à faire. L'imprimante Epson ePOS se passe du pont :
// déjà enregistrée, elle mène droit à l'essai ou au récapitulatif.
export function resolveStep({ status, printer, verified, redo }: StepContext): HardwareStep {
  const direct = printer.mode === 'epos' && printerSaved(printer) && !redo
  if (!direct) {
    if (status === 'off' || status === 'connecting') return 'pont'
    if (status === 'unpaired') return 'appairage'
    if (redo || !printerSaved(printer)) return 'detection'
  }
  return verified && verified === printerKey(printer) ? 'fini' : 'essai'
}

// Imprimantes de tickets seulement (ESC/POS), sans doublon d'adresse
export function ticketPrinters(found: DiscoveredPrinter[]): DiscoveredPrinter[] {
  const seen = new Set<string>()
  return found.filter((p) => {
    const key = `${p.host}:${p.port}`
    if (!p.protocols.includes('escpos') || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Choix d'office : l'imprimante déjà enregistrée si on la retrouve, sinon la
// seule trouvée. Plusieurs sans indice : au commerçant de choisir.
export function pickPrinter(found: DiscoveredPrinter[], current?: Pick<PrinterConfig, 'host' | 'port'>): DiscoveredPrinter | null {
  const list = ticketPrinters(found)
  if (current?.host) {
    const same = list.find((p) => p.host === current.host && p.port === (current.port ?? 9100))
    if (same) return same
  }
  return list.length === 1 ? list[0] : null
}

export const printerLabel = (p: Pick<DiscoveredPrinter, 'model' | 'name'>) => p.model || p.name || 'Imprimante de tickets'

// Réglage enregistré pour une imprimante détectée (le reste est gardé)
export function printerConfigFor(p: Pick<DiscoveredPrinter, 'host' | 'port' | 'model' | 'name'>, current: PrinterConfig): PrinterConfig {
  return { ...current, mode: 'bridge', host: p.host, port: p.port, name: printerLabel(p) }
}

// Adresse saisie à la main : IPv4 ou nom local, port facultatif
export function parsePrinterAddress(input: string): { host: string; port: number } | null {
  const m = /^\s*([a-z0-9.-]+)(?::(\d{1,5}))?\s*$/i.exec(input)
  if (!m) return null
  const host = m[1].toLowerCase()
  if (/^[\d.]+$/.test(host) && !(host.split('.').length === 4 && host.split('.').every((p) => p !== '' && Number(p) <= 255))) return null
  const port = m[2] ? Number(m[2]) : 9100
  if (port < 1 || port > 65535) return null
  return { host, port }
}

// TPE détecté par le pont (capacité tpe.discover)
export interface DiscoveredTerminal {
  host: string
  port: number
  protocol: 'caisse-ap'
}
export interface TpeDiscoverResult {
  terminals: DiscoveredTerminal[]
}

export const canDiscoverTpe = (capabilities: readonly string[] | null | undefined) => !!capabilities?.includes('tpe.discover')
// Le pont garde aussi le TPE (tpe.get, tpe.set) : une 2e caisse le reprend
export const canStoreTpe = (capabilities: readonly string[] | null | undefined) => !!capabilities?.includes('tpe.config')

// Réponse de tpe.get
export interface BridgeStoredTpe {
  adapter: 'caisse-ap' | 'simulator'
  host?: string
  port?: number
  posNumber?: string
  updatedAt?: string
}

// TPE gardé par le pont, repris sur une caisse qui n'en a pas encore
export function tpeFromBridge(stored: BridgeStoredTpe | null | undefined, current: BridgeTpeConfig): BridgeTpeConfig | null {
  if (!stored) return null
  if (stored.adapter === 'simulator') return { ...current, enabled: true, adapter: 'simulator' }
  if (stored.adapter !== 'caisse-ap' || !stored.host) return null
  return { ...current, enabled: true, adapter: 'caisse-ap', host: stored.host, port: stored.port ?? 8888, ...(stored.posNumber ? { posNumber: stored.posNumber } : {}) }
}

// Paramètres de tpe.set pour le TPE retenu
export function tpeSetParams(c: BridgeTpeConfig): { adapter: 'caisse-ap'; host: string; port: number; posNumber?: string } | { adapter: 'simulator' } | null {
  if (!c.enabled) return null
  if (c.adapter === 'simulator') return { adapter: 'simulator' }
  if (!c.host) return null
  return { adapter: 'caisse-ap', host: c.host, port: c.port ?? 8888, ...(c.posNumber && /^\d{1,2}$/.test(c.posNumber) ? { posNumber: c.posNumber } : {}) }
}

export function pickTerminal(found: DiscoveredTerminal[], current?: Pick<BridgeTpeConfig, 'enabled' | 'host' | 'port'>): DiscoveredTerminal | null {
  const list = found.filter((t) => t.protocol === 'caisse-ap')
  if (current?.enabled && current.host) {
    const same = list.find((t) => t.host === current.host && t.port === (current.port ?? 8888))
    if (same) return same
  }
  return list.length === 1 ? list[0] : null
}

// Comme BridgeTpeSettings : Caisse-AP, numéro de caisse gardé
export function tpeConfigFor(t: DiscoveredTerminal | null, current: BridgeTpeConfig): BridgeTpeConfig {
  if (!t) return { ...current, enabled: false }
  return { ...current, enabled: true, adapter: 'caisse-ap', host: t.host, port: t.port }
}

// Retour après connexion : chemin interne seulement (pas d'URL externe)
export function safeReturnPath(p: string | null | undefined): string | null {
  if (!p || !p.startsWith('/') || p.startsWith('//') || p.startsWith('/\\')) return null
  if (/^\/(login|inscription|mot-de-passe)(\/|$|\?|#)/.test(p)) return null
  return p
}
