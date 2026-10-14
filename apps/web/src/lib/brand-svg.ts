// Le logo en texte SVG autonome, pour ce qui sort de React : carte de badge
// imprimée, icônes. Mêmes tracés que components/brand/FlowLogo.tsx.
export function wordmarkSvg(ink = '#14141A', accent = '#1F3FFF', height = '5mm') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 138 42" style="height:${height};width:auto" fill="none" stroke="${ink}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 4.5 V37.5 M3.5 4.5 H22 M3.5 20.5 H17"/><path d="M32.5 4.5 V37.5 H50"/><rect x="62" y="0" width="28" height="6" rx="3" fill="${accent}" stroke="none"/><path d="M74.8 10.3 A14.5 14.5 0 0 0 74.8 39.3 Z" fill="${ink}" stroke="none"/><path d="M77.2 12.7 A14.5 14.5 0 0 1 77.2 41.7 Z" fill="${ink}" stroke="none"/><path d="M99.5 4.5 L106.5 37.5 L114.5 15 L122.5 37.5 L129.5 4.5"/></svg>`
}
