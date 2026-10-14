import type { RayonShape } from '@/lib/brand'

// Formes des rayons, sur une grille de 16 : le vocabulaire du signe FLŌW
// (disque, moitiés, trait) décliné en dix formes reconnaissables de loin
const SHAPES: Record<RayonShape, React.ReactNode> = {
  disque: <circle cx="8" cy="8" r="6" />,
  moitie: <path d="M8 2 A6 6 0 0 0 8 14 Z" />,
  trait: <rect x="1.5" y="5.5" width="13" height="5" rx="2.5" />,
  fendu: (
    <>
      <path d="M7.3 1.5 A6 6 0 0 0 7.3 13.5 Z" />
      <path d="M8.7 2.5 A6 6 0 0 1 8.7 14.5 Z" />
    </>
  ),
  anneau: <path fillRule="evenodd" d="M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2Zm0 3.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z" />,
  dome: <path d="M2 11 A6 6 0 0 1 14 11 Z" />,
  paire: (
    <>
      <circle cx="4.5" cy="8" r="3.2" />
      <circle cx="11.5" cy="8" r="3.2" />
    </>
  ),
  quart: <path d="M3 13 V3 A10 10 0 0 1 13 13 Z" />,
  losange: <rect x="3.8" y="3.8" width="8.4" height="8.4" rx="1.6" transform="rotate(45 8 8)" />,
  colonnes: (
    <>
      <rect x="3" y="2" width="4" height="12" rx="2" />
      <rect x="9" y="4.5" width="4" height="9.5" rx="2" />
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
