'use client'

import { PERIODS, type PeriodKey } from './network'

// Boutons radio natifs : flèches du clavier, un seul arrêt de tabulation,
// et le lecteur d'écran annonce « Période, groupe de choix, 7 jours, 3 sur 6 »
export function PeriodSelector({ value, onChange }: { value: PeriodKey; onChange: (key: PeriodKey) => void }) {
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">Période affichée</legend>
      <div className="flex flex-wrap gap-1.5">
        {PERIODS.map((p) => (
          <label
            key={p.key}
            className="relative flex h-10 cursor-pointer items-center rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3.5 font-body text-sm text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-bg-hover)] has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[var(--color-accent-muted)] has-[:checked]:font-medium has-[:checked]:text-[var(--color-accent)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-accent)]"
          >
            <input
              type="radio"
              name="periode"
              value={p.key}
              checked={value === p.key}
              onChange={() => onChange(p.key)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            {p.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
