import type { InventoryLineApi, InventorySummary } from '@/lib/api/inventory'
import { gapOf, normalize } from './stock-format'

// Logique de l'écran d'inventaire, sans React : testée seule

export type LineFilter = 'all' | 'todo' | 'gaps'

export const countedOf = (l: Pick<InventoryLineApi, 'countedQty'>): number | null =>
  l.countedQty === null || l.countedQty === undefined ? null : Number(l.countedQty)

export function lineGap(l: Pick<InventoryLineApi, 'countedQty' | 'expectedQty'>): number | null {
  const c = countedOf(l)
  return c === null ? null : gapOf(c, Number(l.expectedQty))
}

export function summarize(lines: Array<Pick<InventoryLineApi, 'countedQty' | 'expectedQty'>>): InventorySummary {
  const out: InventorySummary = { total: lines.length, counted: 0, uncounted: 0, withGap: 0, surplus: 0, missing: 0 }
  for (const l of lines) {
    const g = lineGap(l)
    if (g === null) {
      out.uncounted++
      continue
    }
    out.counted++
    if (g !== 0) out.withGap++
    if (g > 0) out.surplus = Math.round((out.surplus + g) * 1000) / 1000
    if (g < 0) out.missing = Math.round((out.missing + g) * 1000) / 1000
  }
  return out
}

export function filterLines(lines: InventoryLineApi[], query: string, filter: LineFilter): InventoryLineApi[] {
  const q = normalize(query)
  return lines.filter((l) => {
    if (filter === 'todo' && countedOf(l) !== null) return false
    if (filter === 'gaps' && !((lineGap(l) ?? 0) !== 0)) return false
    if (!q) return true
    return [l.name, l.sku, l.barcode].some((f) => normalize(f).includes(q))
  })
}

// Un code-barres ou un SKU saisi en entier désigne une seule ligne : c'est
// ce que fait la douchette. Une seule ligne trouvée par le nom compte aussi.
export function findScanMatch(lines: InventoryLineApi[], raw: string): InventoryLineApi | null {
  const code = raw.trim()
  if (!code) return null
  const exact = lines.filter((l) => l.barcode === code || (l.sku !== null && normalize(l.sku) === normalize(code)))
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) return null
  const partial = filterLines(lines, code, 'all')
  return partial.length === 1 ? partial[0] : null
}

// Quantité après un passage de douchette : +1, ou la première unité
export const afterScan = (l: Pick<InventoryLineApi, 'countedQty'>): number => (countedOf(l) ?? 0) + 1
