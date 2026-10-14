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

// tile : le signe sur un carré Klein (icône d'application, en-tête de caisse),
// à 92 % pour rester lisible dès 30 px
// inverse : le signe sur un aplat encre (moitiés papier, trait Klein)
export function FlowMark({ size = 32, className = '', tile = false, inverse = false, motion }: { size?: number; className?: string; tile?: boolean; inverse?: boolean; motion?: Motion }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className={`${motionClass(motion)}shrink-0 ${className}`}>
      {tile ? (
        <>
          <rect width="48" height="48" rx="13" fill="var(--color-accent)" />
          <g transform="translate(1.92 1.23) scale(0.92)">
            <MarkShapes ink="var(--color-on-accent)" accent="var(--color-on-accent)" />
          </g>
        </>
      ) : inverse ? (
        <MarkShapes ink="var(--color-text-inverse)" accent="var(--color-accent)" />
      ) : (
        <MarkShapes ink="currentColor" accent="var(--color-accent)" />
      )}
    </svg>
  )
}

// Le nom, dessiné et non tapé. F, L, W et le Ō partagent le même trait de 7
// à bouts ronds ; le Ō est un anneau fendu à pleine hauteur (il se lit comme
// une lettre, même petit), son macron Klein a la même épaisseur.
// cap : hauteur des lettres en px (18 en en-tête, 26 sur la connexion).
const WM_W = 147
const WM_H = 53
const WM_CAP = 41
export function FlowWordmark({ cap = 18, className = '', motion }: { cap?: number; className?: string; motion?: Motion }) {
  const h = (cap * WM_H) / WM_CAP
  return (
    <svg
      height={h}
      width={(h * WM_W) / WM_H}
      viewBox={`0 -10 ${WM_W} ${WM_H}`}
      aria-hidden
      className={`${motionClass(motion)}shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 4.5 V37.5 M3.5 4.5 H22 M3.5 20.5 H17" />
      <path d="M35 4.5 V37.5 H52.5" />
      <path className="fm-bar" d="M73 -6 H93" stroke="var(--color-accent)" />
      <path className="fm-l" d="M81.5 3 A16.5 16.5 0 0 0 81.5 36" strokeLinecap="butt" />
      <path className="fm-r" d="M84.5 6 A16.5 16.5 0 0 1 84.5 39" strokeLinecap="butt" />
      <path d="M113 4.5 L120 37.5 L128 15 L136 37.5 L143 4.5" />
    </svg>
  )
}

// Logo complet : le nom dessiné (label) ou le signe seul sur son carré.
// Deux tailles seulement : 18 px (en-têtes) et 26 px (connexion, site).
export function FlowLogo({ size = 18, className = '', label = true, motion }: { size?: number; className?: string; label?: boolean; motion?: Motion }) {
  return (
    <span className={`inline-flex items-center text-[var(--color-text-primary)] ${className}`}>
      {label ? <FlowWordmark cap={size} motion={motion} /> : <FlowMark size={size} tile motion={motion} />}
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
