import { createHash } from 'crypto'
import { canonicalSaleContent, stableStringify, type SignedSaleContent } from '@erp/utils'
import { draftContent, type OrderDraft } from '../orders/order-draft'

// Recalcul de l'empreinte de contenu d'un ticket (ReceiptChain.contentDigest)
// à partir de la vente telle qu'elle est stockée. Trois formats coexistent,
// tous figés : ils ne changent jamais.
//   - vente signée par une caisse : canonicalSaleContent (packages/utils)
//   - vente encaissée par le serveur : draftContent (orders/order-draft.ts)
//   - remboursement : JSON canonique écrit par refunds.service.ts
// Fonction pure : aucune lecture en base.

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

type Num = { toString(): string } | number | string

export interface StoredSaleItem {
  id: string
  refundOfItemId: string | null
  productId: string
  variantId: string | null
  name: string
  variantName: string | null
  serialNumber: string | null
  price: Num
  taxRate: Num
  quantity: number
  discount: Num
  modifiers: unknown
  menuProductId: string | null
  menuName: string | null
  menuGroup: number | null
  weight: Num | null
  scaleLabel: string | null
  // Article libre : son nom vient de la caisse et fait partie du contenu signé
  product?: { isCustom: boolean } | null
}

export interface StoredSalePayment {
  id?: string
  code: string
  label?: string
  kind: string
  amount: Num
  reference: string | null
}

export interface StoredSale {
  kind: string
  refundOfId: string | null
  total: Num
  discount: Num
  items: StoredSaleItem[]
  payments: StoredSalePayment[]
}

export interface StoredReceipt {
  terminalId: string | null
  total: Num
}

// unverifiable : trop de montants possibles pour trancher (remboursement de nombreuses lignes en quantités)
export type DigestCheck = 'ok' | 'altered' | 'unverifiable'

// Plafond de combinaisons essayées pour un remboursement (voir refundCandidates)
const MAX_REFUND_TRIES = 20000

const n = (v: Num) => Number(v.toString())
const byId = <T extends { id: string }>(list: T[]) => [...list].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

interface StoredModifier { id: string; name: string; price: number }
function modifiersOf(raw: unknown): StoredModifier[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  return raw.map((m) => ({ id: String((m as StoredModifier).id), name: String((m as StoredModifier).name), price: Number((m as StoredModifier).price) }))
}

// Vente signée par une caisse : le contenu signé est celui reçu à la synchronisation.
// Deux informations ne sont pas conservées telles quelles (voir les limites du
// rapport) : le poids d'une ligne à étiquette de balance (lu sur l'étiquette ou
// envoyé par la caisse) et la référence d'un paiement carte (rattachée par le
// serveur depuis le TPE connecté). On accepte donc les variantes possibles.
function terminalDigests(sale: StoredSale): string[] {
  const items = byId(sale.items)
  const variants: string[] = []
  for (const dropLabelWeight of [false, true]) {
    for (const dropCardRef of [false, true]) {
      const content: SignedSaleContent = {
        items: items.map((i) => {
          const mods = modifiersOf(i.modifiers)
          const weight = i.weight !== null ? n(i.weight) : null
          return {
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
            unitPrice: n(i.price),
            taxRate: n(i.taxRate),
            discount: n(i.discount),
            serialNumber: i.serialNumber,
            customName: i.product?.isCustom ? i.name : null,
            modifiers: mods ? mods.map((m) => m.id) : null,
            menu: i.menuProductId ? { productId: i.menuProductId, group: i.menuGroup ?? 0 } : null,
            weight: dropLabelWeight && i.scaleLabel ? null : weight,
            label: i.scaleLabel,
          }
        }),
        payments: byId(sale.payments as Array<StoredSalePayment & { id: string }>).map((p) => ({
          code: p.code,
          amount: n(p.amount),
          reference: dropCardRef && p.kind === 'CARD' ? null : p.reference,
        })),
        orderDiscount: n(sale.discount),
      }
      variants.push(sha256(canonicalSaleContent(content)))
    }
  }
  return [...new Set(variants)]
}

// Vente encaissée par le serveur : on reconstruit le brouillon dont l'empreinte a été scellée
function serverDigest(sale: StoredSale): string {
  const draft = {
    items: byId(sale.items).map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      name: i.name,
      variantName: i.variantName,
      serialNumber: i.serialNumber,
      price: n(i.price),
      taxRate: n(i.taxRate),
      quantity: i.quantity,
      discount: n(i.discount),
      modifiers: modifiersOf(i.modifiers),
      menuProductId: i.menuProductId,
      menuName: i.menuName,
      menuGroup: i.menuGroup,
      weight: i.weight !== null ? n(i.weight) : null,
      scaleLabel: i.scaleLabel,
    })),
    payments: byId(sale.payments as Array<StoredSalePayment & { id: string }>).map((p) => ({
      code: p.code,
      amount: n(p.amount),
      ...(p.reference ? { reference: p.reference } : {}),
    })),
    pricing: { discount: n(sale.discount), total: n(sale.total) },
  } as unknown as OrderDraft
  return sha256(draftContent(draft))
}

// Remboursement : le contenu signé contient le montant TTC rendu par ligne, mais
// seul le prix unitaire arrondi (price = ttc / quantité, 2 décimales) est stocké.
// On retrouve donc les montants possibles : ceux qui donnent ce prix arrondi et
// dont la somme est le total du ticket. Une ligne de quantité 1 n'a qu'un candidat.
function refundDigestCheck(sale: StoredSale, receipt: StoredReceipt, digest: string): DigestCheck {
  if (sale.payments.length !== 1) return 'altered'
  const items = byId(sale.items)
  const payment = sale.payments[0]
  const totalCents = Math.round(Math.abs(n(receipt.total)) * 100)

  const ranges = items.map((i) => {
    const p = Math.round(Math.abs(n(i.price)) * 100)
    const q = i.quantity
    // c / q arrondi (demi vers le haut) à p centimes  <=>  (2p - 1) q <= 2c < (2p + 1) q
    return { min: Math.ceil(((2 * p - 1) * q) / 2), max: Math.ceil(((2 * p + 1) * q) / 2) - 1 }
  })
  // Somme restante atteignable : élague les branches impossibles
  const maxAfter = new Array<number>(items.length + 1).fill(0)
  const minAfter = new Array<number>(items.length + 1).fill(0)
  for (let k = items.length - 1; k >= 0; k--) {
    maxAfter[k] = maxAfter[k + 1] + ranges[k].max
    minAfter[k] = minAfter[k + 1] + ranges[k].min
  }

  let tries = 0
  const chosen: number[] = []
  const build = () =>
    stableStringify({
      refundOf: sale.refundOfId,
      lines: items.map((i, k) => ({
        orderItemId: i.refundOfItemId,
        quantity: i.quantity,
        ttc: (chosen[k] / 100).toFixed(2),
        taxRate: n(i.taxRate).toFixed(2),
      })),
      payment: { code: payment.code, amount: n(payment.amount).toFixed(2), reference: payment.reference ?? null },
    })

  const walk = (k: number, left: number): boolean => {
    if (k === items.length) {
      if (left !== 0 || ++tries > MAX_REFUND_TRIES) return false
      return sha256(build()) === digest
    }
    if (left < minAfter[k] || left > maxAfter[k]) return false
    for (let c = ranges[k].min; c <= ranges[k].max; c++) {
      chosen[k] = c
      if (walk(k + 1, left - c)) return true
      if (tries > MAX_REFUND_TRIES) return false
    }
    return false
  }
  if (walk(0, totalCents)) return 'ok'
  return tries > MAX_REFUND_TRIES ? 'unverifiable' : 'altered'
}

// Le contenu stocké de la vente correspond-il à l'empreinte scellée dans le ticket ?
export function checkSaleDigest(receipt: StoredReceipt, kind: string, sale: StoredSale, digest: string): DigestCheck {
  if (kind === 'REFUND') return refundDigestCheck(sale, receipt, digest)
  if (receipt.terminalId) return terminalDigests(sale).includes(digest) ? 'ok' : 'altered'
  return serverDigest(sale) === digest ? 'ok' : 'altered'
}
