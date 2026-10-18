import { BRAND_COLORS, MARK_LEFT, MARK_RIGHT, NAME_BAR, NAME_BAR_WIDTH, NAME_CAP, NAME_PATH } from '@erp/utils'

// Logo FLŌW dans un PDF : le signe (deux demi-disques) puis le nom en tracés,
// mêmes formes que dans l'application. cap : hauteur des capitales en points.
export function drawBrandLogo(doc: PDFKit.PDFDocument, x: number, y: number, cap: number) {
  const mark = cap * 1.55
  const m = mark / 48
  doc.save()
  doc.translate(x, y).scale(m)
  doc.path(MARK_LEFT).fill(BRAND_COLORS.ink)
  doc.path(MARK_RIGHT).fill(BRAND_COLORS.accent)
  doc.restore()

  const k = cap / NAME_CAP
  doc.save()
  // Capitales centrées sur le signe, ligne de base en bas des capitales
  doc.translate(x + mark + cap * 0.45 - 40 * k, y + (mark + cap) / 2).scale(k)
  doc.path(NAME_PATH).fill(BRAND_COLORS.ink)
  doc.lineWidth(NAME_BAR_WIDTH).lineCap('round').path(NAME_BAR).stroke(BRAND_COLORS.accent)
  doc.restore()
}
