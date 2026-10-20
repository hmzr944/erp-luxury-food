'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { X } from '@phosphor-icons/react'
import { EASE_DRAWER } from '@/lib/motion'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

// Feuille de saisie : panneau à droite sur grand écran, feuille du bas sur
// téléphone. Fenêtre modale : le focus entre dans le panneau, Tab y reste,
// Échap ferme et le focus revient au bouton qui l'a ouverte.
export function Sheet({
  title,
  description,
  onClose,
  children,
  footer,
}: {
  title: string
  description?: string
  onClose: () => void
  children: React.ReactNode
  footer: React.ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const [wide] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches)

  useEffect(() => {
    const back = document.activeElement as HTMLElement | null
    const t = window.setTimeout(() => {
      const el = panel.current
      ;(el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>(FOCUSABLE))?.focus()
    }, 40)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panel.current) return
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      back?.focus?.()
    }
  }, [onClose])

  const from = reduce ? { opacity: 0 } : wide ? { transform: 'translateX(100%)' } : { transform: 'translateY(100%)' }
  const to = reduce ? { opacity: 1 } : { transform: 'translate(0%, 0%)' }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        aria-hidden
        className="fixed inset-0 z-40 bg-[var(--scrim)]"
      />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        aria-describedby={description ? 'sheet-desc' : undefined}
        initial={from}
        animate={to}
        exit={from}
        transition={{ duration: 0.28, ease: EASE_DRAWER }}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-2xl md:inset-x-auto md:right-0 md:top-0 md:h-full md:max-h-none md:w-[440px] md:rounded-none md:border-y-0 md:border-r-0"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <div className="min-w-0">
            <h2 id="sheet-title" className="font-display text-lg font-bold tracking-tight text-[var(--color-text-primary)]">{title}</h2>
            {description && <p id="sheet-desc" className="mt-0.5 font-body text-sm text-[var(--color-text-secondary)]">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-pill)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">{children}</div>
        <div className="flex gap-3 border-t border-[var(--color-border)] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>
      </motion.div>
    </>
  )
}
