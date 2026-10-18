import { BRAND } from '@/lib/brand'
import { MARK_LEFT, MARK_RIGHT } from '@erp/utils'

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

// Le logo : la forme abstraite seule, sans le nom en lettres. Le nom n'est
// dit qu'aux lecteurs d'écran. size : hauteur de référence (18 en en-tête,
// 26 sur la connexion), le signe en fait 1,55 fois.
export function FlowLogo({ size = 18, className = '', motion }: { size?: number; className?: string; motion?: Motion }) {
  return (
    <span className={`inline-flex items-center text-[var(--color-text-primary)] ${className}`}>
      <FlowMark size={Math.round(size * 1.55)} motion={motion} />
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
