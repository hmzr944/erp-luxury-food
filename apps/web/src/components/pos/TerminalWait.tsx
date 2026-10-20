'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { FlowPulse } from '@/components/brand/FlowLogo'
import { DeviceMobile, WarningCircle } from '@phosphor-icons/react'
import { formatPrice } from '@erp/utils'
import { useAuthStore } from '@/stores/auth.store'
import { cancelPayment, paymentsApi, type PaymentDevice, type TerminalPayment } from '@/lib/api/payments'

interface TerminalWaitProps {
  siteId: string
  device: PaymentDevice
  amount: number // euros
  // Vente déjà commencée (note divisée) : les parts gardent le même identifiant
  clientSaleId?: string
  onApproved: (clientSaleId: string) => void
  onPaidElsewhere: () => void
  onBack: () => void
}

type View =
  | { kind: 'sending' }
  | { kind: 'waiting'; payment: TerminalPayment }
  | { kind: 'failed'; message: string; busy?: boolean }

// Le montant part au TPE, la caisse attend la réponse de la banque et ferme
// la vente d'elle-même : rien à retaper sur le TPE, aucun écart de caisse
export function TerminalWait({ siteId, device, amount, clientSaleId: saleId, onApproved, onPaidElsewhere, onBack }: TerminalWaitProps) {
  const [view, setView] = useState<View>({ kind: 'sending' })
  const [attempt, setAttempt] = useState({ n: 0, force: false })
  // Annulation que le terminal n'a pas confirmée : le paiement reste en cours
  // La simulation d'un paiement est réservée aux responsables (refusée par le serveur sinon)
  const role = useAuthStore((st) => st.user?.role)
  const canSimulate = role === 'OWNER' || role === 'MANAGER'
  const [cancelIssue, setCancelIssue] = useState<string | null>(null)
  const clientSaleId = useRef(saleId ?? crypto.randomUUID())
  const done = useRef(false)

  useEffect(() => {
    let stop = false
    let timer: number | undefined
    done.current = false
    setView({ kind: 'sending' })
    setCancelIssue(null)

    const poll = async (id: string) => {
      if (stop) return
      try {
        const p = await paymentsApi.get(siteId, id)
        if (stop) return
        if (p.status === 'SUCCEEDED' && !done.current) {
          done.current = true
          onApproved(clientSaleId.current)
          return
        }
        if (p.status === 'FAILED' || p.status === 'CANCELED') {
          setView({ kind: 'failed', message: p.status === 'CANCELED' ? 'Paiement annulé.' : (p.failureReason ?? 'Paiement refusé.') })
          return
        }
        setView({ kind: 'waiting', payment: p })
      } catch {
        // Réseau instable : on continue d'interroger
      }
      timer = window.setTimeout(() => poll(id), 1000)
    }

    paymentsApi
      .start(siteId, { deviceId: device.id, amount: Math.round(amount * 100), clientSaleId: clientSaleId.current, force: attempt.force })
      .then((p) => {
        if (stop) return
        setView({ kind: 'waiting', payment: p })
        timer = window.setTimeout(() => poll(p.id), 1000)
      })
      .catch((e: Error) => !stop && setView({ kind: 'failed', message: e.message, busy: /attend déjà/.test(e.message) }))

    return () => {
      stop = true
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  const payment = view.kind === 'waiting' ? view.payment : null

  // Quitte l'attente seulement si le paiement est bien clos. Sinon la caisse
  // reste ici et continue d'interroger : le client a pu payer entre-temps.
  const closePayment = useCallback(
    async (leave: () => void) => {
      if (!payment) return leave()
      const r = await cancelPayment(siteId, payment.id)
      if (r.done) return leave()
      setCancelIssue(r.message ?? null)
    },
    [payment, siteId],
  )
  const cancel = useCallback(() => closePayment(onBack), [closePayment, onBack])

  const check = useCallback(async () => {
    if (!payment) return
    try {
      const p = await paymentsApi.get(siteId, payment.id)
      if (p.status === 'SUCCEEDED' && !done.current) {
        done.current = true
        onApproved(clientSaleId.current)
      } else if (p.status === 'FAILED' || p.status === 'CANCELED') {
        setCancelIssue(null)
        setView({ kind: 'failed', message: p.status === 'CANCELED' ? 'Paiement annulé.' : (p.failureReason ?? 'Paiement refusé.') })
      } else {
        setCancelIssue('Le paiement est toujours en attente sur le TPE. Regardez son écran avant de réessayer.')
      }
    } catch {
      setCancelIssue('Impossible de lire l’état du paiement pour le moment : vérifiez sur le TPE.')
    }
  }, [payment, siteId, onApproved])

  if (view.kind === 'failed') {
    return (
      <div className="space-y-4">
        <p role="alert" className="flex items-start gap-3 rounded-[var(--radius-md)] bg-[var(--color-accent-muted)] p-4 text-[15px] font-medium">
          <WarningCircle size={22} weight="fill" aria-hidden className="mt-px shrink-0" />
          {view.message}
        </p>
        <button
          type="button"
          data-autofocus
          onClick={() => setAttempt((a) => ({ n: a.n + 1, force: !!view.busy }))}
          className="h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)]"
        >
          {view.busy ? 'Libérer le TPE et renvoyer' : 'Renvoyer au TPE'}
        </button>
        <button type="button" onClick={onBack} className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-[15px] font-medium">
          Autre moyen de paiement
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-4 py-4 text-center" role="status" aria-live="polite">
        {/* Le pouls FLŌW bat tant que le client paie sur le terminal */}
        <div className="relative grid size-24 place-items-center rounded-[var(--radius-xl)] bg-[var(--color-accent-muted)]">
          <FlowPulse size={40} />
          <DeviceMobile size={22} aria-hidden className="absolute -bottom-1 -right-1 rounded-full bg-[var(--color-bg-surface)] p-0.5 text-[var(--color-accent)]" />
        </div>
        <p className="tabular text-4xl font-semibold tracking-tight">{formatPrice(amount)}</p>
        <p className="text-[15px] text-[var(--color-text-secondary)]">
          {view.kind === 'sending' ? `Envoi à « ${device.name} »...` : `Le client paie sur « ${device.name} ».`}
        </p>
      </div>

      {device.provider === 'SIMULATOR' && payment && (
        <div className="space-y-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] p-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            TPE virtuel : répondez ici, ou{' '}
            <Link href={`/tpe/${siteId}/${device.id}`} target="_blank" className="font-medium text-[var(--color-accent)] underline underline-offset-4">
              ouvrez-le sur un autre appareil
            </Link>
            .
          </p>
          {!canSimulate && <p className="text-sm font-medium">Seul un responsable peut répondre à la place du TPE virtuel.</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={!canSimulate} onClick={() => paymentsApi.simulate(siteId, payment.id, true)} className="h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-sm font-medium disabled:opacity-40">
              Carte acceptée
            </button>
            <button type="button" disabled={!canSimulate} onClick={() => paymentsApi.simulate(siteId, payment.id, false)} className="h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-sm font-medium disabled:opacity-40">
              Carte refusée
            </button>
          </div>
        </div>
      )}

      {cancelIssue && (
        <div role="alert" className="space-y-3 rounded-[var(--radius-md)] bg-[var(--color-accent-muted)] p-4">
          <p className="flex items-start gap-3 text-[15px] font-medium">
            <WarningCircle size={22} weight="fill" aria-hidden className="mt-px shrink-0" />
            {cancelIssue}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void check()} className="h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-sm font-medium">
              Vérifier le paiement
            </button>
            <button type="button" onClick={() => void cancel()} className="h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-sm font-medium">
              Réessayer l’annulation
            </button>
          </div>
        </div>
      )}
      <button type="button" onClick={() => void cancel()} className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-[15px] font-medium">
        Annuler
      </button>
      <button
        type="button"
        onClick={() => void closePayment(onPaidElsewhere)}
        className="h-11 w-full text-sm font-medium text-[var(--color-accent)] underline-offset-4 hover:underline">
        Le client a payé sur un autre TPE
      </button>
    </div>
  )
}
