// Fidélité et cartes cadeaux : règles communes à la caisse et au serveur.

export interface LoyaltyRules {
  enabled: boolean
  pointsPerEuro: number
  threshold: number
  reward: number
}

// Points gagnés sur une vente : montant réellement payé, cartes cadeaux
// achetées exclues (on ne gagne pas de points sur un moyen de paiement)
export function pointsEarned(paid: number, rules: Pick<LoyaltyRules, 'enabled' | 'pointsPerEuro'>): number {
  if (!rules.enabled || paid <= 0 || rules.pointsPerEuro <= 0) return 0
  return Math.floor(Math.round(paid * 100) * rules.pointsPerEuro / 100)
}

// Récompenses débloquées : nombre de paliers atteints et remise correspondante
export function rewardsAvailable(points: number, rules: Pick<LoyaltyRules, 'enabled' | 'threshold' | 'reward'>) {
  if (!rules.enabled || rules.threshold <= 0 || points < rules.threshold) return { count: 0, points: 0, amount: 0 }
  const count = Math.floor(points / rules.threshold)
  return { count, points: count * rules.threshold, amount: Math.round(count * rules.reward * 100) / 100 }
}

// Points repris sur un remboursement, au prorata de ce qui est rendu
export function pointsToReverse(earned: number, refunded: number, paid: number): number {
  if (earned <= 0 || paid <= 0) return 0
  return Math.min(earned, Math.round((earned * Math.abs(refunded)) / paid))
}

// Téléphone français : « 06 12 34 56 78 », « +33 6... » → « +33612345678 »
export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/[^\d+]/g, '')
  if (/^0[1-9]\d{8}$/.test(d)) return `+33${d.slice(1)}`
  if (/^\+33[1-9]\d{8}$/.test(d)) return d
  if (/^0033[1-9]\d{8}$/.test(d)) return `+${d.slice(2)}`
  if (/^\+\d{8,15}$/.test(d)) return d
  return null
}

// Code de carte cadeau : CC-XXXX-XXXX-XXXX (60 bits), sans caractère ambigu.
// Tiré par la caisse, même hors ligne : il est imprimé et signé avec la vente.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
export const GIFT_CARD_CODE = /\bCC-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}\b/

export function giftCardCode(random: (n: number) => Uint8Array): string {
  const bytes = random(12)
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length])
  return `CC-${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`
}

export const giftCardLineName = (code: string) => `Carte cadeau ${code}`
