'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { toast } from 'sonner'
import { formatPrice, priceOrder } from '@erp/utils'
import { productsApi, type ApiProduct, type ApiVariant } from '@/lib/api/products'
import { sitesApi } from '@/lib/api/sites'
import { paymentsApi, type PaymentDevice } from '@/lib/api/payments'
import { usePlatformConfig } from '@/lib/api/platform'
import { ensureTerminal, recordSale, type TerminalNotRegisteredError } from '@/lib/terminal/terminal'
import { useCartStore, computeCartTotals } from '@/stores/cart.store'
import { POSHeader } from './POSHeader'
import { Catalog } from './Catalog'
import { Ticket } from './Ticket'
import { VariantPicker } from './VariantPicker'
import { PaymentSheet, type PayOptions, type ReceiptView } from './PaymentSheet'
import { Sheet, EASE } from './Sheet'
import { useSaleQueue } from './useSaleQueue'
import { CustomItemSheet, QuickProductSheet } from './QuickSheets'
import type { PayLine } from './CreditPayment'
import { ReturnFinder } from './ReturnFinder'
import { CashCloseSheet, CashOpenSheet, useCashState } from './CashSheets'
import { PinPad } from '@/components/auth/PinPad'
import { BadgeLogin } from '@/components/auth/BadgeLogin'
import { useAuthStore } from '@/stores/auth.store'
import { fiscalApi } from '@/lib/api/fiscal'
import { BridgeTpeSettings } from '@/components/settings/BridgeTpeSettings'
import { PrinterDevice } from '@/components/settings/PrinterDevice'
import type { RecordedSale } from '@/lib/terminal/terminal'

interface POSClientProps {
  siteId: string
}

// Caisse : choisir les articles, encaisser, ticket signé. Trois gestes pour
// une vente simple, sans dépendre du réseau.
export function POSClient({ siteId }: POSClientProps) {
  const { lines, orderDiscount, addProduct, clearCart } = useCartStore()
  const { data: config } = usePlatformConfig()
  const queue = useSaleQueue(siteId)
  const [terminalName, setTerminalName] = useState<string>()
  const [terminalId, setTerminalId] = useState<string>()
  const cash = useCashState(siteId, terminalId, queue.online)
  const [cashSheet, setCashSheet] = useState<'open' | 'close' | null>(null)
  const [openDismissed, setOpenDismissed] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const { pinLogin, badgeLogin, user } = useAuthStore()
  const sellerName = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : null
  const manager = user?.role === 'OWNER' || user?.role === 'MANAGER'
  const [printerOpen, setPrinterOpen] = useState(false)
  // Mode formation : propre à cet appareil, activé par un responsable.
  // Les ventes sont fictives : ni grand livre, ni stock, ni caisse.
  const trainingKey = `flow-training:${siteId}`
  const [training, setTraining] = useState(false)
  useEffect(() => {
    try {
      setTraining(window.localStorage.getItem(trainingKey) === '1')
    } catch {
      // stockage indisponible : le mode formation reste désactivé
    }
  }, [trainingKey])
  const toggleTraining = async () => {
    const next = !training
    try {
      await fiscalApi.training(siteId, next, terminalId)
    } catch (e) {
      toast.error(`Mode formation : ${(e as Error).message}. Une connexion est nécessaire pour le tracer.`)
      return
    }
    try {
      if (next) window.localStorage.setItem(trainingKey, '1')
      else window.localStorage.removeItem(trainingKey)
    } catch {
      // réglage gardé pour la session
    }
    setTraining(next)
    toast(next ? 'Mode formation : les ventes sont fictives' : 'Mode formation terminé')
  }
  const [picking, setPicking] = useState<ApiProduct | null>(null)
  const [paying, setPaying] = useState(false)
  const [ticketOpen, setTicketOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<ReceiptView | null>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [createSeed, setCreateSeed] = useState<string | null>(null)
  const [returning, setReturning] = useState(false)
  // Échange : l'écran de retour renvoie ici avec le code de l'avoir
  const [creditCode, setCreditCode] = useState<string>()
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('avoir')
    if (code) {
      setCreditCode(code)
      toast(`Avoir ${code} prêt : ajoutez les articles, puis Encaisser et Avoir.`)
    }
  }, [])

  const products = useQuery({
    queryKey: ['products', siteId],
    queryFn: () => productsApi.getAll(siteId),
    staleTime: 60_000,
  })
  const categories = useQuery({
    queryKey: ['categories', siteId],
    queryFn: () => productsApi.getCategories(siteId),
    staleTime: 60_000,
  })
  // Article libre : produit technique du site, gardé en cache pour le hors ligne
  const customProduct = useQuery({
    queryKey: ['custom-product', siteId],
    queryFn: () => productsApi.customProduct(siteId),
    staleTime: Infinity,
  })
  const sites = useQuery({ queryKey: ['sites'], queryFn: sitesApi.getAll, staleTime: 5 * 60_000 })
  const siteName = sites.data?.find((s) => s.id === siteId)?.name ?? 'Caisse'
  // TPE connecté de cette caisse : celui choisi sur cet appareil, sinon le premier
  const devices = useQuery({ queryKey: ['payment-devices', siteId], queryFn: () => paymentsApi.devices(siteId), staleTime: 60_000 })
  const device = useTerminalDevice(siteId, devices.data ?? [])

  // Cet appareil devient une caisse du site à sa première ouverture
  useEffect(() => {
    ensureTerminal(siteId)
      .then((t) => {
        setTerminalName(t.name)
        setTerminalId(t.terminalId)
        queue.flush()
      })
      .catch((e: TerminalNotRegisteredError) => toast.error(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId])

  const priceIncludesTax = config?.priceIncludesTax ?? true
  const totals = computeCartTotals(lines, orderDiscount, priceIncludesTax)
  const methods = (config?.paymentMethods ?? []).filter((m) => m.isActive)
  // TTC de chaque ligne, remise globale répartie : base des règles d'encaissement
  const ruleLines = useMemo(() => {
    const priced = priceOrder(
      lines.map((l) => ({ unitPrice: l.product.price, quantity: l.quantity, discount: l.discount, taxRate: l.product.taxRate })),
      { priceIncludesTax, orderDiscount },
    )
    return lines.map((l, i) => ({ total: priced.lines[i]?.ttc ?? 0, mealVoucherEligible: !!l.product.mealVoucher }))
  }, [lines, orderDiscount, priceIncludesTax])

  const add = useCallback(
    (product: ApiProduct, variant?: ApiVariant, serialNumber?: string) => {
      addProduct(
        {
          id: product.id,
          name: product.name,
          subtitle: product.subtitle ?? undefined,
          price: Number(variant?.price ?? product.price),
          taxRate: Number(product.taxRate),
          categoryId: product.categoryId ?? undefined,
          mealVoucher: !!product.mealVoucherEligible,
        },
        { variantId: variant?.id, variantName: variant?.name, serialNumber },
      )
      setPicking(null)
    },
    [addProduct],
  )

  // Produit simple : ajouté d'un geste. Variantes ou n° de série : on demande.
  const pick = (product: ApiProduct, variant?: ApiVariant) => {
    if (variant && product.tracking !== 'SERIAL') return add(product, variant)
    if (product.variants.length || product.tracking === 'SERIAL') return setPicking(product)
    add(product)
  }

  const pay = async (payments: PayLine[], email?: string, clientId?: string, options: PayOptions = {}) => {
    setBusy(true)
    setPayError(null)
    const sold = [...lines]
    const labels = new Map(methods.map((m) => [m.code, m.label]))
    const cashCodes = new Set(methods.filter((m) => m.kind === 'CASH').map((m) => m.code))
    const cashPaid = payments.some((p) => cashCodes.has(p.code))
    // Monnaie rendue : espèces remises moins la part payée en espèces
    const cashDue = payments.filter((p) => cashCodes.has(p.code)).reduce((a, p) => a + Math.round(p.amount * 100), 0)
    const change = options.tendered != null ? Math.max(0, Math.round(options.tendered * 100) - cashDue) / 100 : undefined
    if (training) {
      try {
        const pricing = priceOrder(
          sold.map((l) => ({ unitPrice: l.product.price, quantity: l.quantity, discount: l.discount, taxRate: l.product.taxRate })),
          { priceIncludesTax, orderDiscount },
        )
        const t = await fiscalApi.trainingTicket(siteId, {
          total: pricing.total,
          terminalId,
          content: {
            lines: sold.map((l) => ({ name: l.customName ?? l.product.name, variant: l.variantName ?? null, quantity: l.quantity, price: l.product.price, taxRate: l.product.taxRate })),
            payments,
          },
        })
        const fake: RecordedSale = {
          clientId: `training-${t.number}`,
          terminalName: terminalName ?? 'Caisse',
          receipt: { counter: t.number, previousHash: '', hash: '', signature: '', signedAt: t.createdAt, total: pricing.total },
          pricing,
        }
        setReceipt({
          sale: fake,
          lines: sold,
          payments: payments.map((p) => ({ label: labels.get(p.code) ?? p.code, amount: p.amount })),
          change,
          training: { number: t.number, operator: t.userName },
        })
        clearCart()
        setTicketOpen(false)
      } catch (e) {
        setPayError(`Mode formation : ${e instanceof Error ? e.message : 'ticket fictif non enregistré'}`)
      } finally {
        setBusy(false)
      }
      return
    }
    try {
      const sale = await recordSale(siteId, {
        items: sold.map((l) => ({
          productId: l.product.id,
          ...(l.variantId ? { variantId: l.variantId } : {}),
          quantity: l.quantity,
          unitPrice: l.product.price,
          taxRate: l.product.taxRate,
          ...(l.discount > 0 ? { discount: l.discount } : {}),
          ...(l.serialNumber ? { serialNumber: l.serialNumber } : {}),
          ...(l.customName ? { customName: l.customName } : {}),
        })),
        payments,
        orderDiscount: orderDiscount || undefined,
        customerEmail: email,
        priceIncludesTax,
        clientId,
        nonResident: options.nonResident || undefined,
      })
      setReceipt({
        sale,
        lines: sold,
        payments: payments.map((p) => ({ label: labels.get(p.code) ?? p.code, amount: p.amount })),
        change,
        cashPaid,
      })
      clearCart()
      setTicketOpen(false)
      if (payments.some((p) => p.code === 'CREDIT')) {
        setCreditCode(undefined)
        window.history.replaceState(null, '', window.location.pathname)
      }
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "La vente n'a pas pu être enregistrée")
    } finally {
      setBusy(false)
    }
  }

  const closePayment = () => {
    setPaying(false)
    setReceipt(null)
    setPayError(null)
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
        <POSHeader
          siteName={siteName}
          siteId={siteId}
          terminalName={terminalName}
          queue={queue}
          onReturn={() => setReturning(true)}
          cashOpen={cash.data ? !!cash.data.session : null}
          onCash={() => setCashSheet(cash.data?.session ? 'close' : 'open')}
          onSwitchUser={() => {
            setPinError(null)
            setSwitching(true)
          }}
          training={training}
          onTraining={manager ? () => void toggleTraining() : undefined}
          onPrinter={() => setPrinterOpen(true)}
        />
        {training && (
          <div role="status" className="flex items-center justify-between gap-3 bg-[var(--color-bg-inverse)] px-4 py-2 text-sm font-semibold text-[var(--color-text-inverse)]">
            <span>Mode formation : ventes fictives, ni comptées, ni déstockées. Tickets marqués « fictif ».</span>
            {manager && (
              <button type="button" onClick={() => void toggleTraining()} className="h-9 shrink-0 rounded-[var(--radius-pill)] border border-current px-3">
                Quitter
              </button>
            )}
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <Catalog
            products={products.data ?? []}
            categories={categories.data ?? []}
            isLoading={products.isLoading}
            isError={products.isError}
            onPick={pick}
            onCustom={() => setCustomOpen(true)}
            onCreate={setCreateSeed}
          />

          {/* Tablette et ordinateur : le ticket reste visible à droite */}
          <aside
            aria-label="Vente en cours"
            className="hidden w-[380px] shrink-0 border-l border-[var(--color-border)] bg-[var(--color-bg-surface)] md:block lg:w-[420px]"
          >
            <Ticket totals={totals} priceIncludesTax={priceIncludesTax} onCheckout={() => setPaying(true)} />
          </aside>
        </div>

        {/* Téléphone : barre de vente en bas, le ticket s'ouvre au toucher */}
        <AnimatePresence>
          {totals.itemCount > 0 && !paying && !ticketOpen && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.22, ease: EASE }}
              className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
            >
              <button
                type="button"
                onClick={() => setTicketOpen(true)}
                className="flex h-14 min-w-0 flex-1 flex-col items-start justify-center rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-left"
              >
                <span className="text-sm text-[var(--color-text-secondary)]">
                  {totals.itemCount} {totals.itemCount > 1 ? 'articles' : 'article'}
                </span>
                <span className="tabular text-lg font-semibold leading-tight">{formatPrice(totals.total)}</span>
              </button>
              <button
                type="button"
                onClick={() => setPaying(true)}
                className="h-14 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 text-lg font-semibold text-[var(--color-on-accent)]"
              >
                Encaisser
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <Sheet open={ticketOpen} title="Vente en cours" onClose={() => setTicketOpen(false)}>
          <div className="-mx-5 h-[70dvh]">
            <Ticket
              totals={totals}
              priceIncludesTax={priceIncludesTax}
              onCheckout={() => {
                setTicketOpen(false)
                setPaying(true)
              }}
            />
          </div>
        </Sheet>

        <VariantPicker product={picking} onClose={() => setPicking(null)} onChoose={add} />

        <CustomItemSheet
          open={customOpen}
          config={config}
          onClose={() => setCustomOpen(false)}
          onAdd={(item) => {
            const custom = customProduct.data
            if (!custom) return toast.error('Article libre indisponible : connectez la caisse une première fois.')
            addProduct({ id: custom.id, name: item.name, price: item.price, taxRate: item.taxRate }, { customName: item.name })
            setCustomOpen(false)
          }}
        />

        <QuickProductSheet
          siteId={siteId}
          seed={createSeed}
          config={config}
          categories={categories.data ?? []}
          onClose={() => setCreateSeed(null)}
          onCreated={(product) => {
            setCreateSeed(null)
            add(product)
            toast.success(`${product.name} ajouté au catalogue`)
          }}
        />

        {terminalId && (
          <>
            {/* Ouverture proposée d'office tant que le tiroir n'est pas ouvert */}
            <CashOpenSheet
              siteId={siteId}
              terminalId={terminalId}
              open={
                cashSheet === 'open' ||
                // Proposée d'office le matin, pas juste après la fermeture du soir
                (!!cash.data &&
                  !cash.data.session &&
                  !openDismissed &&
                  (!cash.data.lastClosedAt || new Date(cash.data.lastClosedAt).toDateString() !== new Date().toDateString()))
              }
              onClose={() => {
                setOpenDismissed(true)
                setCashSheet(null)
              }}
            />
            <CashCloseSheet siteId={siteId} terminalId={terminalId} open={cashSheet === 'close'} pendingSales={queue.pending} onClose={() => setCashSheet(null)} />
          </>
        )}

        <Sheet open={switching} title="Qui encaisse ?" onClose={() => setSwitching(false)}>
          <div className="pb-4">
            <PinPad
              error={pinError}
              onSubmit={async (pin) => {
                try {
                  await pinLogin(siteId, pin)
                  setSwitching(false)
                  toast.success(`Bonjour ${useAuthStore.getState().user?.firstName ?? ''}`)
                } catch (e) {
                  setPinError((e as Error).message)
                  throw e
                }
              }}
            />
            <div className="mt-5">
              <BadgeLogin
                active={switching}
                onBadge={async (code) => {
                  await badgeLogin(siteId, code)
                  setSwitching(false)
                  toast.success(`Bonjour ${useAuthStore.getState().user?.firstName ?? ''}`)
                }}
              />
            </div>
          </div>
        </Sheet>

        <ReturnFinder
          siteId={siteId}
          open={returning}
          onUseCredit={(code) => {
            setReturning(false)
            setCreditCode(code)
            toast(`Avoir ${code} prêt : ajoutez les articles, puis Encaisser et Avoir.`)
          }}
          onClose={() => setReturning(false)}
        />

        <Sheet open={printerOpen} title="Imprimante, tiroir et TPE" onClose={() => setPrinterOpen(false)} width="lg">
          <div className="pb-2">
            <PrinterDevice />
            <h3 className="mb-3 mt-8 text-[15px] font-semibold">TPE bancaire</h3>
            <BridgeTpeSettings />
          </div>
        </Sheet>

        <PaymentSheet
          open={paying}
          siteId={siteId}
          device={device}
          total={totals.total}
          ruleLines={ruleLines}
          methods={methods}
          siteName={siteName}
          receiptSettings={config?.receipt}
          sellerName={sellerName}
          receipt={receipt}
          busy={busy}
          error={payError}
          creditCode={creditCode}
          onPay={pay}
          onClose={closePayment}
        />
      </div>
    </MotionConfig>
  )
}

function useTerminalDevice(siteId: string, devices: PaymentDevice[]) {
  const [preferred, setPreferred] = useState<string | null>(null)
  useEffect(() => {
    try {
      setPreferred(localStorage.getItem(`pos:device:${siteId}`))
    } catch {
      setPreferred(null)
    }
  }, [siteId])
  return devices.find((d) => d.id === preferred) ?? devices[0] ?? null
}
