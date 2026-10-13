import { parseNumber } from '@erp/utils'

// Import du catalogue depuis un tableur. Format (en-têtes sans accent ni casse) :
//   nom*, sous_titre, description, categorie, prix*, tva, sku, code_barres,
//   option_1, valeur_1, option_2, valeur_2, stock
// Plusieurs lignes au même nom forment un seul produit et ses variantes
// (ex. un pull décliné en tailles). Fonction pure : le service l'exécute.

export const IMPORT_COLUMNS = [
  'nom', 'sous_titre', 'description', 'categorie', 'prix', 'tva', 'sku',
  'code_barres', 'option_1', 'valeur_1', 'option_2', 'valeur_2', 'stock',
] as const

export const MAX_IMPORT_ROWS = 2000

export interface PlannedVariant {
  line: number
  name: string
  options: Record<string, string>
  price: number
  sku?: string
  barcode?: string
  stock: number | null
}

export interface PlannedProduct {
  line: number
  name: string
  subtitle?: string
  description?: string
  category?: string
  price: number
  taxRate: number
  sku?: string
  barcode?: string
  stock: number | null
  options: Array<{ name: string; values: string[] }>
  variants: PlannedVariant[]
}

export interface ImportPlan {
  products: PlannedProduct[]
  categoriesToCreate: string[]
  errors: Array<{ line: number; message: string }>
  skipped: Array<{ line: number; message: string }>
}

export function planProductImport(
  rows: Record<string, string>[],
  ctx: { existingProductNames: string[]; existingCategories: string[]; defaultTaxRate: number },
): ImportPlan {
  const errors: ImportPlan['errors'] = []
  const skipped: ImportPlan['skipped'] = []

  if (rows.length > MAX_IMPORT_ROWS) {
    return { products: [], categoriesToCreate: [], skipped, errors: [{ line: 0, message: `Fichier trop long : ${MAX_IMPORT_ROWS} lignes maximum` }] }
  }
  if (rows.length && !('nom' in rows[0] && 'prix' in rows[0])) {
    return { products: [], categoriesToCreate: [], skipped, errors: [{ line: 1, message: 'Colonnes « nom » et « prix » obligatoires' }] }
  }

  const existing = new Set(ctx.existingProductNames.map((n) => n.toLowerCase()))
  const groups = new Map<string, PlannedProduct>()
  const seenCodes = new Set<string>()
  const skippedNames = new Set<string>()

  rows.forEach((row, i) => {
    const line = i + 2 // ligne 1 = en-têtes
    const name = row.nom?.trim()
    if (!name) return errors.push({ line, message: 'Nom manquant' })
    const price = parseNumber(row.prix)
    if (price === null || price < 0) return errors.push({ line, message: `Prix illisible : « ${row.prix ?? ''} »` })
    const taxRate = row.tva ? parseNumber(row.tva) : ctx.defaultTaxRate
    if (taxRate === null || taxRate < 0 || taxRate > 100) return errors.push({ line, message: `TVA illisible : « ${row.tva} »` })
    const stock = row.stock ? parseNumber(row.stock) : null
    if (row.stock && stock === null) return errors.push({ line, message: `Stock illisible : « ${row.stock} »` })

    for (const code of [row.sku, row.code_barres].filter(Boolean)) {
      if (seenCodes.has(code)) return errors.push({ line, message: `Code en double dans le fichier : ${code}` })
    }
    ;[row.sku, row.code_barres].filter(Boolean).forEach((c) => seenCodes.add(c))

    const key = name.toLowerCase()
    if (existing.has(key)) {
      if (!skippedNames.has(key)) skipped.push({ line, message: `« ${name} » existe déjà sur ce site, non modifié` })
      skippedNames.add(key)
      return
    }

    const options: Record<string, string> = {}
    for (const n of [1, 2]) {
      const axis = row[`option_${n}`]?.trim()
      const value = row[`valeur_${n}`]?.trim()
      if (axis && value) options[axis] = value
      else if (axis || value) return errors.push({ line, message: `Option ${n} incomplète (nom et valeur requis)` })
    }
    const isVariant = Object.keys(options).length > 0

    let product = groups.get(key)
    if (!product) {
      product = {
        line,
        name,
        subtitle: row.sous_titre || undefined,
        description: row.description || undefined,
        category: row.categorie || undefined,
        price,
        taxRate,
        sku: isVariant ? undefined : row.sku || undefined,
        barcode: isVariant ? undefined : row.code_barres || undefined,
        stock: isVariant ? null : stock,
        options: [],
        variants: [],
      }
      groups.set(key, product)
    } else if (!isVariant || product.variants.length === 0) {
      return errors.push({ line, message: `« ${name} » apparaît plusieurs fois sans options qui les distinguent` })
    }

    if (isVariant) {
      const variantName = Object.values(options).join(' / ')
      if (product.variants.some((v) => v.name === variantName)) {
        return errors.push({ line, message: `Variante en double : ${name} ${variantName}` })
      }
      for (const [axis, value] of Object.entries(options)) {
        let o = product.options.find((x) => x.name === axis)
        if (!o) product.options.push((o = { name: axis, values: [] }))
        if (!o.values.includes(value)) o.values.push(value)
      }
      product.variants.push({ line, name: variantName, options, price, sku: row.sku || undefined, barcode: row.code_barres || undefined, stock })
    }
  })

  const products = [...groups.values()]
  for (const p of products) {
    // Toutes les variantes d'un produit doivent utiliser les mêmes axes
    const axes = p.options.map((o) => o.name).sort().join('|')
    const bad = p.variants.find((v) => Object.keys(v.options).sort().join('|') !== axes)
    if (bad) errors.push({ line: bad.line, message: `« ${p.name} » : toutes les variantes doivent avoir les mêmes options (${p.options.map((o) => o.name).join(', ')})` })
  }

  const known = new Set(ctx.existingCategories.map((c) => c.toLowerCase()))
  const categoriesToCreate = [
    ...new Map(
      products.filter((p) => p.category && !known.has(p.category.toLowerCase())).map((p) => [p.category!.toLowerCase(), p.category!]),
    ).values(),
  ]

  return { products: errors.length ? [] : products, categoriesToCreate: errors.length ? [] : categoriesToCreate, errors, skipped }
}
