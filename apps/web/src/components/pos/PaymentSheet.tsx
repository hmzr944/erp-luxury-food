'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUUpLeft, CreditCard, Money, Ticket as TicketIcon, Bank, Wallet, CloudCheck, CloudSlash, CheckCircle, Printer, QrCode } from '@phosphor-icons/react'
import { CASH_LIMIT_NON_RESIDENT, CASH_LIMIT_RESIDENT, checkPayments, formatPrice, mealVoucherAllowance, type RuleLine } from '@erp/utils'
import { PaymentKind } from '@erp/types'
import type { PlatformConfig } from '@/lib/api/platform'
import type { PaymentDevice } from '@/lib/api/payments'
import type { ReceiptSettings } from '@/lib/api/platform'
import { canOpenDrawer, openDrawer, printTicket, usePrinterConfig } from '@/lib/printing/printer'
import { printPlan, ticketForSale } from './receipt-ticket'
import { productsAdminApi } from '@/lib/api/products-admin'
import { db } from '@/lib/offline/db'
import type { RecordedSale } from '@/lib/terminal/terminal'
import type { CartLine } from '@/stores/cart.store'
import { Sheet } from './Sheet'
import { FlowBeat } from '@/components/brand/FlowLogo'
import { DigitalReceipt } from './DigitalReceipt'
import { BusinessInvoice } from './BusinessInvoice'
import { EASE_DRAWER } from '@/lib/motion'
import { TerminalWait } from './TerminalWait'
import { QrPayWait } from './QrPayWait'
import { BridgeTerminalWait } from './BridgeTerminalWait'
import { getBridgeTpe } from '@/lib/bridge'
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

// Précisions d'un encaissement : espèces remises, client non résident
export interface PayOptions {
  tendered?: number
  nonResident?: boolean
}

export interface ReceiptView {
  sale: RecordedSale
  lines: CartLine[]
  payments: Array<{ label: string; amount: number; reference?: string }>
  // E-mail saisi à l'encaissement : le ticket part tout seul
  email?: string
  // Monnaie rendue au client (espèces)
  change?: number
  // Vente fictive du mode formation : numérotée à part, hors grand livre
  training?: { number: number; operator: string }
  // Encaissement en espèces : le tiroir s'ouvre
  cashPaid?: boolean
}

interface PaymentSheetProps {
  open: boolean
  siteId: string
  // TPE connecté de cette caisse : la carte y est encaissée automatiquement
  device: PaymentDevice | null
  // Mode formation : vente fictive, aucun montant n'est envoyé à un TPE réel
  training?: boolean
  total: number
  // Lignes de la vente (TTC, éligibilité titre-restaurant) pour les règles d'encaissement
  ruleLines: RuleLine[]
  methods: Method[]
  siteName: string
  // Mentions du ticket et nom du vendeur, pour l'impression
  receiptSettings?: ReceiptSettings
  sellerName?: string | null
  receipt: ReceiptView | null
  busy: boolean
  error: string | null
  // Code d'avoir apporté par un échange (écran Commandes)
  creditCode?: string
  onPay: (payments: PayLine[], email?: string, clientId?: string, options?: PayOptions) => void
  onClose: () => void
  // Paiement par QR disponible (Stripe relié, ou TPE virtuel) et QR montré à l'écran client
  qrAvailable?: boolean
  onQrShow?: (qr: { url: string; expiresAt: string | null } | null) => void
}

export function PaymentSheet({ open, siteId, device: realDevice, training = false, total, ruleLines, methods, siteName, receiptSettings, sellerName, receipt, busy, error, creditCode, onPay, onClose, qrAvailable, onQrShow }: PaymentSheetProps) {
  const device = training ? null : realDevice
  const bridgeTpe = !training && getBridgeTpe().enabled
  const [split, setSplit] = useState(false)
  // Paiement par QR : enregistré sur le moyen « carte » de l'organisation
  const [qr, setQr] = useState(false)
  const qrMethod = methods.find((m) => m.kind === PaymentKind.CARD)
  const [terminal, setTerminal] = useState<Method | null>(null)
  // TPE bancaire branché sur FLŌW-Bridge (Caisse-AP)
  const [bridgeCard, setBridgeCard] = useState<Method | null>(null)
  const [parts, setParts] = useState(false)
  const [partsLocked, setPartsLocked] = useState(false)
  // Avoir ou carte cadeau FLŌW : vérifiés par leur code
  const [credit, setCredit] = useState<false | 'CREDIT' | 'GIFT_CARD'>(false)
  // Étape propre à un moyen : espèces (rendu), chèque (numéro)
  const [cash, setCash] = useState<Method | null>(null)
  const [reference, setReference] = useState<Method | null>(null)
  const [splitPreset, setSplitPreset] = useState<{ amounts: Record<string, string>; notice: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // L'avoir demande un code : il a son propre écran, pas sa place dans les partages
  const plain = methods.filter((m) => m.code !== 'CREDIT')
  const [email, setEmail] = useState('')
  const [showEmail, setShowEmail] = useState(false)

  useEffect(() => {
    if (!open) {
      setSplit(false)
      setQr(false)
      setTerminal(null)
      setBridgeCard(null)
      setParts(false)
      setPartsLocked(false)
      setCredit(false)
      setCash(null)
      setReference(null)
      setSplitPreset(null)
      setNotice(null)
      setEmail('')
      setShowEmail(false)
    }
  }, [open])

  const title = receipt
    ? 'Vente enregistrée'
    : terminal || bridgeCard
      ? 'Paiement sur le TPE'
      : credit
        ? `Payer ${formatPrice(total)} par ${credit === 'GIFT_CARD' ? 'carte cadeau' : 'avoir'}`
        : cash
        ? `Espèces : ${formatPrice(total)}`
        : reference
        ? `${reference.label} : ${formatPrice(total)}`
        : parts
        ? 'Diviser la note'
        : split
        ? 'Paiement en plusieurs fois'
        : `Encaisser ${formatPrice(total)}`

  // Carte + TPE connecté + réseau : le montant part au TPE. Sinon, TPE autonome.
  const choose = (m: Method) => {
    setNotice(null)
    if (m.code === 'CREDIT' || m.code === 'GIFT_CARD') return setCredit(m.code)
    if (m.kind === PaymentKind.CARD && device && navigator.onLine) return setTerminal(m)
    if (m.kind === PaymentKind.CARD && bridgeTpe) return setBridgeCard(m)
    // Titre-restaurant : articles éligibles seulement, plafonné par ticket.
    // Au-delà, le reste se paie avec un autre moyen.
    if (m.mealVoucher) {
      const allowed = mealVoucherAllowance(ruleLines, m)
      if (allowed <= 0) return setNotice('Aucun article de cette vente n’est payable en titre-restaurant.')
      if (Math.round(allowed * 100) < Math.round(total * 100)) {
        const why = m.maxAmount != null && allowed >= Number(m.maxAmount) ? `plafond de ${formatPrice(Number(m.maxAmount))} par ticket` : 'articles éligibles'
        setSplitPreset({ amounts: { [m.code]: allowed.toFixed(2).replace('.', ',') }, notice: `${m.label} : ${formatPrice(allowed)} au plus (${why}). Le reste avec un autre moyen.` })
        return setSplit(true)
      }
    }
    if (m.requiresReference) return setReference(m)
    if (m.kind === PaymentKind.CASH) return setCash(m)
    onPay([{ code: m.code, amount: total }], mail)
  }
  const mail = email.trim() || undefined

  return (
    // Pendant l'attente du TPE, on ne ferme qu'en annulant : sinon le client
    // pourrait payer sans que la vente soit enregistrée
    <Sheet open={open} title={title} onClose={onClose} locked={busy || (!receipt && (!!terminal || !!bridgeCard || qr || partsLocked))}>
      {receipt ? (
        <Receipt receipt={receipt} siteId={siteId} siteName={siteName} settings={receiptSettings} sellerName={sellerName} onNext={onClose} />
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
      ) : qr && qrMethod ? (
        <>
          {error && (
            <p role="alert" className="mb-4 alert-box">
              Paiement accepté, mais la vente n&apos;a pas pu être enregistrée : {error}
            </p>
          )}
          <QrPayWait
            siteId={siteId}
            amount={total}
            onShow={(q) => onQrShow?.(q)}
            onApproved={(clientId) => onPay([{ code: qrMethod.code, amount: total }], mail, clientId)}
            onBack={() => setQr(false)}
          />
        </>
      ) : bridgeCard ? (
        <>
          {error && (
            <p role="alert" className="mb-4 alert-box">
              Paiement accepté, mais la vente n&apos;a pas pu être enregistrée : {error}
            </p>
          )}
          <BridgeTerminalWait
            config={getBridgeTpe()}
            amount={total}
            onApproved={(ref) => onPay([{ code: bridgeCard.code, amount: total, ...(ref ? { reference: ref } : {}) }], mail)}
            onPaidElsewhere={() => onPay([{ code: bridgeCard.code, amount: total }], mail)}
            onBack={() => setBridgeCard(null)}
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
          kind={credit}
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
      ) : cash ? (
        <CashPayment
          total={total}
          giveChange={cash.giveChange !== false}
          busy={busy}
          error={error}
          onPay={(tendered, nonResident) => onPay([{ code: cash.code, amount: total }], mail, undefined, { tendered, nonResident })}
          onBack={() => setCash(null)}
        />
      ) : reference ? (
        <ReferencePayment
          method={reference}
          busy={busy}
          error={error}
          onPay={(ref) => onPay([{ code: reference.code, amount: total, reference: ref }], mail)}
          onBack={() => setReference(null)}
        />
      ) : split ? (
        <SplitPayment
          total={total}
          methods={plain}
          ruleLines={ruleLines}
          initial={splitPreset?.amounts}
          notice={splitPreset?.notice}
          busy={busy}
          error={error}
          onPay={(p, nonResident) => onPay(p, mail, undefined, { nonResident })}
          onBack={() => {
            setSplit(false)
            setSplitPreset(null)
          }}
        />
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

          {qrAvailable && qrMethod && (
            <button
              type="button"
              disabled={busy || total < 1}
              onClick={() => setQr(true)}
              className="flex h-14 w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-3 text-left hover:border-[var(--color-accent)] disabled:opacity-50 press"
            >
              <QrCode size={26} aria-hidden className="shrink-0 text-[var(--color-accent)]" />
              <span className="text-[15px] font-semibold">QR code, paiement sur le téléphone du client</span>
            </button>
          )}

          {notice && (
            <p role="status" className="alert-box">
              {notice}
            </p>
          )}
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

const fieldCls =
  'h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-4 text-base focus:border-[var(--color-accent)]'
const primaryCls =
  'h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)] press'
const backCls = 'h-11 w-full text-sm font-medium text-[var(--color-text-secondary)]'
const toCents = (v: string | undefined) => Math.round(Number((v ?? '').replace(',', '.')) * 100) || 0
// Saisie à la française : « 20,00 »
const toInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')

// Paiement en espèces au-delà de 1 000 € : seul un client non résident le peut,
// jusqu'à 15 000 € (art. L112-6 et D112-3 code monétaire et financier)
function NonResident({ cash, checked, onChange }: { cash: number; checked: boolean; onChange: (v: boolean) => void }) {
  if (cash <= CASH_LIMIT_RESIDENT) return null
  return (
    <label className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] p-3 text-[15px]">
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        Client non résident, justificatif de domicile à l’étranger vérifié.
        <span className="block text-sm text-[var(--color-text-secondary)]">
          En espèces, {formatPrice(CASH_LIMIT_RESIDENT)} au plus pour un client résidant en France, {formatPrice(CASH_LIMIT_NON_RESIDENT)} pour un non-résident.
        </span>
      </span>
    </label>
  )
}

// Espèces : montant remis, monnaie à rendre
function CashPayment({
  total,
  giveChange,
  busy,
  error,
  onPay,
  onBack,
}: {
  total: number
  giveChange: boolean
  busy: boolean
  error: string | null
  onPay: (tendered: number, nonResident: boolean) => void
  onBack: () => void
}) {
  const due = Math.round(total * 100)
  const [given, setGiven] = useState('')
  const [nonResident, setNonResident] = useState(false)
  const tendered = given ? toCents(given) : due
  const change = tendered - due
  // Billets ronds au-dessus du total, comme les propose le client
  const quick = [...new Set([500, 1000, 2000, 5000, 10000].map((n) => Math.ceil(due / n) * n).filter((n) => n > due))].slice(0, 3)
  const issues = checkPayments({ lines: [], payments: [{ code: 'CASH', amount: total }], methods: [{ code: 'CASH', label: 'Espèces', kind: 'CASH' }], nonResident })
  const ok = tendered >= due && (giveChange || change === 0) && !issues.length

  return (
    <div className="space-y-4">
      {giveChange && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[due, ...quick].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setGiven(n === due ? '' : toInput(n))}
                aria-pressed={tendered === n}
                className={[
                  'tabular h-14 rounded-[var(--radius-md)] border px-2 text-[15px] font-semibold press',
                  tendered === n ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)]' : 'border-[var(--color-border-strong)]',
                ].join(' ')}
              >
                {n === due ? 'Compte exact' : formatPrice(n / 100)}
              </button>
            ))}
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Montant remis par le client</span>
            <input inputMode="decimal" placeholder={toInput(due)} value={given} onChange={(e) => setGiven(e.target.value)} className={`tabular ${fieldCls}`} />
          </label>
          <p className="tabular flex items-baseline justify-between" aria-live="polite">
            <span className="text-[15px]">{change >= 0 ? 'À rendre' : 'Il manque'}</span>
            <span className="font-display text-3xl font-bold tracking-[-0.03em]">{formatPrice(Math.abs(change) / 100)}</span>
          </p>
        </>
      )}
      <NonResident cash={total} checked={nonResident} onChange={setNonResident} />
      {issues.map((i) => (
        <p key={i} role="status" className="alert-box">
          {i}
        </p>
      ))}
      {error && (
        <p role="alert" className="alert-box">
          {error}
        </p>
      )}
      <button type="button" data-autofocus disabled={busy || !ok} onClick={() => onPay(tendered / 100, nonResident)} className={primaryCls}>
        Valider {formatPrice(total)}
      </button>
      <button type="button" onClick={onBack} className={backCls}>
        Autre moyen de paiement
      </button>
    </div>
  )
}

// Chèque, chèque-vacances : le numéro est noté sur la vente
function ReferencePayment({ method, busy, error, onPay, onBack }: { method: Method; busy: boolean; error: string | null; onPay: (reference: string) => void; onBack: () => void }) {
  const [ref, setRef] = useState('')
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (ref.trim()) onPay(ref.trim())
      }}
    >
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Numéro du {method.label.toLowerCase().startsWith('chèque') ? method.label.toLowerCase() : `paiement ${method.label}`}</span>
        <input data-autofocus autoComplete="off" inputMode="numeric" value={ref} onChange={(e) => setRef(e.target.value)} className={`tabular ${fieldCls}`} />
      </label>
      {error && (
        <p role="alert" className="alert-box">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy || !ref.trim()} className={primaryCls}>
        Valider
      </button>
      <button type="button" onClick={onBack} className={backCls}>
        Autre moyen de paiement
      </button>
    </form>
  )
}

function SplitPayment({
  total,
  methods,
  ruleLines,
  initial,
  notice,
  busy,
  error,
  onPay,
  onBack,
}: {
  total: number
  methods: Method[]
  ruleLines: RuleLine[]
  initial?: Record<string, string>
  notice?: string
  busy: boolean
  error: string | null
  onPay: (payments: PayLine[], nonResident: boolean) => void
  onBack: () => void
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>(initial ?? {})
  const [refs, setRefs] = useState<Record<string, string>>({})
  const [nonResident, setNonResident] = useState(false)
  const paid = Object.values(amounts).reduce((a, v) => a + toCents(v), 0)
  const remaining = Math.round(total * 100) - paid
  const payments: PayLine[] = methods
    .filter((m) => toCents(amounts[m.code]) > 0)
    .map((m) => ({ code: m.code, amount: toCents(amounts[m.code]) / 100, ...(refs[m.code]?.trim() ? { reference: refs[m.code].trim() } : {}) }))
  const issues = remaining === 0 ? checkPayments({ lines: ruleLines, payments, methods, nonResident }) : []
  const cashTotal = payments.filter((p) => methods.find((m) => m.code === p.code)?.kind === PaymentKind.CASH).reduce((a, p) => a + p.amount, 0)

  return (
    <div className="space-y-3">
      {notice && (
        <p role="status" className="alert-box">
          {notice}
        </p>
      )}
      <ul className="space-y-2">
        {methods.map((m) => (
          <li key={m.code} className="space-y-2">
            <div className="flex items-center gap-3">
              <label htmlFor={`pay-${m.code}`} className="flex-1 text-[15px] font-medium">
                {m.label}
              </label>
              <button
                type="button"
                onClick={() => setAmounts((a) => ({ ...a, [m.code]: toInput(toCents(a[m.code]) + Math.max(remaining, 0)) }))}
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
            </div>
            {m.requiresReference && toCents(amounts[m.code]) > 0 && (
              <input
                aria-label={`Numéro ${m.label}`}
                placeholder={`Numéro ${m.label.toLowerCase()}`}
                autoComplete="off"
                value={refs[m.code] ?? ''}
                onChange={(e) => setRefs((r) => ({ ...r, [m.code]: e.target.value }))}
                className={`tabular ${fieldCls}`}
              />
            )}
          </li>
        ))}
      </ul>
      <p className="tabular flex justify-between text-[15px]" aria-live="polite">
        <span>{remaining >= 0 ? 'Reste à payer' : 'Trop perçu'}</span>
        <span className="font-semibold">{formatPrice(Math.abs(remaining) / 100)}</span>
      </p>
      <NonResident cash={cashTotal} checked={nonResident} onChange={setNonResident} />
      {issues.map((i) => (
        <p key={i} role="status" className="alert-box">
          {i}
        </p>
      ))}
      {error && (
        <p role="alert" className="alert-box">
          {error}
        </p>
      )}
      <button type="button" disabled={busy || remaining !== 0 || issues.length > 0} onClick={() => onPay(payments, nonResident)} className={primaryCls}>
        Valider {formatPrice(total)}
      </button>
      <button type="button" onClick={onBack} className={backCls}>
        Un seul moyen de paiement
      </button>
    </div>
  )
}

// Le ticket sort de la caisse : il est signé et valable, réseau ou pas
function Receipt({
  receipt,
  siteId,
  siteName,
  settings,
  sellerName,
  onNext,
}: {
  receipt: ReceiptView
  siteId: string
  siteName: string
  settings?: ReceiptSettings
  sellerName?: string | null
  onNext: () => void
}) {
  const synced = useSaleSynced(receipt.sale.clientId)
  const customLines = receipt.lines.filter((l) => l.customName)
  const { sale } = receipt
  const signedAt = new Date(sale.receipt.signedAt)
  const printer = usePrinterConfig()
  const [print, setPrint] = useState<{ state: 'idle' | 'printing' | 'printed' | 'error'; message?: string }>({ state: 'idle' })
  const started = useRef(false)

  const doPrint = async (copies: Array<'CLIENT' | 'DOUBLE' | undefined>, drawer: boolean) => {
    setPrint({ state: 'printing' })
    try {
      for (const [i, copy] of copies.entries()) {
        await printTicket(ticketForSale(receipt, { receipt: settings, siteName, sellerName }, { copy }), { openDrawer: drawer && i === 0 })
      }
      setPrint({ state: 'printed' })
    } catch (e) {
      setPrint({ state: 'error', message: (e as Error).message })
    }
  }

  // Une fois, à l'affichage : ticket imprimé d'office quand il le faut,
  // tiroir ouvert pour un paiement en espèces
  useEffect(() => {
    if (started.current) return
    started.current = true
    const drawer = !!receipt.cashPaid && printer.drawerOnCash && canOpenDrawer(printer)
    const plan = printPlan(receipt, settings)
    if (plan.auto && printer.mode !== 'none') void doPrint(plan.copies, drawer)
    else if (drawer) openDrawer(printer).catch((e: Error) => setPrint({ state: 'error', message: e.message }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          {receipt.change ? (
            <p className="flex justify-between font-body text-[15px] font-semibold">
              <span>Rendu</span>
              <span className="tabular">{formatPrice(receipt.change)}</span>
            </p>
          ) : null}
          {receipt.training ? (
            <p className="mt-3 font-body font-semibold">Mode formation : ticket fictif n° F-{receipt.training.number}, {receipt.training.operator}</p>
          ) : (
            <>
              <p className="mt-3 text-[var(--color-text-secondary)]">
                {sale.terminalName}, ticket n° {sale.receipt.counter}
              </p>
              <p className="break-all text-[var(--color-text-muted)]">Signature {sale.receipt.hash.slice(0, 24)}</p>
            </>
          )}
        </motion.div>
      </div>

      {!receipt.training && <DigitalReceipt siteId={siteId} clientId={sale.clientId} initialEmail={receipt.email} />}

      {!receipt.training && (
        <p className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]" role="status">
          {synced ? <CloudCheck size={18} aria-hidden /> : <CloudSlash size={18} aria-hidden />}
          {synced ? 'Envoyée au serveur.' : 'Gardée sur la caisse, envoi dès que le réseau revient.'}
        </p>
      )}

      {print.state === 'error' && (
        <p role="alert" className="alert-box">
          {print.message}
        </p>
      )}
      {printer.mode !== 'none' && (
        <button
          type="button"
          disabled={print.state === 'printing' || print.state === 'printed'}
          onClick={() => void doPrint(printPlan(receipt, settings).copies, false)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-[15px] font-semibold disabled:text-[var(--color-text-secondary)] press"
        >
          <Printer size={20} aria-hidden />
          {print.state === 'printing' ? 'Impression' : print.state === 'printed' ? 'Ticket imprimé' : print.state === 'error' ? 'Réessayer l’impression' : 'Imprimer le ticket'}
        </button>
      )}

      {!receipt.training && <BusinessInvoice siteId={siteId} clientId={sale.clientId} />}

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
