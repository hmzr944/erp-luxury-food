import { normalizeHeader } from './csv'

// Import « glisser-déposer » : on reconnaît les colonnes d'un fichier venu
// d'un autre logiciel ou d'Excel (« Désignation », « PV TTC », « EAN13 »,
// « Famille », « Taille »...) et on les ramène au format FLŌW : nom, prix,
// tva, code_barres, categorie, stock, sku, sous_titre, description, et
// jusqu'à deux options (Taille, Couleur...).

export type ImportField = 'nom' | 'sous_titre' | 'description' | 'categorie' | 'prix' | 'tva' | 'sku' | 'code_barres' | 'stock' | 'option'

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  nom: 'Nom',
  sous_titre: 'Sous-titre',
  description: 'Description',
  categorie: 'Rayon',
  prix: 'Prix TTC',
  tva: 'TVA',
  sku: 'Référence',
  code_barres: 'Code-barres',
  stock: 'Stock',
  option: 'Déclinaison',
}

// Synonymes, sous forme normalisée (minuscules, sans accents, « _ »)
const SYNONYMS: Record<Exclude<ImportField, 'option'>, string[]> = {
  nom: ['nom', 'designation', 'libelle', 'article', 'produit', 'nom_produit', 'nom_article', 'intitule', 'name', 'title', 'product', 'product_name', 'item'],
  sous_titre: ['sous_titre', 'subtitle', 'accroche'],
  description: ['description', 'descriptif', 'details'],
  categorie: ['categorie', 'category', 'famille', 'rayon', 'sous_famille', 'type', 'collection', 'univers'],
  prix: ['prix', 'prix_ttc', 'pv_ttc', 'pv', 'prix_vente', 'prix_de_vente', 'prix_de_vente_ttc', 'prix_unitaire', 'tarif', 'price', 'sale_price', 'retail_price', 'montant_ttc'],
  tva: ['tva', 'taux_tva', 'taux', 'tva_taux', 'vat', 'tax', 'tax_rate', 'taux_de_tva'],
  sku: ['sku', 'reference', 'ref', 'ref_article', 'code_article', 'code_produit', 'reference_interne'],
  code_barres: ['code_barres', 'code_barre', 'codebarre', 'codebarres', 'ean', 'ean13', 'ean_13', 'gencod', 'gencode', 'gtin', 'barcode', 'upc'],
  stock: ['stock', 'quantite', 'qte', 'qty', 'quantity', 'stock_actuel', 'inventaire', 'en_stock'],
}

// Colonnes qui deviennent des déclinaisons : leur titre est le nom de l'option
const OPTION_HEADERS = ['taille', 'couleur', 'pointure', 'format', 'contenance', 'coloris', 'matiere', 'size', 'color', 'colour', 'poids', 'parfum', 'finition']

// Colonnes à ne jamais prendre pour un prix de vente
const NOT_PRICE = ['prix_ht', 'pv_ht', 'prix_achat', 'cout', 'cout_achat', 'pa', 'pa_ht', 'prix_de_revient', 'marge']

export interface ColumnMapping {
  header: string
  field: ImportField | null
}

export function guessMapping(headers: string[]): ColumnMapping[] {
  const taken = new Set<ImportField>()
  let options = 0
  return headers.map((header) => {
    const h = normalizeHeader(header)
    if (!h || NOT_PRICE.includes(h)) return { header, field: null }
    for (const [field, names] of Object.entries(SYNONYMS) as Array<[Exclude<ImportField, 'option'>, string[]]>) {
      if (!taken.has(field) && names.includes(h)) {
        taken.add(field)
        return { header, field }
      }
    }
    if (OPTION_HEADERS.includes(h) && options < 2) {
      options++
      return { header, field: 'option' }
    }
    // « Prix TTC (€) », « Désignation article » : on cherche le mot clé
    for (const [field, names] of Object.entries(SYNONYMS) as Array<[Exclude<ImportField, 'option'>, string[]]>) {
      if (!taken.has(field) && names.some((n) => n.length > 3 && h.startsWith(n))) {
        taken.add(field)
        return { header, field }
      }
    }
    return { header, field: null }
  })
}

// « 20 % », « 0,2 », « 5.5 » → « 20 », « 20 », « 5.5 »
function rate(v: string): string {
  const n = Number(v.replace(/[\s%]/g, '').replace(',', '.'))
  if (!v.trim() || !Number.isFinite(n)) return v
  return String(n > 0 && n < 1 ? Math.round(n * 1000) / 10 : n)
}

// Lignes du fichier → lignes au format d'import FLŌW
export function applyMapping(rows: Array<Record<string, string>>, mapping: ColumnMapping[]): Array<Record<string, string>> {
  const optionHeaders = mapping.filter((m) => m.field === 'option').slice(0, 2)
  return rows
    .map((row) => {
      const out: Record<string, string> = {}
      for (const m of mapping) {
        if (!m.field || m.field === 'option') continue
        const v = (row[m.header] ?? '').trim()
        out[m.field] = m.field === 'tva' ? rate(v) : v
      }
      optionHeaders.forEach((m, i) => {
        const v = (row[m.header] ?? '').trim()
        if (v) {
          const name = m.header.trim().replace(/_/g, ' ')
          out[`option_${i + 1}`] = name.charAt(0).toUpperCase() + name.slice(1)
          out[`valeur_${i + 1}`] = v
        }
      })
      return out
    })
    .filter((r) => Object.values(r).some((v) => v))
}

export function missingRequired(mapping: ColumnMapping[]): ImportField[] {
  const fields = new Set(mapping.map((m) => m.field))
  return (['nom', 'prix'] as ImportField[]).filter((f) => !fields.has(f))
}

// Tableau brut (première ligne = en-têtes) → lignes nommées
export function tableToRows(table: unknown[][]): { headers: string[]; rows: Array<Record<string, string>> } {
  const nonEmpty = table.filter((r) => r.some((c) => c !== null && c !== undefined && String(c).trim() !== ''))
  const [head, ...body] = nonEmpty
  if (!head) return { headers: [], rows: [] }
  const headers = head.map((h, i) => (h === null || h === undefined || String(h).trim() === '' ? `Colonne ${i + 1}` : String(h).trim()))
  const cell = (c: unknown) => (c === null || c === undefined ? '' : c instanceof Date ? c.toISOString().slice(0, 10) : String(c))
  return { headers, rows: body.map((r) => Object.fromEntries(headers.map((h, i) => [h, cell(r[i])]))) }
}
