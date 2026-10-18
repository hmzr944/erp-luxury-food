'use client'

import { useState } from 'react'
import { Check } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { PLAN_OFFERS, type PlanCode } from '@erp/types'
import { billingApi, useBilling } from '@/lib/api/billing'
import { Loading } from '@/components/brand/FlowLogo'

const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

const STATUS_LABEL = {
  TRIALING: "Essai gratuit",
  ACTIVE: 'Abonnement actif',
  PAST_DUE: 'Paiement en attente',
  CANCELED: 'Abonnement arrêté',
} as const

// Abonnement : où on en est, ce que ça coûtera, et un seul bouton pour agir
export function BillingSettings() {
  const { data, isLoading } = useBilling()
  const [going, setGoing] = useState<PlanCode | 'portal' | null>(null)

  const go = async (target: PlanCode | 'portal') => {
    setGoing(target)
    try {
      const { url } = target === 'portal' ? await billingApi.portal() : await billingApi.checkout(target)
      window.location.assign(url)
    } catch (e) {
      toast.error((e as Error).message)
      setGoing(null)
    }
  }

  if (isLoading || !data) return <Loading className="p-8" />

  const owner = data.canManage
  const subscribed = data.status === 'ACTIVE' || data.status === 'PAST_DUE'

  return (
    <div className="max-w-3xl space-y-8 p-6 md:p-8">
      <header className="space-y-1">
        <h1 className="page-title">Abonnement</h1>
        <p className="text-[15px] text-[var(--color-text-secondary)]">
          Sans engagement, résiliable à tout moment. Vos données restent exportables, abonnement ou pas.
        </p>
      </header>

      <section className="space-y-1 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
        <p className="text-sm text-[var(--color-text-secondary)]">{STATUS_LABEL[data.status]}</p>
        {data.status === 'TRIALING' && data.trialEndsAt && (
          <p className="text-xl font-semibold">
            {data.trialDaysLeft ? `${data.trialDaysLeft} ${data.trialDaysLeft > 1 ? 'jours' : 'jour'} restants` : 'Essai terminé'}
            <span className="block text-[15px] font-normal text-[var(--color-text-secondary)]">jusqu&apos;au {day(data.trialEndsAt)}, sans carte bancaire</span>
          </p>
        )}
        {subscribed && (
          <p className="text-xl font-semibold">
            Offre {data.planName}, {data.sites} {data.sites > 1 ? 'boutiques' : 'boutique'}
            {data.currentPeriodEnd && (
              <span className="block text-[15px] font-normal text-[var(--color-text-secondary)]">Prochaine échéance le {day(data.currentPeriodEnd)}</span>
            )}
          </p>
        )}
        {data.status === 'PAST_DUE' && <p className="pt-2 text-[15px] font-medium">Le dernier prélèvement a échoué : mettez à jour la carte pour continuer.</p>}
        {data.access === 'grace' && data.lockAt && (
          <p role="status" className="pt-2 text-[15px] font-medium">
            La caisse reste ouverte jusqu&apos;au {day(data.lockAt)}. Ensuite, elle ne pourra plus commencer de vente sans abonnement.
          </p>
        )}
        {data.access === 'locked' && (
          <p role="status" className="pt-2 text-[15px] font-medium">
            La caisse ne commence plus de vente. Les ventes en attente, les clôtures, les archives et les exports restent accessibles.
          </p>
        )}
        {data.hasPaymentMethod && owner && (
          <button
            type="button"
            onClick={() => go('portal')}
            disabled={going !== null}
            className="mt-3 h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-[15px] font-medium hover:border-[var(--color-accent)]"
          >
            {going === 'portal' ? 'Ouverture...' : 'Factures, carte et résiliation'}
          </button>
        )}
      </section>

      {!subscribed && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Choisir une offre</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {PLAN_OFFERS.map((p) => (
              <div key={p.code} className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
                <p className="text-lg font-semibold">{p.name}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">{p.summary}</p>
                <p className="mt-3">
                  <span className="tabular text-3xl font-semibold">{p.monthlyPrice} €</span>
                  <span className="text-sm text-[var(--color-text-secondary)]"> HT par boutique et par mois</span>
                </p>
                <p className="tabular text-sm text-[var(--color-text-secondary)]">
                  Pour vous : {p.monthlyPrice * Math.max(1, data.sites)} € HT par mois ({data.sites} {data.sites > 1 ? 'boutiques' : 'boutique'})
                </p>
                <ul className="mt-4 flex-1 space-y-1.5 text-[15px]">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check size={18} aria-hidden className="mt-0.5 shrink-0 text-[var(--color-accent)]" />
                      {f}
                    </li>
                  ))}
                </ul>
                {owner ? (
                  <button
                    type="button"
                    disabled={!data.onlinePayment || going !== null}
                    onClick={() => go(p.code)}
                    className="mt-5 h-12 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-[15px] font-semibold text-[var(--color-on-accent)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)]"
                  >
                    {going === p.code ? 'Ouverture du paiement...' : `Souscrire à ${p.name}`}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {!owner && <p className="text-sm text-[var(--color-text-secondary)]">Seul le titulaire du compte peut souscrire.</p>}
          {owner && !data.onlinePayment && (
            <p className="text-sm text-[var(--color-text-secondary)]">
              Le paiement en ligne n&apos;est pas activé sur ce serveur : l&apos;essai continue, rien n&apos;est facturé.
            </p>
          )}
        </section>
      )}
    </div>
  )
}
