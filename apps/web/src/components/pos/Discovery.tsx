'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CaretDown, CaretUp, CheckCircle, Circle, Confetti } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api/client'
import { EASE_OUT } from '@/lib/motion'

// Mode découverte : juste après l'inscription, la caisse s'ouvre en mode
// formation (ventes fictives, hors grand livre). Une liste accompagne les
// trois premières ventes, puis le passage en vente réelle.

export type DiscoveryStep = 'sale' | 'split' | 'card'

interface DiscoveryState {
  active: boolean
  open: boolean
  done: Partial<Record<DiscoveryStep, boolean>>
}

const keyOf = (siteId: string) => `flow-discovery:${siteId}`

function read(siteId: string): DiscoveryState | null {
  try {
    const raw = window.localStorage.getItem(keyOf(siteId))
    return raw ? (JSON.parse(raw) as DiscoveryState) : null
  } catch {
    return null
  }
}

function write(siteId: string, s: DiscoveryState | null) {
  try {
    if (s) window.localStorage.setItem(keyOf(siteId), JSON.stringify(s))
    else window.localStorage.removeItem(keyOf(siteId))
  } catch {
    // stockage indisponible : la liste vit le temps de la session
  }
}

export function useDiscovery(siteId: string, start: boolean) {
  const [state, setState] = useState<DiscoveryState | null>(null)
  useEffect(() => {
    const saved = read(siteId)
    const next = saved ?? (start ? { active: true, open: true, done: {} } : null)
    if (next && !saved) write(siteId, next)
    setState(next)
  }, [siteId, start])

  const update = useCallback(
    (fn: (s: DiscoveryState) => DiscoveryState | null) => {
      setState((prev) => {
        if (!prev) return prev
        const next = fn(prev)
        write(siteId, next)
        return next
      })
    },
    [siteId],
  )

  // Appelé après chaque vente fictive réussie
  const record = useCallback(
    (sale: { payments: number; card: boolean }) =>
      update((s) => ({
        ...s,
        done: { ...s.done, sale: true, ...(sale.payments > 1 ? { split: true } : {}), ...(sale.card ? { card: true } : {}) },
      })),
    [update],
  )

  return {
    state,
    record,
    toggle: () => update((s) => ({ ...s, open: !s.open })),
    finish: () => update(() => null),
  }
}

const STEPS: Array<{ key: DiscoveryStep; label: string; hint: string }> = [
  { key: 'sale', label: 'Vendre un article', hint: 'Touchez un produit, puis Encaisser.' },
  { key: 'split', label: 'Diviser une note', hint: 'À l’encaissement : « Diviser la note » ou « Payer avec plusieurs moyens ».' },
  { key: 'card', label: 'Encaisser par carte', hint: 'Le paiement est simulé : rien n’est débité.' },
]

export function DiscoveryChecklist({
  siteId,
  state,
  canManage,
  onToggle,
  onPrinter,
  onGoLive,
  variant = 'floating',
}: {
  variant?: 'panel' | 'floating'
  siteId: string
  state: DiscoveryState
  canManage: boolean
  onToggle: () => void
  onPrinter: () => void
  onGoLive: () => Promise<void>
}) {
  const [samples, setSamples] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  // Dans le panneau de vente, la liste est toujours dépliée
  const open = variant === 'panel' || state.open
  const count = STEPS.filter((s) => state.done[s.key]).length
  const allDone = count === STEPS.length

  useEffect(() => {
    apiClient<{ count: number }>(`/sites/${siteId}/products/samples`)
      .then((r) => setSamples(r.count))
      .catch(() => setSamples(null))
  }, [siteId])

  return (
    <motion.aside
      aria-labelledby={`discovery-title-${variant}`}
      initial={{ opacity: 0, transform: 'translateY(12px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      transition={{ duration: 0.24, ease: EASE_OUT }}
      className={
        variant === 'panel'
          ? 'rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-base)]'
          : 'fixed bottom-4 left-4 z-30 w-[min(360px,calc(100vw-2rem))] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-2xl md:hidden'
      }
    >
      <button type="button" onClick={variant === 'panel' ? undefined : onToggle} aria-expanded={variant === 'panel' ? undefined : open} disabled={variant === 'panel'} className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-default">
        <span className="min-w-0 flex-1">
          <span id={`discovery-title-${variant}`} className="block text-[15px] font-semibold">
            {allDone ? 'Prêt à vendre' : 'Bienvenue dans votre caisse'}
          </span>
          <span className="block text-sm text-[var(--color-text-secondary)]">Mode découverte · {count} sur {STEPS.length}</span>
        </span>
        {variant === 'floating' && (open ? <CaretDown size={18} aria-hidden /> : <CaretUp size={18} aria-hidden />)}
      </button>
      {open && (
        <div className="space-y-4 border-t border-[var(--color-border)] px-4 py-3">
          <p className="text-sm text-[var(--color-text-secondary)]">Les ventes d’essai sont fictives : ni comptées, ni déstockées, hors du journal fiscal.</p>
          <ol className="space-y-3">
            {STEPS.map((s) => (
              <li key={s.key} className="flex gap-3">
                {state.done[s.key] ? (
                  <CheckCircle size={22} weight="fill" aria-hidden className="shrink-0 text-[var(--color-accent)]" />
                ) : (
                  <Circle size={22} aria-hidden className="shrink-0 text-[var(--color-text-muted)]" />
                )}
                <span>
                  <span className={['block text-[15px] font-medium', state.done[s.key] ? 'text-[var(--color-text-secondary)] line-through' : ''].join(' ')}>{s.label}</span>
                  {!state.done[s.key] && <span className="block text-sm text-[var(--color-text-secondary)]">{s.hint}</span>}
                </span>
              </li>
            ))}
          </ol>

          <div className="space-y-2 border-t border-[var(--color-border)] pt-3">
            <p className="text-sm font-semibold">Avant la première vraie vente</p>
            <div className="flex flex-wrap gap-2">
              {canManage && (
                <Link href="/settings/data" className="inline-flex h-10 items-center rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] px-3 text-sm font-medium press">
                  Importer mon catalogue
                </Link>
              )}
              <button type="button" onClick={onPrinter} className="inline-flex h-10 items-center rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] px-3 text-sm font-medium press">
                Imprimante et tiroir
              </button>
              {canManage && !!samples && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      const r = await apiClient<{ removed: number; hidden: number }>(`/sites/${siteId}/products/samples`, { method: 'DELETE' })
                      setSamples(0)
                      toast.success(`${r.removed + r.hidden} articles d’exemple retirés`)
                    } catch (e) {
                      toast.error((e as Error).message)
                    } finally {
                      setBusy(false)
                    }
                  }}
                  className="inline-flex h-10 items-center rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] px-3 text-sm font-medium press disabled:opacity-60"
                >
                  Retirer les {samples} articles d’exemple
                </button>
              )}
            </div>
          </div>

          {canManage && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await onGoLive()
                } finally {
                  setBusy(false)
                }
              }}
              className={[
                'flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] text-[15px] font-semibold press disabled:opacity-60',
                allDone ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]' : 'border border-[var(--color-border-strong)]',
              ].join(' ')}
            >
              {allDone && <Confetti size={20} aria-hidden />} Passer en vente réelle
            </button>
          )}
        </div>
      )}
    </motion.aside>
  )
}
