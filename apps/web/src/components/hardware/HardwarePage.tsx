'use client'

import Link from 'next/link'
import { useSiteStore } from '@/stores/site.store'
import { HardwareWizard } from './HardwareWizard'

// Matériel de CET appareil : FLŌW-Bridge l'ouvre au démarrage
// (/materiel#pont=<code>&port=<port>) pour appairer sans rien saisir
export function HardwarePage() {
  const site = useSiteStore((s) => s.currentSite)

  return (
    <div className="max-w-2xl space-y-8 p-4 md:p-8">
      <header>
        <h1 className="page-title">Matériel</h1>
        <p className="mt-1 text-[15px] text-[var(--color-text-secondary)]">Imprimante, tiroir-caisse et terminal de paiement de cet appareil.</p>
      </header>
      <HardwareWizard doneHref={site ? `/pos/${site.id}` : undefined} advancedHref="/settings/printing" />
      <p className="border-t border-[var(--color-border)] pt-4 text-sm text-[var(--color-text-secondary)]">
        Réglages fins : largeur du papier, factures A4 et accès des iPad dans{' '}
        <Link href="/settings/printing" className="font-medium text-[var(--color-accent)] underline underline-offset-4">
          Impression
        </Link>
        , TPE Caisse-AP dans{' '}
        <Link href="/settings/payments" className="font-medium text-[var(--color-accent)] underline underline-offset-4">
          Paiement
        </Link>
        .
      </p>
    </div>
  )
}
