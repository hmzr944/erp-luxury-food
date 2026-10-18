'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { CheckCircle, EnvelopeSimple } from '@phosphor-icons/react'
import { receiptUrl, receiptsApi } from '@/lib/receipts'

// Ticket dématérialisé, proposé avant le papier : le client scanne le QR
// code sur l'écran de la caisse, ou reçoit le ticket par e-mail
export function DigitalReceipt({ siteId, clientId, initialEmail }: { siteId: string; clientId: string; initialEmail?: string }) {
  const url = receiptUrl(clientId)
  const [svg, setSvg] = useState('')
  const [email, setEmail] = useState('')
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'sent' | 'error'; message?: string }>(initialEmail ? { kind: 'sent', message: initialEmail } : { kind: 'idle' })

  useEffect(() => {
    QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#1C1726', light: '#00000000' } })
      .then(setSvg)
      .catch(() => setSvg(''))
  }, [url])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const to = email.trim()
    if (!to) return
    setState({ kind: 'busy' })
    // La vente vient d'être signée : elle peut encore être en route vers le serveur
    for (let i = 0; i < 4; i++) {
      try {
        const r = await receiptsApi.email(siteId, clientId, to)
        return setState(r.sent ? { kind: 'sent', message: to } : { kind: 'error', message: r.reason })
      } catch (err) {
        if (i === 3) return setState({ kind: 'error', message: /introuvable/i.test((err as Error).message) ? 'La vente n’est pas encore arrivée au serveur. Réessayez quand la caisse est en ligne.' : (err as Error).message })
        await new Promise((r) => setTimeout(r, 1500))
      }
    }
  }

  return (
    <section aria-label="Ticket dématérialisé" className="flex gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
      <div className="size-28 shrink-0 rounded-[var(--radius-sm)] bg-white p-2" role="img" aria-label="QR code du ticket en ligne">
        {svg && <div className="size-full [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-[15px] font-semibold">Ticket sur le téléphone du client</p>
        <p className="text-sm text-[var(--color-text-secondary)]">À scanner : ticket en PDF, sans papier.</p>
        {state.kind === 'sent' ? (
          <p role="status" className="flex items-center gap-1.5 text-sm font-medium">
            <CheckCircle size={18} weight="fill" aria-hidden className="text-[var(--color-accent)]" /> Envoyé à {state.message}
          </p>
        ) : (
          <form onSubmit={send} className="flex gap-2">
            <input
              type="email"
              inputMode="email"
              autoComplete="off"
              aria-label="E-mail du client"
              placeholder="E-mail du client"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 text-[15px]"
            />
            <button
              type="submit"
              aria-label="Envoyer le ticket par e-mail"
              disabled={state.kind === 'busy' || !email.trim()}
              className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-md)] border border-[var(--color-border-strong)] disabled:opacity-50 press"
            >
              <EnvelopeSimple size={20} aria-hidden />
            </button>
          </form>
        )}
        {state.kind === 'error' && (
          <p role="alert" className="text-sm text-[var(--color-text-secondary)]">
            {state.message}
          </p>
        )}
      </div>
    </section>
  )
}
