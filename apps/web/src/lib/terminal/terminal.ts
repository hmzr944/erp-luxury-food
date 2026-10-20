'use client'

import { ECDSA_PARAMS, RECEIPT_GENESIS_HASH, priceOrder, type SignedSaleContent } from '@erp/utils'
import { authorizedFetch } from '@/lib/api/client'
import { db, type SaleRecord, type TerminalRecord } from '@/lib/offline/db'
import { classifyStorageError, SaleStorageError } from '@/lib/offline/storage'
import { signSale, type TerminalReceipt } from './signer'
import { applyOfflineRoster, type OfflineRoster } from './offline-pin'

// Toutes les ventes passent par ici, réseau ou pas :
// 1. la caisse signe le ticket localement (il est valable immédiatement),
// 2. la vente est conservée sur l'appareil,
// 3. elle est envoyée au serveur dès que possible, dans l'ordre des tickets.

export class TerminalNotRegisteredError extends Error {
  constructor() {
    super('Cette caisse doit être connectée à internet lors de sa première utilisation')
  }
}

// Verrou partagé entre onglets : deux onglets ne signent jamais en même temps
async function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(name, fn) as Promise<T>
  }
  return fn()
}

export async function getTerminal(siteId: string): Promise<TerminalRecord | undefined> {
  return db.terminals.get(siteId)
}

// Enregistre cet appareil comme caisse du site (une seule fois)
//
// Clé perdue (stockage vidé, appareil remplacé) : la clé privée n'existe qu'ici
// et n'est pas exportable, rien ne peut la reconstituer. Conséquences, sans
// changer l'API ni la logique fiscale :
// - Ventes déjà envoyées : rien à faire, le serveur les a vérifiées avec la clé
//   publique de l'ancienne caisse, qu'il garde.
// - Ventes en attente restées dans le navigateur : si la base est intacte, elles
//   partent normalement (le serveur accepte les ventes d'une caisse désactivée).
//   Si la base est vidée, elles sont perdues, sauf fichier « Sauvegarder les
//   ventes en attente » (lib/offline/backup.ts) : il contient les ventes déjà
//   signées, qu'on réimporte telles quelles, sans clé.
// - Nouvelle vente : impossible avec l'ancienne identité. Marche à suivre :
//   un responsable désactive l'ancienne caisse (réglages, caisses), puis cet
//   appareil en enregistre une nouvelle (autre terminalId, compteur à 1, chaîne
//   neuve). Ne jamais réutiliser l'ancien compteur : le serveur refuserait
//   (409) tout ticket qui ne prolonge pas la chaîne de la caisse.
// - Ventes signées par l'ancienne clé mais jamais retrouvées : trou dans la
//   chaîne de l'ancienne caisse, à signaler et expliquer par le responsable.
export async function ensureTerminal(siteId: string): Promise<TerminalRecord> {
  return withLock(`terminal:${siteId}`, async () => {
    const existing = await db.terminals.get(siteId)
    if (existing) return existing

    const keys = await crypto.subtle.generateKey(ECDSA_PARAMS, false, ['sign', 'verify'])
    const publicKey = await crypto.subtle.exportKey('jwk', keys.publicKey)
    const list = await authorizedFetch(`/sites/${siteId}/terminals`).then((r) => (r.ok ? r.json() : []))
    const name = `Caisse ${(Array.isArray(list) ? list.length : 0) + 1}`

    let res: Response
    try {
      res = await authorizedFetch(`/sites/${siteId}/terminals`, {
        method: 'POST',
        body: JSON.stringify({ name, publicKey }),
      })
    } catch {
      throw new TerminalNotRegisteredError()
    }
    if (!res.ok) throw new TerminalNotRegisteredError()
    const created = (await res.json()) as { id: string; name: string }

    const record: TerminalRecord = {
      siteId,
      terminalId: created.id,
      name: created.name,
      privateKey: keys.privateKey,
      counter: 0,
      lastHash: RECEIPT_GENESIS_HASH,
    }
    await db.terminals.put(record)
    return record
  })
}

export interface SaleInput {
  items: SignedSaleContent['items']
  payments: SignedSaleContent['payments']
  orderDiscount?: number
  customerEmail?: string
  note?: string
  priceIncludesTax: boolean
  // Identifiant de vente déjà utilisé pour un paiement sur TPE connecté
  clientId?: string
  // Client non résident déclaré (plafond espèces 15 000 €), hors contenu signé
  nonResident?: boolean
  // Client fidélité et points utilisés, hors contenu signé
  customerId?: string
  loyaltyPointsUsed?: number
}

export interface RecordedSale {
  clientId: string
  terminalName: string
  receipt: TerminalReceipt
  pricing: ReturnType<typeof priceOrder>
}

export async function recordSale(siteId: string, input: SaleInput): Promise<RecordedSale> {
  const terminal = await getTerminal(siteId)
  if (!terminal) throw new TerminalNotRegisteredError()

  const pricing = priceOrder(
    input.items.map((i) => ({ unitPrice: i.unitPrice, quantity: i.quantity, discount: i.discount, taxRate: i.taxRate })),
    { priceIncludesTax: input.priceIncludesTax, orderDiscount: input.orderDiscount },
  )
  const paid = input.payments.reduce((a, p) => a + Math.round(p.amount * 100), 0)
  if (paid !== Math.round(pricing.total * 100)) {
    throw new Error('Le montant payé ne correspond pas au total')
  }

  const content: SignedSaleContent = {
    items: input.items,
    payments: input.payments,
    ...(input.orderDiscount ? { orderDiscount: input.orderDiscount } : {}),
  }
  const clientId = input.clientId ?? crypto.randomUUID()

  const recorded = await withLock(`terminal:${siteId}`, async () => {
    const current = await db.terminals.get(siteId)
    // Clé disparue entre-temps (stockage vidé) : on ne signe rien avec une autre
    if (!current) throw new TerminalNotRegisteredError()
    const { receipt, next } = await signSale(current.privateKey, current, {
      clientId,
      content,
      total: pricing.total,
      signedAt: new Date(),
    })
    const sale: SaleRecord = {
      clientId,
      siteId,
      terminalId: current.terminalId,
      counter: receipt.counter,
      status: 'pending',
      total: pricing.total,
      createdAt: Date.now(),
      attempts: 0,
      payload: {
        clientId,
        terminalId: current.terminalId,
        ...content,
        customerEmail: input.customerEmail,
        note: input.note,
        ...(input.nonResident ? { nonResident: true } : {}),
        ...(input.customerId ? { customerId: input.customerId } : {}),
        ...(input.loyaltyPointsUsed ? { loyaltyPointsUsed: input.loyaltyPointsUsed } : {}),
        receipt,
      },
    }
    // Compteur de la caisse et vente enregistrés ensemble, ou pas du tout.
    // Si l'écriture échoue (stockage plein, base fermée), la transaction est
    // annulée : le compteur n'avance pas, aucun trou dans la chaîne des
    // tickets, et le vendeur voit l'échec au lieu d'un ticket qui n'existe pas.
    try {
      await db.transaction('rw', db.terminals, db.sales, async () => {
        await db.terminals.update(siteId, { counter: next.counter, lastHash: next.lastHash })
        await db.sales.add(sale)
      })
      // Relecture : on ne remet un ticket qu'une fois la vente retrouvée sur l'appareil
      if (!(await db.sales.where('clientId').equals(clientId).first())) throw new Error('vente introuvable après écriture')
    } catch (e) {
      throw new SaleStorageError(classifyStorageError(e), e)
    }
    return { clientId, terminalName: current.name, receipt, pricing }
  })

  void flushSales(siteId)
  return recorded
}

export interface FlushResult {
  synced: number
  rejected: number
  remaining: number
}

// Envoie les ventes en attente, dans l'ordre des tickets. S'arrête à la
// première coupure réseau : on réessaiera au retour de la connexion.
export async function flushSales(siteId: string): Promise<FlushResult> {
  return withLock(`sync:${siteId}`, async () => {
    const result: FlushResult = { synced: 0, rejected: 0, remaining: 0 }
    const all = await db.sales.where('[siteId+status]').equals([siteId, 'pending']).sortBy('counter')
    // Chaque caisse a sa propre chaîne : on envoie caisse par caisse, dans l'ordre
    // des tickets (cas d'une ancienne caisse réimportée à côté de la nouvelle)
    const pending = all.sort((a, b) => (a.terminalId < b.terminalId ? -1 : a.terminalId > b.terminalId ? 1 : a.counter - b.counter))
    const stuck = new Set<string>() // caisses dont la chaîne attend un ticket manquant

    for (const sale of pending) {
      if (stuck.has(sale.terminalId)) continue
      let res: Response
      try {
        res = await authorizedFetch(`/sites/${siteId}/orders/sync`, {
          method: 'POST',
          body: JSON.stringify(sale.payload),
        })
      } catch {
        break // hors ligne
      }

      if (res.ok) {
        const order = (await res.json()) as { id: string }
        await db.sales.update(sale.id!, { status: 'synced', orderId: order.id, error: undefined })
        result.synced++
        continue
      }

      const body = await res.json().catch(() => ({}))
      const message = Array.isArray(body?.message) ? body.message.join(' ') : String(body?.message ?? `HTTP ${res.status}`)
      if (res.status === 400 || res.status === 404 || res.status === 422) {
        // Refus définitif (ticket altéré, produit inconnu...) : à traiter par un responsable
        await db.sales.update(sale.id!, { status: 'rejected', error: message, attempts: sale.attempts + 1 })
        result.rejected++
        continue
      }
      // 409 (ordre des tickets), 401, 5xx : on garde la vente et on réessaiera
      await db.sales.update(sale.id!, { error: message, attempts: sale.attempts + 1 })
      if (res.status === 409) {
        stuck.add(sale.terminalId) // seule cette caisse attend, les autres continuent
        continue
      }
      break
    }

    result.remaining = await db.sales.where('[siteId+status]').equals([siteId, 'pending']).count()
    return result
  })
}

export function countSales(siteId: string) {
  return Promise.all([
    db.sales.where('[siteId+status]').equals([siteId, 'pending']).count(),
    db.sales.where('[siteId+status]').equals([siteId, 'rejected']).count(),
  ]).then(([pending, rejected]) => ({ pending, rejected }))
}

// Ventes en attente : combien, et depuis quand (alerte de stockage)
export async function pendingOverview(siteId: string): Promise<{ count: number; oldestAt: number | null }> {
  const pending = await db.sales.where('[siteId+status]').equals([siteId, 'pending']).toArray()
  return { count: pending.length, oldestAt: pending.length ? Math.min(...pending.map((s) => s.createdAt)) : null }
}

// Connexion par code vendeur : la caisse signe la demande avec sa clé,
// le serveur sait ainsi que le code est tapé sur une caisse enregistrée
export async function signPinChallenge(siteId: string, purpose: 'pin-login' | 'pin-offline' = 'pin-login') {
  const terminal = await db.terminals.get(siteId)
  if (!terminal) throw new TerminalNotRegisteredError()
  const signedAt = new Date().toISOString()
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    terminal.privateKey,
    new TextEncoder().encode(`${purpose}:${terminal.terminalId}:${signedAt}`),
  )
  let b = ''
  for (const x of new Uint8Array(sig)) b += String.fromCharCode(x)
  return { terminalId: terminal.terminalId, signedAt, signature: btoa(b) }
}

// Met à jour la liste des personnes que la caisse reconnaît sans réseau :
// au démarrage, au retour de la connexion, puis régulièrement. Sans réseau ou
// sans session, on garde ce qu'on a (l'expiration à 7 jours s'applique).
export async function syncOfflineRoster(siteId: string): Promise<boolean> {
  if (!localStorage.getItem('access_token') || !(await db.terminals.get(siteId))) return false
  let res: Response
  try {
    res = await authorizedFetch('/auth/pin/offline', { method: 'POST', body: JSON.stringify(await signPinChallenge(siteId, 'pin-offline')) })
  } catch {
    return false
  }
  if (!res.ok) return false
  await applyOfflineRoster(siteId, (await res.json()) as OfflineRoster)
  return true
}

// Caisses enregistrées sur cet appareil (une par boutique)
export async function localTerminals() {
  return (await db.terminals.toArray()).map((t) => ({ siteId: t.siteId, terminalId: t.terminalId, name: t.name }))
}
