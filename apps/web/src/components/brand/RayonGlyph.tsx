import type { RayonShape } from '@/lib/brand'

// Formes des rayons, sur une grille de 16 : la famille du signe FLŌW (cercle
// et pilule) déclinée en dix formes. Toujours en encre, 16 px minimum : le
// Klein reste réservé à l'action, le trait seul reste au logo.
const SHAPES: Record<RayonShape, React.ReactNode> = {
  disque: <circle cx="8" cy="8" r="6" />,
  moitie: <path d="M8 2 A6 6 0 0 0 8 14 Z" />,
  dome: <path d="M2 11 A6 6 0 0 1 14 11 Z" />,
  bol: <path d="M2 5 A6 6 0 0 0 14 5 Z" />,
  fendu: (
    <>
      <path d="M7.2 1.5 A6 6 0 0 0 7.2 13.5 Z" />
      <path d="M8.8 2.5 A6 6 0 0 1 8.8 14.5 Z" />
    </>
  ),
  anneau: <path fillRule="evenodd" d="M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2Zm0 3.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2Z" />,
  paire: (
    <>
      <circle cx="4.5" cy="8" r="3.3" />
      <circle cx="11.5" cy="8" r="3.3" />
    </>
  ),
  pilule: <rect x="5.25" y="1.5" width="5.5" height="13" rx="2.75" />,
  arc: <path fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" d="M3 12 A5 5 0 0 1 13 12" />,
  colonnes: (
    <>
      <rect x="2.5" y="2" width="4.5" height="12" rx="2.25" />
      <rect x="9" y="5" width="4.5" height="9" rx="2.25" />
    </>
  ),
}

export function RayonGlyph({ shape, size = 16, className = '' }: { shape: RayonShape; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden fill="currentColor" className={`shrink-0 ${className}`}>
      {SHAPES[shape]}
    </svg>
  )
}
