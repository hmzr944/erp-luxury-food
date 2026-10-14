'use client'

import { useEffect, useRef, useState } from 'react'
import { CreditCard, WarningCircle } from '@phosphor-icons/react'
import { formatPrice } from '@erp/utils'
import { FlowPulse } from '@/components/brand/FlowLogo'
import { getBridge, type BridgeTpeConfig, type PaymentResult } from '@/lib/bridge'

interface BridgeTerminalWaitProps {
  config: BridgeTpeConfig
  amount: number // euros
  // Autorisation ou n° de transaction du TPE, gardé sur la vente
  onApproved: (reference?: string) => void
  onPaidElsewhere: () => void
  onBack: () => void
}

type View = { kind: 'waiting'; step?: string } | { kind: 'failed'; message: string }

// TPE bancaire branché sur le réseau de la boutique : FLŌW-Bridge lui envoie
// le montant (Caisse-AP) et rend la réponse de la banque. Fonctionne sans
// Internet, le pont étant sur place.
export function BridgeTerminalWait({ config, amount, onApproved, onPaidElsewhere, onBack }: BridgeTerminalWaitProps) {
  const [view, setView] = useState<View>({ kind: 'waiting' })
  const [attempt, setAttempt] = useState(0)
  const paymentId = useRef<string>('')
  // Un seul envoi au TPE par tentative, même si React rejoue l'effet
  const startedFor = useRef(-1)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    const off = getBridge().on('payment.progress', (p) => {
      if (mounted.current && p.paymentId === paymentId.current) setView({ kind: 'waiting', step: p.message })
    })
    return () => {
      mounted.current = false
      off()
    }
  }, [])

  useEffect(() => {
    if (startedFor.current === attempt) return
    startedFor.current = attempt
    const id = crypto.randomUUID()
    paymentId.current = id
    setView({ kind: 'waiting' })
    const current = () => mounted.current && paymentId.current === id
    getBridge()
      .call('payment.start', {
        adapter: config.adapter,
        amountCents: Math.round(amount * 100),
        currency: 'EUR',
        paymentId: id,
        ...(config.adapter === 'caisse-ap' ? { host: config.host, port: config.port, posNumber: config.posNumber } : {}),
      })
      .then((r: PaymentResult) => {
        if (!current()) return
        if (r.status === 'approved') return onApproved(r.authorizationCode ?? r.transactionId)
        setView({ kind: 'failed', message: r.message ?? (r.status === 'declined' ? 'Paiement refusé.' : r.status === 'cancelled' ? 'Paiement annulé.' : 'Le TPE n’a pas répondu.') })
      })
      .catch((e: Error) => current() && setView({ kind: 'failed', message: e.message }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  const cancel = async () => {
    await getBridge()
      .call('payment.cancel', { paymentId: paymentId.current })
      .catch(() => {})
    onBack()
  }

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
          onClick={() => setAttempt((n) => n + 1)}
          className="h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)] press"
        >
          Renvoyer au TPE
        </button>
        <button type="button" onClick={onBack} className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-[15px] font-medium press">
          Autre moyen de paiement
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-4 py-4 text-center" role="status" aria-live="polite">
        <div className="relative grid size-24 place-items-center rounded-[var(--radius-xl)] bg-[var(--color-accent-muted)]">
          <FlowPulse size={40} />
          <CreditCard size={22} aria-hidden className="absolute -bottom-1 -right-1 rounded-full bg-[var(--color-bg-surface)] p-0.5 text-[var(--color-accent)]" />
        </div>
        <p className="tabular text-4xl font-semibold tracking-tight">{formatPrice(amount)}</p>
        <p className="text-[15px] text-[var(--color-text-secondary)]">{view.step ?? 'Le client paie sur le TPE.'}</p>
      </div>
      <button type="button" onClick={cancel} className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-[15px] font-medium press">
        Annuler
      </button>
      <button
        type="button"
        onClick={async () => {
          await getBridge()
            .call('payment.cancel', { paymentId: paymentId.current })
            .catch(() => {})
          onPaidElsewhere()
        }}
        className="h-11 w-full text-sm font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
      >
        Le client a payé sur un autre TPE
      </button>
    </div>
  )
}
