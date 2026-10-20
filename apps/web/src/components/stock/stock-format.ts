import type { StockItemApi, StockMovementApi } from '@/lib/api/stock'

// Quantité lisible en français : « 2,5 », « 10 », jamais plus de 3 décimales
export function formatQty(n: number | string | null | undefined): string {
  const v = Number(n ?? 0)
  if (!Number.isFinite(v)) return '0'
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(v)
}

// Écart signé : « +5 », « -3 », « 0 »
export function formatGap(n: number): string {
  if (n === 0) return '0'
  return `${n > 0 ? '+' : '-'}${formatQty(Math.abs(n))}`
}

// Saisie « 2,5 » ou « 2.5 » ; vide ou invalide : null. Jamais négatif.
export function parseQty(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (!t || !/^\d+(\.\d{1,3})?$/.test(t)) return null
  return Number(t)
}

export function gapOf(counted: number, expected: number): number {
  return Math.round((counted - expected) * 1000) / 1000
}

export function isLow(item: Pick<StockItemApi, 'quantity' | 'alertAt'>): boolean {
  return item.alertAt !== null && item.alertAt !== undefined && Number(item.quantity) <= Number(item.alertAt)
}

export const MOVEMENT_LABELS: Record<StockMovementApi['type'], string> = {
  SALE: 'Vente',
  RESTOCK: 'Réception',
  ADJUSTMENT: 'Correction',
  TRANSFER: 'Transfert',
  LOSS: 'Perte',
}

// Effet d'un mouvement sur le stock, avec son signe. L'ajustement est signé
// par le serveur ; les anciens ajustements, toujours positifs, restent lus tels quels.
export function movementEffect(type: StockMovementApi['type'], quantity: number | string): number {
  const q = Number(quantity)
  if (type === 'ADJUSTMENT') return q
  if (type === 'SALE' || type === 'LOSS' || type === 'TRANSFER') return -Math.abs(q)
  return Math.abs(q)
}

export function itemLabel(item: Pick<StockItemApi, 'product' | 'variantName'>): string {
  return item.variantName ? `${item.product.name} (${item.variantName})` : item.product.name
}

// Texte de recherche : nom, SKU ou code-barres, sans accents ni casse
export const normalize = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

export function matchesQuery(item: Pick<StockItemApi, 'product' | 'variantName'>, query: string): boolean {
  const q = normalize(query)
  if (!q) return true
  return [itemLabel(item), item.product.sku, item.product.barcode].some((f) => normalize(f).includes(q))
}
