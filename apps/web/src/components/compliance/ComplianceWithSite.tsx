'use client'

import { useSiteStore } from '@/stores/site.store'
import { ComplianceClient } from './ComplianceClient'

export function ComplianceWithSite() {
  const { currentSite } = useSiteStore()
  if (!currentSite) return (
    <div className="flex items-center justify-center h-full">
      <p className="font-body text-sm text-[var(--color-text-muted)]">Sélectionnez un site</p>
    </div>
  )
  return <ComplianceClient siteId={currentSite.id} />
}
