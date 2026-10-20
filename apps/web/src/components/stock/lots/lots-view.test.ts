import { describe, expect, it } from 'vitest'
import { dateKindLabel, formatDay, lotTitle, quantityLabel, statusDetail, statusLabel, todayInParis } from './lots-view'

describe('états d’un lot', () => {
  it('dit l’état en toutes lettres', () => {
    expect(statusLabel('EXPIRED', -2)).toBe('Périmé')
    expect(statusLabel('EXPIRED', -2, 'DDM')).toBe('Date dépassée')
    expect(statusLabel('TODAY', 0)).toBe('Dernier jour')
    expect(statusLabel('SOON', 1)).toBe('Demain')
    expect(statusLabel('SOON', 3)).toBe('Dans 3 jours')
    expect(statusLabel('NEAR', 21)).toBe('Dans 21 jours')
    expect(statusLabel('NO_DATE', null)).toBe('Sans date')
  })

  it('précise depuis quand un lot est périmé', () => {
    expect(statusDetail('EXPIRED', -1)).toBe('depuis 1 jour')
    expect(statusDetail('EXPIRED', -4)).toBe('depuis 4 jours')
    expect(statusDetail('SOON', 3)).toBeNull()
  })

  it('formate un jour sans glisser d’un jour', () => {
    expect(formatDay('2026-10-20')).toBe('20 oct. 2026')
    expect(formatDay('2027-01-01')).toBe('1 janv. 2027')
    expect(formatDay(null)).toBe('Sans date')
  })

  it('lit « aujourd’hui » à Paris', () => {
    expect(todayInParis(new Date('2026-10-19T22:30:00Z'))).toBe('2026-10-20')
    expect(todayInParis(new Date('2026-10-20T21:30:00Z'))).toBe('2026-10-20')
  })

  it('écrit quantités et titres', () => {
    expect(quantityLabel(12, 'unité')).toBe('12')
    expect(quantityLabel(1.5, 'kg')).toBe('1,5 kg')
    expect(lotTitle({ productName: 'Rillettes', variantName: '180 g' })).toBe('Rillettes (180 g)')
    expect(dateKindLabel('DDM')).toBe('DDM')
  })
})
