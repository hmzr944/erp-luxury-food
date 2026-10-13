'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatPrice } from '@erp/utils'
import { supplyApi } from '@/lib/api/supply'

// Cessions internes : ce que chaque boutique doit au labo sur le mois
export function LaboStatement({ siteId }: { siteId: string }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const st = useQuery({ queryKey: ['supply', siteId, 'statement', month], queryFn: () => supplyApi.statement(siteId, month) })
  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3 text-[15px] font-medium">
        Mois
        <input
          type="month"
          value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className="h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3"
        />
      </label>
      <p className="max-w-2xl text-[15px] text-[var(--color-text-secondary)]">
        Quantités réceptionnées par les boutiques, au prix de cession du jour de la commande. De quoi suivre la rentabilité du labo d&apos;un côté,
        des boutiques de l&apos;autre.
      </p>
      {st.data && (
        <table className="w-full max-w-2xl text-[15px]">
          <thead>
            <tr className="border-b border-[var(--color-border-strong)] text-left text-sm text-[var(--color-text-secondary)]">
              <th className="py-2 font-medium">Boutique</th>
              <th className="py-2 text-right font-medium">Livraisons</th>
              <th className="py-2 text-right font-medium">Montant HT</th>
            </tr>
          </thead>
          <tbody>
            {st.data.rows.map((r) => (
              <tr key={r.siteId} className="border-b border-[var(--color-border)]">
                <td className="py-2.5">
                  {r.siteName}
                  {r.unpriced > 0 && <span className="block text-sm text-[var(--color-text-secondary)]">{r.unpriced} lignes sans prix de cession</span>}
                </td>
                <td className="tabular py-2.5 text-right">{r.orders}</td>
                <td className="tabular py-2.5 text-right font-medium">{formatPrice(r.amount)}</td>
              </tr>
            ))}
            {st.data.rows.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-[var(--color-text-secondary)]">
                  Aucune livraison réceptionnée ce mois-ci.
                </td>
              </tr>
            )}
          </tbody>
          {st.data.rows.length > 0 && (
            <tfoot>
              <tr>
                <td className="py-2.5 font-semibold">Total</td>
                <td />
                <td className="tabular py-2.5 text-right font-semibold">{formatPrice(st.data.total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      )}
    </div>
  )
}
