'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle, Minus, Plus } from '@phosphor-icons/react'
import { formatPrice } from '@erp/utils'
import { PaymentKind } from '@erp/types'
import type { PaymentDevice } from '@/lib/api/payments'
import type { PlatformConfig } from '@/lib/api/platform'
import { TerminalWait } from './TerminalWait'

type Method = PlatformConfig['paymentMethods'][number]

// Parts au centime près : le reste d'arrondi va à la première part
export function splitEqually(totalCents: number, parts: number): number[] {
  const base = Math.floor(totalCents / parts)
  return Array.from({ length: parts }, (_, i) => base + (i === 0 ? totalCents - base * parts : 0))
}

interface PartsPaymentProps {
  siteId: string
  device: PaymentDevice | null
  total: number
  methods: Method[]
  busy: boolean
  onLock: (locked: boolean) => void
  onPay: (payments: Array<{ code: string; amount: number }>, clientId?: string) => void
  onBack: () => void
}

// Diviser la note : chaque convive paie sa part, avec le moyen de son choix
export function PartsPayment({ siteId, device, total, methods, busy, onLock, onPay, onBack }: PartsPaymentProps) {
  const [count, setCount] = useState(2)
  const [paid, setPaid] = useState<Array<{ code: string; label: string } | null>>([])
  const [onTerminal, setOnTerminal] = useState<{ index: number; method: Method } | null>(null)
  const clientId = useRef<string | undefined>(undefined)
  const amounts = splitEqually(Math.round(total * 100), count)
  const started = paid.some(Boolean)

  useEffect(() => onLock(started || !!onTerminal), [started, onTerminal, onLock])

  const settle = (index: number, method: Method, saleId?: string) => {
    if (saleId) clientId.current = saleId
    const next = Array.from({ length: count }, (_, i) => (i === index ? { code: method.code, label: method.label } : (paid[i] ?? null)))
    setPaid(next)
    setOnTerminal(null)
    if (next.every(Boolean)) {
      onPay(next.map((p, i) => ({ code: p!.code, amount: amounts[i] / 100 })), clientId.current)
    }
  }

  const choose = (index: number, method: Method) => {
    if (method.kind === PaymentKind.CARD && device && navigator.onLine) return setOnTerminal({ index, method })
    settle(index, method)
  }

  if (onTerminal && device) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">
          Part {onTerminal.index + 1} sur {count}
        </p>
        <TerminalWait
          // Une seule vente : toutes les parts portent le même identifiant
          key={onTerminal.index}
          siteId={siteId}
          device={device}
          amount={amounts[onTerminal.index] / 100}
          clientSaleId={clientId.current}
          onApproved={(saleId) => settle(onTerminal.index, onTerminal.method, saleId)}
          onPaidElsewhere={() => settle(onTerminal.index, onTerminal.method)}
          onBack={() => setOnTerminal(null)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[15px] font-medium" id="parts-label">
          Nombre de parts
        </span>
        <div className="flex items-center rounded-[var(--radius-pill)] border border-[var(--color-border)]" aria-labelledby="parts-label">
          <button
            type="button"
            disabled={started || count <= 2}
            onClick={() => setCount((c) => c - 1)}
            aria-label="Une part de moins"
            className="grid size-11 place-items-center rounded-[var(--radius-pill)] disabled:opacity-40"
          >
            <Minus size={18} />
          </button>
          <span className="tabular w-8 text-center text-lg font-semibold" aria-live="polite">
            {count}
          </span>
          <button
            type="button"
            disabled={started || count >= 20}
            onClick={() => setCount((c) => c + 1)}
            aria-label="Une part de plus"
            className="grid size-11 place-items-center rounded-[var(--radius-pill)] disabled:opacity-40"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <ol className="divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
        {amounts.map((cents, i) => (
          <li key={i} className="space-y-2 px-4 py-3">
            <p className="flex items-baseline justify-between">
              <span className="text-[15px] font-medium">Part {i + 1}</span>
              <span className="tabular text-[15px] font-semibold">{formatPrice(cents / 100)}</span>
            </p>
            {paid[i] ? (
              <p className="flex items-center gap-2 text-sm">
                <CheckCircle size={18} weight="fill" aria-hidden className="text-[var(--color-accent)]" />
                Payée, {paid[i]!.label.toLowerCase()}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {methods.map((m) => (
                  <button
                    key={m.code}
                    type="button"
                    disabled={busy}
                    onClick={() => choose(i, m)}
                    className="h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-sm font-medium hover:border-[var(--color-accent)]"
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>

      {started ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Encaissez les parts restantes pour terminer la vente.</p>
      ) : (
        <button type="button" onClick={onBack} className="h-11 w-full text-sm font-medium text-[var(--color-text-secondary)]">
          Ne pas diviser
        </button>
      )}
    </div>
  )
}
