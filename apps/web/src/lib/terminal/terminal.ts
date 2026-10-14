'use client'

import { ECDSA_PARAMS, RECEIPT_GENESIS_HASH, priceOrder, type SignedSaleContent } from '@erp/utils'
import { authorizedFetch } from '@/lib/api/client'
import { db, type SaleRecord, type TerminalRecord } from '@/lib/offline/db'
import { signSale, type TerminalReceipt } from './signer'

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
    const current = (await db.terminals.get(siteId))!
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
        receipt,
      },
    }
    // Compteur de la caisse et vente enregistrés ensemble, ou pas du tout
    await db.transaction('rw', db.terminals, db.sales, async () => {
      await db.terminals.update(siteId, { counter: next.counter, lastHash: next.lastHash })
      await db.sales.add(sale)
    })
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
    const pending = await db.sales.where('[siteId+status]').equals([siteId, 'pending']).sortBy('counter')

    for (const sale of pending) {
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

// Connexion par code vendeur : la caisse signe la demande avec sa clé,
// le serveur sait ainsi que le code est tapé sur une caisse enregistrée
export async function signPinChallenge(siteId: string) {
  const terminal = await db.terminals.get(siteId)
  if (!terminal) throw new TerminalNotRegisteredError()
  const signedAt = new Date().toISOString()
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    terminal.privateKey,
    new TextEncoder().encode(`pin-login:${terminal.terminalId}:${signedAt}`),
  )
  let b = ''
  for (const x of new Uint8Array(sig)) b += String.fromCharCode(x)
  return { terminalId: terminal.terminalId, signedAt, signature: btoa(b) }
}

// Caisses enregistrées sur cet appareil (une par boutique)
export async function localTerminals() {
  return (await db.terminals.toArray()).map((t) => ({ siteId: t.siteId, terminalId: t.terminalId, name: t.name }))
}
