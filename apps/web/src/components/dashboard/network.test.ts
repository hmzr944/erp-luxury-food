import { describe, expect, it } from 'vitest'
import { describeRange, describeVariation, formatPercent, periodFromParam } from './network'

describe('période dans l\'URL', () => {
  it('reconnaît les périodes valides, retombe sur aujourd\'hui sinon', () => {
    expect(periodFromParam('7d')).toBe('7d')
    expect(periodFromParam('lastMonth')).toBe('lastMonth')
    expect(periodFromParam('n\'importe quoi')).toBe('today')
    expect(periodFromParam(null)).toBe('today')
  })
})

describe('variation lue aux lecteurs d\'écran', () => {
  it('hausse', () => {
    const v = describeVariation(12)
    expect(v.direction).toBe('up')
    expect(v.visible).toBe('+12 %')
    expect(v.spoken).toBe('en hausse de 12 % par rapport à la période précédente')
  })
  it('baisse : le signe moins est typographique, le texte lu dit « baisse de »', () => {
    const v = describeVariation(-3.5)
    expect(v.visible).toBe('−3,5 %')
    expect(v.spoken).toBe('en baisse de 3,5 % par rapport à la période précédente')
  })
  it('stable', () => {
    expect(describeVariation(0)).toMatchObject({ direction: 'flat', spoken: 'stable par rapport à la période précédente' })
  })
  it('sans comparaison (période précédente à zéro) : pas de pourcentage inventé', () => {
    const v = describeVariation(null)
    expect(v.direction).toBe('none')
    expect(v.visible).not.toMatch(/%/)
    expect(v.spoken).toMatch(/Comparaison impossible/)
  })
  it('pourcentage sans signe', () => {
    expect(formatPercent(28)).toBe('28 %')
  })
})

describe('libellé de période en heure de Paris', () => {
  it('un jour', () => {
    expect(describeRange('2026-10-24T22:00:00.000Z', '2026-10-25T23:00:00.000Z')).toBe('dimanche 25 octobre 2026')
  })
  it('plusieurs jours du même mois', () => {
    expect(describeRange('2026-09-30T22:00:00.000Z', '2026-10-31T23:00:00.000Z')).toBe('du 1 au 31 octobre 2026')
  })
  it('à cheval sur deux mois', () => {
    expect(describeRange('2026-09-24T22:00:00.000Z', '2026-10-01T22:00:00.000Z')).toBe('du 25 septembre au 1 octobre 2026')
  })
})
