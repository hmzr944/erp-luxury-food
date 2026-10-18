import { describe, expect, it } from 'vitest'
import { applyMapping, decodeImportText, guessMapping, missingRequired, parseCsv, tableToRows } from '@erp/utils'

describe('Import : reconnaissance des colonnes', () => {
  it('reconnaît un export d’un autre logiciel de caisse', () => {
    const m = guessMapping(['Désignation', 'Famille', 'PV TTC', 'Prix HT', 'Taux TVA', 'EAN13', 'Qté', 'Réf.', 'Taille', 'Coloris'])
    expect(Object.fromEntries(m.map((x) => [x.header, x.field]))).toEqual({
      Désignation: 'nom',
      Famille: 'categorie',
      'PV TTC': 'prix',
      'Prix HT': null,
      'Taux TVA': 'tva',
      EAN13: 'code_barres',
      Qté: 'stock',
      'Réf.': 'sku',
      Taille: 'option',
      Coloris: 'option',
    })
    expect(missingRequired(m)).toEqual([])
  })

  it('ramène les lignes au format FLŌW, TVA « 0,2 » ou « 20 % » comprise', () => {
    const m = guessMapping(['Libellé', 'Prix de vente', 'TVA', 'Taille'])
    const rows = applyMapping(
      [
        { Libellé: 'Pull', 'Prix de vente': '89,00', TVA: '0,2', Taille: 'M' },
        { Libellé: 'Pull', 'Prix de vente': '89,00', TVA: '20 %', Taille: 'L' },
        { Libellé: '', 'Prix de vente': '', TVA: '', Taille: '' },
      ],
      m,
    )
    expect(rows).toEqual([
      { nom: 'Pull', prix: '89,00', tva: '20', option_1: 'Taille', valeur_1: 'M' },
      { nom: 'Pull', prix: '89,00', tva: '20', option_1: 'Taille', valeur_1: 'L' },
    ])
  })

  it('signale les colonnes obligatoires absentes', () => {
    expect(missingRequired(guessMapping(['Produit', 'Stock']))).toEqual(['prix'])
  })

  it('lit un tableau Excel (première ligne d’en-têtes, lignes vides ignorées)', () => {
    const { headers, rows } = tableToRows([
      ['Article', 'Prix', null],
      [null, null, null],
      ['Croissant', 1.4, 'x'],
    ])
    expect(headers).toEqual(['Article', 'Prix', 'Colonne 3'])
    expect(rows).toEqual([{ Article: 'Croissant', Prix: '1.4', 'Colonne 3': 'x' }])
  })

  it('accepte aussi un CSV au point-virgule', () => {
    const rows = parseCsv('Désignation;PV TTC\nBaguette;1,30\n')
    const m = guessMapping(Object.keys(rows[0]))
    expect(applyMapping(rows, m)).toEqual([{ nom: 'Baguette', prix: '1,30' }])
  })
})

describe('decodeImportText', () => {
  it('lit un CSV UTF-8 avec ou sans BOM', () => {
    const utf8 = new TextEncoder().encode('nom;prix\nCafé;2,50')
    expect(decodeImportText(utf8)).toBe('nom;prix\nCafé;2,50')
    expect(decodeImportText(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8]))).toBe('nom;prix\nCafé;2,50')
  })
  it('lit un CSV d’Excel français (Windows-1252) sans perdre les accents ni l’euro', () => {
    // « Crème brûlée;4,50 € » en Windows-1252
    const cp1252 = new Uint8Array([0x43, 0x72, 0xe8, 0x6d, 0x65, 0x20, 0x62, 0x72, 0xfb, 0x6c, 0xe9, 0x65, 0x3b, 0x34, 0x2c, 0x35, 0x30, 0x20, 0x80])
    expect(decodeImportText(cp1252)).toBe('Crème brûlée;4,50 €')
  })
})
