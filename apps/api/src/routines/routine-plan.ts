// Routine de fermeture, sans base de données : échéances du jour, tâches
// faites ou non, et niveau de rappel à afficher sur la caisse.
//   0 rien · 1 bandeau discret (échéance proche) · 2 liste de fin de journée
//   (échéance passée) · 3 caisse oubliée : alerte au gérant et verrouillage
import { businessDate } from '@erp/utils'
import { addDays, zonedTime } from '../supply/supply-plan'

export interface RoutineTaskConfig {
  key: string
  label: string
  deadline?: string | null
}

export interface RoutineConfig {
  enabled: boolean
  closingTime: string
  supplyDeadline: string | null
  cashDeadline: string | null
  days: number[]
  reminderMinutes: number
  alertAfterMinutes: number
  autoLock: boolean
  tasks: RoutineTaskConfig[]
}

export const DEFAULT_ROUTINE: RoutineConfig = {
  enabled: false,
  closingTime: '19:30',
  supplyDeadline: null,
  cashDeadline: null,
  days: [1, 2, 3, 4, 5, 6],
  reminderMinutes: 30,
  alertAfterMinutes: 60,
  autoLock: true,
  tasks: [],
}

export interface RoutineFacts {
  // Le site commande à un fournisseur interne (labo, dépôt)
  canOrderSupply: boolean
  supplySentAt: Date | null
  // Caisses encore ouvertes sur le site
  openCash: number
  lastCashClosedAt: Date | null
  checks: Record<string, { doneAt: Date; userName: string | null }>
}

export type RoutineTaskKind = 'SUPPLY' | 'CASH' | 'CUSTOM'

export interface RoutineTaskStatus {
  key: string
  kind: RoutineTaskKind
  label: string
  deadlineAt: string
  done: boolean
  doneAt: string | null
  doneBy: string | null
  overdue: boolean
}

export interface RoutineStatus {
  enabled: boolean
  day: string
  openDay: boolean
  closingAt: string
  alertAt: string
  autoLock: boolean
  level: 0 | 1 | 2 | 3
  tasks: RoutineTaskStatus[]
}

export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

// Instant d'une heure « HH:MM » de la journée commerciale (avant 05:00 : nuit suivante)
export function dayTime(day: string, hhmm: string, timeZone: string): Date {
  return zonedTime(hhmm < '05:00' ? addDays(day, 1) : day, hhmm, timeZone)
}

// Jour ISO (1 lundi ... 7 dimanche) d'une date « AAAA-MM-JJ »
export function isoWeekday(day: string): number {
  const d = new Date(`${day}T12:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}

export function routineStatus(now: Date, timeZone: string, config: RoutineConfig, facts: RoutineFacts): RoutineStatus {
  const day = businessDate(now, timeZone)
  const closingAt = dayTime(day, config.closingTime, timeZone)
  const alertAt = new Date(closingAt.getTime() + config.alertAfterMinutes * 60_000)
  const at = (hhmm: string | null | undefined) => (hhmm && HHMM.test(hhmm) ? dayTime(day, hhmm, timeZone) : closingAt)

  const tasks: Array<Omit<RoutineTaskStatus, 'overdue' | 'deadlineAt'> & { deadline: Date }> = []
  if (config.supplyDeadline && facts.canOrderSupply) {
    tasks.push({
      key: 'supply',
      kind: 'SUPPLY',
      label: 'Commande fournisseur envoyée',
      deadline: at(config.supplyDeadline),
      done: !!facts.supplySentAt,
      doneAt: facts.supplySentAt?.toISOString() ?? null,
      doneBy: null,
    })
  }
  for (const t of config.tasks) {
    const check = facts.checks[t.key]
    tasks.push({ key: t.key, kind: 'CUSTOM', label: t.label, deadline: at(t.deadline), done: !!check, doneAt: check?.doneAt.toISOString() ?? null, doneBy: check?.userName ?? null })
  }
  tasks.push({
    key: 'cash',
    kind: 'CASH',
    label: 'Comptage et clôture de la caisse',
    deadline: at(config.cashDeadline),
    done: facts.openCash === 0,
    doneAt: facts.openCash === 0 ? (facts.lastCashClosedAt?.toISOString() ?? null) : null,
    doneBy: null,
  })

  const openDay = config.days.includes(isoWeekday(day))
  const out = tasks
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
    .map(({ deadline, ...t }) => ({ ...t, deadlineAt: deadline.toISOString(), overdue: !t.done && now >= deadline }))

  let level: RoutineStatus['level'] = 0
  if (config.enabled && openDay) {
    const pending = tasks.filter((t) => !t.done)
    if (facts.openCash > 0 && now >= alertAt) level = 3
    else if (pending.some((t) => now >= t.deadline)) level = 2
    else if (pending.some((t) => now.getTime() >= t.deadline.getTime() - config.reminderMinutes * 60_000)) level = 1
  }

  return {
    enabled: config.enabled,
    day,
    openDay,
    closingAt: closingAt.toISOString(),
    alertAt: alertAt.toISOString(),
    autoLock: config.autoLock,
    level,
    tasks: out,
  }
}
