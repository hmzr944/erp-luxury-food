import { modifiersLabel } from './composition'
import { weightLabel } from './scale-barcode'

// Ticket de caisse : modèle commun à la caisse (impression) et au serveur
// (reçu en ligne, PDF). Aucune dépendance au navigateur.
// Mentions légales du commerçant reprises sur le ticket
export interface ReceiptSettings {
  legalName: string
  siret: string | null
  vatNumber: string | null
  legalForm: string | null
  rcs: string | null
  address: string | null
  policy: 'ASK' | 'ALWAYS' | 'NEVER'
  serviceNote: boolean
  footer: string | null
}

// Ticket de caisse imprimable : un seul modèle, trois rendus (ESC/POS brut,
// Epson ePOS, impression du système). Mentions : commerçant et SIRET, date,
// numéro, lignes avec taux de TVA, total TTC, TVA par taux, paiements,
// extrait de la signature, logiciel et version.

export interface TicketLine {
  quantity: number
  name: string
  detail?: string // variante, n° de série, options, poids
  unit: number
  total: number
  taxRate: number
  // Formule : composants avec leur part du prix et leur taux de TVA
  parts?: Array<{ name: string; total: number; taxRate: number }>
}

// Ligne vendue telle qu'enregistrée (OrderItem, ou ligne signée en caisse)
export interface SoldItemView {
  name: string
  variantName?: string | null
  serialNumber?: string | null
  quantity: number
  taxRate: number
  modifiers?: Array<{ name: string; price: number }> | null
  menuGroup?: number | null
  menuName?: string | null
  weight?: number | null
  pricePerKg?: number | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

// Ligne vendue lue en base (Decimal, Json) ramenée à une SoldItemView
export function soldItemView(i: {
  name: string
  variantName?: string | null
  serialNumber?: string | null
  quantity: number
  taxRate: unknown
  modifiers?: unknown
  menuGroup?: number | null
  menuName?: string | null
  weight?: unknown
  pricePerKg?: unknown
}): SoldItemView {
  const mods = Array.isArray(i.modifiers) ? (i.modifiers as Array<{ name: string; price: unknown }>).map((m) => ({ name: String(m.name), price: Number(m.price) })) : null
  return {
    name: i.name,
    variantName: i.variantName ?? null,
    serialNumber: i.serialNumber ?? null,
    quantity: i.quantity,
    taxRate: Number(i.taxRate),
    modifiers: mods,
    menuGroup: i.menuGroup ?? null,
    menuName: i.menuName ?? null,
    weight: i.weight != null ? Number(i.weight) : null,
    pricePerKg: i.pricePerKg != null ? Number(i.pricePerKg) : null,
  }
}

export function soldItemDetail(i: SoldItemView): string | undefined {
  const parts = [
    i.variantName,
    i.modifiers?.length ? modifiersLabel(i.modifiers) : null,
    i.weight ? weightLabel(i.weight, i.pricePerKg ?? undefined) : null,
    i.serialNumber ? `N° de série ${i.serialNumber}` : null,
  ]
  return parts.filter(Boolean).join(', ') || undefined
}

// Lignes du ticket à partir des lignes vendues et de leur montant TTC payé.
// Les composants d'une formule sont regroupés sous le nom de la formule.
export function ticketLinesFromItems(items: SoldItemView[], ttc: number[], sign = 1): TicketLine[] {
  const out: TicketLine[] = []
  const menus = new Map<number, TicketLine>()
  items.forEach((i, k) => {
    const total = sign * (ttc[k] ?? 0)
    if (i.menuGroup != null) {
      const detail = soldItemDetail(i)
      const part = { name: detail ? `${i.name} (${detail})` : i.name, total, taxRate: i.taxRate }
      const line = menus.get(i.menuGroup)
      if (line) {
        line.parts!.push(part)
        line.total = round2(line.total + total)
        line.unit = round2(line.total / line.quantity)
        return
      }
      const created: TicketLine = { quantity: i.quantity, name: i.menuName ?? 'Formule', unit: round2(total / i.quantity), total, taxRate: i.taxRate, parts: [part] }
      menus.set(i.menuGroup, created)
      out.push(created)
      return
    }
    out.push({ quantity: i.quantity, name: i.name, detail: soldItemDetail(i), unit: round2(total / i.quantity), total, taxRate: i.taxRate })
  })
  return out
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
  payments: Array<{ label: string; amount: number; reference?: string }>
  change?: number
  footer: string[]
  signature?: string
  software: string
  // Ticket dématérialisé : lien vers le reçu en ligne (PDF, facture)
  qr?: { url: string; caption: string }
}

export interface SaleTicketInput {
  receipt?: ReceiptSettings
  siteName: string
  siteAddress?: string | null
  terminalName: string
  sellerName?: string | null
  number: string // « 128 » ou « F-12 » en formation
  // Fuseau du magasin (le serveur n'est pas à l'heure de la boutique)
  timeZone?: string
  signedAt: Date
  lines: TicketLine[]
  discount?: number
  total: number
  taxBreakdown: Array<{ rate: number; ht: number; tax: number }>
  payments: Array<{ label: string; amount: number; reference?: string }>
  change?: number
  signature?: string
  // « FLŌW 1.0.0 »
  software: string
  // Lien du reçu en ligne, imprimé en QR code
  receiptUrl?: string
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

  const date = i.signedAt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: i.timeZone })
  const time = i.signedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: i.timeZone })
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
    // L'adresse légale n'est répétée que si elle diffère de celle de la boutique
    shop: { name: i.siteName, address: i.siteAddress, legal: legalLines(i.receipt).filter((l) => !i.siteAddress || l.trim().toLowerCase() !== i.siteAddress.trim().toLowerCase()) },
    meta,
    lines: i.lines,
    discount: i.discount,
    total: i.total,
    taxes: i.taxBreakdown.map((t) => ({ code: codes.get(t.rate) ?? '?', rate: t.rate, ht: t.ht, tax: t.tax, ttc: Math.round((t.ht + t.tax) * 100) / 100 })),
    payments: i.payments,
    change: i.change,
    footer: [i.receipt?.footer, i.refund ? null : 'Merci de votre visite'].filter((x): x is string => !!x),
    signature: i.training ? undefined : i.signature,
    software: i.software,
    ...(i.receiptUrl && !i.training ? { qr: { url: i.receiptUrl, caption: 'Votre ticket et votre facture en ligne' } } : {}),
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
    // Formule : le taux de TVA est porté par chaque composant
    out.push({ text: pair(name, l.parts ? money(l.total) : `${money(l.total)} ${codes.get(l.taxRate) ?? ''}`.trim()) })
    if (l.quantity !== 1) out.push({ text: `   ${money(l.unit)} l'unité` })
    if (l.detail) wrap(l.detail, width - 3).forEach((d) => out.push({ text: `   ${d}` }))
    for (const p of l.parts ?? []) out.push({ text: pair(`   ${p.name}`, `${money(p.total)} ${codes.get(p.taxRate) ?? ''}`.trim()) })
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
  t.payments.forEach((p) => {
    out.push({ text: pair(p.label, money(p.amount)) })
    if (p.reference) out.push({ text: `   Réf. ${p.reference}` })
  })
  if (t.change) out.push({ text: pair('Rendu', money(t.change)) })
  out.push({ text: '' })
  t.footer.forEach((f) => wrap(f).forEach((l) => out.push({ text: l, align: 'center' })))
  if (t.signature) out.push({ text: `Signature ${t.signature}`, align: 'center' })
  out.push({ text: t.software, align: 'center' })
  for (const m of t.marks) out.push({ text: `*** ${m} ***`, align: 'center', bold: true })
  return out
}
