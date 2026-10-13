'use client'

import { useState } from 'react'
import { formatPrice } from '@erp/utils'
import { PaymentKind } from '@erp/types'
import { ordersApi } from '@/lib/api/orders'
import type { PlatformConfig } from '@/lib/api/platform'
import type { PaymentDevice } from '@/lib/api/payments'
import { TerminalWait } from './TerminalWait'

type Method = PlatformConfig['paymentMethods'][number]
export type PayLine = { code: string; amount: number; reference?: string }

const fieldCls =
  'h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-4 text-base focus:border-[var(--color-accent)] focus:outline-none'

// Paiement par avoir : le code est vérifié, le solde s'applique, le reste se
// paie avec un autre moyen. C'est aussi la deuxième moitié d'un échange.
export function CreditPayment({
  siteId,
  device,
  total,
  methods,
  busy,
  initialCode,
  onPay,
  onLock,
  onBack,
}: {
  siteId: string
  device: PaymentDevice | null
  total: number
  methods: Method[]
  busy: boolean
  initialCode?: string
  onPay: (payments: PayLine[], clientId?: string) => void
  onLock: (locked: boolean) => void
  onBack: () => void
}) {
  const [code, setCode] = useState(initialCode ?? '')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [credit, setCredit] = useState<{ code: string; balance: number } | null>(null)
  const [terminalFor, setTerminalFor] = useState<Method | null>(null)

  const check = async () => {
    if (!navigator.onLine) return setError('Un avoir se vérifie en ligne : reconnectez la caisse ou payez autrement.')
    setChecking(true)
    setError(null)
    try {
      const c = await ordersApi.credit(siteId, code)
      if (c.expired) setError(`Avoir ${c.code} expiré`)
      else if (c.balance <= 0) setError(`Avoir ${c.code} déjà utilisé en entier`)
      else setCredit({ code: c.code, balance: c.balance })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setChecking(false)
    }
  }

  if (!credit) {
    return (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (code.trim()) void check()
        }}
      >
        <div className="space-y-2">
          <label htmlFor="credit-code" className="block text-sm font-medium">
            Code de l&apos;avoir
          </label>
          <input
            id="credit-code"
            data-autofocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="AV-XXXX-XXXX"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className={fieldCls + ' font-data text-xl tracking-wider'}
          />
        </div>
        {error && (
          <p role="alert" className="rounded-[var(--radius-md)] bg-[var(--color-accent-muted)] p-3 text-sm font-medium">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!code.trim() || checking}
          className="h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)]"
        >
          {checking ? 'Vérification...' : 'Vérifier le solde'}
        </button>
        <button type="button" onClick={onBack} className="h-11 w-full text-sm font-medium text-[var(--color-text-secondary)]">
          Autre moyen de paiement
        </button>
      </form>
    )
  }

  const used = Math.min(credit.balance, total)
  const rest = Math.round((total - used) * 100) / 100
  const creditLine: PayLine = { code: 'CREDIT', amount: used, reference: credit.code }

  if (terminalFor && device) {
    return (
      <TerminalWait
        siteId={siteId}
        device={device}
        amount={rest}
        onApproved={(clientId) => onPay([creditLine, { code: terminalFor.code, amount: rest }], clientId)}
        onPaidElsewhere={() => onPay([creditLine, { code: terminalFor.code, amount: rest }])}
        onBack={() => {
          setTerminalFor(null)
          onLock(false)
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <dl className="space-y-1 rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] p-4 text-[15px]">
        <div className="flex justify-between">
          <dt>
            Avoir <span className="font-data">{credit.code}</span>
          </dt>
          <dd className="tabular">{formatPrice(credit.balance)}</dd>
        </div>
        <div className="flex justify-between font-semibold">
          <dt>Utilisé pour cette vente</dt>
          <dd className="tabular">{formatPrice(used)}</dd>
        </div>
        {credit.balance > used && (
          <div className="flex justify-between text-[var(--color-text-secondary)]">
            <dt>Restera sur l&apos;avoir</dt>
            <dd className="tabular">{formatPrice(credit.balance - used)}</dd>
          </div>
        )}
      </dl>

      {rest <= 0 ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onPay([creditLine])}
          className="h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)] disabled:opacity-60"
        >
          Payer {formatPrice(total)} avec l&apos;avoir
        </button>
      ) : (
        <>
          <p className="text-[15px] font-medium">
            Reste <span className="tabular">{formatPrice(rest)}</span>, payé en :
          </p>
          <ul className="grid grid-cols-2 gap-2">
            {methods.map((m) => (
              <li key={m.code}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (m.kind === PaymentKind.CARD && device && navigator.onLine) {
                      onLock(true)
                      return setTerminalFor(m)
                    }
                    onPay([creditLine, { code: m.code, amount: rest }])
                  }}
                  className="h-14 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-[15px] font-semibold hover:border-[var(--color-accent)] disabled:opacity-50"
                >
                  {m.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <button
        type="button"
        onClick={() => {
          setCredit(null)
          setError(null)
        }}
        className="h-11 w-full text-sm font-medium text-[var(--color-text-secondary)]"
      >
        Autre avoir
      </button>
    </div>
  )
}
