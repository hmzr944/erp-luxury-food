import type { AttributeType } from '@erp/types'

export interface AttributeDefinitionLike {
  key: string
  label: string
  type: AttributeType | `${AttributeType}`
  options: string[]
  required: boolean
}

// Vérifie les valeurs d'un produit contre les champs définis par l'organisation.
// Renvoie les valeurs nettoyées (champs vides retirés) ou la liste des erreurs.
export function validateAttributes(
  defs: AttributeDefinitionLike[],
  values: Record<string, unknown>,
): { values: Record<string, unknown>; errors: string[] } {
  const errors: string[] = []
  const clean: Record<string, unknown> = {}
  const byKey = new Map(defs.map((d) => [d.key, d]))

  for (const key of Object.keys(values)) {
    if (!byKey.has(key)) errors.push(`Champ inconnu : ${key}`)
  }

  for (const def of defs) {
    const raw = values[def.key]
    const empty = raw === undefined || raw === null || raw === ''
    if (empty) {
      if (def.required) errors.push(`${def.label} est obligatoire`)
      continue
    }
    switch (def.type) {
      case 'TEXT':
        if (typeof raw !== 'string') errors.push(`${def.label} doit être un texte`)
        else clean[def.key] = raw.trim()
        break
      case 'NUMBER':
        if (typeof raw !== 'number' || !Number.isFinite(raw)) errors.push(`${def.label} doit être un nombre`)
        else clean[def.key] = raw
        break
      case 'BOOLEAN':
        if (typeof raw !== 'boolean') errors.push(`${def.label} doit être oui ou non`)
        else clean[def.key] = raw
        break
      case 'SELECT':
        if (typeof raw !== 'string' || !def.options.includes(raw)) {
          errors.push(`${def.label} doit être l'une des valeurs : ${def.options.join(', ')}`)
        } else clean[def.key] = raw
        break
      case 'DATE':
        if (typeof raw !== 'string' || Number.isNaN(Date.parse(raw))) errors.push(`${def.label} doit être une date`)
        else clean[def.key] = raw
        break
    }
  }

  return { values: clean, errors }
}
