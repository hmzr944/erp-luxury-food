import { describe, it, expect } from 'vitest'
import { parseCsv } from '@erp/utils'
import { planProductImport } from './product-import'

const ctx = { existingProductNames: ['Écharpe'], existingCategories: ['Maille'], defaultTaxRate: 20 }

const csv = (s: string) => parseCsv(s.trim())

describe('planProductImport', () => {
  it('regroupe les lignes au même nom en un produit et ses variantes', () => {
    const plan = planProductImport(
      csv(`
nom;categorie;prix;option_1;valeur_1;option_2;valeur_2;code_barres;stock
Pull col rond;Maille;290;Taille;S;Couleur;Écru;3700000000011;2
Pull col rond;Maille;290;Taille;M;Couleur;Écru;3700000000028;4
Pull col rond;Maille;310;Taille;L;Couleur;Marine;3700000000035;1
Ceinture;Accessoires;95,50;;;;;3700000000042;7`),
      ctx,
    )
    expect(plan.errors).toEqual([])
    expect(plan.products).toHaveLength(2)
    const [pull, belt] = plan.products
    expect(pull.options).toEqual([
      { name: 'Taille', values: ['S', 'M', 'L'] },
      { name: 'Couleur', values: ['Écru', 'Marine'] },
    ])
    expect(pull.variants.map((v) => [v.name, v.price, v.stock])).toEqual([
      ['S / Écru', 290, 2],
      ['M / Écru', 290, 4],
      ['L / Marine', 310, 1],
    ])
    expect(belt).toMatchObject({ price: 95.5, taxRate: 20, barcode: '3700000000042', stock: 7, variants: [] })
    expect(plan.categoriesToCreate).toEqual(['Accessoires'])
  })

  it('ignore un produit déjà présent sans le modifier', () => {
    const plan = planProductImport(csv('nom;prix\nÉcharpe;99'), ctx)
    expect(plan.products).toEqual([])
    expect(plan.skipped[0].message).toContain('existe déjà')
  })

  it('signale chaque erreur avec son numéro de ligne et n\'importe rien', () => {
    const plan = planProductImport(
      csv(`
nom;prix;tva;option_1;valeur_1;sku
Bague;abc;;;;
;10;;;;
Collier;100;250;;;
Sac;100;;Couleur;;
Pull;10;;Taille;S;A1
Pull;10;;Taille;S;A2
Gants;10;;;;A1`),
      ctx,
    )
    expect(plan.products).toEqual([])
    expect(plan.errors).toEqual([
      { line: 2, message: 'Prix illisible : « abc »' },
      { line: 3, message: 'Nom manquant' },
      { line: 4, message: 'TVA illisible : « 250 »' },
      { line: 5, message: 'Option 1 incomplète (nom et valeur requis)' },
      { line: 7, message: 'Variante en double : Pull S' },
      { line: 8, message: 'Code en double dans le fichier : A1' },
    ])
  })

  it('refuse un fichier sans les colonnes obligatoires', () => {
    expect(planProductImport(csv('produit;tarif\nA;1'), ctx).errors[0].message).toContain('obligatoires')
  })

  it('refuse des variantes aux options incohérentes', () => {
    const plan = planProductImport(
      csv(`
nom;prix;option_1;valeur_1;option_2;valeur_2
Chemise;100;Taille;S;Couleur;Blanc
Chemise;100;Taille;M;;`),
      ctx,
    )
    expect(plan.errors[0].message).toContain('mêmes options')
  })
})
