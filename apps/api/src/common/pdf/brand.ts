import { BRAND_COLORS, MARK_LEFT, MARK_RIGHT } from '@erp/utils'

// Logo FLŌW dans un PDF : la forme abstraite seule (deux demi-disques), mêmes
// tracés que dans l'application. size : côté du carré de 48 en points.
export function drawBrandLogo(doc: PDFKit.PDFDocument, x: number, y: number, size: number) {
  doc.save()
  doc.translate(x, y).scale(size / 48)
  doc.path(MARK_LEFT).fill(BRAND_COLORS.ink)
  doc.path(MARK_RIGHT).fill(BRAND_COLORS.accent)
  doc.restore()
}
