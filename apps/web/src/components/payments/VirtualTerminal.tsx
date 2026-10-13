'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle } from '@phosphor-icons/react'
import { formatPrice } from '@erp/utils'
import { paymentsApi, type TerminalPayment } from '@/lib/api/payments'

// Un téléphone ou une tablette joue le rôle du TPE : il reçoit le montant
// envoyé par la caisse, le client « paie » d'un geste. Pour essayer et former
// l'équipe sans matériel ni frais.
export function VirtualTerminal({ siteId, deviceId }: { siteId: string; deviceId: string }) {
  const [payment, setPayment] = useState<TerminalPayment | null>(null)
  const [result, setResult] = useState<'approved' | 'declined' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stop = false
    const tick = async () => {
      try {
        const p = await paymentsApi.pending(siteId, deviceId)
        if (!stop) {
          setPayment(p)
          setError(null)
        }
      } catch (e) {
        if (!stop) setError((e as Error).message)
      }
    }
    void tick()
    const t = window.setInterval(tick, 1000)
    return () => {
      stop = true
      window.clearInterval(t)
    }
  }, [siteId, deviceId])

  const answer = async (approve: boolean) => {
    if (!payment) return
    await paymentsApi.simulate(siteId, payment.id, approve).catch((e: Error) => setError(e.message))
    setResult(approve ? 'approved' : 'declined')
    setPayment(null)
    window.setTimeout(() => setResult(null), 2500)
  }

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 bg-[var(--color-bg-base)] px-6 text-center text-[var(--color-text-primary)]">
      <p className="text-sm font-medium text-[var(--color-text-secondary)]">TPE virtuel, sans argent réel</p>

      {result ? (
        <div role="status" className="flex flex-col items-center gap-3">
          {result === 'approved' ? (
            <CheckCircle size={72} weight="fill" className="text-[var(--color-accent)]" aria-hidden />
          ) : (
            <XCircle size={72} weight="fill" aria-hidden />
          )}
          <p className="text-2xl font-semibold">{result === 'approved' ? 'Paiement accepté' : 'Paiement refusé'}</p>
        </div>
      ) : payment ? (
        <div className="w-full max-w-xs space-y-8">
          <div>
            <p className="text-[15px] text-[var(--color-text-secondary)]">Montant à payer</p>
            <p className="tabular mt-1 text-5xl font-semibold tracking-tight">{formatPrice(payment.amount / 100)}</p>
          </div>
          <button
            type="button"
            onClick={() => answer(true)}
            className="h-20 w-full rounded-[var(--radius-lg)] bg-[var(--color-accent)] text-xl font-semibold text-[var(--color-on-accent)] active:scale-[0.98]"
          >
            Présenter la carte
          </button>
          <button type="button" onClick={() => answer(false)} className="h-12 w-full text-[15px] font-medium text-[var(--color-text-secondary)]">
            Simuler un refus
          </button>
        </div>
      ) : (
        <p className="text-xl text-[var(--color-text-secondary)]" role="status">
          En attente d&apos;un montant de la caisse.
        </p>
      )}

      {error && <p role="alert" className="text-sm font-medium">{error}</p>}
    </main>
  )
}
