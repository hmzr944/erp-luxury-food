'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatPrice } from '@erp/utils'
import { customersApi, type LoyaltySettings as Rules } from '@/lib/api/customers'
import { Loading } from '@/components/brand/FlowLogo'
import { LoyaltyCustomers } from './LoyaltyCustomers'

const field = 'tabular h-11 w-28 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 text-right text-[15px]'
const num = (v: string) => Number(v.replace(',', '.'))

// Fidélité et cartes cadeaux : inclus dans tous les forfaits, réglés en trois chiffres
export function LoyaltySettings() {
  const qc = useQueryClient()
  const rules = useQuery({ queryKey: ['loyalty'], queryFn: customersApi.loyalty })
  const [form, setForm] = useState({ pointsPerEuro: '', threshold: '', reward: '', months: '' })

  useEffect(() => {
    if (rules.data) {
      setForm({
        pointsPerEuro: String(rules.data.pointsPerEuro).replace('.', ','),
        threshold: String(rules.data.threshold),
        reward: String(rules.data.reward).replace('.', ','),
        months: rules.data.giftCardMonths ? String(rules.data.giftCardMonths) : '',
      })
    }
  }, [rules.data])

  const save = async (body: Partial<Rules>) => {
    try {
      qc.setQueryData(['loyalty'], await customersApi.updateLoyalty(body))
      toast.success('Réglage enregistré')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const r = rules.data
  if (!r) return <Loading />
  const spend = num(form.pointsPerEuro) > 0 ? num(form.threshold) / num(form.pointsPerEuro) : 0

  return (
    <div className="max-w-3xl space-y-6 p-6 md:p-8">
      <header>
        <h1 className="page-title">Fidélité et cartes cadeaux</h1>
        <p className="text-[15px] text-[var(--color-text-secondary)]">
          Inclus dans votre abonnement. Le client est retrouvé par son téléphone ou son e-mail, sans carte à imprimer ni application à installer.
        </p>
      </header>

      <section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={r.enabled} onChange={(e) => save({ enabled: e.target.checked })} className="mt-1 size-5 accent-[var(--color-accent)]" />
          <span>
            <span className="block text-[16px] font-semibold">Programme de fidélité</span>
            <span className="block text-[15px] text-[var(--color-text-secondary)]">
              En caisse, « Ajouter un client fidélité » apparaît sur la vente. Les points se gagnent sur ce qui est payé, cartes cadeaux exclues.
            </span>
          </span>
        </label>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void save({ pointsPerEuro: num(form.pointsPerEuro), threshold: Math.round(num(form.threshold)), reward: num(form.reward) })
          }}
        >
          <Row label="Points gagnés par euro" htmlFor="ppe">
            <input id="ppe" inputMode="decimal" value={form.pointsPerEuro} onChange={(e) => setForm({ ...form, pointsPerEuro: e.target.value })} className={field} />
          </Row>
          <Row label="Points pour une récompense" htmlFor="thr">
            <input id="thr" inputMode="numeric" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} className={field} />
          </Row>
          <Row label="Récompense offerte (€)" htmlFor="rew">
            <input id="rew" inputMode="decimal" value={form.reward} onChange={(e) => setForm({ ...form, reward: e.target.value })} className={field} />
          </Row>
          {spend > 0 && num(form.reward) > 0 && (
            <p className="text-[15px] text-[var(--color-text-secondary)]">
              Soit {formatPrice(num(form.reward))} offerts tous les {formatPrice(spend)} d&apos;achats ({((num(form.reward) / spend) * 100).toFixed(1).replace('.', ',')} % rendus au client).
            </p>
          )}
          <button type="submit" className="h-11 rounded-[var(--radius-pill)] bg-[var(--color-bg-inverse)] px-5 text-sm font-semibold text-[var(--color-text-inverse)]">
            Enregistrer
          </button>
        </form>
      </section>

      <LoyaltyCustomers />

      <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
        <h2 className="text-[16px] font-semibold">Cartes cadeaux</h2>
        <p className="text-[15px] text-[var(--color-text-secondary)]">
          Vendues depuis la tuile « Carte cadeau » de la caisse, de 1 à 1 500 €. Le code est imprimé sur le ticket ; la carte se dépense en une ou plusieurs fois avec le moyen « Carte cadeau ».
        </p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void save({ giftCardMonths: form.months.trim() ? Math.round(num(form.months)) : null })
          }}
        >
          <Row label="Validité en mois (vide : sans limite)" htmlFor="months">
            <input id="months" inputMode="numeric" value={form.months} onChange={(e) => setForm({ ...form, months: e.target.value })} className={field} />
          </Row>
          <button type="submit" className="h-11 rounded-[var(--radius-pill)] bg-[var(--color-bg-inverse)] px-5 text-sm font-semibold text-[var(--color-text-inverse)]">
            Enregistrer
          </button>
        </form>
        <p className="text-sm text-[var(--color-text-muted)]">
          Vente sans TVA comme bon à usages multiples, la TVA étant due lors de l&apos;utilisation : traitement à faire confirmer par votre expert-comptable.
        </p>
      </section>
    </div>
  )
}

function Row({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={htmlFor} className="text-[15px]">
        {label}
      </label>
      {children}
    </div>
  )
}
