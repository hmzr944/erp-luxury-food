'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle } from '@phosphor-icons/react'
import { formatPrice } from '@erp/utils'
import { PaymentKind } from '@erp/types'
import type { PaymentDevice } from '@/lib/api/payments'
import type { PlatformConfig } from '@/lib/api/platform'
import { getBridgeTpe } from '@/lib/bridge'
import { TerminalWait } from './TerminalWait'
import { BridgeTerminalWait } from './BridgeTerminalWait'
import type { PayLine } from './CreditPayment'

type Method = PlatformConfig['paymentMethods'][number]

// Carte titre-restaurant (Swile, Edenred, Pluxee, Up) : acceptée par le TPE
// quand l'acquéreur est affilié à Conecs (research_notes, materiel_paiement.md).
// Sources disponibles : TPE bancaire (Caisse-AP), SumUp. Rien sur Stripe
// Terminal : la saisie manuelle reste la règle pour ce TPE.
export const MEAL_CARD_CODE = 'TICKET_RESTO_CARD'

export type MealCardTpe = { kind: 'device'; device: PaymentDevice } | { kind: 'bridge' }

// TPE connecté (par Internet) d'abord, comme pour la carte bancaire, puis le
// TPE bancaire du pont (sur place, sans Internet). Aucun : saisie manuelle.
export function mealCardTpe(method: Pick<Method, 'code'>, device: PaymentDevice | null, bridgeTpe: boolean, online: boolean): MealCardTpe | null {
  if (method.code !== MEAL_CARD_CODE) return null
  if (device && online && (device.provider === 'SUMUP' || device.provider === 'SIMULATOR')) return { kind: 'device', device }
  if (bridgeTpe) return { kind: 'bridge' }
  return null
}

interface MealCardPaymentProps {
  siteId: string
  tpe: MealCardTpe
  method: Method
  total: number
  // Montant payable en titre-restaurant (articles éligibles, plafond par ticket)
  allowed: number
  // Moyens pour le reste, si le titre-restaurant ne couvre pas tout
  methods: Method[]
  // TPE connecté, pour payer le reste par carte bancaire
  device: PaymentDevice | null
  bridgeTpe: boolean
  busy: boolean
  onLock: (locked: boolean) => void
  onPay: (payments: PayLine[], clientId?: string) => void
  onBack: () => void
}

type Step = { kind: 'meal' } | { kind: 'rest'; line: PayLine } | { kind: 'restCard'; line: PayLine; method: Method; via: 'device' | 'bridge' }

// Le montant du titre-restaurant part au TPE, comme une carte bancaire. Au-delà
// du plafond ou des articles éligibles, le reste se paie ensuite avec un autre
// moyen ; la caisse reste verrouillée tant que la vente n'est pas soldée.
export function MealCardPayment({ siteId, tpe, method, total, allowed, methods, device, bridgeTpe, busy, onLock, onPay, onBack }: MealCardPaymentProps) {
  const [step, setStep] = useState<Step>({ kind: 'meal' })
  const clientSaleId = useRef<string>(crypto.randomUUID())
  const amount = Math.min(allowed, total)
  const rest = Math.round((total - amount) * 100) / 100

  // Titre-restaurant accepté : l'argent est pris, on ne ferme plus sans solder
  const accepted = step.kind !== 'meal'
  useEffect(() => onLock(accepted), [accepted, onLock])

  const approved = (reference: string | undefined, saleId?: string) => {
    const line: PayLine = { code: method.code, amount, ...(reference ? { reference } : {}) }
    if (rest <= 0) return onPay([line], saleId)
    setStep({ kind: 'rest', line })
  }

  if (step.kind === 'meal') {
    const intro = (
      <p className="text-sm text-[var(--color-text-secondary)]">
        {method.label} : <span className="tabular font-semibold text-[var(--color-text-primary)]">{formatPrice(amount)}</span> sur le TPE
        {rest > 0 && (
          <>
            , le reste (<span className="tabular">{formatPrice(rest)}</span>) avec un autre moyen ensuite
          </>
        )}
        .
      </p>
    )
    return (
      <div className="space-y-4">
        {intro}
        {tpe.kind === 'device' ? (
          <TerminalWait
            siteId={siteId}
            device={tpe.device}
            amount={amount}
            clientSaleId={clientSaleId.current}
            onApproved={(saleId) => approved(undefined, saleId)}
            onPaidElsewhere={() => approved(undefined)}
            onBack={onBack}
          />
        ) : (
          <BridgeTerminalWait config={getBridgeTpe()} amount={amount} onApproved={(ref) => approved(ref)} onPaidElsewhere={() => approved(undefined)} onBack={onBack} />
        )}
      </div>
    )
  }

  if (step.kind === 'restCard') {
    const done = (reference?: string, saleId?: string) =>
      onPay([step.line, { code: step.method.code, amount: rest, ...(reference ? { reference } : {}) }], saleId ?? (tpe.kind === 'device' ? clientSaleId.current : undefined))
    return step.via === 'device' && device ? (
      <TerminalWait
        siteId={siteId}
        device={device}
        amount={rest}
        clientSaleId={clientSaleId.current}
        onApproved={(saleId) => done(undefined, saleId)}
        onPaidElsewhere={() => done()}
        onBack={() => setStep({ kind: 'rest', line: step.line })}
      />
    ) : (
      <BridgeTerminalWait config={getBridgeTpe()} amount={rest} onApproved={(ref) => done(ref)} onPaidElsewhere={() => done()} onBack={() => setStep({ kind: 'rest', line: step.line })} />
    )
  }

  // Reste à payer : pas un second titre-restaurant (le plafond est atteint ou
  // plus rien n'est éligible), ni un moyen qui demande un code ou un numéro
  const others = methods.filter((m) => !m.mealVoucher && !m.requiresReference && m.code !== 'CREDIT' && m.code !== 'GIFT_CARD')
  const line = step.line
  return (
    <div className="space-y-4">
      <p role="status" className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent-muted)] p-3 text-[15px] font-medium">
        <CheckCircle size={20} aria-hidden weight="fill" className="shrink-0 text-[var(--color-accent)]" />
        {method.label} acceptée : <span className="tabular">{formatPrice(line.amount)}</span>
      </p>
      <p className="text-[15px] font-medium">
        Reste <span className="tabular">{formatPrice(rest)}</span>, payé en :
      </p>
      <ul className="grid grid-cols-2 gap-2">
        {others.map((m) => (
          <li key={m.code}>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (m.kind === PaymentKind.CARD && device && navigator.onLine) return setStep({ kind: 'restCard', line, method: m, via: 'device' })
                if (m.kind === PaymentKind.CARD && bridgeTpe) return setStep({ kind: 'restCard', line, method: m, via: 'bridge' })
                onPay([line, { code: m.code, amount: rest }], tpe.kind === 'device' ? clientSaleId.current : undefined)
              }}
              className="h-14 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-[15px] font-semibold hover:border-[var(--color-accent)] disabled:opacity-50 press"
            >
              {m.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
