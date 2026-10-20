import { describe, expect, it } from 'vitest'
import { attributeSummary, attributesMatch, dateKindOf, parseInputs, toInputs, type AttributeDef } from './attributes-form'

const d = (key: string, label: string, type: string, extra: Partial<AttributeDef> = {}): AttributeDef => ({ id: key, key, label, type, options: [], required: false, ...extra })
const defs = [
  d('vintage', 'Millésime', 'NUMBER'),
  d('appellation', 'Appellation', 'TEXT'),
  d('wineType', 'Couleur ou type', 'SELECT', { options: ['Rouge', 'Blanc'] }),
  d('abv', 'Degré (% vol.)', 'NUMBER'),
  d('isTester', 'Testeur', 'BOOLEAN'),
]

describe('saisie des attributs', () => {
  it('type les valeurs : nombre avec virgule, liste, texte, oui ou non', () => {
    const r = parseInputs(defs, { vintage: '2019', appellation: ' Pauillac ', wineType: 'Rouge', abv: '13,5', isTester: 'true' })
    expect(r.errors).toEqual({})
    expect(r.values).toEqual({ vintage: 2019, appellation: 'Pauillac', wineType: 'Rouge', abv: 13.5, isTester: true })
  })

  it('laisse de côté les champs vides', () => {
    expect(parseInputs(defs, { vintage: '', appellation: '  ' }).values).toEqual({})
  })

  it('signale un nombre illisible, négatif ou une valeur hors liste', () => {
    const r = parseInputs(defs, { vintage: 'deux mille', abv: '-3', wineType: 'Bleu' })
    expect(r.errors.vintage).toBe('Millésime doit être un nombre')
    expect(r.errors.abv).toBe('Degré (% vol.) ne peut pas être négatif')
    expect(r.errors.wineType).toContain('choisissez')
  })

  it('exige les champs obligatoires', () => {
    const r = parseInputs([d('origin', 'Origine', 'TEXT', { required: true })], {})
    expect(r.errors.origin).toBe('Origine est obligatoire')
  })

  it('remplit les champs depuis un produit enregistré', () => {
    expect(toInputs(defs, { vintage: 2019, abv: 13.5, isTester: true, appellation: 'Pauillac', inconnu: 'x' })).toEqual({
      vintage: '2019', abv: '13,5', isTester: 'true', appellation: 'Pauillac',
    })
  })

  it('résume pour la liste et lit le type de date', () => {
    expect(attributeSummary(defs, { vintage: 2019, appellation: 'Pauillac', abv: 13.5 })).toBe('Millésime 2019 · Pauillac · Degré 13,5')
    expect(attributeSummary(defs, {})).toBe('')
    expect(dateKindOf({ dateKind: 'DDM' })).toBe('DDM')
    expect(dateKindOf({})).toBe('DLC')
  })

  it('cherche dans les attributs sans tenir compte des accents', () => {
    expect(attributesMatch({ appellation: 'Saint-Émilion', vintage: 2018 }, 'emilion')).toBe(true)
    expect(attributesMatch({ vintage: 2018 }, '2018')).toBe(true)
    expect(attributesMatch({ dateKind: 'DLC' }, 'dlc')).toBe(false)
    expect(attributesMatch({}, 'x')).toBe(false)
  })
})
