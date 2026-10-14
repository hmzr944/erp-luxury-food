'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { FlowPulse } from '@/components/brand/FlowLogo'
import { DeviceMobile, WarningCircle } from '@phosphor-icons/react'
import { formatPrice } from '@erp/utils'
import { paymentsApi, type PaymentDevice, type TerminalPayment } from '@/lib/api/payments'

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
  const clientSaleId = useRef(saleId ?? crypto.randomUUID())
  const done = useRef(false)

  useEffect(() => {
    let stop = false
    let timer: number | undefined
    done.current = false
    setView({ kind: 'sending' })

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

  const cancel = useCallback(async () => {
    if (payment) await paymentsApi.cancel(siteId, payment.id).catch(() => {})
    onBack()
  }, [payment, siteId, onBack])

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
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => paymentsApi.simulate(siteId, payment.id, true)} className="h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-sm font-medium">
              Carte acceptée
            </button>
            <button type="button" onClick={() => paymentsApi.simulate(siteId, payment.id, false)} className="h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-sm font-medium">
              Carte refusée
            </button>
          </div>
        </div>
      )}

      <button type="button" onClick={cancel} className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-[15px] font-medium">
        Annuler
      </button>
      <button
        type="button"
        onClick={async () => {
          if (payment) await paymentsApi.cancel(siteId, payment.id).catch(() => {})
          onPaidElsewhere()
        }}
        className="h-11 w-full text-sm font-medium text-[var(--color-accent)] underline-offset-4 hover:underline">
        Le client a payé sur un autre TPE
      </button>
    </div>
  )
}
