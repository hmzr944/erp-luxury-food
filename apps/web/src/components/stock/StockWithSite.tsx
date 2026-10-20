'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useSiteStore } from '@/stores/site.store'
import { useAuthStore } from '@/stores/auth.store'
import { StockClient } from './StockClient'
import { StockNetwork } from './StockNetwork'

type View = 'site' | 'reseau'

export function StockWithSite() {
  const { currentSite, sites } = useSiteStore()
  const { user } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  // Vue réseau : titulaire et gérant, dès qu'il y a plusieurs boutiques
  const canSeeNetwork = (user?.role === 'OWNER' || user?.role === 'MANAGER') && sites.length > 1
  const view: View = canSeeNetwork && params.get('vue') === 'reseau' ? 'reseau' : 'site'

  const choose = useCallback(
    (next: View) => router.replace(next === 'reseau' ? `${pathname}?vue=reseau` : pathname, { scroll: false }),
    [pathname, router],
  )

  if (!currentSite) return (
    <div className="flex items-center justify-center h-full">
      <p className="font-body text-sm text-[var(--color-text-muted)]">Sélectionnez un site</p>
    </div>
  )

  if (!canSeeNetwork) return <StockClient siteId={currentSite.id} />

  const tabs: Array<{ key: View; label: string }> = [
    { key: 'site', label: `Ce site : ${currentSite.name}` },
    { key: 'reseau', label: 'Stock du réseau' },
  ]

  return (
    <div className="flex h-full flex-col">
      <div role="tablist" aria-label="Vue du stock" className="flex shrink-0 gap-1 border-b border-[var(--color-border)] px-4 pt-3 sm:px-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`stock-tab-${t.key}`}
            aria-selected={view === t.key}
            aria-controls="stock-panel"
            tabIndex={view === t.key ? 0 : -1}
            onClick={() => choose(t.key)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') choose(view === 'site' ? 'reseau' : 'site')
            }}
            className={[
              'min-h-10 min-w-0 truncate rounded-t-[var(--radius-md)] border-b-2 px-3 font-body text-sm transition-colors',
              view === t.key
                ? 'border-[var(--color-accent)] font-medium text-[var(--color-text-primary)]'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id="stock-panel" role="tabpanel" aria-labelledby={`stock-tab-${view}`} className="min-h-0 flex-1">
        {view === 'reseau' ? <StockNetwork /> : <StockClient siteId={currentSite.id} />}
      </div>
    </div>
  )
}
