// Saisie des attributs d'un produit (millésime, origine...) : les champs viennent des
// définitions de l'organisation, les valeurs partent typées vers l'API, qui les revalide.

export interface AttributeDef {
  id: string
  key: string
  label: string
  type: string
  options: string[]
  required: boolean
}

export type DateKind = 'DLC' | 'DDM'

// Clé réservée : le type de date limite se règle avec le suivi du produit, pas avec les champs libres
export const DATE_KIND_KEY = 'dateKind'

export function dateKindOf(attributes: Record<string, unknown> | null | undefined): DateKind {
  return attributes?.[DATE_KIND_KEY] === 'DDM' ? 'DDM' : 'DLC'
}

// Valeurs enregistrées -> contenu des champs de saisie (tout en texte)
export function toInputs(defs: AttributeDef[], attributes: Record<string, unknown> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const def of defs) {
    const v = attributes?.[def.key]
    if (v === undefined || v === null || v === '') continue
    out[def.key] = def.type === 'BOOLEAN' ? (v === true ? 'true' : '') : String(v).replace('.', def.type === 'NUMBER' ? ',' : '.')
  }
  return out
}

// Contenu des champs -> valeurs typées, ou erreurs en français
export function parseInputs(defs: AttributeDef[], inputs: Record<string, string>): { values: Record<string, unknown>; errors: Record<string, string> } {
  const values: Record<string, unknown> = {}
  const errors: Record<string, string> = {}
  for (const def of defs) {
    const raw = (inputs[def.key] ?? '').trim()
    if (!raw) {
      if (def.required) errors[def.key] = `${def.label} est obligatoire`
      continue
    }
    switch (def.type) {
      case 'NUMBER': {
        const n = Number(raw.replace(/\s/g, '').replace(',', '.'))
        if (!Number.isFinite(n)) errors[def.key] = `${def.label} doit être un nombre`
        else if (n < 0) errors[def.key] = `${def.label} ne peut pas être négatif`
        else values[def.key] = n
        break
      }
      case 'BOOLEAN':
        values[def.key] = raw === 'true'
        break
      case 'SELECT':
        if (def.options.includes(raw)) values[def.key] = raw
        else errors[def.key] = `${def.label} : choisissez une valeur de la liste`
        break
      default:
        values[def.key] = raw
    }
  }
  return { values, errors }
}

// Sans séparateur de milliers : un millésime s'écrit 2019, pas 2 019
const fr = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3, useGrouping: false })

// Résumé court pour la liste du catalogue : « Millésime 2019 · Pauillac »
export function attributeSummary(defs: AttributeDef[], attributes: Record<string, unknown> | null | undefined, max = 3): string {
  const parts: string[] = []
  for (const def of defs) {
    const v = attributes?.[def.key]
    if (v === undefined || v === null || v === '' || v === false) continue
    if (def.type === 'BOOLEAN') parts.push(def.label)
    else if (def.type === 'NUMBER' && typeof v === 'number') parts.push(`${def.label.replace(/\s*\(.*\)$/, '')} ${fr.format(v)}`)
    else parts.push(String(v))
    if (parts.length >= max) break
  }
  return parts.join(' · ')
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

// La recherche du catalogue lit aussi les attributs (appellation, producteur, millésime...)
export function attributesMatch(attributes: Record<string, unknown> | null | undefined, query: string): boolean {
  const q = fold(query.trim())
  if (!q || !attributes) return false
  return Object.entries(attributes).some(([key, v]) => key !== DATE_KIND_KEY && (typeof v === 'string' || typeof v === 'number') && fold(String(v)).includes(q))
}
