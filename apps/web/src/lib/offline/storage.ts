'use client'

// Le stockage du navigateur (IndexedDB) garde les ventes signées en attente et
// la clé de la caisse. Le navigateur peut le vider (pression sur le disque,
// nettoyage de l'OS) tant qu'il n'est pas déclaré « persistant » : on le
// demande au démarrage, on mesure la place restante, et on rend visible tout
// échec d'écriture d'une vente.

export interface StorageStatus {
  // true : le navigateur ne videra pas la base de lui-même
  // false : refusé ; null : inconnu (API absente : Safari ancien, navigation privée)
  persisted: boolean | null
  usage: number | null
  quota: number | null
}

export const UNKNOWN_STORAGE: StorageStatus = { persisted: null, usage: null, quota: null }

// Au-delà de cette part du quota, on prévient avant que l'écriture échoue
export const STORAGE_NEAR_FULL = 0.85

const MEMO_KEY = 'flow:storage-persist'

let memo: StorageStatus | null = null

function remember(status: StorageStatus) {
  memo = status
  try {
    localStorage.setItem(MEMO_KEY, JSON.stringify({ persisted: status.persisted, at: Date.now() }))
  } catch {
    // stockage local indisponible : la valeur reste en mémoire pour cette session
  }
}

// Demande le stockage persistant et lit l'espace disponible. Ne lève jamais.
export async function requestPersistentStorage(): Promise<StorageStatus> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined
  if (!storage) {
    remember(UNKNOWN_STORAGE)
    return UNKNOWN_STORAGE
  }

  let persisted: boolean | null = null
  try {
    persisted = typeof storage.persisted === 'function' ? await storage.persisted() : null
    if (persisted === false && typeof storage.persist === 'function') persisted = await storage.persist()
  } catch {
    // le navigateur refuse la demande sans autre forme : on reste sur l'état connu
  }

  const { usage, quota } = await readStorageEstimate()
  const status: StorageStatus = { persisted, usage, quota }
  remember(status)
  return status
}

export async function readStorageEstimate(): Promise<{ usage: number | null; quota: number | null }> {
  try {
    const e = await navigator.storage?.estimate?.()
    return { usage: e?.usage ?? null, quota: e?.quota ?? null }
  } catch {
    return { usage: null, quota: null }
  }
}

export function lastStorageStatus(): StorageStatus {
  return memo ?? UNKNOWN_STORAGE
}

export function isNearlyFull(status: Pick<StorageStatus, 'usage' | 'quota'>): boolean {
  return status.usage != null && status.quota != null && status.quota > 0 && status.usage / status.quota >= STORAGE_NEAR_FULL
}

// Une vente signée n'a pas pu être écrite sur l'appareil : le ticket n'existe
// pas, il ne faut pas laisser croire le contraire au vendeur.
export type SaleStorageFailure = 'quota' | 'closed' | 'other'

export class SaleStorageError extends Error {
  readonly reason: SaleStorageFailure
  constructor(reason: SaleStorageFailure, cause?: unknown) {
    super(
      reason === 'quota'
        ? "La vente n'a pas pu être gardée sur cet appareil : il n'a plus assez de place. Libérez de l'espace (fermez d'autres applications, supprimez des fichiers), puis réessayez l'encaissement. Aucun ticket n'a été créé."
        : "La vente n'a pas pu être gardée sur cet appareil. Aucun ticket n'a été créé. Réessayez l'encaissement ; si cela se répète, rechargez la page.",
    )
    this.name = 'SaleStorageError'
    this.reason = reason
    this.cause = cause
  }
}

export function classifyStorageError(error: unknown): SaleStorageFailure {
  const seen = new Set<unknown>()
  let e: any = error
  while (e && !seen.has(e)) {
    seen.add(e)
    const name = String(e.name ?? '')
    if (name === 'QuotaExceededError' || /quota/i.test(String(e.message ?? ''))) return 'quota'
    if (name === 'DatabaseClosedError' || name === 'InvalidStateError') return 'closed'
    e = e.inner ?? e.cause
  }
  return 'other'
}
