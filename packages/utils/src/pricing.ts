// Calcul des montants d'une vente, partagé entre la caisse (y compris hors
// ligne) et le serveur : les deux doivent produire exactement le même total,
// sinon le ticket signé en caisse ne correspondrait plus à la commande.
// Tous les calculs se font en centimes entiers.

export interface PricingLineInput {
  unitPrice: number // prix unitaire tel que saisi (TTC ou HT selon l'organisation)
  quantity: number
  discount?: number // remise en euros sur la ligne, dans la même base que le prix
  taxRate: number // en %, ex. 20
}

export interface PricingOptions {
  priceIncludesTax: boolean
  orderDiscount?: number // remise globale en euros, dans la même base que les prix
}

export interface PricedLine {
  ht: number
  tax: number
  ttc: number
}

export interface PricedOrder {
  lines: PricedLine[]
  subtotal: number // total HT
  taxAmount: number
  total: number // total TTC à encaisser
  discount: number // remise globale réellement appliquée
  taxBreakdown: Array<{ rate: number; ht: number; tax: number }>
}

const toCents = (euros: number) => Math.round(euros * 100)
const toEuros = (cents: number) => cents / 100

export function priceOrder(lines: PricingLineInput[], options: PricingOptions): PricedOrder {
  // Montant de chaque ligne après remise de ligne, dans la base de saisie
  const gross = lines.map((l) => {
    const amount = toCents(l.unitPrice * l.quantity) - toCents(l.discount ?? 0)
    return Math.max(0, amount)
  })
  const grossTotal = gross.reduce((a, b) => a + b, 0)

  // La remise globale est répartie au prorata des lignes pour que la TVA
  // de chaque taux reste juste ; le reliquat d'arrondi va à la dernière ligne
  const orderDiscount = Math.min(toCents(options.orderDiscount ?? 0), grossTotal)
  const shares = gross.map((g) => (grossTotal === 0 ? 0 : Math.floor((g * orderDiscount) / grossTotal)))
  const remainder = orderDiscount - shares.reduce((a, b) => a + b, 0)
  if (remainder > 0) {
    let last = gross.length - 1
    while (last > 0 && gross[last] === 0) last--
    shares[last] += remainder
  }

  const priced = lines.map((l, i) => {
    const net = gross[i] - shares[i]
    if (options.priceIncludesTax) {
      const ht = Math.round(net / (1 + l.taxRate / 100))
      return { ht, tax: net - ht, ttc: net }
    }
    const tax = Math.round((net * l.taxRate) / 100)
    return { ht: net, tax, ttc: net + tax }
  })

  const byRate = new Map<number, { ht: number; tax: number }>()
  priced.forEach((p, i) => {
    const entry = byRate.get(lines[i].taxRate) ?? { ht: 0, tax: 0 }
    entry.ht += p.ht
    entry.tax += p.tax
    byRate.set(lines[i].taxRate, entry)
  })

  const sum = (key: keyof PricedLine) => priced.reduce((a, p) => a + p[key], 0)

  return {
    lines: priced.map((p) => ({ ht: toEuros(p.ht), tax: toEuros(p.tax), ttc: toEuros(p.ttc) })),
    subtotal: toEuros(sum('ht')),
    taxAmount: toEuros(sum('tax')),
    total: toEuros(sum('ttc')),
    discount: toEuros(orderDiscount),
    taxBreakdown: [...byRate.entries()]
      .sort(([a], [b]) => a - b)
      .map(([rate, v]) => ({ rate, ht: toEuros(v.ht), tax: toEuros(v.tax) })),
  }
}
