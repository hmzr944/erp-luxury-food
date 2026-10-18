import { BRAND } from '@/lib/brand'
import { MARK_LEFT, MARK_RIGHT, NAME_BAR, NAME_BAR_WIDTH, NAME_CAP, NAME_H, NAME_PATH, NAME_VIEWBOX, NAME_W } from '@erp/utils'

// Le signe FLŌW : deux demi-disques décalés, l'encre et le violet. L'argent
// qui entre et celui qui sort, la vente et le stock : un flux, pas une lettre.
// Grille de 48, décalage vertical de 4. Les décalages sont dans le tracé (pas
// en transform) pour que les animations CSS les gardent.
function MarkShapes({ left, right }: { left: string; right: string }) {
  return (
    <>
      <path className="fm-l" d={MARK_LEFT} fill={left} />
      <path className="fm-r" d={MARK_RIGHT} fill={right} />
    </>
  )
}

type Motion = 'form' | 'flux' | undefined
const motionClass = (m: Motion) => (m === 'form' ? 'flow-form ' : m === 'flux' ? 'flow-flux ' : '')

// tile : le signe sur un carré violet (icône d'application, en-tête de caisse),
// moitiés encre et papier, à 80 % pour rester lisible dès 30 px
// inverse : sur un aplat encre (moitié papier, moitié violet)
export function FlowMark({ size = 32, className = '', tile = false, inverse = false, motion }: { size?: number; className?: string; tile?: boolean; inverse?: boolean; motion?: Motion }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className={`${motionClass(motion)}shrink-0 ${className}`}>
      {tile ? (
        <>
          <rect width="48" height="48" rx="11" fill="var(--color-accent)" />
          <g transform="translate(4.8 4.8) scale(0.8)">
            <MarkShapes left="var(--color-bg-inverse)" right="var(--color-on-accent)" />
          </g>
        </>
      ) : inverse ? (
        <MarkShapes left="var(--color-text-inverse)" right="var(--color-accent)" />
      ) : (
        <MarkShapes left="currentColor" right="var(--color-accent)" />
      )}
    </svg>
  )
}

// Le nom en tracés vectoriels (Bricolage Grotesque ExtraBold), macron violet.
// cap : hauteur des capitales en px (18 en en-tête, 26 sur la connexion).
export function FlowWordmark({ cap = 18, className = '', motion }: { cap?: number; className?: string; motion?: Motion }) {
  const h = (cap * NAME_H) / NAME_CAP
  return (
    <svg height={h} width={(h * NAME_W) / NAME_H} viewBox={NAME_VIEWBOX} aria-hidden className={`${motionClass(motion)}shrink-0 ${className}`}>
      <path d={NAME_PATH} fill="currentColor" />
      <path className="fm-bar" d={NAME_BAR} stroke="var(--color-accent)" strokeWidth={NAME_BAR_WIDTH} strokeLinecap="round" />
    </svg>
  )
}

// Logo complet : le signe et le nom côte à côte (label), ou le signe seul sur
// son carré. Deux tailles seulement : 18 px (en-têtes) et 26 px (connexion, site).
export function FlowLogo({ size = 18, className = '', label = true, motion }: { size?: number; className?: string; label?: boolean; motion?: Motion }) {
  return (
    <span className={`inline-flex items-center gap-[0.45em] text-[var(--color-text-primary)] ${className}`} style={{ fontSize: size }}>
      {label ? (
        <>
          <FlowMark size={Math.round(size * 1.55)} motion={motion} />
          <FlowWordmark cap={size} motion={motion} />
        </>
      ) : (
        <FlowMark size={size} tile motion={motion} />
      )}
      <span className="sr-only">{BRAND}</span>
    </span>
  )
}

// Attente : les deux moitiés glissent en sens contraire tant qu'on attend.
// Remplace les roues de chargement ; l'état est dit en texte à côté.
export function FlowPulse({ size = 28, className = '' }: { size?: number; className?: string }) {
  return <FlowMark size={size} motion="flux" className={`text-[var(--color-text-primary)] ${className}`} />
}

// Le signe se forme une fois : la vente est enregistrée
export function FlowBeat({ size = 28, className = '' }: { size?: number; className?: string }) {
  return <FlowMark size={size} motion="form" className={`text-[var(--color-text-primary)] ${className}`} />
}

// Chargement : le flux et une phrase, qui n'apparaissent qu'après 200 ms
// pour ne pas clignoter quand la réponse est immédiate
export function Loading({ label = 'Chargement', className = '' }: { label?: string; className?: string }) {
  return (
    <p role="status" className={`loading-in flex items-center gap-3 text-sm text-[var(--color-text-secondary)] ${className}`}>
      <FlowPulse size={20} />
      {label}
    </p>
  )
}
