'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatPrice } from '@erp/utils'
import { ordersApi } from '@/lib/api/orders'
import { OrderDetailSheet } from '@/components/orders/OrderDetailSheet'
import { Sheet } from './Sheet'

// Retour depuis la caisse : le numéro du ticket suffit. Sans ticket, on
// cherche par produit ou e-mail. Ni délai imposé, ni passage au back-office.
export function ReturnFinder({
  siteId,
  open,
  onUseCredit,
  onClose,
}: {
  siteId: string
  open: boolean
  onUseCredit: (code: string) => void
  onClose: () => void
}) {
  const [input, setInput] = useState('')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setInput('')
      setQ('')
    }
  }, [open])
  useEffect(() => {
    const t = window.setTimeout(() => setQ(input.trim()), 250)
    return () => window.clearTimeout(t)
  }, [input])

  const results = useQuery({
    queryKey: ['orders', siteId, 'return', q],
    queryFn: () => ordersApi.getAll(siteId, { q, kind: 'SALE', limit: 8 }),
    enabled: open && !selected,
  })

  return (
    <>
      <Sheet open={open && !selected} title="Retour d'article" onClose={onClose}>
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="return-search" className="block text-sm font-medium">
              N° du ticket, produit ou e-mail du client
            </label>
            <input
              id="return-search"
              data-autofocus
              type="search"
              autoComplete="off"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-4 text-base focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
          {!navigator.onLine ? (
            <p role="alert" className="rounded-[var(--radius-md)] bg-[var(--color-accent-muted)] p-3 text-sm font-medium">
              Les retours se font en ligne, pour vérifier la vente d&apos;origine. Les ventes, elles, continuent hors ligne.
            </p>
          ) : (
            <>
              <p className="text-sm text-[var(--color-text-secondary)]">{q ? 'Résultats' : 'Dernières ventes'}</p>
              <ul className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]" aria-busy={results.isFetching}>
                {(results.data ?? []).map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(o.id)}
                      className="flex w-full items-center gap-3 py-3 text-left hover:bg-[var(--color-bg-hover)]"
                    >
                      <span className="tabular w-14 shrink-0 text-sm font-semibold">n° {o.receiptChain?.counter}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px]">{o.items.map((i) => i.name).join(', ')}</span>
                        <span className="block text-sm text-[var(--color-text-secondary)]">
                          {new Date(o.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </span>
                      <span className="tabular shrink-0 text-[15px] font-medium">{formatPrice(Number(o.total))}</span>
                    </button>
                  </li>
                ))}
                {results.data?.length === 0 && <li className="py-6 text-center text-sm text-[var(--color-text-secondary)]">Aucune vente trouvée</li>}
              </ul>
            </>
          )}
        </div>
      </Sheet>
      <OrderDetailSheet
        siteId={siteId}
        orderId={selected}
        startWithRefund
        onUseCredit={(code) => {
          setSelected(null)
          onUseCredit(code)
        }}
        onClose={() => {
          setSelected(null)
          onClose()
        }}
      />
    </>
  )
}
