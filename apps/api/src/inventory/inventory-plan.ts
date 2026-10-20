import { gap } from '../stock/stock-rules'

// Calculs d'un inventaire, sans accès à la base

export interface PlanLine {
  expectedQty: number
  countedQty: number | null
}

export interface InventorySummary {
  total: number
  counted: number
  uncounted: number
  // Lignes comptées dont la quantité diffère de l'attendu
  withGap: number
  // Sommes des écarts, en quantité : surplus (+) et manquants (-)
  surplus: number
  missing: number
}

// Écart d'une ligne : absent tant que la ligne n'est pas comptée
export function lineGap(line: PlanLine): number | null {
  return line.countedQty === null ? null : gap(line.countedQty, line.expectedQty)
}

export function summarize(lines: PlanLine[]): InventorySummary {
  const out: InventorySummary = { total: lines.length, counted: 0, uncounted: 0, withGap: 0, surplus: 0, missing: 0 }
  for (const l of lines) {
    const g = lineGap(l)
    if (g === null) {
      out.uncounted++
      continue
    }
    out.counted++
    if (g > 0) out.surplus = Math.round((out.surplus + g) * 1000) / 1000
    if (g < 0) out.missing = Math.round((out.missing + g) * 1000) / 1000
    if (g !== 0) out.withGap++
  }
  return out
}
