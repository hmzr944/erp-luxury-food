import { priceOrder, type PricedOrder } from '@erp/utils'
import { stableStringify } from '@erp/utils'

// Construit le contenu d'une vente à partir des données en base.
// Fonction pure : utilisée à l'encaissement en ligne et pour vérifier les
// tickets signés hors ligne par une caisse.

export interface DraftProduct {
  id: string
  name: string
  price: number
  taxRate: number
  tracking: string
  isCustom?: boolean
  variants: Array<{ id: string; name: string; price: number }>
}

export interface DraftItemInput {
  productId: string
  variantId?: string
  quantity: number
  discount?: number
  serialNumber?: string
  // Vente signée par une caisse : prix et taux réellement appliqués
  unitPrice?: number
  taxRate?: number
  // Article libre : nom saisi en caisse
  customName?: string
}

export interface DraftPaymentMethod {
  code: string
  label: string
  kind: string
}

export interface DraftInput {
  items: DraftItemInput[]
  products: DraftProduct[]
  priceIncludesTax: boolean
  orderDiscount?: number
  paymentMethods: DraftPaymentMethod[]
  payments?: Array<{ code: string; amount: number; reference?: string | null }>
  // Ancien format : un seul moyen de paiement pour tout le montant
  paymentMode?: string
  // Vente signée par une caisse : le ticket fait foi, on garde ses prix
  // (le catalogue a pu changer entre la vente hors ligne et la synchro)
  useSignedPrices?: boolean
}

export interface OrderDraft {
  items: Array<{
    productId: string
    variantId: string | null
    name: string
    variantName: string | null
    serialNumber: string | null
    price: number
    taxRate: number
    quantity: number
    discount: number
  }>
  pricing: PricedOrder
  // reference : identifiant chez le prestataire du TPE connecté, s'il y en a un
  payments: Array<DraftPaymentMethod & { amount: number; reference?: string }>
  paymentMode: string
  // Lignes dont le prix signé diffère du catalogue actuel
  priceDifferences: string[]
}

export class OrderDraftError extends Error {}

const LEGACY_MODES = ['CARD', 'CASH', 'INVOICE', 'TICKET_RESTO']

export function buildOrderDraft(input: DraftInput): OrderDraft {
  const byId = new Map(input.products.map((p) => [p.id, p]))
  const missing = [...new Set(input.items.map((i) => i.productId))].filter((id) => !byId.has(id))
  if (missing.length) throw new OrderDraftError(`Produits introuvables : ${missing.join(', ')}`)

  const priceDifferences: string[] = []
  const items = input.items.map((item) => {
    const product = byId.get(item.productId)!
    const variant = item.variantId ? product.variants.find((v) => v.id === item.variantId) : undefined
    if (item.variantId && !variant) {
      throw new OrderDraftError(`Variante introuvable pour ${product.name}`)
    }
    if (!item.variantId && product.variants.length > 0) {
      throw new OrderDraftError(`Choisissez une variante pour ${product.name}`)
    }
    if (product.tracking === 'SERIAL') {
      if (!item.serialNumber) throw new OrderDraftError(`Numéro de série requis pour ${product.name}`)
      if (item.quantity !== 1) throw new OrderDraftError(`Un numéro de série par ligne pour ${product.name}`)
    }
    const catalogPrice = variant?.price ?? product.price
    let price = catalogPrice
    let taxRate = product.taxRate
    let name = product.name
    if (product.isCustom) {
      // Article libre : nom, prix et taux viennent de la caisse
      const custom = item.customName?.trim()
      if (!custom) throw new OrderDraftError("Nom manquant pour l'article libre")
      if (item.unitPrice === undefined || item.taxRate === undefined) {
        throw new OrderDraftError(`Prix manquant pour ${custom}`)
      }
      name = custom.slice(0, 120)
      price = item.unitPrice
      taxRate = item.taxRate
    } else if (input.useSignedPrices) {
      if (item.unitPrice === undefined || item.taxRate === undefined) {
        throw new OrderDraftError(`Prix signé manquant pour ${product.name}`)
      }
      price = item.unitPrice
      taxRate = item.taxRate
      if (price !== catalogPrice || taxRate !== product.taxRate) {
        priceDifferences.push(`${product.name}${variant ? ` ${variant.name}` : ''} : ${price} (catalogue ${catalogPrice})`)
      }
    }
    return {
      productId: product.id,
      variantId: variant?.id ?? null,
      name,
      variantName: variant?.name ?? null,
      serialNumber: item.serialNumber ?? null,
      price,
      taxRate,
      quantity: item.quantity,
      discount: item.discount ?? 0,
    }
  })

  const serials = items.filter((i) => i.serialNumber).map((i) => `${i.productId}:${i.serialNumber}`)
  if (new Set(serials).size !== serials.length) {
    throw new OrderDraftError('Le même numéro de série apparaît deux fois')
  }

  const pricing = priceOrder(
    items.map((i) => ({ unitPrice: i.price, quantity: i.quantity, discount: i.discount, taxRate: i.taxRate })),
    { priceIncludesTax: input.priceIncludesTax, orderDiscount: input.orderDiscount },
  )

  const methods = new Map(input.paymentMethods.map((m) => [m.code, m]))
  const requested =
    input.payments ?? [{ code: input.paymentMode ?? 'CARD', amount: pricing.total }]
  if (!requested.length) throw new OrderDraftError('Aucun paiement')

  const payments = requested.map((p) => {
    const method = methods.get(p.code)
    if (!method) throw new OrderDraftError(`Moyen de paiement inconnu ou désactivé : ${p.code}`)
    // Seul le code d'avoir vient de la caisse ; la référence d'un paiement
    // carte est rattachée par le serveur à partir du TPE connecté
    // Référence gardée : code d'avoir, numéro de chèque
    return { ...method, amount: p.amount, ...(p.reference ? { reference: p.reference } : {}) }
  })

  const paidCents = payments.reduce((a, p) => a + Math.round(p.amount * 100), 0)
  if (paidCents !== Math.round(pricing.total * 100)) {
    throw new OrderDraftError(
      `Les paiements (${(paidCents / 100).toFixed(2)}) ne correspondent pas au total (${pricing.total.toFixed(2)})`,
    )
  }

  // Colonne historique Order.paymentMode ; le détail fait foi dans OrderPayment
  const single = payments.length === 1 ? payments[0].code : null
  const paymentMode = single && LEGACY_MODES.includes(single) ? single : 'MIXED'

  return { items, pricing, payments, paymentMode, priceDifferences }
}

// Contenu canonique d'une vente pour le grand livre : lignes telles que
// facturées, paiements, remise globale. Son empreinte est scellée.
export function draftContent(draft: OrderDraft): string {
  return stableStringify({
    items: draft.items.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      name: i.name,
      variantName: i.variantName,
      serialNumber: i.serialNumber,
      price: i.price.toFixed(2),
      taxRate: i.taxRate.toFixed(2),
      quantity: i.quantity,
      discount: i.discount.toFixed(2),
    })),
    payments: draft.payments.map((p) => ({ code: p.code, amount: p.amount.toFixed(2), reference: p.reference ?? null })),
    discount: draft.pricing.discount.toFixed(2),
    total: draft.pricing.total.toFixed(2),
  })
}
