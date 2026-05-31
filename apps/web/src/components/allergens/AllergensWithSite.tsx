'use client'

import { useSiteStore } from '@/stores/site.store'
import { AllergensClient } from './AllergensClient'

export function AllergensWithSite() {
  const { currentSite } = useSiteStore()
  if (!currentSite) return (
    <div className="flex items-center justify-center h-full">
      <p className="font-body text-sm text-[var(--color-text-muted)]">Sélectionnez un site</p>
    </div>
  )
  return <AllergensClient siteId={currentSite.id} />
}
