import { describe, it, expect } from 'vitest'
import { parseCsv, parseNumber, toCsv } from '@erp/utils'

describe('CSV', () => {
  it('écrit un fichier lisible par Excel en français', () => {
    const csv = toCsv([{ name: 'Pull "Marin"; col rond', price: 290.5 }], [
      { header: 'Nom', value: (r) => r.name },
      { header: 'Prix', value: (r) => r.price },
    ])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"Pull ""Marin""; col rond";290,5')
  })

  it('neutralise les formules de tableur', () => {
    const csv = toCsv([{ v: '=HYPERLINK("http://x")' }, { v: '-12,5' }], [{ header: 'V', value: (r) => r.v }])
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`)
    expect(csv).toContain('-12,5')
  })

  it('relit ce qu\'il écrit, séparateur et en-têtes normalisés', () => {
    const csv = toCsv([{ a: 'Écharpe', b: 'ligne 1\nligne 2' }], [
      { header: 'Nom du produit', value: (r) => r.a },
      { header: 'Code-barres', value: (r) => r.b },
    ])
    expect(parseCsv(csv)).toEqual([{ nom_du_produit: 'Écharpe', code_barres: 'ligne 1\nligne 2' }])
  })

  it('accepte un fichier à virgules exporté d\'un autre logiciel', () => {
    expect(parseCsv('name,price\r\nScarf,120\r\n\r\n')).toEqual([{ name: 'Scarf', price: '120' }])
  })

  it('lit les nombres à la française', () => {
    expect(parseNumber('1 234,50 €')).toBe(1234.5)
    expect(parseNumber('20%')).toBe(20)
    expect(parseNumber('abc')).toBeNull()
    expect(parseNumber('')).toBeNull()
  })
})
