import {
  DEFAULT_SCALE_RULES,
  modifiersTotal,
  parseScaleBarcode,
  priceForWeight,
  priceMenu,
  priceOrder,
  stableStringify,
  type ModifierChoice,
  type PricedOrder,
  type ScaleBarcodeRule,
} from '@erp/utils'

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
  // Options proposées par ses groupes d'options
  modifiers?: ModifierChoice[]
  modifierGroups?: Array<{ name: string; minSelect: number; maxSelect: number | null; modifierIds: string[] }>
  // Formule : étapes et articles proposés
  isMenu?: boolean
  menuSteps?: Array<{
    name: string
    minSelect: number
    maxSelect: number
    choices: Array<{ productId: string; variantId: string | null; supplement: number }>
  }>
  // Vente au poids : price est le prix au kilo
  soldByWeight?: boolean
  scaleCode?: string | null
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
  // Options choisies (identifiants)
  modifiers?: string[]
  // Composant d'une formule
  menu?: { productId: string; group: number }
  // Article pesé : poids en kg, étiquette de balance scannée
  weight?: number
  label?: string
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
  // Étiquettes de balance de l'organisation
  scaleRules?: ScaleBarcodeRule[]
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
    modifiers: ModifierChoice[] | null
    menuProductId: string | null
    menuName: string | null
    menuGroup: number | null
    weight: number | null
    pricePerKg: number | null
    scaleLabel: string | null
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
  const ids = [...input.items.map((i) => i.productId), ...input.items.flatMap((i) => (i.menu ? [i.menu.productId] : []))]
  const missing = [...new Set(ids)].filter((id) => !byId.has(id))
  if (missing.length) throw new OrderDraftError(`Produits introuvables : ${missing.join(', ')}`)
  const signed = !!input.useSignedPrices

  const priceDifferences: string[] = []
  const resolved = input.items.map((item) => {
    const product = byId.get(item.productId)!
    if (product.isMenu) throw new OrderDraftError(`${product.name} est une formule : vendez ses composants`)
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

    // Options : connues du produit, sinon (vente signée, option supprimée depuis) signalées
    const available = new Map((product.modifiers ?? []).map((m) => [m.id, m]))
    const modifiers = [...new Set(item.modifiers ?? [])].map((id) => {
      const m = available.get(id)
      if (m) return { id: m.id, name: m.name, price: m.price }
      if (!signed) throw new OrderDraftError(`Option inconnue pour ${product.name}`)
      priceDifferences.push(`${product.name} : option ${id} inconnue du catalogue`)
      return { id, name: 'Option retirée du catalogue', price: 0 }
    })
    // Choix obligatoires et maximums de chaque groupe (la vente signée a déjà eu lieu)
    if (!signed) {
      for (const g of product.modifierGroups ?? []) {
        const n = modifiers.filter((m) => g.modifierIds.includes(m.id)).length
        if (n < g.minSelect) throw new OrderDraftError(`${product.name} : choisissez ${g.name.toLowerCase()}`)
        if (g.maxSelect !== null && n > g.maxSelect) throw new OrderDraftError(`${product.name} : ${g.maxSelect} choix au plus pour ${g.name.toLowerCase()}`)
      }
    }

    // Vente au poids : poids saisi ou lu sur l'étiquette de la balance
    let weight: number | null = null
    let labelPrice: number | null = null
    let scaleLabel: string | null = null
    if (item.label) {
      const parsed = parseScaleBarcode(item.label, input.scaleRules ?? DEFAULT_SCALE_RULES)
      if (!parsed) throw new OrderDraftError(`Étiquette de balance illisible pour ${product.name}`)
      if (product.scaleCode && parsed.code !== product.scaleCode.replace(/^0+(?=\d)/, '')) {
        throw new OrderDraftError(`L'étiquette ${item.label} ne correspond pas à ${product.name}`)
      }
      scaleLabel = parsed.barcode
      if (parsed.weight !== undefined) weight = parsed.weight
      if (parsed.price !== undefined) labelPrice = parsed.price
    }
    if (item.weight !== undefined && item.weight !== null) {
      if (weight !== null && Math.round(weight * 1000) !== Math.round(item.weight * 1000)) {
        throw new OrderDraftError(`Poids de ${product.name} différent de celui de l'étiquette`)
      }
      weight = item.weight
    }
    const weighed = weight !== null || labelPrice !== null
    if (weighed && !product.soldByWeight) throw new OrderDraftError(`${product.name} ne se vend pas au poids`)
    if (product.soldByWeight && !weighed) throw new OrderDraftError(`Poids manquant pour ${product.name}`)
    if (weighed && item.quantity !== 1) throw new OrderDraftError(`Un article pesé par ligne pour ${product.name}`)
    if (weighed && item.menu) throw new OrderDraftError(`${product.name} pesé ne peut pas entrer dans une formule`)

    // Prix catalogue de l'article seul (prix au kilo pour un article pesé)
    const alaCarte = variant?.price ?? product.price
    const unitCatalog = labelPrice ?? (weight !== null ? priceForWeight(weight, product.price) : alaCarte)
    return {
      item,
      product,
      variant,
      modifiers,
      weight,
      pricePerKg: weighed ? product.price : null,
      scaleLabel,
      alaCarte,
      catalogPrice: Math.round((unitCatalog + modifiersTotal(modifiers)) * 100) / 100,
    }
  })

  // Formules : le prix de la formule est réparti entre ses composants
  const groups = new Map<number, number[]>()
  resolved.forEach((r, i) => {
    if (!r.item.menu) return
    const list = groups.get(r.item.menu.group) ?? []
    list.push(i)
    groups.set(r.item.menu.group, list)
  })
  for (const [group, indexes] of groups) {
    const menu = byId.get(input.items[indexes[0]].menu!.productId)!
    if (!menu.isMenu) throw new OrderDraftError(`${menu.name} n'est pas une formule`)
    if (indexes.some((i) => input.items[i].menu!.productId !== menu.id)) {
      throw new OrderDraftError(`Formule n° ${group} : composants de formules différentes`)
    }
    const quantity = input.items[indexes[0]].quantity
    if (indexes.some((i) => input.items[i].quantity !== quantity)) {
      throw new OrderDraftError(`${menu.name} : tous les composants doivent avoir la même quantité`)
    }
    const steps = menu.menuSteps ?? []
    const used = steps.map(() => 0)
    const parts = indexes.map((i) => {
      const r = resolved[i]
      // Choix rattaché à la première étape qui le propose et n'est pas pleine
      let supplement = 0
      const stepIndex = steps.findIndex(
        (st, k) => used[k] < st.maxSelect && st.choices.some((c) => c.productId === r.product.id && (!c.variantId || c.variantId === r.variant?.id)),
      )
      if (stepIndex < 0) {
        if (!signed) throw new OrderDraftError(`${r.product.name} ne fait pas partie de la formule ${menu.name}`)
        priceDifferences.push(`${menu.name} : ${r.product.name} hors formule au catalogue`)
      } else {
        used[stepIndex]++
        const choice = steps[stepIndex].choices.find((c) => c.productId === r.product.id && (!c.variantId || c.variantId === r.variant?.id))!
        supplement = choice.supplement
      }
      return { productId: r.product.id, name: r.product.name, taxRate: r.product.taxRate, alaCarte: r.alaCarte, supplement, modifiers: r.modifiers }
    })
    if (!signed) {
      const short = steps.find((st, k) => used[k] < st.minSelect)
      if (short) throw new OrderDraftError(`${menu.name} : choisissez ${short.name.toLowerCase()}`)
    }
    const priced = priceMenu(menu.price, parts)
    indexes.forEach((i, k) => {
      resolved[i].catalogPrice = priced.unitPrices[k]
    })
  }

  const items = resolved.map((r) => {
    const { item, product, variant } = r
    let price = r.catalogPrice
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
    } else if (signed) {
      if (item.unitPrice === undefined || item.taxRate === undefined) {
        throw new OrderDraftError(`Prix signé manquant pour ${product.name}`)
      }
      price = item.unitPrice
      taxRate = item.taxRate
      if (price !== r.catalogPrice || taxRate !== product.taxRate) {
        priceDifferences.push(`${product.name}${variant ? ` ${variant.name}` : ''} : ${price} (catalogue ${r.catalogPrice})`)
      }
    }
    const menu = item.menu ? byId.get(item.menu.productId)! : null
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
      modifiers: r.modifiers.length ? r.modifiers : null,
      menuProductId: menu?.id ?? null,
      menuName: menu?.name ?? null,
      menuGroup: item.menu?.group ?? null,
      weight: r.weight,
      pricePerKg: r.pricePerKg,
      scaleLabel: r.scaleLabel,
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
      // Absents (undefined) pour une ligne simple : l'empreinte des ventes sans
      // option ni formule ne change pas
      modifiers: i.modifiers?.map((m) => ({ id: m.id, name: m.name, price: m.price.toFixed(2) })),
      menu: i.menuProductId ? { productId: i.menuProductId, name: i.menuName, group: i.menuGroup } : undefined,
      weight: i.weight !== null ? i.weight.toFixed(3) : undefined,
      label: i.scaleLabel ?? undefined,
    })),
    payments: draft.payments.map((p) => ({ code: p.code, amount: p.amount.toFixed(2), reference: p.reference ?? null })),
    discount: draft.pricing.discount.toFixed(2),
    total: draft.pricing.total.toFixed(2),
  })
}
