import { describe, expect, it } from 'vitest'
import { PACK_ATTRIBUTES, Pack } from '@erp/types'
import { validateAttributes, withSystemAttributes, type AttributeDefinitionLike } from './attributes'

const fromPack = (pack: Pack): AttributeDefinitionLike[] =>
  PACK_ATTRIBUTES[pack].map((a) => ({ key: a.key, label: a.label, type: a.type, options: a.options ?? [], required: false }))

describe('attributs de cave', () => {
  const defs = withSystemAttributes(fromPack(Pack.WINE))

  it('définit millésime, appellation, région, cépage, degré et contenance', () => {
    const keys = PACK_ATTRIBUTES[Pack.WINE].map((a) => a.key)
    expect(keys).toEqual(expect.arrayContaining(['vintage', 'appellation', 'region', 'grape', 'abv', 'volumeCl']))
  })

  it('accepte une fiche complète et typée', () => {
    const r = validateAttributes(defs, { vintage: 2019, appellation: 'Pauillac', region: 'Bordeaux', grape: 'Cabernet', wineType: 'Rouge', abv: 13.5, volumeCl: 75 })
    expect(r.errors).toEqual([])
    expect(r.values.volumeCl).toBe(75)
  })

  it('refuse un texte pour un nombre et une couleur hors liste', () => {
    const r = validateAttributes(defs, { vintage: '2019', wineType: 'Bleu' })
    expect(r.errors).toContain('Millésime doit être un nombre')
    expect(r.errors.some((e) => e.startsWith('Couleur ou type doit être'))).toBe(true)
  })
})

describe('attributs d’épicerie fine et type de date', () => {
  const defs = withSystemAttributes(fromPack(Pack.FOOD))

  it('définit origine, producteur et conditionnement', () => {
    const keys = PACK_ATTRIBUTES[Pack.FOOD].map((a) => a.key)
    expect(keys).toEqual(expect.arrayContaining(['origin', 'producer', 'packaging', 'netWeight']))
  })

  it('accepte DLC ou DDM, refuse autre chose', () => {
    expect(validateAttributes(defs, { dateKind: 'DDM' }).errors).toEqual([])
    expect(validateAttributes(defs, { dateKind: 'DLUO' }).errors).toHaveLength(1)
  })

  it('le type de date existe même sans pack, sans doublonner une définition de l’organisation', () => {
    expect(validateAttributes(withSystemAttributes([]), { dateKind: 'DLC' }).errors).toEqual([])
    const own: AttributeDefinitionLike[] = [{ key: 'dateKind', label: 'Mon type', type: 'SELECT', options: ['DLC'], required: false }]
    expect(withSystemAttributes(own)).toHaveLength(1)
  })
})
