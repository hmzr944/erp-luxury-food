'use client'

import { useSyncExternalStore } from 'react'
import { bytesToBase64, getBridge } from '@/lib/bridge'
import { encodeDrawerOnly, encodeTicket } from './escpos'
import { eposDocument, sendEpos } from './epos'
import { printWithSystem } from './html'
import type { TicketModel } from './ticket'

// Imprimante de CETTE caisse (réglage de l'appareil, comme le TPE)
export interface PrinterConfig {
  // bridge : imprimante réseau ESC/POS via FLŌW-Bridge (Epson, Star en
  // émulation ESC/POS, Bixolon...) ; epos : Epson ePOS en direct depuis le
  // navigateur ; system : imprimante installée sur l'appareil ; none : aucune
  mode: 'none' | 'system' | 'bridge' | 'epos'
  host?: string
  port?: number
  width: 48 | 32
  drawerPin: 0 | 1
  // Le tiroir s'ouvre à chaque encaissement en espèces
  drawerOnCash: boolean
  // Imprimante bureautique pour les factures A4 : fenêtre d'impression du
  // système (AirPrint sur iPad et Mac), ou envoi direct en IPP par le pont
  a4?: A4PrinterConfig
}

export interface A4PrinterConfig {
  mode: 'system' | 'ipp'
  name?: string
  host?: string
  port?: number
  path?: string
  tls?: boolean
}

const KEY = 'flow-printer'
const DEFAULT: PrinterConfig = { mode: 'system', width: 48, drawerPin: 0, drawerOnCash: true }
const listeners = new Set<() => void>()
let cached: PrinterConfig | null = null

export function getPrinterConfig(): PrinterConfig {
  if (cached) return cached
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null
    cached = raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT
  } catch {
    cached = DEFAULT
  }
  return cached!
}

export function setPrinterConfig(next: PrinterConfig) {
  cached = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // stockage indisponible (navigation privée) : réglage gardé le temps de la session
  }
  listeners.forEach((l) => l())
}

export function usePrinterConfig(): PrinterConfig {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    getPrinterConfig,
    () => DEFAULT,
  )
}

export const canOpenDrawer = (c: PrinterConfig) => c.mode === 'bridge' || c.mode === 'epos'

async function bridgeReady() {
  const bridge = getBridge()
  bridge.connect()
  if (bridge.status === 'ready') return bridge
  // Laisse le temps à la connexion locale de s'établir
  await new Promise<void>((resolve, reject) => {
    const started = Date.now()
    const tick = () => {
      if (bridge.status === 'ready') return resolve()
      if (bridge.status === 'unpaired') return reject(new Error('FLŌW-Bridge n’est pas appairé avec cette caisse (Réglages, Impression)'))
      if (Date.now() - started > 4000) return reject(new Error('FLŌW-Bridge injoignable sur cet appareil'))
      setTimeout(tick, 150)
    }
    tick()
  })
  return bridge
}

// Issue d'une impression. confirmed : l'imprimante a dit qu'elle était prête
// (false : ticket envoyé sans retour d'état). warning : à montrer sans bloquer.
// Sans papier, capot ouvert, hors ligne : printTicket échoue avec un message
// français prêt à afficher.
export interface PrintOutcome {
  confirmed: boolean
  warning?: string
}

export async function printTicket(t: TicketModel, opts: { openDrawer?: boolean; config?: PrinterConfig } = {}): Promise<PrintOutcome | undefined> {
  const c = opts.config ?? getPrinterConfig()
  const openDrawer = !!opts.openDrawer && canOpenDrawer(c)
  switch (c.mode) {
    case 'none':
      return
    case 'system':
      await printWithSystem(t, c.width)
      return
    case 'epos':
      if (!c.host) throw new Error('Adresse de l’imprimante Epson à renseigner')
      await sendEpos(c.host, eposDocument(t, { width: c.width, openDrawer, drawerPin: c.drawerPin }))
      return { confirmed: true }
    case 'bridge': {
      if (!c.host) throw new Error('Adresse de l’imprimante à renseigner')
      const bridge = await bridgeReady()
      const r = await bridge.call('printer.print', { host: c.host, port: c.port ?? 9100, data: bytesToBase64(encodeTicket(t, { width: c.width, openDrawer, drawerPin: c.drawerPin })) })
      return { confirmed: r.status?.known ?? false, ...(r.warning ? { warning: r.warning } : {}) }
    }
  }
}

// Libellé du bouton après une impression réussie
export const printedLabel = (o: PrintOutcome | undefined) => (o && !o.confirmed ? 'Ticket envoyé' : 'Ticket imprimé')

export async function openDrawer(config?: PrinterConfig) {
  const c = config ?? getPrinterConfig()
  if (c.mode === 'bridge' && c.host) {
    const bridge = await bridgeReady()
    await bridge.call('drawer.open', { host: c.host, port: c.port ?? 9100, pin: c.drawerPin })
    return
  }
  if (c.mode === 'epos' && c.host) return sendEpos(c.host, eposDocument(null, { openDrawer: true, drawerPin: c.drawerPin }))
  throw new Error('Le tiroir s’ouvre par l’imprimante réseau : choisissez FLŌW-Bridge ou Epson ePOS dans les réglages d’impression')
}

// Ouverture du tiroir seule, octets bruts (diagnostic, pont local)
export const drawerBytes = encodeDrawerOnly

// Facture A4 (PDF) : imprimante bureautique en IPP par le pont, sinon la
// fenêtre d'impression du système (AirPrint, imprimante installée)
export async function printPdf(url: string, opts: { jobName?: string; config?: PrinterConfig } = {}) {
  const a4 = (opts.config ?? getPrinterConfig()).a4 ?? { mode: 'system' }
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error('Document introuvable')
  const blob = await res.blob()
  if (a4.mode === 'ipp' && a4.host) {
    const bridge = await bridgeReady()
    const data = bytesToBase64(new Uint8Array(await blob.arrayBuffer()))
    await bridge.call('printer.printDocument', { host: a4.host, port: a4.port, path: a4.path, tls: a4.tls, data, jobName: opts.jobName ?? 'FLOW' }, 60_000)
    return
  }
  // PDF servi par l'API (autre origine) : copie locale pour pouvoir l'imprimer
  const local = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0'
  frame.src = local
  document.body.appendChild(frame)
  await new Promise<void>((resolve) => {
    frame.onload = () => {
      try {
        frame.contentWindow!.focus()
        frame.contentWindow!.print()
      } catch {
        // Navigateur qui n'imprime pas un PDF intégré (Safari iOS) : on l'ouvre
        window.open(local, '_blank', 'noopener')
      }
      resolve()
    }
  })
  setTimeout(() => {
    frame.remove()
    URL.revokeObjectURL(local)
  }, 60_000)
}
