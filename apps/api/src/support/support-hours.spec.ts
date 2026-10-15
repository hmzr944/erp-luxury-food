import { describe, expect, it } from 'vitest'
import { describeHours, describePromise, dueAt, emailList, formatDelay, isOpen, nextOpening, parseSupportHours, positiveMinutes } from './support-hours'

// Octobre 2026 : heure d'été jusqu'au 25 (UTC+2), puis UTC+1
const LUN_SAM = parseSupportHours('lun-sam 08:00-20:00')

describe('parseSupportHours', () => {
  it('lit un intervalle de jours et une plage horaire', () => {
    expect(LUN_SAM).toEqual([{ days: [1, 2, 3, 4, 5, 6], start: 480, end: 1200 }])
  })

  it('lit plusieurs plages, des listes de jours et un intervalle qui passe par le dimanche', () => {
    expect(parseSupportHours('lun,mer 09:00-12:30; sam-lun 10h-18h')).toEqual([
      { days: [1, 3], start: 540, end: 750 },
      { days: [1, 6, 0], start: 600, end: 1080 },
    ])
  })

  it('sans valeur : pas d’horaires, le délai court en continu', () => {
    expect(parseSupportHours('')).toBeNull()
    expect(parseSupportHours(undefined)).toBeNull()
  })

  it('refuse une configuration illisible plutôt que d’inventer des horaires', () => {
    expect(() => parseSupportHours('lundi au samedi')).toThrow()
    expect(() => parseSupportHours('lun-xyz 08:00-20:00')).toThrow()
    expect(() => parseSupportHours('lun 20:00-08:00')).toThrow()
  })
})

describe('dueAt', () => {
  it('pendant les heures d’ouverture : simple addition', () => {
    // Jeudi 15 octobre 2026, 10 h à Paris
    const from = new Date('2026-10-15T08:00:00Z')
    expect(dueAt(from, 120, LUN_SAM).toISOString()).toBe('2026-10-15T10:00:00.000Z') // 12 h
  })

  it('reporte le reste au lendemain matin', () => {
    // Jeudi 19 h : 1 h ce soir, 1 h vendredi à partir de 8 h
    const from = new Date('2026-10-15T17:00:00Z')
    expect(dueAt(from, 120, LUN_SAM).toISOString()).toBe('2026-10-16T07:00:00.000Z') // vendredi 9 h
  })

  it('demande la nuit : le délai part de l’ouverture', () => {
    // Jeudi 23 h → vendredi 8 h + 2 h
    const from = new Date('2026-10-15T21:00:00Z')
    expect(dueAt(from, 120, LUN_SAM).toISOString()).toBe('2026-10-16T08:00:00.000Z')
  })

  it('saute le dimanche fermé', () => {
    // Samedi 17 octobre, 19 h 30 : 30 min samedi, 1 h 30 lundi
    const from = new Date('2026-10-17T17:30:00Z')
    expect(dueAt(from, 120, LUN_SAM).toISOString()).toBe('2026-10-19T07:30:00.000Z') // lundi 9 h 30
  })

  it('suit le changement d’heure', () => {
    // Samedi 24 octobre 2026, 22 h (UTC+2) → lundi 26 octobre 8 h (UTC+1) + 2 h
    const from = new Date('2026-10-24T20:00:00Z')
    expect(dueAt(from, 120, LUN_SAM).toISOString()).toBe('2026-10-26T09:00:00.000Z')
  })

  it('urgence : délai plus court, mêmes horaires', () => {
    const from = new Date('2026-10-15T08:00:00Z')
    expect(dueAt(from, 30, LUN_SAM).toISOString()).toBe('2026-10-15T08:30:00.000Z')
    // Dimanche midi : la première demi-heure de lundi
    expect(dueAt(new Date('2026-10-18T10:00:00Z'), 30, LUN_SAM).toISOString()).toBe('2026-10-19T06:30:00.000Z')
  })

  it('sans horaires : en continu', () => {
    const from = new Date('2026-10-18T02:00:00Z')
    expect(dueAt(from, 120, null).toISOString()).toBe('2026-10-18T04:00:00.000Z')
  })

  it('délai plus long qu’une journée d’ouverture', () => {
    // 24 h ouvrées depuis lundi 8 h : lundi 12 h + mardi 12 h → mardi 20 h
    const from = new Date('2026-10-19T06:00:00Z')
    expect(dueAt(from, 24 * 60, LUN_SAM).toISOString()).toBe('2026-10-20T18:00:00.000Z')
  })
})

describe('isOpen et nextOpening', () => {
  it('ouvert en semaine, fermé la nuit et le dimanche', () => {
    expect(isOpen(new Date('2026-10-15T08:00:00Z'), LUN_SAM)).toBe(true)
    expect(isOpen(new Date('2026-10-15T18:00:00Z'), LUN_SAM)).toBe(false) // 20 h pile : fermé
    expect(isOpen(new Date('2026-10-18T10:00:00Z'), LUN_SAM)).toBe(false)
    expect(isOpen(new Date('2026-10-18T10:00:00Z'), null)).toBe(true)
  })

  it('prochaine ouverture', () => {
    expect(nextOpening(new Date('2026-10-18T10:00:00Z'), LUN_SAM).toISOString()).toBe('2026-10-19T06:00:00.000Z')
    const now = new Date('2026-10-15T08:00:00Z')
    expect(nextOpening(now, LUN_SAM)).toEqual(now)
  })
})

describe('textes', () => {
  it('décrit la promesse à partir de la configuration', () => {
    expect(describePromise(120, LUN_SAM)).toBe('Réponse sous 2 h, du lundi au samedi de 8 h à 20 h')
    expect(describePromise(90, null)).toBe('Réponse sous 1 h 30')
    expect(formatDelay(30)).toBe('30 min')
    expect(describeHours(parseSupportHours('lun,mer,ven 09:30-18:00; dim 10:00-12:00'))).toBe(
      'le lundi, mercredi et vendredi de 9 h 30 à 18 h, le dimanche de 10 h à 12 h',
    )
    expect(describeHours(parseSupportHours('lun-dim 00:00-24:00'))).toBe('tous les jours de 0 h à 24 h')
  })

  it('lit les listes et les nombres de la configuration', () => {
    expect(emailList(' A@flow.fr, b@flow.fr ;pas-un-email')).toEqual(['a@flow.fr', 'b@flow.fr'])
    expect(positiveMinutes('45', 120)).toBe(45)
    expect(positiveMinutes('', 120)).toBe(120)
    expect(positiveMinutes('-3', 120)).toBe(120)
  })
})
