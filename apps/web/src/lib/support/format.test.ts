import { describe, expect, it } from 'vitest'
import { formatGap, formatMessageTime, formatWhen, pushError } from './format'

const TZ = 'Europe/Paris'
const now = new Date('2026-10-15T09:00:00Z') // jeudi 11 h à Paris

describe('textes du support', () => {
  it('échéance : heure seule le jour même, « demain », sinon le jour', () => {
    expect(formatWhen('2026-10-15T09:35:00Z', now, TZ)).toBe('11:35')
    expect(formatWhen('2026-10-16T07:00:00Z', now, TZ)).toBe('demain 09:00')
    expect(formatWhen('2026-10-19T06:00:00Z', now, TZ)).toBe('lundi 19 oct. 08:00')
  })

  it('heure des messages', () => {
    expect(formatMessageTime('2026-10-15T08:05:00Z', now, TZ)).toBe('10:05')
    expect(formatMessageTime('2026-10-14T08:05:00Z', now, TZ)).toBe('14 oct. 10:05')
  })

  it('retard lisible', () => {
    expect(formatGap(12 * 60_000)).toBe('12 min')
    expect(formatGap(65 * 60_000)).toBe('1 h 05')
    expect(formatGap(3 * 86_400_000)).toBe('3 j')
  })

  it('garde les dernières erreurs, sans doublon', () => {
    let list: string[] = []
    for (const m of ['a', 'b', 'a', 'c', 'd', 'e', 'f']) list = pushError(list, m)
    expect(list).toEqual(['a', 'c', 'd', 'e', 'f'])
    expect(pushError(['x'], '   ')).toEqual(['x'])
  })
})
