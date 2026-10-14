import { BRAND } from '@/lib/brand'

// Le signe FLŌW : le Ō réduit à trois formes. Le trait du macron (Klein) et
// un disque fendu dont les deux moitiés sont décalées, comme deux flux qui se
// croisent : la boutique et son labo, la vente et le stock. Les décalages sont
// dans le tracé (pas en transform) pour que les animations CSS les gardent.
function MarkShapes({ ink, accent }: { ink: string; accent: string }) {
  return (
    <>
      <rect className="fm-bar" x="11" y="5" width="26" height="6" rx="3" fill={accent} />
      <path className="fm-l" d="M23 15.5 A13 13 0 0 0 23 41.5 Z" fill={ink} />
      <path className="fm-r" d="M25 18.5 A13 13 0 0 1 25 44.5 Z" fill={ink} />
    </>
  )
}

type Motion = 'form' | 'flux' | undefined
const motionClass = (m: Motion) => (m === 'form' ? 'flow-form ' : m === 'flux' ? 'flow-flux ' : '')

// tile : le signe sur un carré Klein (icône d'application, en-tête de caisse)
// inverse : le signe en papier, posé sur un aplat Klein
export function FlowMark({ size = 32, className = '', tile = false, inverse = false, motion }: { size?: number; className?: string; tile?: boolean; inverse?: boolean; motion?: Motion }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className={`${motionClass(motion)}shrink-0 ${className}`}>
      {tile ? (
        <>
          <rect width="48" height="48" rx="13" fill="var(--base-accent)" />
          <g transform="translate(4.8 3.2) scale(0.8)">
            <MarkShapes ink="var(--base-on-accent)" accent="var(--base-on-accent)" />
          </g>
        </>
      ) : inverse ? (
        <MarkShapes ink="var(--base-on-accent)" accent="var(--base-on-accent)" />
      ) : (
        <MarkShapes ink="currentColor" accent="var(--base-accent)" />
      )}
    </svg>
  )
}

// Le nom, dessiné et non tapé : F, L et W sont des traits de même épaisseur
// à bouts ronds, le Ō est le signe lui-même
export function FlowWordmark({ height = 22, className = '', motion }: { height?: number; className?: string; motion?: Motion }) {
  return (
    <svg
      height={height}
      width={(height * 138) / 42}
      viewBox="0 0 138 42"
      aria-hidden
      className={`${motionClass(motion)}shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 4.5 V37.5 M3.5 4.5 H22 M3.5 20.5 H17" />
      <path d="M32.5 4.5 V37.5 H50" />
      <rect className="fm-bar" x="62" y="0" width="28" height="6" rx="3" fill="var(--base-accent)" stroke="none" />
      <path className="fm-l" d="M74.8 10.3 A14.5 14.5 0 0 0 74.8 39.3 Z" fill="currentColor" stroke="none" />
      <path className="fm-r" d="M77.2 12.7 A14.5 14.5 0 0 1 77.2 41.7 Z" fill="currentColor" stroke="none" />
      <path d="M99.5 4.5 L106.5 37.5 L114.5 15 L122.5 37.5 L129.5 4.5" />
    </svg>
  )
}

// Logo complet : le nom dessiné (label) ou le signe seul sur son carré
export function FlowLogo({ size = 32, className = '', label = true, motion }: { size?: number; className?: string; label?: boolean; motion?: Motion }) {
  return (
    <span className={`inline-flex items-center text-[var(--color-text-primary)] ${className}`}>
      {label ? <FlowWordmark height={Math.round(size * 0.7)} motion={motion} /> : <FlowMark size={size} tile motion={motion} />}
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
