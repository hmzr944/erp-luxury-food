// Génère toutes les combinaisons d'options d'un produit.
// Ex. Taille [S, M] × Couleur [Noir, Sable] → 4 variantes.

export interface VariantOptionAxis {
  name: string
  values: string[]
}

export type VariantCombination = Record<string, string>

export const MAX_VARIANTS = 250

export function buildVariantMatrix(axes: VariantOptionAxis[]): VariantCombination[] {
  const usable = axes.filter((a) => a.name.trim() && a.values.length)
  if (!usable.length) return []
  const total = usable.reduce((n, a) => n * a.values.length, 1)
  if (total > MAX_VARIANTS) {
    throw new Error(`Trop de combinaisons (${total}) : maximum ${MAX_VARIANTS} variantes par produit`)
  }
  return usable.reduce<VariantCombination[]>(
    (combos, axis) => combos.flatMap((c) => axis.values.map((v) => ({ ...c, [axis.name]: v }))),
    [{}],
  )
}

// Nom lisible d'une variante, dans l'ordre des axes : "M / Noir"
export function variantLabel(combination: VariantCombination, axes: VariantOptionAxis[]): string {
  return axes
    .map((a) => combination[a.name])
    .filter(Boolean)
    .join(' / ')
}
