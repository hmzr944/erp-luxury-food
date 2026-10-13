'use client'

import { useEffect, useId, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from '@phosphor-icons/react'

export const EASE = [0.2, 0, 0, 1] as const

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

  useEffect(() => {
    if (!open) return
    returnFocus.current = document.activeElement as HTMLElement | null
    const t = window.setTimeout(() => {
      panel.current?.querySelector<HTMLElement>('[data-autofocus], button, input')?.focus()
    }, 30)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !locked) onClose()
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
            transition={{ duration: 0.2, ease: EASE }}
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
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.22, ease: EASE }}
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
