import { BRAND } from '@/lib/brand'

// Le signe FLŌW : quatre barres de hauteurs différentes dans un carré Flux,
// comme le pouls d'une boutique (et les offres Pulse et Tempo)
export function FlowMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="9" fill="var(--base-accent)" />
      <rect x="7" y="13" width="3.5" height="12" rx="1.75" fill="var(--gamme-corail)" />
      <rect x="12.5" y="7" width="3.5" height="18" rx="1.75" fill="var(--gamme-soleil)" />
      <rect x="18" y="10" width="3.5" height="15" rx="1.75" fill="var(--gamme-menthe)" />
      <rect x="23.5" y="16" width="3.5" height="9" rx="1.75" fill="var(--gamme-lagon)" />
    </svg>
  )
}

export function FlowLogo({ size = 32, className = '', label = true }: { size?: number; className?: string; label?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <FlowMark size={size} />
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
