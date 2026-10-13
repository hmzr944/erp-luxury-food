// Fiche produit à partir d'un code-barres (EAN/UPC), dans les bases
// ouvertes Open Food Facts, Open Beauty Facts et Open Products Facts.
// Ces bases sont collaboratives : la fiche est une proposition à vérifier.

export interface ProductSuggestion {
  barcode: string
  name: string
  brand?: string
  quantity?: string
  imageUrl?: string
  source: 'Open Food Facts' | 'Open Beauty Facts' | 'Open Products Facts'
}

const SOURCES = [
  { host: 'world.openfoodfacts.org', source: 'Open Food Facts' },
  { host: 'world.openbeautyfacts.org', source: 'Open Beauty Facts' },
  { host: 'world.openproductsfacts.org', source: 'Open Products Facts' },
] as const

export const isBarcode = (code: string) => /^\d{8,14}$/.test(code)

type Http = (url: string, init?: RequestInit) => Promise<Response>

export async function lookupBarcode(code: string, http: Http): Promise<ProductSuggestion | null> {
  if (!isBarcode(code)) return null
  for (const { host, source } of SOURCES) {
    try {
      const res = await http(
        `https://${host}/api/v2/product/${code}.json?fields=product_name_fr,product_name,brands,quantity,image_front_url`,
        { headers: { 'User-Agent': 'Caisse-multi-secteurs/1.0 (contact via site)' } },
      )
      if (!res.ok) continue
      const body = (await res.json()) as {
        status?: number
        product?: { product_name_fr?: string; product_name?: string; brands?: string; quantity?: string; image_front_url?: string }
      }
      const p = body.product
      const name = (p?.product_name_fr || p?.product_name || '').trim()
      if (body.status !== 1 || !p || !name) continue
      return {
        barcode: code,
        name,
        brand: p.brands?.split(',')[0]?.trim() || undefined,
        quantity: p.quantity?.trim() || undefined,
        imageUrl: p.image_front_url || undefined,
        source,
      }
    } catch {
      // Base indisponible : on essaie la suivante
    }
  }
  return null
}
