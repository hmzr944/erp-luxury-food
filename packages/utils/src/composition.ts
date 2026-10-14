// Options, suppléments et formules : passage d'une ligne de caisse aux
// lignes vendues. Partagé entre la caisse (qui signe) et le serveur (qui
// vérifie) : les deux doivent obtenir les mêmes prix au centime.
//
// Une formule est vendue à un prix unique mais ses composants peuvent
// relever de taux de TVA différents (plat à 10 %, boisson alcoolisée à
// 20 %...). Le prix de la formule est donc réparti entre ses composants au
// prorata de leur prix de vente à la carte, et chaque composant devient une
// ligne vendue avec son propre taux. Les suppléments d'un composant et ses
// options payantes lui reviennent en entier.

export interface ModifierChoice {
  id: string
  name: string
  price: number // supplément TTC (ou HT selon l'organisation), 0 si gratuit
}

export interface MenuPart {
  productId: string
  variantId?: string | null
  name: string
  variantName?: string | null
  taxRate: number
  // Prix du composant vendu seul : base de la répartition
  alaCarte: number
  // Supplément demandé pour ce choix dans la formule (« dessert du jour +1 € »)
  supplement?: number
  modifiers?: ModifierChoice[]
  mealVoucher?: boolean
}

export interface MenuPricing {
  // Prix unitaire de chaque composant, dans l'ordre des composants
  unitPrices: number[]
  // Prix unitaire total de la formule
  total: number
}

const toCents = (n: number) => Math.round(n * 100)

// Répartit `total` centimes au prorata de `weights`. Le reliquat d'arrondi
// va à la dernière part de poids non nul. Poids tous nuls : parts égales.
export function splitCents(total: number, weights: number[]): number[] {
  if (!weights.length) return []
  const w = weights.some((x) => x > 0) ? weights.map((x) => Math.max(0, x)) : weights.map(() => 1)
  const sum = w.reduce((a, b) => a + b, 0)
  const shares = w.map((x) => Math.floor((total * x) / sum))
  const rest = total - shares.reduce((a, b) => a + b, 0)
  if (rest) {
    let last = w.length - 1
    while (last > 0 && w[last] === 0) last--
    shares[last] += rest
  }
  return shares
}

export const modifiersTotal = (mods: ModifierChoice[] = []) => mods.reduce((a, m) => a + toCents(m.price), 0) / 100

// Prix unitaire d'un article avec ses options payantes
export const priceWithModifiers = (base: number, mods: ModifierChoice[] = []) => (toCents(base) + toCents(modifiersTotal(mods))) / 100

export function priceMenu(menuPrice: number, parts: MenuPart[]): MenuPricing {
  const shares = splitCents(toCents(menuPrice), parts.map((p) => toCents(p.alaCarte)))
  const unit = parts.map((p, i) => shares[i] + toCents(p.supplement ?? 0) + toCents(modifiersTotal(p.modifiers)))
  return { unitPrices: unit.map((c) => c / 100), total: unit.reduce((a, b) => a + b, 0) / 100 }
}

// Remise d'une ligne de formule répartie sur ses composants, au prorata de
// leur montant : la somme des remises est exactement la remise saisie
export function splitDiscount(discount: number, amounts: number[]): number[] {
  if (!discount) return amounts.map(() => 0)
  return splitCents(toCents(discount), amounts.map(toCents)).map((c) => c / 100)
}

// Libellé des options d'une ligne : « Saignante, Cheddar +1,00 »
export function modifiersLabel(mods: Array<{ name: string; price: number }> = []): string {
  return mods.map((m) => (m.price ? `${m.name} +${m.price.toFixed(2).replace('.', ',')}` : m.name)).join(', ')
}
