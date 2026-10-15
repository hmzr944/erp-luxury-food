// Textes du support, sans dépendance au navigateur (testés)
import type { SupportStatus } from '@/lib/api/support'

const time = (d: Date, timeZone?: string) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone })
const dayKey = (d: Date, timeZone?: string) => d.toLocaleDateString('fr-CA', { timeZone })

// « 11:35 », « demain 09:00 », « lundi 19 oct. 09:00 »
export function formatWhen(iso: string, now = new Date(), timeZone?: string): string {
  const d = new Date(iso)
  const today = dayKey(now, timeZone)
  const tomorrow = dayKey(new Date(now.getTime() + 86_400_000), timeZone)
  const key = dayKey(d, timeZone)
  if (key === today) return time(d, timeZone)
  if (key === tomorrow) return `demain ${time(d, timeZone)}`
  const day = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short', timeZone })
  return `${day} ${time(d, timeZone)}`
}

// Heure d'un message dans la conversation
export function formatMessageTime(iso: string, now = new Date(), timeZone?: string): string {
  const d = new Date(iso)
  if (dayKey(d, timeZone) === dayKey(now, timeZone)) return time(d, timeZone)
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone })} ${time(d, timeZone)}`
}

// Écart en minutes, lisible : « 12 min », « 1 h 05 », « 2 j »
export function formatGap(ms: number): string {
  const min = Math.max(1, Math.round(Math.abs(ms) / 60_000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h >= 48) return `${Math.floor(h / 24)} j`
  const m = min % 60
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}

export const MERCHANT_STATUS: Record<SupportStatus, string> = {
  OPEN: 'Transmise à l’équipe',
  WAITING_CUSTOMER: 'Réponse reçue',
  RESOLVED: 'Résolue',
}

export const AGENT_STATUS: Record<SupportStatus, string> = {
  OPEN: 'À traiter',
  WAITING_CUSTOMER: 'En attente du commerçant',
  RESOLVED: 'Résolue',
}

// Garde les dernières erreurs utiles, sans doublon, sans dépasser la taille
// acceptée par l'API
export function pushError(list: string[], message: string, max = 5): string[] {
  const clean = message.replace(/\s+/g, ' ').trim().slice(0, 300)
  if (!clean) return list
  return [...list.filter((m) => m !== clean), clean].slice(-max)
}
