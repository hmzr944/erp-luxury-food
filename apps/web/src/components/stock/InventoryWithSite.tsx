'use client'

import { useSearchParams } from 'next/navigation'
import { useSiteStore } from '@/stores/site.store'
import { useAuthStore } from '@/stores/auth.store'
import { InventoryClient } from './InventoryClient'

export function InventoryWithSite() {
  const { currentSite } = useSiteStore()
  const role = useAuthStore((s) => s.user?.role)
  const viewId = useSearchParams().get('id')

  if (!currentSite) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="font-body text-sm text-[var(--color-text-secondary)]">Sélectionnez un site</p>
      </div>
    )
  }
  return <InventoryClient siteId={currentSite.id} siteName={currentSite.name} canEdit={role === 'OWNER' || role === 'MANAGER'} viewId={viewId} />
}
