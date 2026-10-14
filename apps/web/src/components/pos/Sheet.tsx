'use client'

import { useEffect, useId, useRef, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from '@phosphor-icons/react'
import { EASE_DRAWER, EASE_OUT } from '@/lib/motion'

export const EASE = EASE_OUT

const WIDE = '(min-width: 768px)'
function useWide() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(WIDE)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia(WIDE).matches,
    () => true,
  )
}

interface SheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  // Bloque la fermeture pendant une opération (signature du ticket)
  locked?: boolean
  width?: 'md' | 'lg'
}

// Panneau modal : feuille qui monte du bas sur téléphone, fenêtre centrée
// au-delà. Le mouvement indique d'où vient le panneau et où il repart.
export function Sheet({ open, title, onClose, children, locked, width = 'md' }: SheetProps) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const wide = useWide()
  // Téléphone : la feuille monte du bas et y repart (courbe iOS).
  // Au-delà : fenêtre centrée qui se pose, sans point d'ancrage.
  const motionProps = wide
    ? { initial: { opacity: 0, transform: 'scale(0.96)' }, animate: { opacity: 1, transform: 'scale(1)' }, exit: { opacity: 0, transform: 'scale(0.97)' }, transition: { duration: 0.22, ease: EASE_OUT } }
    : { initial: { transform: 'translateY(100%)' }, animate: { transform: 'translateY(0%)' }, exit: { transform: 'translateY(100%)' }, transition: { duration: 0.32, ease: EASE_DRAWER } }

  useEffect(() => {
    if (!open) return
    returnFocus.current = document.activeElement as HTMLElement | null
    const t = window.setTimeout(() => {
      // L'action principale marquée data-autofocus d'abord, sinon le premier champ
      const el = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current?.querySelector<HTMLElement>('input, button')
      el?.focus()
    }, 30)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !locked) onClose()
      // Tab reste dans la fenêtre : du dernier élément on revient au premier
      if (e.key === 'Tab' && panel.current) {
        const items = [...panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null)
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        const inside = panel.current.contains(document.activeElement)
        if (e.shiftKey && (document.activeElement === first || !inside)) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
      returnFocus.current?.focus?.()
    }
  }, [open, locked, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 flex items-end md:items-center justify-center">
          <motion.div
            className="absolute inset-0 bg-[var(--scrim)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: wide ? 0.22 : 0.32, ease: EASE_OUT }}
            onClick={() => !locked && onClose()}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={[
              'relative w-full max-h-[92dvh] overflow-y-auto bg-[var(--color-bg-surface)] text-[var(--color-text-primary)]',
              'rounded-t-[var(--radius-xl)] md:rounded-[var(--radius-xl)] shadow-[0_24px_80px_-24px_color-mix(in_srgb,var(--base-ink)_45%,transparent)]',
              width === 'lg' ? 'md:max-w-[640px]' : 'md:max-w-[460px]',
            ].join(' ')}
            {...motionProps}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-5 pt-4 pb-3 bg-[var(--color-bg-surface)]">
              <h2 id={titleId} className="text-lg font-semibold tracking-tight">
                {title}
              </h2>
              {!locked && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fermer"
                  className="grid place-items-center size-11 -mr-2 rounded-[var(--radius-pill)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
                >
                  <X size={20} />
                </button>
              )}
            </div>
            <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
