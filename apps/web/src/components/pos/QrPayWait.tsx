'use client'

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { WarningCircle } from '@phosphor-icons/react'
import { formatPrice } from '@erp/utils'
import { paymentsApi, type TerminalPayment } from '@/lib/api/payments'

type View = { kind: 'creating' } | { kind: 'waiting'; payment: TerminalPayment } | { kind: 'failed'; message: string }

// Paiement par QR : le client scanne le code (écran client ou caisse) et paie
// sur son téléphone ; la caisse attend la confirmation du prestataire
export function QrPayWait({
  siteId,
  amount,
  onShow,
  onApproved,
  onBack,
}: {
  siteId: string
  amount: number // euros
  // Ce que montre l'écran client pendant l'attente (null : rien)
  onShow: (qr: { url: string; expiresAt: string | null } | null) => void
  onApproved: (clientSaleId: string) => void
  onBack: () => void
}) {
  const [view, setView] = useState<View>({ kind: 'creating' })
  const [attempt, setAttempt] = useState(0)
  const [svg, setSvg] = useState('')
  const clientSaleId = useRef(crypto.randomUUID())
  const done = useRef(false)

  useEffect(() => {
    let stop = false
    let timer: number | undefined
    setView({ kind: 'creating' })
    const poll = async (id: string) => {
      if (stop) return
      try {
        const p = await paymentsApi.get(siteId, id)
        if (stop) return
        if (p.status === 'SUCCEEDED' && !done.current) {
          done.current = true
          onShow(null)
          onApproved(clientSaleId.current)
          return
        }
        if (p.status === 'FAILED' || p.status === 'CANCELED') {
          onShow(null)
          setView({ kind: 'failed', message: p.failureReason ?? 'Paiement non abouti.' })
          return
        }
      } catch {
        // Réseau instable : on continue d'interroger
      }
      timer = window.setTimeout(() => poll(id), 1500)
    }
    paymentsApi
      .startQr(siteId, { amount: Math.round(amount * 100), clientSaleId: clientSaleId.current })
      .then((p) => {
        if (stop) return
        setView({ kind: 'waiting', payment: p })
        if (p.checkoutUrl) onShow({ url: p.checkoutUrl, expiresAt: p.expiresAt ?? null })
        timer = window.setTimeout(() => poll(p.id), 1500)
      })
      .catch((e: Error) => !stop && setView({ kind: 'failed', message: e.message }))
    return () => {
      stop = true
      window.clearTimeout(timer)
      onShow(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  const payment = view.kind === 'waiting' ? view.payment : null
  useEffect(() => {
    if (!payment?.checkoutUrl) return setSvg('')
    QRCode.toString(payment.checkoutUrl, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#1C1726', light: '#00000000' } })
      .then(setSvg)
      .catch(() => setSvg(''))
  }, [payment?.checkoutUrl])

  const cancel = async () => {
    if (payment) await paymentsApi.cancel(siteId, payment.id).catch(() => {})
    onBack()
  }

  if (view.kind === 'failed') {
    return (
      <div className="space-y-4">
        <p role="alert" className="flex items-start gap-3 rounded-[var(--radius-md)] bg-[var(--color-accent-muted)] p-4 text-[15px] font-medium">
          <WarningCircle size={22} weight="fill" aria-hidden className="mt-px shrink-0" />
          {view.message}
        </p>
        <button type="button" data-autofocus onClick={() => setAttempt((n) => n + 1)} className="h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)]">
          Nouveau QR code
        </button>
        <button type="button" onClick={onBack} className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-[15px] font-medium">
          Autre moyen de paiement
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-4 text-center" role="status" aria-live="polite">
        <div role="img" aria-label="QR code de paiement" className="size-48 rounded-[var(--radius-lg)] bg-white p-3">
          {svg && <div className="size-full [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />}
        </div>
        <p className="tabular text-4xl font-semibold tracking-tight">{formatPrice(amount)}</p>
        <p className="text-[15px] text-[var(--color-text-secondary)]">
          {view.kind === 'creating' ? 'Préparation du QR code…' : 'Le client scanne le code sur l’écran client ou ici, puis paie sur son téléphone.'}
        </p>
      </div>

      {payment?.provider === 'SIMULATOR' && (
        <div className="space-y-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] p-3">
          <p className="text-sm text-[var(--color-text-secondary)]">Paiement de test : donnez la réponse de la banque.</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => paymentsApi.simulate(siteId, payment.id, true)} className="h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-sm font-medium">
              Paiement accepté
            </button>
            <button type="button" onClick={() => paymentsApi.simulate(siteId, payment.id, false)} className="h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-sm font-medium">
              Paiement refusé
            </button>
          </div>
        </div>
      )}

      <button type="button" onClick={() => void cancel()} className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-[15px] font-medium">
        Annuler le QR code
      </button>
    </div>
  )
}
