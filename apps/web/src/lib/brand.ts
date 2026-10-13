// Identité FLŌW : nom, gammes de couleur, attribution d'une couleur par rayon
export const BRAND = 'FLŌW'

export const GAMMES = [
  { key: 'corail', label: 'Corail', css: 'var(--gamme-corail)' },
  { key: 'soleil', label: 'Soleil', css: 'var(--gamme-soleil)' },
  { key: 'menthe', label: 'Menthe', css: 'var(--gamme-menthe)' },
  { key: 'lagon', label: 'Lagon', css: 'var(--gamme-lagon)' },
  { key: 'lilas', label: 'Lilas', css: 'var(--gamme-lilas)' },
  { key: 'pivoine', label: 'Pivoine', css: 'var(--gamme-pivoine)' },
] as const

export type GammeKey = (typeof GAMMES)[number]['key']

const GAMME_HUES: Array<[GammeKey, number]> = [
  ['corail', 7], ['soleil', 42], ['menthe', 163], ['lagon', 203], ['lilas', 255], ['pivoine', 333],
]

function hueOf(hex: string): { h: number; s: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  const s = max === 0 ? 0 : d / max
  if (d === 0) return { h: 0, s }
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s }
}

// Couleur d'un rayon, toujours une gamme FLŌW : la gamme choisie, sinon la
// plus proche d'une couleur saisie, sinon une gamme dans l'ordre des rayons
// (deux rayons voisins ne se ressemblent pas)
export function rayonColor(color: string | null | undefined, index: number): string {
  const named = GAMMES.find((g) => g.key === color)
  if (named) return named.css
  if (color && /^#[0-9a-f]{6}$/i.test(color)) {
    const { h, s } = hueOf(color)
    if (s > 0.25) {
      const near = GAMME_HUES.reduce((best, [k, gh]) => {
        const dist = Math.min(Math.abs(h - gh), 360 - Math.abs(h - gh))
        return dist < best.dist ? { k, dist } : best
      }, { k: 'corail' as GammeKey, dist: 999 })
      return GAMMES.find((g) => g.key === near.k)!.css
    }
  }
  return GAMMES[index % GAMMES.length].css
}

// Les offres et les espaces ont aussi leur couleur
export const PLAN_GAMME: Record<string, string> = { STARTER: 'var(--gamme-corail)', PRO: 'var(--gamme-lilas)' }

// Couleurs de tous les rayons d'une boutique : chaque rayon garde sa gamme
// préférée si elle est libre, sinon prend la suivante non utilisée
export function rayonColors(categories: Array<{ id: string; color: string | null }>): Map<string, string> {
  const used = new Set<string>()
  const out = new Map<string, string>()
  categories.forEach((c, i) => {
    let css = rayonColor(c.color, i)
    if (used.has(css) && used.size < GAMMES.length) {
      const start = GAMMES.findIndex((g) => g.css === css)
      for (let k = 1; k <= GAMMES.length; k++) {
        const next = GAMMES[(start + k) % GAMMES.length].css
        if (!used.has(next)) {
          css = next
          break
        }
      }
    }
    used.add(css)
    out.set(c.id, css)
  })
  return out
}
