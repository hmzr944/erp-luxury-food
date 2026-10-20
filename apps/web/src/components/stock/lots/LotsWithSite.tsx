'use client'

import { useSiteStore } from '@/stores/site.store'
import { LotsClient } from './LotsClient'

export function LotsWithSite() {
  const currentSite = useSiteStore((s) => s.currentSite)
  if (!currentSite) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="font-body text-sm text-[var(--color-text-muted)]">Sélectionnez un site</p>
      </div>
    )
  }
  return <LotsClient siteId={currentSite.id} />
}
