'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CreditCard, Money, Ticket as TicketIcon, Bank, Wallet, CloudCheck, CloudSlash } from '@phosphor-icons/react'
import { formatPrice } from '@erp/utils'
import { PaymentKind } from '@erp/types'
import type { PlatformConfig } from '@/lib/api/platform'
import type { PaymentDevice } from '@/lib/api/payments'
import { db } from '@/lib/offline/db'
import type { RecordedSale } from '@/lib/terminal/terminal'
import type { CartLine } from '@/stores/cart.store'
import { EASE, Sheet } from './Sheet'
import { TerminalWait } from './TerminalWait'

const KIND_ICON: Record<PaymentKind, React.ElementType> = {
  [PaymentKind.CARD]: CreditCard,
  [PaymentKind.CASH]: Money,
  [PaymentKind.VOUCHER]: TicketIcon,
  [PaymentKind.TRANSFER]: Bank,
  [PaymentKind.OTHER]: Wallet,
}

type Method = PlatformConfig['paymentMethods'][number]

export interface ReceiptView {
  sale: RecordedSale
  lines: CartLine[]
  payments: Array<{ label: string; amount: number }>
}

interface PaymentSheetProps {
  open: boolean
  siteId: string
  // TPE connecté de cette caisse : la carte y est encaissée automatiquement
  device: PaymentDevice | null
  total: number
  methods: Method[]
  siteName: string
  receipt: ReceiptView | null
  busy: boolean
  error: string | null
  onPay: (payments: Array<{ code: string; amount: number }>, email?: string, clientId?: string) => void
  onClose: () => void
}

export function PaymentSheet({ open, siteId, device, total, methods, siteName, receipt, busy, error, onPay, onClose }: PaymentSheetProps) {
  const [split, setSplit] = useState(false)
  const [terminal, setTerminal] = useState<Method | null>(null)
  const [email, setEmail] = useState('')
  const [showEmail, setShowEmail] = useState(false)

  useEffect(() => {
    if (!open) {
      setSplit(false)
      setTerminal(null)
      setEmail('')
      setShowEmail(false)
    }
  }, [open])

  const title = receipt
    ? 'Vente enregistrée'
    : terminal
      ? 'Paiement sur le TPE'
      : split
        ? 'Paiement en plusieurs fois'
        : `Encaisser ${formatPrice(total)}`

  // Carte + TPE connecté + réseau : le montant part au TPE. Sinon, TPE autonome.
  const choose = (m: Method) => {
    if (m.kind === PaymentKind.CARD && device && navigator.onLine) return setTerminal(m)
    onPay([{ code: m.code, amount: total }], mail)
  }
  const mail = email.trim() || undefined

  return (
    // Pendant l'attente du TPE, on ne ferme qu'en annulant : sinon le client
    // pourrait payer sans que la vente soit enregistrée
    <Sheet open={open} title={title} onClose={onClose} locked={busy || (!!terminal && !receipt)}>
      {receipt ? (
        <Receipt receipt={receipt} siteName={siteName} onNext={onClose} />
      ) : terminal && device ? (
        <>
          {error && (
            // Paiement accepté mais vente non enregistrée : à ne jamais perdre de vue
            <p role="alert" className="mb-4 rounded-[var(--radius-md)] bg-[var(--color-accent-muted)] p-3 text-sm font-medium">
              Paiement accepté, mais la vente n&apos;a pas pu être enregistrée : {error}
            </p>
          )}
          <TerminalWait
            siteId={siteId}
            device={device}
            amount={total}
            onApproved={(clientId) => onPay([{ code: terminal.code, amount: total }], mail, clientId)}
            onPaidElsewhere={() => onPay([{ code: terminal.code, amount: total }], mail)}
            onBack={() => setTerminal(null)}
          />
        </>
      ) : split ? (
        <SplitPayment total={total} methods={methods} busy={busy} onPay={(p) => onPay(p, mail)} onBack={() => setSplit(false)} />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">Touchez le moyen de paiement pour valider.</p>
          <ul className="grid grid-cols-2 gap-2">
            {methods.map((m) => {
              const Icon = KIND_ICON[m.kind] ?? Wallet
              return (
                <li key={m.code}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => choose(m)}
                    className="flex h-20 w-full flex-col items-start justify-between rounded-[var(--radius-md)] border border-[var(--color-border-strong)] p-3 text-left transition-[transform,border-color] duration-150 hover:border-[var(--color-accent)] active:scale-[0.98] disabled:opacity-50"
                  >
                    <Icon size={22} aria-hidden />
                    <span className="text-[15px] font-semibold">{m.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          {error && (
            <p role="alert" className="rounded-[var(--radius-md)] bg-[var(--color-accent-muted)] p-3 text-sm font-medium">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-x-4">
            {methods.length > 1 && (
              <button type="button" onClick={() => setSplit(true)} className="h-11 text-sm font-medium text-[var(--color-accent)] underline-offset-4 hover:underline">
                Payer avec plusieurs moyens
              </button>
            )}
            {!showEmail && (
              <button type="button" onClick={() => setShowEmail(true)} className="h-11 text-sm font-medium text-[var(--color-accent)] underline-offset-4 hover:underline">
                Ticket par e-mail
              </button>
            )}
          </div>

          {showEmail && (
            <div className="space-y-2">
              <label htmlFor="receipt-email" className="block text-sm font-medium">
                E-mail du client
              </label>
              <input
                id="receipt-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-4 text-base focus:border-[var(--color-accent)] focus:outline-none"
              />
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}

function SplitPayment({
  total,
  methods,
  busy,
  onPay,
  onBack,
}: {
  total: number
  methods: Method[]
  busy: boolean
  onPay: (payments: Array<{ code: string; amount: number }>) => void
  onBack: () => void
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const cents = (v: string | undefined) => Math.round(Number((v ?? '').replace(',', '.')) * 100) || 0
  const paid = Object.values(amounts).reduce((a, v) => a + cents(v), 0)
  const remaining = Math.round(total * 100) - paid

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {methods.map((m) => (
          <li key={m.code} className="flex items-center gap-3">
            <label htmlFor={`pay-${m.code}`} className="flex-1 text-[15px] font-medium">
              {m.label}
            </label>
            <button
              type="button"
              onClick={() => setAmounts((a) => ({ ...a, [m.code]: ((cents(a[m.code]) + Math.max(remaining, 0)) / 100).toFixed(2) }))}
              disabled={remaining <= 0}
              className="h-11 rounded-[var(--radius-pill)] px-3 text-sm text-[var(--color-accent)] disabled:opacity-40"
            >
              Le reste
            </button>
            <input
              id={`pay-${m.code}`}
              inputMode="decimal"
              value={amounts[m.code] ?? ''}
              onChange={(e) => setAmounts((a) => ({ ...a, [m.code]: e.target.value }))}
              placeholder="0,00"
              className="tabular h-12 w-28 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 text-right text-base focus:border-[var(--color-accent)] focus:outline-none"
            />
          </li>
        ))}
      </ul>
      <p className="tabular flex justify-between text-[15px]" aria-live="polite">
        <span>{remaining >= 0 ? 'Reste à payer' : 'Trop perçu'}</span>
        <span className="font-semibold">{formatPrice(Math.abs(remaining) / 100)}</span>
      </p>
      <button
        type="button"
        disabled={busy || remaining !== 0}
        onClick={() =>
          onPay(
            methods
              .filter((m) => cents(amounts[m.code]) > 0)
              .map((m) => ({ code: m.code, amount: cents(amounts[m.code]) / 100 })),
          )
        }
        className="h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)]"
      >
        Valider {formatPrice(total)}
      </button>
      <button type="button" onClick={onBack} className="h-11 w-full text-sm font-medium text-[var(--color-text-secondary)]">
        Un seul moyen de paiement
      </button>
    </div>
  )
}

// Le ticket sort de la caisse : il est signé et valable, réseau ou pas
function Receipt({ receipt, siteName, onNext }: { receipt: ReceiptView; siteName: string; onNext: () => void }) {
  const synced = useSaleSynced(receipt.sale.clientId)
  const { sale } = receipt
  const signedAt = new Date(sale.receipt.signedAt)

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[var(--radius-md)]">
        <motion.div
          initial={{ y: '-100%' }}
          animate={{ y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="border border-[var(--color-border)] bg-[var(--color-bg-base)] px-4 py-4 font-data text-[13px] leading-relaxed"
        >
          <p className="text-center font-body text-[15px] font-semibold">{siteName}</p>
          <p className="text-center text-[var(--color-text-secondary)]">
            {signedAt.toLocaleDateString('fr-FR')} {signedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <ul className="my-3 space-y-1 border-y border-dashed border-[var(--color-border-strong)] py-3">
            {receipt.lines.map((l) => (
              <li key={l.key} className="flex justify-between gap-3">
                <span className="truncate">
                  {l.quantity} × {l.product.name}
                  {l.variantName ? ` ${l.variantName}` : ''}
                </span>
                <span className="tabular shrink-0">{formatPrice(l.product.price * l.quantity - l.discount)}</span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between font-body text-base font-semibold">
            <span>Total</span>
            <span className="tabular">{formatPrice(sale.pricing.total)}</span>
          </p>
          {receipt.payments.map((p) => (
            <p key={p.label} className="flex justify-between text-[var(--color-text-secondary)]">
              <span>{p.label}</span>
              <span className="tabular">{formatPrice(p.amount)}</span>
            </p>
          ))}
          <p className="mt-3 text-[var(--color-text-secondary)]">
            {sale.terminalName}, ticket n° {sale.receipt.counter}
          </p>
          <p className="break-all text-[var(--color-text-muted)]">Signature {sale.receipt.hash.slice(0, 24)}</p>
        </motion.div>
      </div>

      <p className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]" role="status">
        {synced ? <CloudCheck size={18} aria-hidden /> : <CloudSlash size={18} aria-hidden />}
        {synced ? 'Envoyée au serveur.' : 'Gardée sur la caisse, envoi dès que le réseau revient.'}
      </p>

      <button
        type="button"
        data-autofocus
        onClick={onNext}
        className="h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)]"
      >
        Vente suivante
      </button>
    </div>
  )
}

function useSaleSynced(clientId: string) {
  const [synced, setSynced] = useState(false)
  useEffect(() => {
    let stop = false
    const check = async () => {
      const sale = await db.sales.where('clientId').equals(clientId).first()
      if (!stop) setSynced(sale?.status === 'synced')
    }
    void check()
    const t = window.setInterval(check, 1000)
    return () => {
      stop = true
      window.clearInterval(t)
    }
  }, [clientId])
  return synced
}
