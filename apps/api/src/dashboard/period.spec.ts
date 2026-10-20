import { describe, expect, it } from 'vitest'
import { isPeriodKey, resolvePeriod, variation } from './period'

const iso = (d: Date) => d.toISOString()

describe('bornes de période en heure de Paris', () => {
  it('été : minuit à Paris est 22 h UTC la veille', () => {
    const p = resolvePeriod('today', new Date('2026-07-15T10:00:00Z'))
    expect(iso(p.from)).toBe('2026-07-14T22:00:00.000Z')
    expect(iso(p.to)).toBe('2026-07-15T22:00:00.000Z')
  })

  it('hiver : minuit à Paris est 23 h UTC la veille', () => {
    const p = resolvePeriod('today', new Date('2026-01-15T10:00:00Z'))
    expect(iso(p.from)).toBe('2026-01-14T23:00:00.000Z')
    expect(iso(p.to)).toBe('2026-01-15T23:00:00.000Z')
  })

  it("une vente à 23 h 30 à Paris appartient au jour de Paris, pas au jour UTC", () => {
    const p = resolvePeriod('today', new Date('2026-07-15T21:45:00Z')) // 23 h 45 à Paris
    expect(iso(p.from)).toBe('2026-07-14T22:00:00.000Z')
    expect(iso(p.to)).toBe('2026-07-15T22:00:00.000Z')
    // 22 h 30 UTC = 0 h 30 le 16 à Paris : jour suivant
    const next = resolvePeriod('today', new Date('2026-07-15T22:30:00Z'))
    expect(iso(next.from)).toBe('2026-07-15T22:00:00.000Z')
  })

  it("changement d'heure d'octobre : le jour dure 25 heures", () => {
    const p = resolvePeriod('today', new Date('2026-10-25T12:00:00Z'))
    expect(iso(p.from)).toBe('2026-10-24T22:00:00.000Z')
    expect(iso(p.to)).toBe('2026-10-25T23:00:00.000Z')
    expect((p.to.getTime() - p.from.getTime()) / 3_600_000).toBe(25)
    // le lendemain commence à minuit d'hiver
    const monday = resolvePeriod('today', new Date('2026-10-26T09:00:00Z'))
    expect(iso(monday.from)).toBe('2026-10-25T23:00:00.000Z')
  })

  it("changement d'heure de mars : le jour dure 23 heures", () => {
    const p = resolvePeriod('today', new Date('2026-03-29T12:00:00Z'))
    expect(iso(p.from)).toBe('2026-03-28T23:00:00.000Z')
    expect(iso(p.to)).toBe('2026-03-29T22:00:00.000Z')
    expect((p.to.getTime() - p.from.getTime()) / 3_600_000).toBe(23)
  })

  it("7 jours à cheval sur le changement d'heure : sept jours civils, pas 168 heures", () => {
    const p = resolvePeriod('7d', new Date('2026-10-28T10:00:00Z'))
    // du 22 octobre (heure d'été) au 28 octobre inclus (heure d'hiver)
    expect(iso(p.from)).toBe('2026-10-21T22:00:00.000Z')
    expect(iso(p.to)).toBe('2026-10-28T23:00:00.000Z')
    // précédente : sept jours juste avant
    expect(iso(p.previous.to)).toBe('2026-10-21T22:00:00.000Z')
    expect(iso(p.previous.from)).toBe('2026-10-14T22:00:00.000Z')
  })

  it('hier et sa période précédente', () => {
    const p = resolvePeriod('yesterday', new Date('2026-10-26T09:00:00Z'))
    expect(iso(p.from)).toBe('2026-10-24T22:00:00.000Z')
    expect(iso(p.to)).toBe('2026-10-25T23:00:00.000Z')
    expect(iso(p.previous.from)).toBe('2026-10-23T22:00:00.000Z')
    expect(iso(p.previous.to)).toBe('2026-10-24T22:00:00.000Z')
  })

  it('30 jours : trente jours civils, précédente de même durée', () => {
    const p = resolvePeriod('30d', new Date('2026-07-31T10:00:00Z'))
    expect(iso(p.from)).toBe('2026-07-01T22:00:00.000Z') // 2 juillet 0 h
    expect(iso(p.to)).toBe('2026-07-31T22:00:00.000Z')
    expect(iso(p.previous.to)).toBe(iso(p.from))
    expect(iso(p.previous.from)).toBe('2026-06-01T22:00:00.000Z')
  })

  it('ce mois-ci : le mois entier, comparé au même nombre de jours du mois précédent', () => {
    const p = resolvePeriod('month', new Date('2026-10-10T10:00:00Z'))
    expect(iso(p.from)).toBe('2026-09-30T22:00:00.000Z') // 1er octobre 0 h, heure d'été
    expect(iso(p.to)).toBe('2026-10-31T23:00:00.000Z') // 1er novembre 0 h, heure d'hiver
    expect(iso(p.previous.from)).toBe('2026-08-31T22:00:00.000Z') // 1er septembre
    // 10 jours écoulés : du 1er au 10 septembre inclus
    expect(iso(p.previous.to)).toBe('2026-09-10T22:00:00.000Z')
  })

  it('ce mois-ci le 31 : la période précédente ne déborde pas sur le mois courant', () => {
    const p = resolvePeriod('month', new Date('2026-10-31T10:00:00Z'))
    expect(iso(p.previous.from)).toBe('2026-08-31T22:00:00.000Z')
    expect(iso(p.previous.to)).toBe('2026-09-30T22:00:00.000Z') // 1er octobre 0 h
  })

  it('mois dernier, y compris en janvier (passage d\'année)', () => {
    const p = resolvePeriod('lastMonth', new Date('2026-01-10T10:00:00Z'))
    expect(iso(p.from)).toBe('2025-11-30T23:00:00.000Z') // 1er décembre 2025
    expect(iso(p.to)).toBe('2025-12-31T23:00:00.000Z') // 1er janvier 2026
    expect(iso(p.previous.from)).toBe('2025-10-31T23:00:00.000Z') // 1er novembre 2025
    expect(iso(p.previous.to)).toBe(iso(p.from))
  })

  it('mois dernier : mars 2026 contient le changement d\'heure', () => {
    const p = resolvePeriod('lastMonth', new Date('2026-04-12T10:00:00Z'))
    expect(iso(p.from)).toBe('2026-02-28T23:00:00.000Z')
    expect(iso(p.to)).toBe('2026-03-31T22:00:00.000Z')
  })

  it('reconnaît les clés valides seulement', () => {
    expect(isPeriodKey('7d')).toBe(true)
    expect(isPeriodKey('year')).toBe(false)
    expect(isPeriodKey(undefined)).toBe(false)
    expect(isPeriodKey(['7d'])).toBe(false)
  })
})

describe('variation', () => {
  it('pourcentage à une décimale', () => {
    expect(variation(112, 100)).toBe(12)
    expect(variation(50, 80)).toBe(-37.5)
    expect(variation(100, 100)).toBe(0)
  })
  it('période précédente à zéro : null, jamais Infinity ni 100 %', () => {
    expect(variation(500, 0)).toBeNull()
    expect(variation(0, 0)).toBeNull()
  })
  it('période précédente négative (remboursements seuls) : null', () => {
    expect(variation(100, -20)).toBeNull()
  })
})
