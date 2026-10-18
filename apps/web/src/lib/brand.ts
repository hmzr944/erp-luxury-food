// Identité FLŌW : trois couleurs (encre, papier, violet). Les rayons ne se
// distinguent pas par la couleur mais par une forme, tirée du signe : disque,
// moitiés, trait. On reconnaît « Maille » ou « Pâtisseries » à sa forme.
export const BRAND = 'FLŌW'

export const RAYON_SHAPES = ['disque', 'moitie', 'dome', 'fendu', 'anneau', 'bol', 'paire', 'pilule', 'arc', 'colonnes'] as const
export type RayonShape = (typeof RAYON_SHAPES)[number]

// Une forme par rayon, sans doublon tant qu'il en reste : la forme déjà
// choisie (champ couleur historique) si elle est libre, sinon la suivante
export function rayonShapes(categories: Array<{ id: string; color: string | null }>): Map<string, RayonShape> {
  const used = new Set<RayonShape>()
  const out = new Map<string, RayonShape>()
  categories.forEach((c, i) => {
    const wanted = RAYON_SHAPES.find((s) => s === c.color)
    let shape: RayonShape = wanted ?? RAYON_SHAPES[i % RAYON_SHAPES.length]
    if (used.has(shape) && used.size < RAYON_SHAPES.length) {
      const start = RAYON_SHAPES.indexOf(shape)
      for (let k = 1; k <= RAYON_SHAPES.length; k++) {
        const next = RAYON_SHAPES[(start + k) % RAYON_SHAPES.length]
        if (!used.has(next)) {
          shape = next
          break
        }
      }
    }
    used.add(shape)
    out.set(c.id, shape)
  })
  return out
}
