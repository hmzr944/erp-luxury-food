'use client'

import { Minus, Plus } from '@phosphor-icons/react'

// Quantité : deux gros boutons pour ajuster au pouce, un champ pour taper
export function QtyInput({
  value,
  onChange,
  label,
  step = 1,
  max,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  label: string
  step?: number
  max?: number
  disabled?: boolean
}) {
  const set = (v: number) => onChange(Math.max(0, Math.min(max ?? Infinity, Math.round(v * 1000) / 1000)))
  return (
    <div className="flex shrink-0 items-center gap-1" role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => set(value - step)}
        disabled={disabled || value <= 0}
        aria-label={`Moins, ${label}`}
        className="grid size-11 place-items-center rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] disabled:opacity-30 press"
      >
        <Minus size={16} />
      </button>
      <input
        inputMode="decimal"
        aria-label={label}
        disabled={disabled}
        value={String(value).replace('.', ',')}
        onChange={(e) => {
          const n = Number(e.target.value.replace(',', '.'))
          if (Number.isFinite(n)) set(n)
        }}
        onFocus={(e) => e.target.select()}
        className="tabular h-11 w-16 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-center text-lg font-semibold focus:border-[var(--color-accent)] focus:outline-none disabled:opacity-60"
      />
      <button
        type="button"
        onClick={() => set(value + step)}
        disabled={disabled || (max != null && value >= max)}
        aria-label={`Plus, ${label}`}
        className="grid size-11 place-items-center rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] disabled:opacity-30 press"
      >
        <Plus size={16} />
      </button>
    </div>
  )
}
