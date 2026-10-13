import { describe, it, expect } from 'vitest'
import { validateAttributes, type AttributeDefinitionLike } from './attributes'

const defs: AttributeDefinitionLike[] = [
  { key: 'material', label: 'Matière', type: 'TEXT', options: [], required: true },
  { key: 'season', label: 'Saison', type: 'SELECT', options: ['Printemps-été', 'Automne-hiver'], required: false },
  { key: 'vintage', label: 'Millésime', type: 'NUMBER', options: [], required: false },
  { key: 'isTester', label: 'Testeur', type: 'BOOLEAN', options: [], required: false },
]

describe('validateAttributes', () => {
  it('accepte des valeurs valides et retire les champs vides', () => {
    const r = validateAttributes(defs, { material: ' Cachemire ', season: 'Automne-hiver', vintage: '' })
    expect(r.errors).toEqual([])
    expect(r.values).toEqual({ material: 'Cachemire', season: 'Automne-hiver' })
  })

  it('signale un champ obligatoire manquant', () => {
    expect(validateAttributes(defs, {}).errors).toEqual(['Matière est obligatoire'])
  })

  it('refuse les champs inconnus et les mauvais types', () => {
    const r = validateAttributes(defs, { material: 'Soie', vintage: '2019', isTester: 'oui', color: 'rouge' })
    expect(r.errors).toContain('Champ inconnu : color')
    expect(r.errors).toContain('Millésime doit être un nombre')
    expect(r.errors).toContain('Testeur doit être oui ou non')
  })

  it('refuse une valeur hors liste', () => {
    const r = validateAttributes(defs, { material: 'Lin', season: 'Été indien' })
    expect(r.errors[0]).toMatch(/^Saison doit être l'une des valeurs/)
  })
})
