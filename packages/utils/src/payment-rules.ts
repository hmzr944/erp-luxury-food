// Règles françaises d'encaissement, appliquées à l'identique par la caisse
// (avant de valider) et par le serveur (contrôle des ventes reçues) :
// - titre-restaurant : seulement les articles éligibles, plafond par
//   transaction (25 € en 2026), jamais de rendu de monnaie
// - chèque : numéro du chèque noté
// - espèces : 1 000 € au plus pour un particulier résidant en France,
//   15 000 € pour un non-résident (art. L112-6 et D112-3 code monétaire et financier)

export const CASH_LIMIT_RESIDENT = 1000
export const CASH_LIMIT_NON_RESIDENT = 15000

export interface RuleMethod {
  code: string
  label: string
  kind: string
  mealVoucher?: boolean
  maxAmount?: number | string | null
  requiresReference?: boolean
}

export interface RuleLine {
  total: number // TTC de la ligne, remises comprises
  mealVoucherEligible: boolean
}

export interface RulePayment {
  code: string
  amount: number
  reference?: string | null
}

const cents = (n: number | string) => Math.round(Number(n) * 100)

// Montant payable en titre-restaurant pour cette vente
export function mealVoucherAllowance(lines: RuleLine[], method: RuleMethod): number {
  const eligible = lines.filter((l) => l.mealVoucherEligible).reduce((a, l) => a + cents(l.total), 0)
  const cap = method.maxAmount != null && method.maxAmount !== '' ? cents(method.maxAmount) : Infinity
  return Math.min(eligible, cap) / 100
}

export function checkPayments(input: {
  lines: RuleLine[]
  payments: RulePayment[]
  methods: RuleMethod[]
  nonResident?: boolean
}): string[] {
  const errors: string[] = []
  const byCode = new Map(input.methods.map((m) => [m.code, m]))

  // Tous les titres-restaurant ensemble ne dépassent ni l'éligible ni le plafond
  const voucherMethods = input.methods.filter((m) => m.mealVoucher)
  if (voucherMethods.length) {
    const paidVoucher = input.payments.filter((p) => byCode.get(p.code)?.mealVoucher).reduce((a, p) => a + cents(p.amount), 0)
    const eligible = input.lines.filter((l) => l.mealVoucherEligible).reduce((a, l) => a + cents(l.total), 0)
    const caps = voucherMethods.map((m) => (m.maxAmount != null && m.maxAmount !== '' ? cents(m.maxAmount) : Infinity))
    const cap = Math.max(...caps)
    if (paidVoucher > eligible) {
      errors.push(eligible === 0 ? 'Aucun article de cette vente n’est payable en titre-restaurant' : `Titre-restaurant limité aux articles éligibles : ${(eligible / 100).toFixed(2).replace('.', ',')} €`)
    } else if (paidVoucher > cap) {
      errors.push(`Titre-restaurant plafonné à ${(cap / 100).toFixed(2).replace('.', ',')} € par ticket`)
    }
  }

  for (const p of input.payments) {
    const m = byCode.get(p.code)
    if (m?.requiresReference && cents(p.amount) > 0 && !p.reference?.trim()) errors.push(`${m.label} : numéro à saisir`)
  }

  const cash = input.payments.filter((p) => byCode.get(p.code)?.kind === 'CASH').reduce((a, p) => a + cents(p.amount), 0)
  const limit = input.nonResident ? CASH_LIMIT_NON_RESIDENT : CASH_LIMIT_RESIDENT
  if (cash > limit * 100) {
    errors.push(
      input.nonResident
        ? `Espèces limitées à ${CASH_LIMIT_NON_RESIDENT.toLocaleString('fr-FR')} € pour un client non résident`
        : `Espèces limitées à ${CASH_LIMIT_RESIDENT.toLocaleString('fr-FR')} € pour un client résidant en France`,
    )
  }
  return errors
}
