// Codes-barres EAN-13 à prix ou poids intégré, imprimés par une balance
// étiqueteuse. Les préfixes 20 à 29 sont réservés à l'usage interne du
// commerçant : leur structure dépend du paramétrage de la balance, d'où
// des règles configurables par organisation.
//
// Structure : préfixe (2) + code article (n) + valeur (10 - n) + clé.
// Avec le réglage courant n = 5 : 2x CCCCC VVVVV K.

export type ScaleBarcodeMode = 'PRICE' | 'WEIGHT'

export interface ScaleBarcodeRule {
  prefix: string // « 20 » à « 29 »
  mode: ScaleBarcodeMode
  codeLength: number // chiffres du code article (4 à 6)
}

// Réglage de départ, à aligner sur celui de la balance du magasin
export const DEFAULT_SCALE_RULES: ScaleBarcodeRule[] = [
  { prefix: '20', mode: 'PRICE', codeLength: 5 },
  { prefix: '23', mode: 'WEIGHT', codeLength: 5 },
]

export interface ScaleBarcode {
  barcode: string
  rule: ScaleBarcodeRule
  // Code article de la balance (PLU), sans zéros de tête
  code: string
  // Prix de l'étiquette en euros (mode PRICE)
  price?: number
  // Poids en kilogrammes (mode WEIGHT)
  weight?: number
}

export function ean13CheckDigit(first12: string): number {
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3)
  return (10 - (sum % 10)) % 10
}

export const isValidEan13 = (code: string) => /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === Number(code[12])

export function validScaleRule(r: ScaleBarcodeRule): string | null {
  if (!/^2\d$/.test(r.prefix)) return `Préfixe ${r.prefix} : choisissez entre 20 et 29`
  if (!Number.isInteger(r.codeLength) || r.codeLength < 4 || r.codeLength > 6) return `Préfixe ${r.prefix} : code article de 4 à 6 chiffres`
  if (r.mode !== 'PRICE' && r.mode !== 'WEIGHT') return `Préfixe ${r.prefix} : mode inconnu`
  return null
}

// Règles enregistrées par l'organisation ; vide ou absent : réglage par défaut
export function scaleRulesFrom(value: unknown): ScaleBarcodeRule[] {
  if (!Array.isArray(value)) return DEFAULT_SCALE_RULES
  const rules = (value as ScaleBarcodeRule[]).filter((r) => r && typeof r === 'object' && !validScaleRule(r))
  return rules.length ? rules : DEFAULT_SCALE_RULES
}

// Code lu par la douchette : étiquette de balance reconnue, ou null
export function parseScaleBarcode(raw: string, rules: ScaleBarcodeRule[] = DEFAULT_SCALE_RULES): ScaleBarcode | null {
  const barcode = raw.trim()
  if (!isValidEan13(barcode)) return null
  const rule = rules.find((r) => barcode.startsWith(r.prefix) && !validScaleRule(r))
  if (!rule) return null
  const code = barcode.slice(2, 2 + rule.codeLength).replace(/^0+(?=\d)/, '')
  const value = Number(barcode.slice(2 + rule.codeLength, 12))
  return rule.mode === 'PRICE'
    ? { barcode, rule, code, price: value / 100 }
    : { barcode, rule, code, weight: value / 1000 }
}

// Prix d'un poids au prix au kilo, arrondi au centime
export const priceForWeight = (weightKg: number, pricePerKg: number) => Math.round(Math.round(weightKg * 1000) * Math.round(pricePerKg * 100) / 1000) / 100

// « 0,452 kg à 24,90 €/kg »
export function weightLabel(weightKg: number, pricePerKg?: number): string {
  const w = `${weightKg.toFixed(3).replace('.', ',')} kg`
  return pricePerKg === undefined ? w : `${w} à ${pricePerKg.toFixed(2).replace('.', ',')} €/kg`
}
