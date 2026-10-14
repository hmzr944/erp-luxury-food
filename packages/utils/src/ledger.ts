// Grand livre fiscal v2 : empreintes des tickets et des clôtures, partagées
// entre le serveur (qui scelle) et tout outil de vérification. Ne jamais
// modifier un format publié ; en créer un nouveau (v3) si besoin.

export const LEDGER_FORMAT = 'v2'

const money = (n: number | string) => Number(n).toFixed(2)

export interface LedgerEntryFields {
  previousHash: string
  counter: number
  signedAt: string // ISO 8601
  siteId: string
  terminalId?: string | null
  kind: 'SALE' | 'REFUND'
  total: number | string // TTC, négatif pour un remboursement
  perpetualTotal: number | string
  perpetualAbsTotal: number | string
  contentDigest: string // empreinte du contenu (lignes, paiements)
  terminalSignature?: string | null
}

// Chaîne signée d'un ticket : empreinte précédente + horodatage + caisse +
// montant + totaux perpétuels + contenu + signature de la caisse
export function ledgerEntryInput(e: LedgerEntryFields): string {
  return [
    LEDGER_FORMAT,
    e.previousHash,
    e.counter,
    e.signedAt,
    e.siteId,
    e.terminalId ?? '-',
    e.kind,
    money(e.total),
    money(e.perpetualTotal),
    money(e.perpetualAbsTotal),
    e.contentDigest,
    e.terminalSignature ?? '-',
  ].join('|')
}

// Ancien format (v1) des maillons du site, gardé pour vérifier l'historique
export function ledgerEntryInputV1(e: { previousHash: string; total: number | string; signedAt: string; counter: number }): string {
  return [e.previousHash, String(e.total), e.signedAt, String(e.counter)].join('|')
}

export interface ClosureFields {
  siteId: string
  period: 'DAY' | 'MONTH' | 'YEAR'
  label: string
  seq: number
  firstCounter: number | null
  lastCounter: number | null
  ticketCount: number
  salesTotal: number | string
  refundsTotal: number | string
  periodTotal: number | string
  totalHT: number | string
  totalTax: number | string
  taxBreakdown: Array<{ rate: number; ht: number; tax: number; ttc: number }>
  paymentBreakdown: Array<{ code: string; amount: number }>
  perpetualTotal: number | string
  perpetualAbsTotal: number | string
  previousHash: string
  closedAt: string
}

export function closureInput(c: ClosureFields): string {
  const taxes = c.taxBreakdown.map((t) => `${money(t.rate)}:${money(t.ht)}:${money(t.tax)}:${money(t.ttc)}`).join(';')
  const pays = c.paymentBreakdown.map((p) => `${p.code}:${money(p.amount)}`).join(';')
  return [
    LEDGER_FORMAT,
    c.previousHash,
    c.siteId,
    c.period,
    c.label,
    c.seq,
    c.firstCounter ?? '-',
    c.lastCounter ?? '-',
    c.ticketCount,
    money(c.salesTotal),
    money(c.refundsTotal),
    money(c.periodTotal),
    money(c.totalHT),
    money(c.totalTax),
    taxes,
    pays,
    money(c.perpetualTotal),
    money(c.perpetualAbsTotal),
    c.closedAt,
  ].join('|')
}

export function eventInput(e: { previousHash: string; seq: number; code: string; siteId?: string | null; userId?: string | null; terminalId?: string | null; detail?: string; createdAt: string }): string {
  return [LEDGER_FORMAT, e.previousHash, e.seq, e.code, e.siteId ?? '-', e.userId ?? '-', e.terminalId ?? '-', e.detail ?? '', e.createdAt].join('|')
}

// Somme exacte en centimes (évite les dérives de flottants sur les cumuls)
export const addMoney = (...values: Array<number | string>) => Math.round(values.reduce<number>((a, v) => a + Math.round(Number(v) * 100), 0)) / 100

// Jour d'activité d'un instant dans un fuseau : la journée commence à
// `startHour` heures locales (les ventes de 1 h du matin comptent la veille
// pour un bar ouvert tard si startHour = 5)
export function businessDate(at: Date, timeZone: string, startHour = 5): string {
  const shifted = new Date(at.getTime() - startHour * 3600_000)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(shifted)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

// Instant UTC où commence le jour d'activité `date` (AAAA-MM-JJ) dans le fuseau
export function businessDayStart(date: string, timeZone: string, startHour = 5): Date {
  const [y, m, d] = date.split('-').map(Number)
  // Point de départ : l'heure voulue en UTC, puis correction du décalage du fuseau
  const guess = Date.UTC(y, m - 1, d, startHour, 0, 0)
  const offset = (t: number) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(t))
    const g = (k: string) => Number(parts.find((p) => p.type === k)?.value)
    const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second'))
    return asUtc - t
  }
  const first = guess - offset(guess)
  return new Date(guess - offset(first))
}

// JSON canonique (clés triées, récursif) : la base réordonne les clés des
// colonnes JSON, l'empreinte doit pourtant rester identique à la relecture
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
}
