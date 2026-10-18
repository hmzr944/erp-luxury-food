import { join } from 'path'
import { BRAND_COLORS } from '@erp/utils'
import PDFDocument from 'pdfkit'

const FONTS = join(__dirname, '..', '..', 'assets', 'fonts')

export interface InvoiceDoc {
  number: string
  date: Date
  timeZone: string
  seller: { name: string; lines: string[] }
  buyer: { name: string; lines: string[] }
  reference: string // « Ticket de caisse n° 482 du 14/10/2026, Boutique Gare »
  nature: string // « Livraison de biens »
  lines: Array<{ name: string; detail?: string; quantity: number; unitHt: number; rate: number; totalHt: number }>
  discountHt?: number
  taxes: Array<{ rate: number; ht: number; tax: number }>
  totalHt: number
  totalTax: number
  total: number
  paid: string[] // « Payée le 14/10/2026 par Carte : 18,30 € »
  legal: string[]
  software: string
}

const eur = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
const pct = (r: number) => `${String(r).replace('.', ',')} %`

// Facture A4, mise en page sobre : vendeur, client, lignes HT, TVA par taux
export function renderInvoicePdf(inv: InvoiceDoc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Facture ${inv.number}`, Author: inv.seller.name, Producer: inv.software, Creator: inv.software } })
    doc.registerFont('r', join(FONTS, 'HankenGrotesk-Regular.ttf'))
    doc.registerFont('m', join(FONTS, 'HankenGrotesk-Medium.ttf'))
    doc.registerFont('b', join(FONTS, 'HankenGrotesk-SemiBold.ttf'))
    doc.registerFont('d', join(FONTS, 'BricolageGrotesque-Bold.ttf'))
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const ink = BRAND_COLORS.ink
    const muted = '#5A5A66'
    const left = 48
    const right = doc.page.width - 48
    const width = right - left
    doc.fillColor(ink)

    // En-tête : vendeur à gauche, facture à droite
    doc.font('d').fontSize(16).text(inv.seller.name, left, 48, { width: width * 0.55 })
    doc.font('r').fontSize(9).fillColor(muted)
    inv.seller.lines.forEach((l) => doc.text(l, { width: width * 0.55 }))
    const sellerBottom = doc.y
    doc.fillColor(ink).font('d').fontSize(22).text('Facture', left + width * 0.6, 48, { width: width * 0.4, align: 'right' })
    doc.font('m').fontSize(10).text(`N° ${inv.number}`, { width: width * 0.4, align: 'right' })
    doc.font('r').fillColor(muted).text(`Date : ${inv.date.toLocaleDateString('fr-FR', { timeZone: inv.timeZone })}`, { width: width * 0.4, align: 'right' })

    // Client
    let y = Math.max(sellerBottom, doc.y) + 24
    const boxX = left + width * 0.5
    doc.fillColor(muted).font('m').fontSize(8).text('FACTURÉ À', boxX, y)
    doc.fillColor(ink).font('b').fontSize(11).text(inv.buyer.name, boxX, doc.y + 2, { width: width * 0.5 })
    doc.font('r').fontSize(9.5)
    inv.buyer.lines.forEach((l) => doc.text(l, { width: width * 0.5 }))
    y = doc.y + 20
    doc.fillColor(muted).fontSize(9).text(`${inv.nature}. ${inv.reference}`, left, y, { width })

    // Lignes
    y = doc.y + 14
    const cols = [
      { label: 'Désignation', x: left, w: width * 0.44, align: 'left' as const },
      { label: 'Qté', x: left + width * 0.44, w: width * 0.08, align: 'right' as const },
      { label: 'PU HT', x: left + width * 0.52, w: width * 0.16, align: 'right' as const },
      { label: 'TVA', x: left + width * 0.68, w: width * 0.12, align: 'right' as const },
      { label: 'Total HT', x: left + width * 0.8, w: width * 0.2, align: 'right' as const },
    ]
    doc.fillColor(muted).font('m').fontSize(8)
    cols.forEach((c) => doc.text(c.label.toUpperCase(), c.x, y, { width: c.w, align: c.align }))
    y += 14
    doc.moveTo(left, y).lineTo(right, y).lineWidth(0.6).strokeColor('#D9D7D0').stroke()
    y += 8
    doc.fillColor(ink).font('r').fontSize(9.5)
    for (const l of inv.lines) {
      if (y > doc.page.height - 200) {
        doc.addPage()
        y = 48
      }
      doc.font('r').fillColor(ink).text(l.name, cols[0].x, y, { width: cols[0].w })
      let rowBottom = doc.y
      if (l.detail) {
        doc.fillColor(muted).fontSize(8.5).text(l.detail, cols[0].x, rowBottom, { width: cols[0].w })
        rowBottom = doc.y
        doc.fontSize(9.5).fillColor(ink)
      }
      doc.text(String(l.quantity), cols[1].x, y, { width: cols[1].w, align: 'right' })
      doc.text(eur(l.unitHt), cols[2].x, y, { width: cols[2].w, align: 'right' })
      doc.text(pct(l.rate), cols[3].x, y, { width: cols[3].w, align: 'right' })
      doc.text(eur(l.totalHt), cols[4].x, y, { width: cols[4].w, align: 'right' })
      y = rowBottom + 6
    }
    doc.moveTo(left, y).lineTo(right, y).lineWidth(0.6).strokeColor('#D9D7D0').stroke()

    // Totaux
    y += 12
    const tx = left + width * 0.55
    const tw = width * 0.45
    const row = (label: string, value: string, bold = false) => {
      doc.font(bold ? 'b' : 'r').fontSize(bold ? 12 : 9.5).fillColor(ink)
      doc.text(label, tx, y, { width: tw * 0.6 })
      doc.text(value, tx + tw * 0.6, y, { width: tw * 0.4, align: 'right' })
      y = doc.y + (bold ? 6 : 4)
    }
    if (inv.discountHt) row('Remise HT', `-${eur(inv.discountHt)}`)
    row('Total HT', eur(inv.totalHt))
    inv.taxes.forEach((t) => row(`TVA ${pct(t.rate)} sur ${eur(t.ht)}`, eur(t.tax)))
    row('Total TTC', eur(inv.total), true)

    y += 8
    doc.font('m').fontSize(9.5).fillColor(ink)
    inv.paid.forEach((p) => {
      doc.text(p, tx, y, { width: tw, align: 'right' })
      y = doc.y + 2
    })

    // Mentions légales en pied
    doc.font('r').fontSize(7.5).fillColor(muted)
    const legal = [...inv.legal, `Document émis avec ${inv.software}`]
    const h = doc.heightOfString(legal.join('\n'), { width })
    doc.text(legal.join('\n'), left, doc.page.height - 48 - h, { width })
    doc.end()
  })
}
