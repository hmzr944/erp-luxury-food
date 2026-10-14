import { FISCAL_SOFTWARE } from '@erp/types'
import type { ReceiptSettings } from '@/lib/api/platform'

// Ticket de caisse imprimable : un seul modèle, trois rendus (ESC/POS brut,
// Epson ePOS, impression du système). Mentions : commerçant et SIRET, date,
// numéro, lignes avec taux de TVA, total TTC, TVA par taux, paiements,
// extrait de la signature, logiciel et version.

export interface TicketLine {
  quantity: number
  name: string
  detail?: string // variante, n° de série
  unit: number
  total: number
  taxRate: number
}

export interface TicketModel {
  title: 'TICKET' | 'NOTE' | 'REMBOURSEMENT' | 'CLÔTURE'
  // Mentions encadrées en tête : DUPLICATA, MODE FORMATION, DOUBLE...
  marks: string[]
  shop: { name: string; address?: string | null; legal: string[] }
  meta: Array<[string, string]>
  lines: TicketLine[]
  discount?: number
  total: number
  taxes: Array<{ code: string; rate: number; ht: number; tax: number; ttc: number }>
  payments: Array<{ label: string; amount: number }>
  change?: number
  footer: string[]
  signature?: string
  software: string
}

export interface SaleTicketInput {
  receipt?: ReceiptSettings
  siteName: string
  siteAddress?: string | null
  terminalName: string
  sellerName?: string | null
  number: string // « 128 » ou « F-12 » en formation
  signedAt: Date
  lines: TicketLine[]
  discount?: number
  total: number
  taxBreakdown: Array<{ rate: number; ht: number; tax: number }>
  payments: Array<{ label: string; amount: number }>
  change?: number
  signature?: string
  refund?: boolean
  duplicate?: number
  training?: { operator: string }
  // Note de service : imprimée en deux exemplaires, le second conservé
  copy?: 'CLIENT' | 'DOUBLE'
}

export const SERVICE_NOTE_THRESHOLD = 25

// Lettres de taux : A pour le plus bas, puis B, C...
export function taxCodes(rates: number[]): Map<number, string> {
  const sorted = [...new Set(rates)].sort((a, b) => a - b)
  return new Map(sorted.map((r, i) => [r, String.fromCharCode(65 + i)]))
}

export function legalLines(r?: ReceiptSettings): string[] {
  if (!r) return []
  const out: string[] = []
  const company = [r.legalName, r.legalForm].filter(Boolean).join(' ')
  if (company) out.push(company)
  if (r.address) out.push(r.address)
  if (r.siret) out.push(`SIRET ${r.siret}`)
  if (r.vatNumber) out.push(`TVA ${r.vatNumber}`)
  if (r.rcs) out.push(r.rcs)
  return out
}

export function buildSaleTicket(i: SaleTicketInput): TicketModel {
  const codes = taxCodes(i.taxBreakdown.map((t) => t.rate))
  const serviceNote = !!i.receipt?.serviceNote && i.total >= SERVICE_NOTE_THRESHOLD && !i.refund
  const marks: string[] = []
  if (i.training) marks.push('MODE FORMATION', 'TICKET FICTIF SANS VALEUR')
  if (i.duplicate) marks.push(`DUPLICATA N° ${i.duplicate}`)
  if (serviceNote && i.copy === 'DOUBLE') marks.push('DOUBLE CONSERVÉ PAR LE COMMERÇANT')

  const date = i.signedAt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = i.signedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const meta: Array<[string, string]> = [
    ['Date', `${date} ${time}`],
    [i.training ? 'Ticket fictif' : i.refund ? 'Remboursement' : serviceNote ? 'Note' : 'Ticket', `n° ${i.number}`],
    ['Caisse', i.terminalName],
  ]
  if (i.training) meta.push(['Opérateur', i.training.operator])
  else if (i.sellerName) meta.push(['Vendeur', i.sellerName])

  return {
    title: i.refund ? 'REMBOURSEMENT' : serviceNote ? 'NOTE' : 'TICKET',
    marks,
    shop: { name: i.siteName, address: i.siteAddress, legal: legalLines(i.receipt) },
    meta,
    lines: i.lines,
    discount: i.discount,
    total: i.total,
    taxes: i.taxBreakdown.map((t) => ({ code: codes.get(t.rate) ?? '?', rate: t.rate, ht: t.ht, tax: t.tax, ttc: Math.round((t.ht + t.tax) * 100) / 100 })),
    payments: i.payments,
    change: i.change,
    footer: [i.receipt?.footer, i.refund ? null : 'Merci de votre visite'].filter((x): x is string => !!x),
    signature: i.training ? undefined : i.signature,
    software: `${FISCAL_SOFTWARE.name} ${FISCAL_SOFTWARE.version}`,
  }
}

// Prix au format du ticket : « 12,50 »
export const money = (n: number) => n.toFixed(2).replace('.', ',')
export const rateLabel = (r: number) => `${String(r).replace('.', ',')} %`

// Mise en colonnes pour une imprimante de `width` caractères (48 en 80 mm,
// 32 en 58 mm). Renvoie des lignes de texte prêtes à imprimer.
export function layoutTicket(t: TicketModel, width: number): Array<{ text: string; align?: 'center' | 'left'; bold?: boolean; big?: boolean }> {
  const out: Array<{ text: string; align?: 'center' | 'left'; bold?: boolean; big?: boolean }> = []
  const rule = '-'.repeat(width)
  const pair = (left: string, right: string) => {
    const space = width - right.length - 1
    const l = left.length > space ? left.slice(0, space) : left
    return l + ' '.repeat(Math.max(1, width - l.length - right.length)) + right
  }
  const wrap = (text: string, w = width) => {
    const words = text.split(' ')
    const lines: string[] = []
    let cur = ''
    for (const word of words) {
      if ((cur + ' ' + word).trim().length > w) {
        if (cur) lines.push(cur)
        cur = word.slice(0, w)
      } else cur = (cur + ' ' + word).trim()
    }
    if (cur) lines.push(cur)
    return lines
  }
  const codes = new Map(t.taxes.map((x) => [x.rate, x.code]))

  for (const m of t.marks) out.push({ text: `*** ${m} ***`, align: 'center', bold: true })
  out.push({ text: t.shop.name, align: 'center', bold: true, big: true })
  if (t.shop.address) wrap(t.shop.address).forEach((l) => out.push({ text: l, align: 'center' }))
  t.shop.legal.forEach((l) => wrap(l).forEach((x) => out.push({ text: x, align: 'center' })))
  out.push({ text: rule })
  out.push({ text: t.title, align: 'center', bold: true })
  t.meta.forEach(([k, v]) => out.push({ text: pair(k, v) }))
  out.push({ text: rule })
  for (const l of t.lines) {
    const name = `${l.quantity} x ${l.name}`
    out.push({ text: pair(name, `${money(l.total)} ${codes.get(l.taxRate) ?? ''}`.trim()) })
    if (l.quantity !== 1) out.push({ text: `   ${money(l.unit)} l'unité` })
    if (l.detail) wrap(l.detail, width - 3).forEach((d) => out.push({ text: `   ${d}` }))
  }
  if (t.discount) out.push({ text: pair('Remise', `-${money(t.discount)}`) })
  out.push({ text: rule })
  out.push({ text: pair('TOTAL TTC', `${money(t.total)} EUR`), bold: true, big: width >= 40 })
  out.push({ text: rule })
  out.push({ text: pair('TVA', 'HT      TVA      TTC') })
  for (const x of t.taxes) {
    const cols = [money(x.ht).padStart(8), money(x.tax).padStart(8), money(x.ttc).padStart(8)].join(' ')
    out.push({ text: pair(`${x.code} ${rateLabel(x.rate)}`, cols) })
  }
  out.push({ text: rule })
  t.payments.forEach((p) => out.push({ text: pair(p.label, money(p.amount)) }))
  if (t.change) out.push({ text: pair('Rendu', money(t.change)) })
  out.push({ text: '' })
  t.footer.forEach((f) => wrap(f).forEach((l) => out.push({ text: l, align: 'center' })))
  if (t.signature) out.push({ text: `Signature ${t.signature}`, align: 'center' })
  out.push({ text: t.software, align: 'center' })
  for (const m of t.marks) out.push({ text: `*** ${m} ***`, align: 'center', bold: true })
  return out
}
