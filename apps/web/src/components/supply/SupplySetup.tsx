'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { sitesApi, type ApiSite } from '@/lib/api/sites'
import { supplyApi } from '@/lib/api/supply'

// Qui fournit qui : un site déclaré labo, cuisine centrale ou dépôt reçoit
// les commandes des autres, avec son heure de clôture et son délai
export function SupplySetup() {
  const sites = useQuery({ queryKey: ['sites'], queryFn: sitesApi.getAll })
  return (
    <div className="space-y-3">
      <p className="max-w-2xl text-[15px] text-[var(--color-text-secondary)]">
        Un labo, une cuisine centrale ou un dépôt reçoit les commandes des boutiques. Les boutiques peuvent commander jusqu&apos;à l&apos;heure de
        clôture, la veille d&apos;une livraison à un jour.
      </p>
      <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
        {(sites.data ?? []).map((s) => (
          <SetupRow key={s.id} site={s} />
        ))}
      </ul>
    </div>
  )
}

function SetupRow({ site }: { site: ApiSite }) {
  const qc = useQueryClient()
  const save = async (body: Parameters<typeof supplyApi.settings>[1]) => {
    try {
      await supplyApi.settings(site.id, body)
      await qc.invalidateQueries({ queryKey: ['sites'] })
      await qc.invalidateQueries({ queryKey: ['supply'] })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  const field = 'h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 text-[15px]'
  return (
    <li className="flex flex-wrap items-center gap-4 px-4 py-3">
      <label className="flex min-h-11 flex-1 basis-60 cursor-pointer items-center gap-3">
        <input type="checkbox" checked={!!site.isSupplier} onChange={(e) => save({ isSupplier: e.target.checked })} className="size-5 accent-[var(--color-accent)]" />
        <span>
          <span className="block text-[15px] font-medium">{site.name}</span>
          <span className="block text-sm text-[var(--color-text-secondary)]">{site.isSupplier ? 'Labo ou dépôt' : 'Boutique'}</span>
        </span>
      </label>
      {site.isSupplier && (
        <>
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            Clôture à
            <input type="time" defaultValue={site.orderCutoff} onBlur={(e) => e.target.value && save({ orderCutoff: e.target.value })} className={field} />
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            Livraison à
            <select defaultValue={site.leadDays} onChange={(e) => save({ leadDays: Number(e.target.value) })} className={field}>
              {[1, 2, 3, 7].map((d) => (
                <option key={d} value={d}>
                  J+{d}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </li>
  )
}
