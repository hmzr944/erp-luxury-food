'use client'

import Link from 'next/link'
import { useAccess } from '@/lib/api/billing'

// Fin d'essai proche ou délai de grâce : une ligne discrète, jamais bloquante.
// Le lien vers l'abonnement n'est montré qu'à qui peut ouvrir la page.
export function AccessNotice({ canSubscribe }: { canSubscribe: boolean }) {
  const { notice } = useAccess()
  if (!notice) return null
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[var(--color-border)] bg-[var(--color-accent-muted)] px-4 py-2 text-sm text-[var(--color-text-primary)]"
    >
      <span>{notice}</span>
      {canSubscribe ? (
        <Link
          href="/settings/billing"
          className="shrink-0 rounded-[var(--radius-sm)] font-semibold text-[var(--color-accent)] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          S&apos;abonner
        </Link>
      ) : (
        <span className="text-[var(--color-text-secondary)]">Le titulaire du compte peut s&apos;abonner.</span>
      )}
    </div>
  )
}
