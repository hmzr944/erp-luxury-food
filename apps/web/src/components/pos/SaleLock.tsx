'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { Archive, CloudArrowUp, DownloadSimple, LockSimple } from '@phosphor-icons/react'
import { endReason } from '@/lib/billing-access'

interface SaleLockProps {
  status?: string
  manager: boolean
  pending: number
  online: boolean
  cashOpen: boolean | null
  onCloseCash: () => void
}

// Compte verrouillé, aucune vente en cours : la caisse ne commence plus de
// vente. Tout le reste reste ouvert : ventes en attente, clôture, archives,
// exports et réglages (menu de l'en-tête)
export function SaleLock({ status, manager, pending, online, cashOpen, onCloseCash }: SaleLockProps) {
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => title.current?.focus(), [])

  const link =
    'inline-flex h-11 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-[15px] font-medium hover:border-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]'

  return (
    <section aria-labelledby="sale-lock-title" className="flex min-w-0 flex-1 items-center justify-center overflow-auto p-6">
      <div className="w-full max-w-lg space-y-6">
        <LockSimple size={32} aria-hidden className="text-[var(--color-accent)]" />
        <div className="space-y-2">
          <h2 id="sale-lock-title" ref={title} tabIndex={-1} className="text-2xl font-semibold tracking-[-0.02em] outline-none">
            Plus de nouvelle vente pour l&apos;instant
          </h2>
          <p role="alert" className="text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
            {endReason(status)} Abonnez-vous pour reprendre les ventes : rien n&apos;est perdu, tout reprend là où vous en étiez.
          </p>
        </div>

        <ul className="space-y-2 text-[15px]">
          <li className="flex gap-2.5">
            <CloudArrowUp size={20} aria-hidden className="mt-0.5 shrink-0 text-[var(--color-accent)]" />
            <span>
              {pending
                ? `${pending} ${pending > 1 ? 'ventes en attente partiront' : 'vente en attente partira'} ${online ? 'dans un instant' : 'au retour du réseau'}.`
                : 'Toutes les ventes sont envoyées et conservées.'}
            </span>
          </li>
          <li className="flex gap-2.5">
            <Archive size={20} aria-hidden className="mt-0.5 shrink-0 text-[var(--color-accent)]" />
            <span>Clôtures, archives, exports et attestation restent accessibles.</span>
          </li>
        </ul>

        <div className="flex flex-wrap gap-2">
          {manager && (
            <Link
              href="/settings/billing"
              className="inline-flex h-12 items-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 text-[15px] font-semibold text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              S&apos;abonner
            </Link>
          )}
          {cashOpen && (
            <button type="button" onClick={onCloseCash} className={link}>
              Clôturer la caisse
            </button>
          )}
          {manager && (
            <>
              <Link href="/compliance" className={link}>
                <Archive size={18} aria-hidden />
                Clôtures et archives
              </Link>
              <Link href="/settings/data" className={link}>
                <DownloadSimple size={18} aria-hidden />
                Exports
              </Link>
            </>
          )}
        </div>
        {!manager && (
          <p className="text-sm text-[var(--color-text-secondary)]">Prévenez le titulaire du compte : lui seul peut souscrire.</p>
        )}
      </div>
    </section>
  )
}
