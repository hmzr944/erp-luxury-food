import { describe, it, expect } from 'vitest'
import { suggestedName } from './QuickSheets'

describe('suggestedName', () => {
  it('ne répète pas la marque et retire le signe ℮', () => {
    expect(suggestedName({ barcode: '1', name: 'Nutella', brand: 'Nutella', quantity: '400 g e', source: 'x' })).toBe('Nutella 400 g')
    expect(suggestedName({ barcode: '1', name: 'Pâte à tartiner', brand: 'Marque', quantity: '750 g ℮', source: 'x' })).toBe('Marque Pâte à tartiner 750 g')
    expect(suggestedName({ barcode: '1', name: 'Crème', source: 'x' })).toBe('Crème')
  })
})
