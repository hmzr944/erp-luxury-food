// Remises manuelles : calcul partagé entre la caisse (y compris hors ligne) et
// le serveur. Une remise est toujours une remise de ligne, en euros : c'est
// déjà ce que le ticket signé porte (champ `discount`), son format ne change
// pas. Une remise sur le ticket entier est répartie au prorata sur les lignes
// éligibles, la TVA de chaque taux reste donc juste. Tout se calcule en centimes.

// Un vendeur remise une ligne jusqu'à cette part de son prix. Au-delà, un
// responsable confirme par son code. Propriétaire et gérant : sans limite.
// Règle fixe en attendant un réglage par commerce (schéma non modifié).
export const SELLER_DISCOUNT_MAX_PERCENT = 20

export const DISCOUNT_REASONS = [
  { code: 'GESTE', label: 'Geste commercial' },
  { code: 'ABIME', label: 'Produit abîmé' },
  { code: 'DLC', label: 'DLC courte' },
  { code: 'FIDELITE', label: 'Fidélité' },
  { code: 'AUTRE', label: 'Autre' },
] as const

export type DiscountReasonCode = (typeof DISCOUNT_REASONS)[number]['code']

export const discountReasonLabel = (code?: string | null) => DISCOUNT_REASONS.find((r) => r.code === code)?.label ?? null

// Saisie d'une remise : un pourcentage du prix ou un montant en euros
export interface DiscountSpec {
  mode: 'percent' | 'amount'
  value: number
  reason?: DiscountReasonCode
}

const toCents = (euros: number) => Math.round(euros * 100)

// Peut remiser sans confirmation d'un responsable ?
export const isDiscountManager = (role?: string | null) => role === 'OWNER' || role === 'MANAGER'

// Remise en centimes pour une base donnée : jamais négative, jamais au-delà
// de la base (pas de total négatif), arrondie au centime le plus proche
export function discountCents(spec: DiscountSpec, baseCents: number): number {
  const base = Math.max(0, Math.round(baseCents))
  if (!Number.isFinite(spec.value) || spec.value <= 0 || base === 0) return 0
  const raw = spec.mode === 'percent' ? (base * Math.min(spec.value, 100)) / 100 : toCents(spec.value)
  return Math.min(base, Math.max(0, Math.round(raw)))
}

// Part de remise en pourcentage du prix (pour l'affichage), arrondie à 0,1
export function discountPercent(discountEuros: number, baseEuros: number): number {
  if (baseEuros <= 0 || discountEuros <= 0) return 0
  return Math.round((discountEuros / baseEuros) * 1000) / 10
}

// Répartit une remise (centimes) au prorata des bases. Chaque part reste dans
// la base de sa ligne. Le reliquat d'arrondi va à la dernière ligne qui peut
// encore le recevoir : la somme des parts est exactement la remise.
export function splitDiscountCents(totalCents: number, basesCents: number[]): number[] {
  const bases = basesCents.map((b) => Math.max(0, Math.round(b)))
  const sum = bases.reduce((a, b) => a + b, 0)
  const total = Math.min(Math.max(0, Math.round(totalCents)), sum)
  if (!total || !sum) return bases.map(() => 0)
  const shares = bases.map((b) => Math.floor((total * b) / sum))
  let rest = total - shares.reduce((a, b) => a + b, 0)
  for (let i = bases.length - 1; i >= 0 && rest > 0; i--) {
    const room = bases[i] - shares[i]
    const add = Math.min(room, rest)
    shares[i] += add
    rest -= add
  }
  return shares
}

// Une ligne remisée au-delà de la limite d'un vendeur ? Arrondis des
// répartitions (remise du ticket, composants d'une formule) : au plus un
// centime par ligne de la vente peut s'ajouter à la part d'une seule ligne.
export function overSellerLimit(discountCentsOfLine: number, grossCents: number, itemCount = 1): boolean {
  if (discountCentsOfLine <= 0) return false
  const allowed = Math.round((grossCents * SELLER_DISCOUNT_MAX_PERCENT) / 100) + Math.max(1, itemCount)
  return discountCentsOfLine > allowed
}

export interface DiscountedItem {
  name?: string
  unitPrice: number
  quantity: number
  discount?: number
}

// Lignes d'une vente qu'un vendeur n'avait pas le droit de remiser seul.
// `orderDiscount` : remise globale de l'ancien format (serveur, B2B), répartie
// au prorata comme le fait le calcul des totaux.
export function sellerDiscountExcess(items: DiscountedItem[], orderDiscount = 0): Array<{ index: number; name?: string; percent: number }> {
  const gross = items.map((i) => toCents(i.unitPrice * i.quantity))
  const own = items.map((i, k) => Math.min(gross[k], toCents(i.discount ?? 0)))
  const net = gross.map((g, k) => g - own[k])
  const extra = splitDiscountCents(toCents(orderDiscount), net)
  const out: Array<{ index: number; name?: string; percent: number }> = []
  items.forEach((i, k) => {
    const total = own[k] + extra[k]
    if (overSellerLimit(total, gross[k], items.length)) out.push({ index: k, name: i.name, percent: discountPercent(total, gross[k]) })
  })
  return out
}
