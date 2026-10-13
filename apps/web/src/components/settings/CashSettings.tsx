'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatPrice } from '@erp/utils'
import { sitesApi, type ApiSite } from '@/lib/api/sites'
import { cashApi } from '@/lib/api/cash'

// Fond de caisse : la consigne par boutique et l'historique des comptages
export function CashSettings() {
  const sites = useQuery({ queryKey: ['sites'], queryFn: sitesApi.getAll })
  const shops = (sites.data ?? []).filter((s) => !s.isSupplier)
  const [siteId, setSiteId] = useState<string | null>(null)
  const active = shops.find((s) => s.id === siteId) ?? shops[0]

  return (
    <div className="max-w-3xl space-y-6 p-6 md:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Caisse et fond de caisse</h1>
        <p className="text-[15px] text-[var(--color-text-secondary)]">
          Le fond laissé dans le tiroir est proposé à l&apos;ouverture suivante. Sous la tolérance, un écart est enregistré sans rien demander au
          vendeur.
        </p>
      </header>
      {shops.length > 1 && (
        <div role="radiogroup" aria-label="Boutique" className="flex flex-wrap gap-2">
          {shops.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={s.id === active?.id}
              onClick={() => setSiteId(s.id)}
              className={['h-11 rounded-[var(--radius-pill)] px-4 text-sm font-medium', s.id === active?.id ? 'bg-[var(--color-text-primary)] text-[var(--color-bg-base)]' : 'border border-[var(--color-border-strong)]'].join(' ')}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      {active && <SiteCash key={active.id} site={active} />}
    </div>
  )
}

function SiteCash({ site }: { site: ApiSite & { cashFloat?: string | number; cashTolerance?: string | number } }) {
  const qc = useQueryClient()
  const [float, setFloat] = useState(String(site.cashFloat ?? 150).replace('.', ','))
  const [tolerance, setTolerance] = useState(String(site.cashTolerance ?? 2).replace('.', ','))
  const sessions = useQuery({ queryKey: ['cash-sessions', site.id], queryFn: () => cashApi.sessions(site.id) })
  const num = (v: string) => Number(v.replace(',', '.'))
  const field = 'tabular h-11 w-28 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 text-right text-[15px]'

  return (
    <>
      <form
        className="flex flex-wrap items-end gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5"
        onSubmit={async (e) => {
          e.preventDefault()
          try {
            await cashApi.settings(site.id, { cashFloat: num(float), cashTolerance: num(tolerance) })
            await qc.invalidateQueries({ queryKey: ['sites'] })
            toast.success('Consignes enregistrées')
          } catch (err) {
            toast.error((err as Error).message)
          }
        }}
      >
        <label className="space-y-1 text-sm font-medium">
          <span className="block">Fond à garder chaque soir</span>
          <span className="flex items-center gap-2">
            <input inputMode="decimal" value={float} onChange={(e) => setFloat(e.target.value)} className={field} /> €
          </span>
        </label>
        <label className="space-y-1 text-sm font-medium">
          <span className="block">Écart toléré</span>
          <span className="flex items-center gap-2">
            ± <input inputMode="decimal" value={tolerance} onChange={(e) => setTolerance(e.target.value)} className={field} /> €
          </span>
        </label>
        <button type="submit" className="h-11 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 text-[15px] font-semibold text-[var(--color-on-accent)]">
          Enregistrer
        </button>
      </form>

      <section aria-labelledby="sessions-title" className="space-y-2">
        <h2 id="sessions-title" className="text-lg font-semibold">
          Derniers comptages
        </h2>
        {sessions.data?.length ? (
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b border-[var(--color-border-strong)] text-left text-sm text-[var(--color-text-secondary)]">
                <th className="py-2 font-medium">Fermeture</th>
                <th className="py-2 text-right font-medium">Compté</th>
                <th className="py-2 text-right font-medium">Écart</th>
                <th className="py-2 text-right font-medium">Déposé</th>
              </tr>
            </thead>
            <tbody>
              {sessions.data.map((s) => (
                <tr key={s.id} className="border-b border-[var(--color-border)] align-top">
                  <td className="py-2.5">
                    {s.closedAt ? new Date(s.closedAt).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Ouverte'}
                    {s.differenceReason && <span className="block text-sm text-[var(--color-text-secondary)]">{s.differenceReason}</span>}
                    {s.openingNote && <span className="block text-sm text-[var(--color-text-secondary)]">{s.openingNote}</span>}
                  </td>
                  <td className="tabular py-2.5 text-right">{s.counted != null ? formatPrice(s.counted) : ''}</td>
                  <td className={['tabular py-2.5 text-right', s.difference ? 'font-semibold' : ''].join(' ')}>{s.difference != null ? formatPrice(s.difference) : ''}</td>
                  <td className="tabular py-2.5 text-right">{s.deposit != null ? formatPrice(s.deposit) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-[15px] text-[var(--color-text-secondary)]">Aucune caisse ouverte pour l&apos;instant.</p>
        )}
      </section>
    </>
  )
}
