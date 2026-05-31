'use client'

import { useSiteStore } from '@/stores/site.store'
import { OrdersHub } from './OrdersHub'

export function OrdersHubWithSite() {
  const { currentSite } = useSiteStore()

  if (!currentSite) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="font-body text-sm text-[var(--color-text-muted)]">
          Sélectionnez un site dans la barre latérale
        </p>
      </div>
    )
  }

  return <OrdersHub siteId={currentSite.id} />
}
