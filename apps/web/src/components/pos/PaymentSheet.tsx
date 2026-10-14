'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUUpLeft, CreditCard, Money, Ticket as TicketIcon, Bank, Wallet, CloudCheck, CloudSlash, CheckCircle } from '@phosphor-icons/react'
import { formatPrice } from '@erp/utils'
import { PaymentKind } from '@erp/types'
import type { PlatformConfig } from '@/lib/api/platform'
import type { PaymentDevice } from '@/lib/api/payments'
import { productsAdminApi } from '@/lib/api/products-admin'
import { db } from '@/lib/offline/db'
import type { RecordedSale } from '@/lib/terminal/terminal'
import type { CartLine } from '@/stores/cart.store'
import { Sheet } from './Sheet'
import { FlowBeat } from '@/components/brand/FlowLogo'
import { EASE_DRAWER } from '@/lib/motion'
import { TerminalWait } from './TerminalWait'
import { PartsPayment } from './PartsPayment'
import { CreditPayment, type PayLine } from './CreditPayment'

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
  // Code d'avoir apporté par un échange (écran Commandes)
  creditCode?: string
  onPay: (payments: PayLine[], email?: string, clientId?: string) => void
  onClose: () => void
}

export function PaymentSheet({ open, siteId, device, total, methods, siteName, receipt, busy, error, creditCode, onPay, onClose }: PaymentSheetProps) {
  const [split, setSplit] = useState(false)
  const [terminal, setTerminal] = useState<Method | null>(null)
  const [parts, setParts] = useState(false)
  const [partsLocked, setPartsLocked] = useState(false)
  const [credit, setCredit] = useState(false)
  // L'avoir demande un code : il a son propre écran, pas sa place dans les partages
  const plain = methods.filter((m) => m.code !== 'CREDIT')
  const [email, setEmail] = useState('')
  const [showEmail, setShowEmail] = useState(false)

  useEffect(() => {
    if (!open) {
      setSplit(false)
      setTerminal(null)
      setParts(false)
      setPartsLocked(false)
      setCredit(false)
      setEmail('')
      setShowEmail(false)
    }
  }, [open])

  const title = receipt
    ? 'Vente enregistrée'
    : terminal
      ? 'Paiement sur le TPE'
      : credit
        ? `Payer ${formatPrice(total)} par avoir`
        : parts
        ? 'Diviser la note'
        : split
        ? 'Paiement en plusieurs fois'
        : `Encaisser ${formatPrice(total)}`

  // Carte + TPE connecté + réseau : le montant part au TPE. Sinon, TPE autonome.
  const choose = (m: Method) => {
    if (m.code === 'CREDIT') return setCredit(true)
    if (m.kind === PaymentKind.CARD && device && navigator.onLine) return setTerminal(m)
    onPay([{ code: m.code, amount: total }], mail)
  }
  const mail = email.trim() || undefined

  return (
    // Pendant l'attente du TPE, on ne ferme qu'en annulant : sinon le client
    // pourrait payer sans que la vente soit enregistrée
    <Sheet open={open} title={title} onClose={onClose} locked={busy || (!receipt && (!!terminal || partsLocked))}>
      {receipt ? (
        <Receipt receipt={receipt} siteId={siteId} siteName={siteName} onNext={onClose} />
      ) : terminal && device ? (
        <>
          {error && (
            // Paiement accepté mais vente non enregistrée : à ne jamais perdre de vue
            <p role="alert" className="mb-4 alert-box">
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
      ) : credit ? (
        <CreditPayment
          siteId={siteId}
          device={device}
          total={total}
          methods={plain}
          busy={busy}
          initialCode={creditCode}
          onLock={setPartsLocked}
          onPay={(p, clientId) => onPay(p, mail, clientId)}
          onBack={() => setCredit(false)}
        />
      ) : parts ? (
        <PartsPayment
          siteId={siteId}
          device={device}
          total={total}
          methods={plain}
          busy={busy}
          onLock={setPartsLocked}
          onPay={(p, clientId) => onPay(p, mail, clientId)}
          onBack={() => setParts(false)}
        />
      ) : split ? (
        <SplitPayment total={total} methods={plain} busy={busy} onPay={(p) => onPay(p, mail)} onBack={() => setSplit(false)} />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">Touchez le moyen de paiement pour valider.</p>
          <ul className="grid grid-cols-2 gap-2">
            {methods.map((m) => {
              const Icon = m.code === 'CREDIT' ? ArrowUUpLeft : (KIND_ICON[m.kind] ?? Wallet)
              return (
                <li key={m.code}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => choose(m)}
                    className="flex h-24 w-full flex-col items-start justify-between rounded-[var(--radius-md)] border border-[var(--color-border-strong)] p-3 text-left hover:border-[var(--color-accent)] disabled:opacity-50 press"
                  >
                    <span aria-hidden className="text-[var(--color-accent)]">
                      <Icon size={26} weight="regular" />
                    </span>
                    <span className="text-[15px] font-semibold">{m.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          {error && (
            <p role="alert" className="alert-box">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-x-4">
            <button type="button" onClick={() => setParts(true)} className="h-11 text-sm font-medium text-[var(--color-accent)] underline-offset-4 hover:underline">
              Diviser la note
            </button>
            {plain.length > 1 && (
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
                className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-4 text-base focus:border-[var(--color-accent)]"
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
              className="tabular h-12 w-28 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 text-right text-base focus:border-[var(--color-accent)]"
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
function Receipt({ receipt, siteId, siteName, onNext }: { receipt: ReceiptView; siteId: string; siteName: string; onNext: () => void }) {
  const synced = useSaleSynced(receipt.sale.clientId)
  const customLines = receipt.lines.filter((l) => l.customName)
  const { sale } = receipt
  const signedAt = new Date(sale.receipt.signedAt)

  return (
    <div className="space-y-4">
      {/* Le signe bat une fois, le ticket sort de la caisse */}
      <p className="flex items-center gap-3">
        <FlowBeat size={30} />
        <span className="tabular font-display text-3xl font-bold tracking-[-0.03em]">{formatPrice(sale.pricing.total)}</span>
      </p>
      <div className="overflow-hidden rounded-[var(--radius-md)]">
        <motion.div
          initial={{ transform: 'translateY(-100%)' }}
          animate={{ transform: 'translateY(0%)' }}
          transition={{ duration: 0.3, ease: EASE_DRAWER }}
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

      {customLines.map((l) => (
        <SaveToCatalog key={l.key} siteId={siteId} name={l.customName!} price={l.product.price} taxRate={l.product.taxRate} />
      ))}

      <button
        type="button"
        data-autofocus
        onClick={onNext}
        className="h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] press"
      >
        Vente suivante
      </button>
    </div>
  )
}

// « Burger du chef », « Retouche » : un article vendu à la volée devient un
// produit du catalogue en un geste
function SaveToCatalog({ siteId, name, price, taxRate }: { siteId: string; name: string; price: number; taxRate: number }) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  if (state === 'saved') {
    return (
      <p className="flex items-center gap-2 text-sm" role="status">
        <CheckCircle size={18} weight="fill" aria-hidden className="text-[var(--color-accent)]" /> « {name} » ajouté au catalogue.
      </p>
    )
  }
  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2">
      <p className="min-w-0 text-sm">
        Garder « <span className="font-medium">{name}</span> » à {formatPrice(price)} dans le catalogue ?
        {state === 'error' && <span className="block text-[var(--color-text-secondary)]">Impossible pour le moment (réseau).</span>}
      </p>
      <button
        type="button"
        disabled={state === 'saving'}
        onClick={async () => {
          setState('saving')
          try {
            await productsAdminApi.create(siteId, { name, price, taxRate })
            setState('saved')
          } catch {
            setState('error')
          }
        }}
        className="h-11 shrink-0 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-sm font-medium"
      >
        Ajouter
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
