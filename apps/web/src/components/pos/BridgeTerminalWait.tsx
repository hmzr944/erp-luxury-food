'use client'

import { useEffect, useRef, useState } from 'react'
import { CreditCard, WarningCircle } from '@phosphor-icons/react'
import { formatPrice } from '@erp/utils'
import { FlowPulse } from '@/components/brand/FlowLogo'
import { CANCEL_UNCONFIRMED_MESSAGE } from '@/lib/api/payments'
import { BridgeCallError, getBridge, type BridgeTpeConfig, type PaymentResult } from '@/lib/bridge'

interface BridgeTerminalWaitProps {
  config: BridgeTpeConfig
  amount: number // euros
  // Autorisation ou n° de transaction du TPE, gardé sur la vente
  onApproved: (reference?: string) => void
  onPaidElsewhere: () => void
  onBack: () => void
}

type View =
  | { kind: 'waiting'; step?: string; cancelling?: boolean; issue?: string }
  | { kind: 'failed'; message: string; uncertain?: boolean }

// Paiement envoyé au TPE et pas encore conclu : gardé sur l'appareil pour
// retrouver son issue après un rechargement ou une coupure, au lieu de
// renvoyer le montant au TPE (double débit)
const PENDING_KEY = 'flow-tpe-en-cours'
const PENDING_TTL_MS = 10 * 60_000
type Pending = { paymentId: string; amountCents: number; at: number }
const readPending = (amountCents: number): Pending | null => {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null') as Pending | null
    return p && p.amountCents === amountCents && Date.now() - p.at < PENDING_TTL_MS ? p : null
  } catch {
    return null
  }
}
const writePending = (p: Pending | null) => {
  try {
    if (p) localStorage.setItem(PENDING_KEY, JSON.stringify(p))
    else localStorage.removeItem(PENDING_KEY)
  } catch {
    // stockage indisponible : la reprise après rechargement ne sera pas possible
  }
}

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

  const amountCents = Math.round(amount * 100)

  // Issue finale d'un paiement : la vente se ferme ou l'écran d'échec s'affiche
  const settle = (id: string, r: PaymentResult) => {
    if (!mounted.current || paymentId.current !== id) return
    writePending(null)
    if (r.status === 'approved') return onApproved(r.authorizationCode ?? r.transactionId)
    setView({ kind: 'failed', message: r.message ?? (r.status === 'declined' ? 'Paiement refusé.' : r.status === 'cancelled' ? 'Paiement annulé.' : 'Le TPE n’a pas répondu.') })
  }

  // Liaison perdue avec le pont pendant le paiement : on lui demande l'issue
  // (le TPE a pu accepter la carte entre-temps)
  const recover = async (id: string) => {
    for (let i = 0; i < 90 && mounted.current && paymentId.current === id; i++) {
      try {
        const st = await getBridge().call('payment.status', { paymentId: id })
        if (st.state === 'done' && st.result) return settle(id, st.result)
        if (st.state === 'unknown') break
        setView({ kind: 'waiting', step: 'Paiement toujours en cours sur le TPE.' })
      } catch {
        setView({ kind: 'waiting', step: 'Liaison avec FLŌW-Bridge perdue, nouvelle tentative...' })
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
    if (!mounted.current || paymentId.current !== id) return
    setView({
      kind: 'failed',
      uncertain: true,
      message: 'Issue du paiement inconnue. Regardez l’écran ou le ticket du TPE avant de renvoyer le montant.',
    })
  }

  useEffect(() => {
    if (startedFor.current === attempt) return
    startedFor.current = attempt
    // Premier affichage : un paiement de ce montant était peut-être déjà en cours
    const previous = attempt === 0 ? readPending(amountCents) : null
    if (previous) {
      paymentId.current = previous.paymentId
      setView({ kind: 'waiting', step: 'Reprise du paiement en cours...' })
      void recover(previous.paymentId)
      return
    }
    const id = crypto.randomUUID()
    paymentId.current = id
    writePending({ paymentId: id, amountCents, at: Date.now() })
    setView({ kind: 'waiting', step: 'Connexion au TPE...' })
    const bridge = getBridge()
    bridge
      .whenReady()
      .then(() => {
        if (mounted.current && paymentId.current === id) setView({ kind: 'waiting' })
        return bridge.call('payment.start', {
          adapter: config.adapter,
          amountCents,
          currency: 'EUR',
          paymentId: id,
          ...(config.adapter === 'caisse-ap' ? { host: config.host, port: config.port, posNumber: config.posNumber } : {}),
        })
      })
      .then((r: PaymentResult) => settle(id, r))
      .catch((e: Error) => {
        // Liaison coupée ou pont muet pendant le paiement : issue à retrouver.
        // Sinon la demande n'est jamais partie au TPE (pont absent, refus du pont).
        if (e instanceof BridgeCallError && (e.code === 'disconnected' || e.code === 'timeout')) return void recover(id)
        if (!mounted.current || paymentId.current !== id) return
        writePending(null)
        setView({ kind: 'failed', message: e.message })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  // Le TPE Caisse-AP ne s'annule pas à distance : on le dit, et on attend
  // sa réponse (le client a pu payer quand même). Si le pont ne répond pas,
  // l'annulation n'est pas confirmée : le paiement reste en cours, on le dit
  // et on propose de vérifier ou de réessayer.
  const tryCancel = async (): Promise<'accepted' | 'refused' | 'unconfirmed'> => {
    const id = paymentId.current
    try {
      const r = await getBridge().call('payment.cancel', { paymentId: id })
      return r.accepted ? 'accepted' : 'refused'
    } catch {
      if (mounted.current && paymentId.current === id) setView({ kind: 'waiting', issue: CANCEL_UNCONFIRMED_MESSAGE })
      return 'unconfirmed'
    }
  }

  const cancel = async () => {
    const id = paymentId.current
    const r = await tryCancel()
    if (r === 'accepted') {
      writePending(null)
      return onBack()
    }
    if (r === 'refused' && paymentId.current === id) setView({ kind: 'waiting', cancelling: true, step: 'Annulez sur le TPE (touche rouge). La caisse attend sa réponse.' })
  }

  // Une seule lecture de l'état chez le pont, sans attendre : le TPE a pu accepter la carte
  const check = async () => {
    const id = paymentId.current
    try {
      const st = await getBridge().call('payment.status', { paymentId: id })
      if (st.state === 'done' && st.result) return settle(id, st.result)
      setView({ kind: 'waiting', issue: 'Le paiement est toujours en cours sur le TPE. Regardez son écran avant de réessayer.' })
    } catch {
      setView({ kind: 'waiting', issue: 'Liaison avec FLŌW-Bridge impossible pour le moment : vérifiez sur le TPE.' })
    }
  }

  const paidOnTerminal = () => {
    writePending(null)
    onPaidElsewhere()
  }

  if (view.kind === 'failed') {
    return (
      <div className="space-y-4">
        <p role="alert" className="flex items-start gap-3 rounded-[var(--radius-md)] bg-[var(--color-accent-muted)] p-4 text-[15px] font-medium">
          <WarningCircle size={22} weight="fill" aria-hidden className="mt-px shrink-0" />
          {view.message}
        </p>
        {view.uncertain && (
          <button
            type="button"
            onClick={paidOnTerminal}
            className="h-14 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-[15px] font-semibold press"
          >
            Le TPE a accepté : enregistrer la vente
          </button>
        )}
        <button
          type="button"
          data-autofocus
          onClick={() => {
            writePending(null)
            setAttempt((n) => n + 1)
          }}
          className="h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)] press"
        >
          Renvoyer au TPE
        </button>
        <button
          type="button"
          onClick={() => {
            writePending(null)
            onBack()
          }}
          className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-[15px] font-medium press">
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
      {view.issue && (
        <div role="alert" className="space-y-3 rounded-[var(--radius-md)] bg-[var(--color-accent-muted)] p-4">
          <p className="flex items-start gap-3 text-[15px] font-medium">
            <WarningCircle size={22} weight="fill" aria-hidden className="mt-px shrink-0" />
            {view.issue}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void check()} className="h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-sm font-medium press">
              Vérifier le paiement
            </button>
            <button type="button" onClick={() => void cancel()} className="h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-sm font-medium press">
              Réessayer l’annulation
            </button>
          </div>
        </div>
      )}
      {!view.cancelling && (
        <button type="button" onClick={cancel} className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-[15px] font-medium press">
          Annuler
        </button>
      )}
      <button
        type="button"
        onClick={async () => {
          // Sans confirmation d'annulation, le TPE peut encore débiter : on ne conclut pas
          if ((await tryCancel()) !== 'unconfirmed') paidOnTerminal()
        }}
        className="h-11 w-full text-sm font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
      >
        Le client a payé sur un autre TPE
      </button>
    </div>
  )
}
