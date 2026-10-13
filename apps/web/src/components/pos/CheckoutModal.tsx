'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CreditCard, Money, Ticket, Invoice, CheckCircle, Warning } from '@phosphor-icons/react'
import { formatPrice } from '@erp/utils'
import { useCartStore, computeCartTotals } from '@/stores/cart.store'
import { usePlatformConfig } from '@/lib/api/platform'
import { recordSale, type RecordedSale } from '@/lib/terminal/terminal'
import { PaymentKind } from '@erp/types'
import { toast } from 'sonner'

interface CheckoutModalProps {
  siteId: string
  isOpen: boolean
  onClose: () => void
}

const KIND_ICON: Record<PaymentKind, React.ElementType> = {
  [PaymentKind.CARD]: CreditCard,
  [PaymentKind.CASH]: Money,
  [PaymentKind.VOUCHER]: Ticket,
  [PaymentKind.TRANSFER]: Invoice,
  [PaymentKind.OTHER]: Invoice,
}

type Step = 'payment' | 'loading' | 'success' | 'error'

export function CheckoutModal({ siteId, isOpen, onClose }: CheckoutModalProps) {
  const { lines, orderDiscount, clearCart } = useCartStore()
  const { data: config } = usePlatformConfig()
  const priceIncludesTax = config?.priceIncludesTax ?? true
  const { total } = computeCartTotals(lines, orderDiscount, priceIncludesTax)
  const methods = (config?.paymentMethods ?? []).filter((m) => m.isActive)
  const [paymentCode, setPaymentCode] = useState('CARD')
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<Step>('payment')
  const [order, setOrder] = useState<RecordedSale | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const handleClose = () => {
    if (step === 'loading') return
    setStep('payment')
    setOrder(null)
    setErrorMsg('')
    onClose()
  }

  const handleConfirm = async () => {
    if (lines.length === 0) return

    setStep('loading')

    try {
      // Ticket signé par cette caisse : valable tout de suite, même sans réseau.
      // L'envoi au serveur se fait en arrière-plan.
      const result = await recordSale(siteId, {
        items: lines.map((l) => ({
          productId: l.product.id,
          variantId: l.variantId,
          quantity: l.quantity,
          unitPrice: l.product.price,
          taxRate: l.product.taxRate,
          ...(l.discount > 0 ? { discount: l.discount } : {}),
        })),
        payments: [{ code: paymentCode, amount: total }],
        orderDiscount: orderDiscount || undefined,
        customerEmail: email.trim() || undefined,
        priceIncludesTax,
      })
      setOrder(result)
      setStep('success')
      clearCart()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'encaissement'
      setErrorMsg(msg)
      setStep('error')
      toast.error(msg)
    }
  }

  const handleNewOrder = () => {
    setStep('payment')
    setOrder(null)
    setErrorMsg('')
    setEmail('')
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={handleClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed inset-x-0 bottom-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-50 w-full md:w-[440px] bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-t-[var(--radius-xl)] md:rounded-[var(--radius-xl)] shadow-2xl"
          >
            {/* Header modal */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[var(--color-border)]">
              <h2 className="font-body text-base font-semibold text-[var(--color-text-primary)]">
                {step === 'success' ? 'Encaissement confirmé' : step === 'error' ? 'Erreur' : 'Encaisser'}
              </h2>
              {step !== 'loading' && (
                <button
                  onClick={handleClose}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1"
                >
                  <X size={16} weight="regular" />
                </button>
              )}
            </div>

            <div className="px-5 py-5">
              <AnimatePresence mode="wait">
                {step === 'payment' && (
                  <motion.div
                    key="payment"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-5"
                  >
                    {/* Total */}
                    <div className="flex items-baseline justify-between">
                      <span className="font-body text-sm text-[var(--color-text-muted)]">Total TTC</span>
                      <span className="font-data text-2xl text-[var(--color-text-primary)]">
                        {formatPrice(total)}
                      </span>
                    </div>

                    {/* Mode de paiement */}
                    <div className="space-y-2">
                      <p className="font-body text-xs text-[var(--color-text-muted)] uppercase tracking-wide">
                        Mode de paiement
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {methods.map(({ code, label, kind }) => {
                          const active = paymentCode === code
                          const Icon = KIND_ICON[kind]
                          return (
                            <button
                              key={code}
                              onClick={() => setPaymentCode(code)}
                              className={[
                                'flex items-center gap-3 px-3 py-3 rounded-[var(--radius-md)] border text-left transition-all',
                                active
                                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent)]'
                                  : 'border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]',
                              ].join(' ')}
                            >
                              <Icon size={16} weight={active ? 'fill' : 'regular'} />
                              <span className="font-body text-sm leading-tight">{label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Email reçu (optionnel) */}
                    <div className="space-y-1.5">
                      <label className="font-body text-xs text-[var(--color-text-muted)]">
                        Email reçu <span className="text-[var(--color-text-muted)]/60">(optionnel)</span>
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="client@email.fr"
                        className="w-full h-9 px-3 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] font-body text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]/40 focus:ring-1 focus:ring-[var(--color-accent)]/20 transition-colors"
                      />
                    </div>

                    <motion.button
                      onClick={handleConfirm}
                      whileTap={{ scale: 0.98 }}
                      className="w-full h-12 bg-[var(--color-accent)] text-black font-body text-sm font-semibold rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] active:-translate-y-px transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                    >
                      Confirmer {formatPrice(total)}
                    </motion.button>
                  </motion.div>
                )}

                {step === 'loading' && (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-4 py-8"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-10 h-10 rounded-full border-2 border-[var(--color-border-strong)] border-t-[var(--color-accent)]"
                    />
                    <p className="font-body text-sm text-[var(--color-text-muted)]">
                      Signature du ticket...
                    </p>
                  </motion.div>
                )}

                {step === 'success' && order && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-5 py-4"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                    >
                      <CheckCircle size={48} weight="fill" className="text-[var(--color-success)]" />
                    </motion.div>

                    <div className="text-center space-y-1">
                      <p className="font-data text-2xl text-[var(--color-text-primary)]">
                        {formatPrice(order.pricing.total)}
                      </p>
                      <p className="font-body text-xs text-[var(--color-text-muted)]">
                        {methods.find((m) => m.code === paymentCode)?.label}
                      </p>
                    </div>

                    {/* NF525 info */}
                    {order.receipt && (
                      <div className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-3 space-y-1">
                        <div className="flex justify-between">
                          <span className="font-data text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">
                            Ticket
                          </span>
                          <span className="font-data text-[11px] text-[var(--color-accent)]">
                            {order.terminalName} · n° {order.receipt.counter}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-data text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">
                            NF525
                          </span>
                          <span className="font-data text-[10px] text-[var(--color-text-muted)]">
                            {order.receipt.hash.substring(0, 16)}...
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-data text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">
                            Signé
                          </span>
                          <span className="font-data text-[10px] text-[var(--color-text-muted)]">
                            {new Date(order.receipt.signedAt).toLocaleTimeString('fr-FR')}
                          </span>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleNewOrder}
                      className="w-full h-11 bg-[var(--color-accent)] text-black font-body text-sm font-semibold rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] transition-all"
                    >
                      Nouvelle commande
                    </button>
                  </motion.div>
                )}

                {step === 'error' && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-4 py-6"
                  >
                    <Warning size={40} weight="fill" className="text-[var(--color-danger)]" />
                    <p className="font-body text-sm text-[var(--color-text-secondary)] text-center">
                      {errorMsg}
                    </p>
                    <button
                      onClick={() => setStep('payment')}
                      className="w-full h-11 border border-[var(--color-border)] text-[var(--color-text-primary)] font-body text-sm rounded-[var(--radius-md)] hover:bg-[var(--color-bg-hover)] transition-colors"
                    >
                      Réessayer
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
