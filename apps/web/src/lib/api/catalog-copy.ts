import { apiClient } from './client'

// Rapport renvoyé par l'API après une copie de catalogue entre deux sites
export interface CatalogCopyReport {
  categories: number
  modifierGroups: number
  products: number
  variants: number
  menus: number
  skipped: number
  skippedItems: Array<{ name: string; reason: 'sku' | 'barcode' | 'name' }>
  samplesExcluded: number
  variantCodesCleared: number
}

export const catalogCopyApi = {
  copy: (targetSiteId: string, sourceSiteId: string) =>
    apiClient<CatalogCopyReport>(`/sites/${targetSiteId}/catalog/copy-from/${sourceSiteId}`, { method: 'POST' }),
}

const REASONS = { sku: 'même SKU', barcode: 'même code-barres', name: 'même nom' } as const
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

// Phrases du rapport, une par ligne, dites en clair (pas de couleur pour l'état)
export function describeCopyReport(r: CatalogCopyReport): string[] {
  const lines = [
    `${plural(r.products, 'article copié', 'articles copiés')}, ${plural(r.categories, 'rayon créé', 'rayons créés')}.`,
  ]
  if (r.modifierGroups) lines.push(`${plural(r.modifierGroups, 'groupe d’options copié', 'groupes d’options copiés')}.`)
  if (r.skipped) lines.push(`${plural(r.skipped, 'article ignoré', 'articles ignorés')} car déjà ${r.skipped > 1 ? 'présents' : 'présent'} sur ce site.`)
  if (r.samplesExcluded) lines.push(`${plural(r.samplesExcluded, 'article d’exemple laissé de côté', 'articles d’exemple laissés de côté')}.`)
  if (r.variantCodesCleared) lines.push(`${plural(r.variantCodesCleared, 'variante copiée sans son code', 'variantes copiées sans leur code')} (code déjà utilisé sur ce site).`)
  lines.push('Les stocks, les ventes et les clients ne sont pas copiés : le stock de départ est à 0.')
  return lines
}

export const skipReasonLabel = (reason: CatalogCopyReport['skippedItems'][number]['reason']) => REASONS[reason]
