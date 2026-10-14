'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { SECTOR_PRESETS, type PaymentMethodPreset } from '@erp/types'
import { apiClient } from '@/lib/api/client'
import { usePlatformConfig, type PaymentMethodConfig } from '@/lib/api/platform'

// Moyens proposés par FLŌW, tous secteurs confondus
const PRESETS: PaymentMethodPreset[] = [
  ...new Map(Object.values(SECTOR_PRESETS).flatMap((s) => s.paymentMethods).map((m) => [m.code, m])).values(),
]

type MethodBody = Omit<PaymentMethodConfig, 'id' | 'maxAmount'> & { maxAmount?: number | null }

const body = (m: PaymentMethodConfig, patch: Partial<MethodBody> = {}): MethodBody => ({
  code: m.code,
  label: m.label,
  kind: m.kind,
  isActive: m.isActive,
  position: m.position,
  mealVoucher: !!m.mealVoucher,
  giveChange: !!m.giveChange,
  maxAmount: m.maxAmount != null ? Number(m.maxAmount) : null,
  requiresReference: !!m.requiresReference,
  ...patch,
})

function rules(m: Pick<PaymentMethodConfig, 'kind' | 'mealVoucher' | 'giveChange' | 'maxAmount' | 'requiresReference'>) {
  const out: string[] = []
  if (m.mealVoucher) out.push(`articles éligibles seulement${m.maxAmount != null ? `, ${Number(m.maxAmount).toLocaleString('fr-FR')} € au plus par ticket` : ''}, sans rendu de monnaie`)
  if (m.requiresReference) out.push('numéro noté sur la vente')
  if (m.giveChange) out.push('monnaie rendue, 1 000 € au plus pour un client résidant en France')
  return out.join(' · ')
}

// Moyens de paiement acceptés en caisse et leurs règles françaises
export function PaymentMethodsSettings() {
  const qc = useQueryClient()
  const { data: config } = usePlatformConfig()
  const methods = (config?.paymentMethods ?? []).filter((m) => m.code !== 'CREDIT')
  const missing = PRESETS.filter((p) => p.code !== 'CREDIT' && !config?.paymentMethods.some((m) => m.code === p.code))
  const [caps, setCaps] = useState<Record<string, string>>({})

  const save = useMutation({
    mutationFn: ({ id, data }: { id?: string; data: MethodBody }) =>
      apiClient(`/organizations/me/platform/payment-methods${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-config'] }),
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <section className="space-y-3" aria-labelledby="methods-title">
      <div className="space-y-1">
        <h2 id="methods-title" className="text-lg font-semibold">
          Moyens de paiement acceptés
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)]">La caisse applique d’elle-même les règles de chacun.</p>
      </div>
      <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)]">
        {methods.map((m) => (
          <li key={m.id} className="space-y-2 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium">{m.label}</p>
                {rules(m) && <p className="text-sm text-[var(--color-text-secondary)]">{rules(m)}</p>}
              </div>
              <label className="flex shrink-0 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--color-accent)]"
                  checked={m.isActive}
                  disabled={save.isPending}
                  onChange={(e) => save.mutate({ id: m.id, data: body(m, { isActive: e.target.checked }) })}
                />
                Accepté
              </label>
            </div>
            {m.mealVoucher && m.isActive && (
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const v = (caps[m.code] ?? '').replace(',', '.').trim()
                  save.mutate({ id: m.id, data: body(m, { maxAmount: v === '' ? null : Number(v) }) }, { onSuccess: () => toast.success('Plafond enregistré') })
                }}
              >
                <label className="space-y-1">
                  <span className="block text-sm font-medium">Plafond par ticket (€)</span>
                  <input
                    inputMode="decimal"
                    className="tabular h-11 w-28 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 text-[15px]"
                    value={caps[m.code] ?? (m.maxAmount != null ? String(Number(m.maxAmount)).replace('.', ',') : '')}
                    onChange={(e) => setCaps((c) => ({ ...c, [m.code]: e.target.value }))}
                  />
                </label>
                <button type="submit" disabled={caps[m.code] == null || save.isPending} className="h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-sm font-semibold disabled:opacity-50 press">
                  Enregistrer
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {missing.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {missing.map((p) => (
            <button
              key={p.code}
              type="button"
              disabled={save.isPending}
              onClick={() =>
                save.mutate({
                  data: {
                    code: p.code,
                    label: p.label,
                    kind: p.kind,
                    isActive: true,
                    position: config?.paymentMethods.length ?? 0,
                    mealVoucher: !!p.mealVoucher,
                    giveChange: !!p.giveChange,
                    maxAmount: p.maxAmount ?? null,
                    requiresReference: !!p.requiresReference,
                  },
                })
              }
              className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] px-4 text-sm font-medium press"
            >
              <Plus size={16} aria-hidden /> {p.label}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
