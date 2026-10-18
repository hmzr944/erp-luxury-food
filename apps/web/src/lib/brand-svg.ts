import { BRAND_COLORS, MARK_LEFT, MARK_RIGHT, NAME_BAR, NAME_BAR_WIDTH, NAME_PATH, NAME_VIEWBOX } from '@erp/utils'

// Le logo en SVG autonome, pour ce qui sort de React : carte de badge
// imprimée, icônes. Mêmes tracés que components/brand/FlowLogo.tsx.

export function markSvg(ink: string = BRAND_COLORS.ink, accent: string = BRAND_COLORS.accent, size = '48') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}"><path d="${MARK_LEFT}" fill="${ink}"/><path d="${MARK_RIGHT}" fill="${accent}"/></svg>`
}

export function wordmarkSvg(ink: string = BRAND_COLORS.ink, accent: string = BRAND_COLORS.accent, height = '5mm') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${NAME_VIEWBOX}" style="height:${height};width:auto"><path d="${NAME_PATH}" fill="${ink}"/><path d="${NAME_BAR}" stroke="${accent}" stroke-width="${NAME_BAR_WIDTH}" stroke-linecap="round"/></svg>`
}
