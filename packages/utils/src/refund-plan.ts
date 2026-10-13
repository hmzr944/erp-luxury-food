// Calcul d'un remboursement à partir de la vente d'origine. On rembourse ce
// qui a réellement été payé : la remise globale de la vente est répartie sur
// les lignes, et le dernier retour solde exactement le reste au centime.

export interface RefundSourceItem {
  id: string
  name: string
  quantity: number
  price: number // prix unitaire de la vente
  discount: number // remise de ligne
  taxRate: number
}

export interface RefundRequestLine {
  orderItemId: string
  quantity: number
}

export interface PlannedRefundLine {
  orderItemId: string
  name: string
  quantity: number
  price: number
  taxRate: number
  ttc: number
  ht: number
  tax: number
}

export class RefundPlanError extends Error {}

const cents = (n: number) => Math.round(n * 100)

export function planRefund(input: {
  total: number // total TTC payé pour la vente
  items: RefundSourceItem[]
  alreadyRefundedQty: Record<string, number>
  alreadyRefundedAmount: number // montant déjà remboursé (positif)
  lines: RefundRequestLine[]
}): { lines: PlannedRefundLine[]; total: number; subtotal: number; taxAmount: number; closesSale: boolean } {
  const requested = input.lines.filter((l) => l.quantity > 0)
  if (!requested.length) throw new RefundPlanError('Choisissez au moins un article à rembourser')

  // Part du total payé revenant à chaque ligne (au prorata de son montant)
  const gross = input.items.map((i) => Math.max(0, cents(i.price * i.quantity) - cents(i.discount)))
  const grossSum = gross.reduce((a, b) => a + b, 0)
  const totalCents = cents(input.total)
  const paid = gross.map((g) => (grossSum ? Math.floor((g * totalCents) / grossSum) : 0))
  const gap = totalCents - paid.reduce((a, b) => a + b, 0)
  if (gap) {
    let last = paid.length - 1
    while (last > 0 && gross[last] === 0) last--
    paid[last] += gap
  }

  const byId = new Map(input.items.map((item, i) => [item.id, { item, paid: paid[i] }]))
  const seen = new Set<string>()
  const lines: PlannedRefundLine[] = requested.map((r) => {
    const entry = byId.get(r.orderItemId)
    if (!entry) throw new RefundPlanError('Article introuvable dans cette vente')
    if (seen.has(r.orderItemId)) throw new RefundPlanError(`${entry.item.name} apparaît deux fois`)
    seen.add(r.orderItemId)
    const left = entry.item.quantity - (input.alreadyRefundedQty[r.orderItemId] ?? 0)
    if (left <= 0) throw new RefundPlanError(`${entry.item.name} : déjà entièrement remboursé`)
    if (!Number.isInteger(r.quantity) || r.quantity > left) {
      throw new RefundPlanError(`${entry.item.name} : ${left} au plus à rembourser`)
    }
    const ttcCents = Math.round((entry.paid * r.quantity) / entry.item.quantity)
    return { orderItemId: r.orderItemId, name: entry.item.name, quantity: r.quantity, price: entry.item.price, taxRate: entry.item.taxRate, ttc: ttcCents, ht: 0, tax: 0 }
  })

  // Tout est rendu : on rembourse exactement ce qui reste, sans centime d'écart
  const closesSale = input.items.every(
    (i) => (input.alreadyRefundedQty[i.id] ?? 0) + (requested.find((r) => r.orderItemId === i.id)?.quantity ?? 0) >= i.quantity,
  )
  const remaining = totalCents - cents(input.alreadyRefundedAmount)
  let sum = lines.reduce((a, l) => a + l.ttc, 0)
  if (closesSale && sum !== remaining) {
    lines[lines.length - 1].ttc += remaining - sum
    sum = remaining
  }
  if (sum > remaining) throw new RefundPlanError('Le remboursement dépasse le montant encore remboursable')

  for (const l of lines) {
    const ht = Math.round(l.ttc / (1 + l.taxRate / 100))
    l.ht = ht / 100
    l.tax = (l.ttc - ht) / 100
    l.ttc = l.ttc / 100
  }
  const total = sum / 100
  const subtotal = Math.round(lines.reduce((a, l) => a + l.ht * 100, 0)) / 100
  return { lines, total, subtotal, taxAmount: Math.round((total - subtotal) * 100) / 100, closesSale }
}
