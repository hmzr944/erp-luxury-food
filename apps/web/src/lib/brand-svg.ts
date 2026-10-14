// Le logo en texte SVG autonome, pour ce qui sort de React : carte de badge
// imprimée, icônes. Mêmes tracés que components/brand/FlowLogo.tsx.
export function wordmarkSvg(ink = '#14141A', accent = '#1F3FFF', height = '5mm') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -10 147 53" style="height:${height};width:auto" fill="none" stroke="${ink}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 4.5 V37.5 M3.5 4.5 H22 M3.5 20.5 H17"/><path d="M35 4.5 V37.5 H52.5"/><path d="M73 -6 H93" stroke="${accent}"/><path d="M81.5 3 A16.5 16.5 0 0 0 81.5 36" stroke-linecap="butt"/><path d="M84.5 6 A16.5 16.5 0 0 1 84.5 39" stroke-linecap="butt"/><path d="M113 4.5 L120 37.5 L128 15 L136 37.5 L143 4.5"/></svg>`
}
