import { BRAND } from '@/lib/brand'

// Le signe FLŌW : quatre barres de hauteurs différentes dans un carré Flux,
// comme le pouls d'une boutique (et les offres Pulse et Tempo)
// rise : les barres se dressent une fois à l'affichage (moments rares seulement)
export function FlowMark({ size = 32, className = '', rise = false }: { size?: number; className?: string; rise?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={`${rise ? 'flow-rise ' : ''}${className}`}>
      <rect width="32" height="32" rx="9" fill="var(--base-accent)" />
      <rect x="7" y="13" width="3.5" height="12" rx="1.75" fill="var(--gamme-corail)" />
      <rect x="12.5" y="7" width="3.5" height="18" rx="1.75" fill="var(--gamme-soleil)" />
      <rect x="18" y="10" width="3.5" height="15" rx="1.75" fill="var(--gamme-menthe)" />
      <rect x="23.5" y="16" width="3.5" height="9" rx="1.75" fill="var(--gamme-lagon)" />
    </svg>
  )
}

export function FlowLogo({ size = 32, className = '', label = true, rise = false }: { size?: number; className?: string; label?: boolean; rise?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <FlowMark size={size} rise={rise} />
      {label ? (
        <span className="font-display font-bold tracking-[-0.03em]" style={{ fontSize: size * 0.72, lineHeight: 1 }}>
          {BRAND}
        </span>
      ) : (
        <span className="sr-only">{BRAND}</span>
      )}
    </span>
  )
}

const BARS = ['var(--gamme-corail)', 'var(--gamme-soleil)', 'var(--gamme-menthe)', 'var(--gamme-lagon)']

// Le pouls FLŌW : les quatre barres du signe battent tant qu'on attend.
// Remplace les roues de chargement ; l'état lui-même est dit en texte à côté.
export function FlowPulse({ size = 28, className = '' }: { size?: number; className?: string }) {
  const bar = Math.max(3, Math.round(size / 7))
  return (
    <span aria-hidden className={`flow-pulse inline-flex items-end ${className}`} style={{ height: size, gap: bar * 0.6 }}>
      {BARS.map((c, i) => (
        <span key={c} className="block h-full rounded-full" style={{ width: bar, background: c, ['--i' as string]: i }} />
      ))}
    </span>
  )
}

// Le signe bat une fois : la vente est enregistrée
export function FlowBeat({ size = 28, className = '' }: { size?: number; className?: string }) {
  const bar = Math.max(3, Math.round(size / 7))
  const heights = [0.66, 1, 0.83, 0.5]
  return (
    <span aria-hidden className={`flow-rise inline-flex items-end ${className}`} style={{ height: size, gap: bar * 0.6 }}>
      {BARS.map((c, i) => (
        <span key={c} className="block rounded-full" style={{ width: bar, height: `${heights[i] * 100}%`, background: c }} />
      ))}
    </span>
  )
}

// Chargement : le pouls et une phrase, qui n'apparaissent qu'après 200 ms
// pour ne pas clignoter quand la réponse est immédiate
export function Loading({ label = 'Chargement', className = '' }: { label?: string; className?: string }) {
  return (
    <p role="status" className={`loading-in flex items-center gap-3 text-sm text-[var(--color-text-secondary)] ${className}`}>
      <FlowPulse size={18} />
      {label}
    </p>
  )
}
