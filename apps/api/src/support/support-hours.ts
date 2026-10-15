// Heures d'ouverture du support et délai de réponse, sans base de données.
// Le délai annoncé est une promesse commerciale décidée par FLŌW : il vient
// de la configuration (SUPPORT_SLA_MINUTES, SUPPORT_HOURS), jamais du code.
import { addDays, localDay, zonedTime } from '../supply/supply-plan'

export const SUPPORT_TZ = 'Europe/Paris'

const DAY_CODES = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'] as const
const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
// Ordre de la semaine française : lundi d'abord
const WEEK = [1, 2, 3, 4, 5, 6, 0]

export interface HoursSegment {
  days: number[] // 0 dimanche … 6 samedi
  start: number // minutes depuis minuit, heure de Paris
  end: number
}

// null : pas d'horaires configurés, le délai court en continu
export type SupportSchedule = HoursSegment[] | null

const toMinutes = (hhmm: string) => {
  const m = /^(\d{1,2})(?::|h)(\d{2})?$/.exec(hhmm.trim())
  if (!m) return NaN
  const h = Number(m[1])
  const min = Number(m[2] ?? 0)
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return NaN
  return h * 60 + min
}

const dayIndex = (code: string) => DAY_CODES.indexOf(code.trim().toLowerCase().slice(0, 3) as (typeof DAY_CODES)[number])

// « lun-sam 08:00-20:00 » ; plusieurs plages séparées par « ; »,
// ex. « lun-ven 08:00-20:00; sam 09:00-13:00 ». Jours en liste (« lun,mer »)
// ou en intervalle (« lun-sam », « sam-lun » passe par le dimanche).
export function parseSupportHours(raw: string | undefined | null): SupportSchedule {
  if (!raw || !raw.trim()) return null
  const segments: HoursSegment[] = []
  for (const part of raw.split(';').map((s) => s.trim()).filter(Boolean)) {
    const m = /^(\S+)\s+(\S+)\s*-\s*(\S+)$/.exec(part)
    if (!m) throw new Error(`SUPPORT_HOURS illisible : « ${part} » (attendu par exemple « lun-sam 08:00-20:00 »)`)
    const days = new Set<number>()
    for (const token of m[1].split(',')) {
      const [a, b] = token.split('-')
      const from = dayIndex(a)
      const to = b === undefined ? from : dayIndex(b)
      if (from < 0 || to < 0) throw new Error(`SUPPORT_HOURS : jour inconnu dans « ${token} » (lun, mar, mer, jeu, ven, sam, dim)`)
      // Parcours dans l'ordre lundi → dimanche, avec bouclage
      const i0 = WEEK.indexOf(from)
      const i1 = WEEK.indexOf(to)
      for (let k = 0; k <= (i1 - i0 + 7) % 7; k++) days.add(WEEK[(i0 + k) % 7])
    }
    const start = toMinutes(m[2])
    const end = toMinutes(m[3])
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      throw new Error(`SUPPORT_HOURS : plage horaire invalide dans « ${part} »`)
    }
    segments.push({ days: [...days].sort((x, y) => WEEK.indexOf(x) - WEEK.indexOf(y)), start, end })
  }
  return segments.length ? segments : null
}

const weekday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay()
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

// Plages ouvertes d'une journée locale, en instants UTC, triées
function windowsOf(day: string, schedule: HoursSegment[], tz: string): Array<[Date, Date]> {
  const wd = weekday(day)
  return schedule
    .filter((s) => s.days.includes(wd))
    .map((s) => [zonedTime(day, hhmm(s.start), tz), s.end >= 1440 ? zonedTime(addDays(day, 1), '00:00', tz) : zonedTime(day, hhmm(s.end), tz)] as [Date, Date])
    .sort((a, b) => a[0].getTime() - b[0].getTime())
}

export function isOpen(at: Date, schedule: SupportSchedule, tz = SUPPORT_TZ): boolean {
  if (!schedule) return true
  return windowsOf(localDay(at, tz), schedule, tz).some(([a, b]) => at >= a && at < b)
}

// Prochaine ouverture (ou maintenant si l'équipe est là)
export function nextOpening(at: Date, schedule: SupportSchedule, tz = SUPPORT_TZ): Date {
  if (!schedule) return at
  const today = localDay(at, tz)
  for (let i = 0; i < 8; i++) {
    for (const [a, b] of windowsOf(addDays(today, i), schedule, tz)) {
      if (at < b) return at > a ? at : a
    }
  }
  return at
}

// Réponse attendue avant : `minutes` d'heures ouvrées à partir de `from`.
// Une demande du samedi soir est comptée à partir de l'ouverture suivante.
export function dueAt(from: Date, minutes: number, schedule: SupportSchedule, tz = SUPPORT_TZ): Date {
  if (!schedule) return new Date(from.getTime() + minutes * 60_000)
  let remaining = minutes * 60_000
  const today = localDay(from, tz)
  // Au plus un an de recherche : une configuration vide ne bloque jamais
  for (let i = 0; i < 366; i++) {
    for (const [a, b] of windowsOf(addDays(today, i), schedule, tz)) {
      const start = from > a ? from : a
      if (start >= b) continue
      const available = b.getTime() - start.getTime()
      if (remaining <= available) return new Date(start.getTime() + remaining)
      remaining -= available
    }
  }
  return new Date(from.getTime() + minutes * 60_000)
}

// --- Textes affichés -----------------------------------------------------

// 120 → « 2 h », 30 → « 30 min », 90 → « 1 h 30 », 2880 → « 48 h »
export function formatDelay(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}

const formatTime = (min: number) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}

function formatDays(days: number[]): string {
  if (days.length === 7) return 'tous les jours'
  const idx = days.map((d) => WEEK.indexOf(d)).sort((a, b) => a - b)
  const consecutive = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1)
  if (days.length === 1) return `le ${DAY_NAMES[days[0]]}`
  if (consecutive) return `du ${DAY_NAMES[WEEK[idx[0]]]} au ${DAY_NAMES[WEEK[idx[idx.length - 1]]]}`
  const names = idx.map((i) => DAY_NAMES[WEEK[i]])
  return `le ${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`
}

// « du lundi au samedi de 8 h à 20 h » ; null sans horaires configurés
export function describeHours(schedule: SupportSchedule): string | null {
  if (!schedule) return null
  return schedule.map((s) => `${formatDays(s.days)} de ${formatTime(s.start)} à ${formatTime(s.end)}`).join(', ')
}

// « Réponse sous 2 h, du lundi au samedi de 8 h à 20 h »
export function describePromise(minutes: number, schedule: SupportSchedule): string {
  const hours = describeHours(schedule)
  return `Réponse sous ${formatDelay(minutes)}${hours ? `, ${hours}` : ''}`
}

// Liste d'e-mails séparés par des virgules, en minuscules
export function emailList(raw: string | undefined | null): string[] {
  return (raw ?? '')
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[^@\s]+@[^@\s]+$/.test(s))
}

// Entier positif lu dans la configuration, sinon la valeur par défaut
export function positiveMinutes(raw: string | undefined | null, fallback: number): number {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : fallback
}
