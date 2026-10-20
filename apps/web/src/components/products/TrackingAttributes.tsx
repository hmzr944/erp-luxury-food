'use client'

import type { UseFormRegister } from 'react-hook-form'
import { FieldError } from '@/components/ui/FieldError'
import type { AttributeDef, DateKind } from './attributes-form'

const inputCls = 'w-full h-11 px-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-[var(--radius-md)] font-body text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-colors'

type Tracking = 'NONE' | 'LOT' | 'LOT_EXPIRY' | 'SERIAL'

export const TRACKING_MODES: Array<{ value: Tracking; label: string; help: string }> = [
  { value: 'NONE', label: 'Aucun', help: 'Le stock est un simple total, sans lot ni date.' },
  { value: 'LOT', label: 'Par lot', help: 'Chaque réception reçoit un numéro de lot, pour retrouver d’où vient un article.' },
  { value: 'LOT_EXPIRY', label: 'Par date limite', help: 'Chaque lot porte une date limite, et la caisse sort d’abord le lot qui expire le premier.' },
  { value: 'SERIAL', label: 'Par numéro de série', help: 'Chaque pièce a son propre numéro, saisi à la réception et choisi à la vente.' },
]

const DATE_KINDS: Array<{ value: DateKind; label: string; help: string }> = [
  { value: 'DLC', label: 'DLC', help: 'À consommer jusqu’au (produits frais, périssables).' },
  { value: 'DDM', label: 'DDM', help: 'À consommer de préférence avant (épicerie sèche, conserves).' },
]

const ring = 'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-accent)]'

// Mode de suivi du stock du produit, avec le type de date quand il y a une date limite
export function TrackingSection({
  register, tracking, dateKind, onDateKind, hadStock,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>
  tracking: Tracking
  dateKind: DateKind
  onDateKind: (k: DateKind) => void
  // Le produit existait sans suivi : son stock actuel n'a pas de lot
  hadStock: boolean
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="font-body text-xs text-[var(--color-text-secondary)]">Suivi du stock</legend>
      <div className="space-y-1.5">
        {TRACKING_MODES.map((m) => (
          <label key={m.value} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border p-3 ${ring} ${tracking === m.value ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)]' : 'border-[var(--color-border-strong)]'}`}>
            <input type="radio" value={m.value} {...register('tracking')} className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]" />
            <span className="min-w-0">
              <span className="block font-body text-sm font-semibold text-[var(--color-text-primary)]">{m.label}</span>
              <span className="block font-body text-sm text-[var(--color-text-secondary)]">{m.help}</span>
            </span>
          </label>
        ))}
      </div>

      {tracking === 'LOT_EXPIRY' && (
        <div role="radiogroup" aria-label="Type de date limite" className="space-y-1.5 pt-1">
          <p className="font-body text-xs text-[var(--color-text-secondary)]">Type de date inscrit sur l’emballage</p>
          <div className="grid grid-cols-2 gap-2">
            {DATE_KINDS.map((k) => (
              <label key={k.value} className={`flex min-h-11 cursor-pointer items-start gap-2 rounded-[var(--radius-md)] border p-3 ${ring} ${dateKind === k.value ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)]' : 'border-[var(--color-border-strong)]'}`}>
                <input type="radio" name="dateKind" checked={dateKind === k.value} onChange={() => onDateKind(k.value)} className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]" />
                <span className="min-w-0">
                  <span className="block font-body text-sm font-semibold">{k.label}</span>
                  <span className="block font-body text-xs text-[var(--color-text-secondary)]">{k.help}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {hadStock && (
        <p className="font-body text-sm text-[var(--color-text-secondary)]">
          Le stock déjà en rayon n’a pas de lot. Après l’enregistrement, réceptionnez-le dans Stock, Lots et dates.
        </p>
      )}
    </fieldset>
  )
}

// Caractéristiques du produit : champs définis par l'organisation (secteur et packs)
export function AttributesSection({
  defs, inputs, errors, onChange,
}: {
  defs: AttributeDef[]
  inputs: Record<string, string>
  errors: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  let firstInvalid = true
  return (
    <fieldset className="space-y-3">
      <legend className="font-body text-xs text-[var(--color-text-secondary)]">Caractéristiques</legend>
      <div className="grid grid-cols-2 gap-3">
        {defs.map((def) => {
          const id = `pd-attr-${def.key}`
          const error = errors[def.key]
          const invalid = error && firstInvalid ? ((firstInvalid = false), true) : false
          const value = inputs[def.key] ?? ''
          const common = {
            id,
            'aria-invalid': !!error,
            'aria-describedby': error ? `${id}-err` : undefined,
            'data-attr-invalid': invalid ? 'true' : undefined,
          } as const
          const wide = def.type === 'TEXT' || def.type === 'BOOLEAN'
          return (
            <div key={def.key} className={`space-y-1.5 ${wide ? 'col-span-2' : ''}`}>
              {def.type === 'BOOLEAN' ? (
                <label className="flex min-h-11 items-center gap-3 font-body text-sm text-[var(--color-text-primary)]">
                  <input type="checkbox" {...common} checked={value === 'true'} onChange={(e) => onChange(def.key, e.target.checked ? 'true' : '')} className="size-5 accent-[var(--color-accent)]" />
                  {def.label}
                </label>
              ) : (
                <>
                  <label htmlFor={id} className="font-body text-xs text-[var(--color-text-secondary)]">{def.label}{def.required ? ' *' : ''}</label>
                  {def.type === 'SELECT' ? (
                    <select {...common} value={value} onChange={(e) => onChange(def.key, e.target.value)} className={inputCls + ' cursor-pointer'}>
                      <option value="">Non précisé</option>
                      {def.options.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  ) : def.type === 'DATE' ? (
                    <input {...common} type="date" value={value} onChange={(e) => onChange(def.key, e.target.value)} className={inputCls + ' tabular'} />
                  ) : (
                    <input
                      {...common}
                      type="text"
                      inputMode={def.type === 'NUMBER' ? 'decimal' : undefined}
                      autoComplete="off"
                      value={value}
                      onChange={(e) => onChange(def.key, e.target.value)}
                      className={inputCls + (def.type === 'NUMBER' ? ' tabular' : '')}
                    />
                  )}
                </>
              )}
              {error && <FieldError id={`${id}-err`}>{error}</FieldError>}
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
