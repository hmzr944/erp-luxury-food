'use client'

import { useSiteStore } from '@/stores/site.store'
import { DashboardClient } from './DashboardClient'

export function DashboardWithSite() {
  const { currentSite } = useSiteStore()

  if (!currentSite) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="font-body text-sm text-[var(--color-text-muted)]">
          Sélectionnez un site pour voir le dashboard
        </p>
      </div>
    )
  }

  return <DashboardClient siteId={currentSite.id} siteName={currentSite.name} />
}
