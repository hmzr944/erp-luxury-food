'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { orgSettingsApi } from '@/lib/api/invoices'
import { useAuthStore } from '@/stores/auth.store'
import { PrinterDevice } from './PrinterDevice'

type Policy = 'ASK' | 'ALWAYS' | 'NEVER'

const POLICIES: Array<{ key: Policy; label: string; hint: string }> = [
  { key: 'ASK', label: 'Sur demande', hint: 'Le ticket papier est proposé, imprimé si le client le souhaite (loi AGEC).' },
  { key: 'ALWAYS', label: 'Toujours', hint: 'Chaque vente imprime son ticket.' },
  { key: 'NEVER', label: 'Jamais d’office', hint: 'Ticket imprimé uniquement d’un geste, ou envoyé par e-mail.' },
]

// Impression : l'imprimante de cet appareil, et les règles du ticket pour
// tout le commerce (ticket sur demande, note de service, pied de ticket)
export function PrintingSettings() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const owner = user?.role === 'OWNER'
  const { data } = useQuery({ queryKey: ['org-settings'], queryFn: orgSettingsApi.get, enabled: owner })
  const [form, setForm] = useState({ receiptPolicy: 'ASK' as Policy, serviceNote: false, receiptFooter: '' })
  useEffect(() => {
    if (data) setForm({ receiptPolicy: (data.receiptPolicy ?? 'ASK') as Policy, serviceNote: !!data.serviceNote, receiptFooter: data.receiptFooter ?? '' })
  }, [data])

  const save = useMutation({
    mutationFn: () => orgSettingsApi.save({ receiptPolicy: form.receiptPolicy, serviceNote: form.serviceNote, receiptFooter: form.receiptFooter.trim() || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['org-settings'] })
      void qc.invalidateQueries({ queryKey: ['platform-config'] })
      toast.success('Règles du ticket enregistrées')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="max-w-3xl space-y-8 p-4 md:p-8">
      <header>
        <h1 className="page-title">Impression</h1>
        <p className="mt-1 text-[15px] text-[var(--color-text-secondary)]">Ticket de caisse, note de service et tiroir-caisse.</p>
      </header>

      <section aria-labelledby="device-title" className="space-y-4">
        <div>
          <h2 id="device-title" className="font-display text-xl font-semibold tracking-tight">Cet appareil</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">Chaque caisse garde son imprimante : réglez-la depuis la caisse elle-même.</p>
        </div>
        <PrinterDevice />
      </section>

      {owner && (
        <section aria-labelledby="ticket-title" className="space-y-4">
          <h2 id="ticket-title" className="font-display text-xl font-semibold tracking-tight">Le ticket</h2>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold">Ticket papier</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {POLICIES.map((p) => (
                <label
                  key={p.key}
                  className={[
                    'flex cursor-pointer flex-col rounded-[var(--radius-md)] border p-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--color-accent)]',
                    form.receiptPolicy === p.key ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)]' : 'border-[var(--color-border-strong)]',
                  ].join(' ')}
                >
                  <input type="radio" name="policy" className="sr-only" checked={form.receiptPolicy === p.key} onChange={() => setForm({ ...form, receiptPolicy: p.key })} />
                  <span className="text-[15px] font-semibold">{p.label}</span>
                  <span className="text-sm text-[var(--color-text-secondary)]">{p.hint}</span>
                </label>
              ))}
            </div>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Toujours imprimés d’office : les articles numérotés (garantie légale) et les notes de service.
            </p>
          </fieldset>
          <label className="flex items-start gap-3 text-[15px]">
            <input type="checkbox" className="mt-0.5 size-5 accent-[var(--color-accent)]" checked={form.serviceNote} onChange={(e) => setForm({ ...form, serviceNote: e.target.checked })} />
            <span>
              Note de service à partir de 25 € TTC
              <span className="block text-sm text-[var(--color-text-secondary)]">Restauration, coiffure, retouches, prestations : la note est imprimée en deux exemplaires, le double reste au commerce.</span>
            </span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Pied de ticket</span>
            <textarea
              rows={2}
              maxLength={300}
              value={form.receiptFooter}
              onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })}
              placeholder="Échange sous 30 jours sur présentation du ticket"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 py-2 text-[15px]"
            />
          </label>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="h-11 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 text-[15px] font-semibold text-[var(--color-on-accent)] press disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)]"
          >
            {save.isPending ? 'Enregistrement' : 'Enregistrer'}
          </button>
        </section>
      )}
    </div>
  )
}
