'use client'

import { sha256Hex } from '@erp/utils'
import { db, type SaleRecord } from './db'

// Sauvegarde de secours des ventes signées en attente. Le fichier contient ce
// qui est déjà destiné au serveur (corps de POST /orders/sync, ticket signé
// compris) et rien d'autre : jamais la clé privée, qui n'est pas exportable.
// Le réimport ne modifie aucune vente signée : il les remet dans la file telles
// quelles, et le serveur déduplique par clientId (syncSignedSale renvoie la
// commande existante), donc une vente déjà partie ne crée pas de doublon.

export const BACKUP_FORMAT = 'flow-ventes-en-attente'
export const BACKUP_VERSION = 1

export interface BackupSale {
  clientId: string
  terminalId: string
  counter: number
  total: number
  createdAt: number
  payload: unknown
}

export interface SalesBackup {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  siteId: string
  // Caisse(s) qui ont signé les ventes du fichier
  terminalIds: string[]
  exportedAt: string
  sales: BackupSale[]
  // SHA-256 de tout ce qui précède : détecte un fichier tronqué ou modifié
  checksum: string
}

function body(b: Omit<SalesBackup, 'checksum'>): string {
  return JSON.stringify({
    format: b.format,
    version: b.version,
    siteId: b.siteId,
    terminalIds: b.terminalIds,
    exportedAt: b.exportedAt,
    sales: b.sales,
  })
}

export async function buildBackup(siteId: string, now: Date = new Date()): Promise<SalesBackup> {
  const pending = await db.sales.where('[siteId+status]').equals([siteId, 'pending']).sortBy('counter')
  const sales: BackupSale[] = pending.map((s) => ({
    clientId: s.clientId,
    terminalId: s.terminalId,
    counter: s.counter,
    total: s.total,
    createdAt: s.createdAt,
    payload: s.payload,
  }))
  const base = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    siteId,
    terminalIds: [...new Set(sales.map((s) => s.terminalId))].sort(),
    exportedAt: now.toISOString(),
    sales,
  } as const
  return { ...base, checksum: await sha256Hex(body(base)) }
}

export function backupFileName(b: Pick<SalesBackup, 'exportedAt' | 'sales'>): string {
  return `ventes-en-attente-${b.exportedAt.slice(0, 19).replace(/[:T]/g, '-')}-${b.sales.length}.json`
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupError'
  }
}

const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v)

// Lit et contrôle un fichier de sauvegarde. Les messages sont destinés au responsable.
export async function parseBackup(text: string): Promise<SalesBackup> {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError("Ce fichier n'est pas une sauvegarde de ventes (lecture impossible).")
  }
  if (!isObj(raw) || raw.format !== BACKUP_FORMAT) throw new BackupError("Ce fichier n'est pas une sauvegarde de ventes FLŌW.")
  if (raw.version !== BACKUP_VERSION) throw new BackupError('Version de sauvegarde non reconnue.')
  if (typeof raw.siteId !== 'string' || typeof raw.exportedAt !== 'string' || !Array.isArray(raw.sales) || !Array.isArray(raw.terminalIds) || typeof raw.checksum !== 'string') {
    throw new BackupError('Sauvegarde incomplète.')
  }
  for (const s of raw.sales) {
    const receipt = isObj(s) && isObj(s.payload) ? s.payload.receipt : undefined
    const ok =
      isObj(s) &&
      typeof s.clientId === 'string' &&
      typeof s.terminalId === 'string' &&
      Number.isInteger(s.counter) &&
      typeof s.total === 'number' &&
      typeof s.createdAt === 'number' &&
      isObj(s.payload) &&
      s.payload.clientId === s.clientId &&
      s.payload.terminalId === s.terminalId &&
      isObj(receipt) &&
      receipt.counter === s.counter &&
      typeof receipt.hash === 'string' &&
      typeof receipt.signature === 'string'
    if (!ok) throw new BackupError('Une vente de la sauvegarde est incomplète : fichier abîmé.')
  }
  const backup = raw as unknown as SalesBackup
  if ((await sha256Hex(body(backup))) !== backup.checksum) {
    throw new BackupError("L'empreinte de contrôle ne correspond pas : le fichier est abîmé ou a été modifié. Rien n'a été importé.")
  }
  return backup
}

export interface ImportResult {
  added: number
  // Déjà sur l'appareil (en attente, envoyée ou refusée) : ignorées, pas de doublon
  alreadyHere: number
  // Même caisse et même numéro de ticket mais autre vente : ignorée, à vérifier
  conflicts: number
}

// Remet les ventes du fichier dans la file de ce site, sans en modifier aucune.
// Rejouable : une seconde importation du même fichier n'ajoute rien.
export async function importBackup(siteId: string, backup: SalesBackup): Promise<ImportResult> {
  if (backup.siteId !== siteId) throw new BackupError("Cette sauvegarde vient d'une autre boutique.")
  const result: ImportResult = { added: 0, alreadyHere: 0, conflicts: 0 }

  await db.transaction('rw', db.sales, async () => {
    for (const s of backup.sales) {
      if (await db.sales.where('clientId').equals(s.clientId).first()) {
        result.alreadyHere++
        continue
      }
      if (await db.sales.where('[terminalId+counter]').equals([s.terminalId, s.counter]).first()) {
        result.conflicts++
        continue
      }
      const record: SaleRecord = {
        clientId: s.clientId,
        siteId,
        terminalId: s.terminalId,
        counter: s.counter,
        status: 'pending',
        payload: s.payload,
        total: s.total,
        createdAt: s.createdAt,
        attempts: 0,
      }
      await db.sales.add(record)
      result.added++
    }
  })
  return result
}
