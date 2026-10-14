import { describe, expect, it } from 'vitest'
import { DEFAULT_ROUTINE, dayTime, routineStatus, type RoutineFacts } from './routine-plan'

const tz = 'Europe/Paris'
const config = { ...DEFAULT_ROUTINE, enabled: true, closingTime: '19:30', supplyDeadline: '18:30', cashDeadline: '19:45', tasks: [{ key: 'vitrine', label: 'Vitrine éteinte' }] }
const facts = (over: Partial<RoutineFacts> = {}): RoutineFacts => ({ canOrderSupply: true, supplySentAt: null, openCash: 1, lastCashClosedAt: null, checks: {}, ...over })
// Mercredi 14 octobre 2026, heure de Paris (UTC+2)
const paris = (hhmm: string, day = '2026-10-14') => new Date(`${day}T${hhmm}:00+02:00`)

describe('Routine de fermeture', () => {
  it('reste silencieuse en journée', () => {
    expect(routineStatus(paris('15:00'), tz, config, facts()).level).toBe(0)
  })

  it('bandeau 30 minutes avant la commande fournisseur', () => {
    const s = routineStatus(paris('18:05'), tz, config, facts())
    expect(s.level).toBe(1)
    expect(s.tasks.map((t) => t.key)).toEqual(['supply', 'vitrine', 'cash'])
  })

  it('liste de fin de journée une fois l’échéance passée, sauf tâches faites', () => {
    expect(routineStatus(paris('18:40'), tz, config, facts()).level).toBe(2)
    const done = routineStatus(paris('18:40'), tz, config, facts({ supplySentAt: paris('18:15') }))
    expect(done.level).toBe(0) // vitrine à 19:30 : rappel à partir de 19:00
    expect(routineStatus(paris('19:05'), tz, config, facts({ supplySentAt: paris('18:15') })).level).toBe(1)
    expect(done.tasks[0]).toMatchObject({ key: 'supply', done: true, overdue: false })
  })

  it('caisse oubliée une heure après la fermeture : niveau 3', () => {
    expect(routineStatus(paris('20:31'), tz, config, facts()).level).toBe(3)
    const closed = routineStatus(paris('20:31'), tz, config, facts({ openCash: 0, supplySentAt: paris('18:00'), checks: { vitrine: { doneAt: paris('19:20'), userName: 'Léa' } } }))
    expect(closed.level).toBe(0)
  })

  it('jour de fermeture : aucun rappel', () => {
    expect(routineStatus(paris('20:31', '2026-10-18'), tz, config, facts()).level).toBe(0) // dimanche
  })

  it('fermeture après minuit : la nuit suivante', () => {
    expect(dayTime('2026-10-14', '01:30', tz).toISOString()).toBe('2026-10-14T23:30:00.000Z')
    const bar = { ...config, closingTime: '01:30', supplyDeadline: null, cashDeadline: null, tasks: [] }
    expect(routineStatus(paris('23:59'), tz, bar, facts()).level).toBe(0)
    expect(routineStatus(new Date('2026-10-15T02:31:00+02:00'), tz, bar, facts()).level).toBe(3)
  })

  it('routine désactivée : jamais de rappel', () => {
    expect(routineStatus(paris('21:00'), tz, { ...config, enabled: false }, facts()).level).toBe(0)
  })
})
