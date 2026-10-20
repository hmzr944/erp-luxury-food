import { describe, it, expect } from 'vitest'
import { describeCopyReport, type CatalogCopyReport } from './catalog-copy'

const base: CatalogCopyReport = {
  categories: 2, modifierGroups: 0, products: 12, variants: 3, menus: 0,
  skipped: 0, skippedItems: [], samplesExcluded: 0, variantCodesCleared: 0,
}

describe('describeCopyReport', () => {
  it('résume la copie et rappelle que le stock part de zéro', () => {
    const lines = describeCopyReport(base)
    expect(lines[0]).toBe('12 articles copiés, 2 rayons créés.')
    expect(lines.at(-1)).toContain('stock de départ est à 0')
  })

  it('accorde au singulier et signale les articles ignorés', () => {
    const lines = describeCopyReport({ ...base, products: 1, categories: 1, skipped: 1, samplesExcluded: 2 })
    expect(lines[0]).toBe('1 article copié, 1 rayon créé.')
    expect(lines).toContain('1 article ignoré car déjà présent sur ce site.')
    expect(lines).toContain('2 articles d’exemple laissés de côté.')
  })

  it('n’emploie aucun tiret cadratin', () => {
    expect(describeCopyReport({ ...base, skipped: 3, variantCodesCleared: 1 }).join(' ')).not.toMatch(/[—–]/)
  })
})
