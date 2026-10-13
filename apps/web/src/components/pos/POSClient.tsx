'use client'

import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { toast } from 'sonner'
import { formatPrice } from '@erp/utils'
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
import { PaymentSheet, type ReceiptView } from './PaymentSheet'
import { Sheet, EASE } from './Sheet'
import { useSaleQueue } from './useSaleQueue'
import { CustomItemSheet, QuickProductSheet } from './QuickSheets'
import type { PayLine } from './CreditPayment'
import { ReturnFinder } from './ReturnFinder'
import { CashCloseSheet, CashOpenSheet, useCashState } from './CashSheets'
import { PinPad } from '@/components/auth/PinPad'
import { BadgeLogin } from '@/components/auth/BadgeLogin'
import { useAuthStore } from '@/stores/auth.store'

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
  const { pinLogin, badgeLogin } = useAuthStore()
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

  const pay = async (payments: PayLine[], email?: string, clientId?: string) => {
    setBusy(true)
    setPayError(null)
    const sold = [...lines]
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
      })
      const labels = new Map(methods.map((m) => [m.code, m.label]))
      setReceipt({
        sale,
        lines: sold,
        payments: payments.map((p) => ({ label: labels.get(p.code) ?? p.code, amount: p.amount })),
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
        />

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
              initial={{ y: 96 }}
              animate={{ y: 0 }}
              exit={{ y: 96 }}
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

        <PaymentSheet
          open={paying}
          siteId={siteId}
          device={device}
          total={totals.total}
          methods={methods}
          siteName={siteName}
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
