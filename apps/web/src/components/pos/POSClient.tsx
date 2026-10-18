'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { toast } from 'sonner'
import { formatPrice, giftCardLineName, priceForWeight, priceMenu, priceOrder, priceWithModifiers, type ModifierChoice, type ScaleBarcode } from '@erp/utils'
import { productsApi, type ApiProduct, type ApiVariant } from '@/lib/api/products'
import { sitesApi } from '@/lib/api/sites'
import { paymentsApi, type PaymentDevice } from '@/lib/api/payments'
import { usePlatformConfig } from '@/lib/api/platform'
import { ensureTerminal, recordSale, type TerminalNotRegisteredError } from '@/lib/terminal/terminal'
import { useCartStore, computeCartTotals, isFixedLine, lineDetail, loyaltyRoom, saleItems, signedItem, withLoyalty, type CartMenuPart } from '@/stores/cart.store'
import { customerName, customersApi } from '@/lib/api/customers'
import { CustomerSheet, GiftCardSheet } from './LoyaltySheets'
import { useDisplayPublisher } from '@/lib/display/publisher'
import type { DisplayState } from '@/lib/display/state'
import { receiptUrl } from '@/lib/receipts'
import { DisplaySheet } from './DisplaySheet'
import { POSHeader } from './POSHeader'
import { Catalog } from './Catalog'
import { Ticket } from './Ticket'
import { VariantPicker } from './VariantPicker'
import { MenuComposer, ModifierSheet, WeightSheet, groupsOf } from './Composition'
import { PaymentSheet, type PayOptions, type ReceiptView } from './PaymentSheet'
import { Sheet, EASE } from './Sheet'
import { useSaleQueue } from './useSaleQueue'
import { CustomItemSheet, QuickProductSheet } from './QuickSheets'
import type { PayLine } from './CreditPayment'
import { ReturnFinder } from './ReturnFinder'
import { CashCloseSheet, CashOpenSheet, useCashState } from './CashSheets'
import { DiscoveryChecklist, useDiscovery } from './Discovery'
import { ClosingChecklist, LockScreen, RoutineBanner, YesterdayClosure, useIdle, useRoutine } from './Routine'
import { PinPad } from '@/components/auth/PinPad'
import { BadgeLogin } from '@/components/auth/BadgeLogin'
import { useAuthStore } from '@/stores/auth.store'
import { fiscalApi } from '@/lib/api/fiscal'
import { BridgeTpeSettings } from '@/components/settings/BridgeTpeSettings'
import { PrinterDevice } from '@/components/settings/PrinterDevice'
import type { RecordedSale } from '@/lib/terminal/terminal'

interface POSClientProps {
  siteId: string
  // Arrivée juste après l'inscription : mode découverte
  discovery?: boolean
}

// Caisse : choisir les articles, encaisser, ticket signé. Trois gestes pour
// une vente simple, sans dépendre du réseau.
export function POSClient({ siteId, discovery: startDiscovery }: POSClientProps) {
  const { lines, orderDiscount, addProduct, clearCart, customer, loyalty, setCustomer, setLoyalty } = useCartStore()
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
  const [displayOpen, setDisplayOpen] = useState(false)
  // QR de paiement montré à l'écran client
  const [qrShown, setQrShown] = useState<{ url: string; expiresAt: string | null } | null>(null)

  // Routine de fermeture : bandeau, liste de fin de journée, verrouillage
  const qc = useQueryClient()
  const routine = useRoutine(siteId, queue.online)
  const idle = useIdle(2 * 60_000)
  const [checklist, setChecklist] = useState<null | 'auto' | 'manual' | 'lock'>(null)
  const [checklistSnooze, setChecklistSnooze] = useState(0)
  const [locked, setLocked] = useState<null | 'manual' | 'unclosed'>(null)
  const [lockSnooze, setLockSnooze] = useState(0)
  const [lockError, setLockError] = useState<string | null>(null)
  const [retroClosing, setRetroClosing] = useState(false)
  const level = routine.data?.level ?? 0
  const pendingTasks = routine.data?.tasks.filter((t) => !t.done).length ?? 0
  // Niveau 2 : la liste s'ouvre quand la caisse est inactive, jamais en pleine vente
  useEffect(() => {
    if (level >= 2 && idle && !checklist && !locked && Date.now() > checklistSnooze) setChecklist('auto')
  }, [level, idle, checklist, locked, checklistSnooze])
  // Niveau 3 : caisse oubliée après la fermeture, verrouillée
  useEffect(() => {
    if (level === 3 && routine.data?.autoLock && !locked && Date.now() > lockSnooze) setLocked('unclosed')
  }, [level, routine.data?.autoLock, locked, lockSnooze])
  const discoveryChecklist = (variant: 'panel' | 'floating') =>
    discovery.state && (
      <DiscoveryChecklist
        variant={variant}
        siteId={siteId}
        state={discovery.state}
        canManage={manager}
        onToggle={discovery.toggle}
        onPrinter={() => setPrinterOpen(true)}
        onGoLive={async () => {
          if (training && !(await setTrainingMode(false))) return
          discovery.finish()
          toast.success('Caisse en vente réelle : chaque vente compte désormais')
          setCashSheet('open')
        }}
      />
    )

  const requestLock = () => {
    if (pendingTasks && level >= 1) setChecklist('lock')
    else setLocked('manual')
  }
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
  const toggleTraining = () => setTrainingMode(!training)
  const setTrainingMode = async (next: boolean) => {
    try {
      await fiscalApi.training(siteId, next, terminalId)
    } catch (e) {
      toast.error(`Mode formation : ${(e as Error).message}. Une connexion est nécessaire pour le tracer.`)
      return false
    }
    try {
      if (next) window.localStorage.setItem(trainingKey, '1')
      else window.localStorage.removeItem(trainingKey)
    } catch {
      // réglage gardé pour la session
    }
    setTraining(next)
    toast(next ? 'Mode formation : les ventes sont fictives' : 'Mode formation terminé')
    return true
  }

  // Mode découverte : première visite après l'inscription, ventes fictives
  const discovery = useDiscovery(siteId, !!startDiscovery)
  const discoveryStarted = useRef(false)
  useEffect(() => {
    if (!discovery.state?.active || discoveryStarted.current) return
    discoveryStarted.current = true
    if (startDiscovery) window.history.replaceState(null, '', window.location.pathname)
    if (!training && window.localStorage.getItem(trainingKey) !== '1') void setTrainingMode(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discovery.state?.active])
  const [picking, setPicking] = useState<ApiProduct | null>(null)
  const [modifying, setModifying] = useState<{ product: ApiProduct; variant?: ApiVariant; serialNumber?: string } | null>(null)
  const [composing, setComposing] = useState<ApiProduct | null>(null)
  const [weighing, setWeighing] = useState<ApiProduct | null>(null)
  const [paying, setPaying] = useState(false)
  const [ticketOpen, setTicketOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<ReceiptView | null>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [giftOpen, setGiftOpen] = useState(false)
  const [customerOpen, setCustomerOpen] = useState(false)
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
  // Carte cadeau : produit technique à 0 % de TVA, gardé pour le hors ligne
  const giftProduct = useQuery({
    queryKey: ['gift-card-product', siteId],
    queryFn: () => productsApi.giftCardProduct(siteId),
    staleTime: Infinity,
  })
  const loyaltyRules = useQuery({ queryKey: ['loyalty'], queryFn: customersApi.loyalty, staleTime: 5 * 60_000 })
  const sites = useQuery({ queryKey: ['sites'], queryFn: sitesApi.getAll, staleTime: 5 * 60_000 })
  const siteName = sites.data?.find((s) => s.id === siteId)?.name ?? 'Caisse'
  const siteAddress = sites.data?.find((s) => s.id === siteId)?.address ?? null
  // TPE connecté de cette caisse : celui choisi sur cet appareil, sinon le premier
  const devices = useQuery({ queryKey: ['payment-devices', siteId], queryFn: () => paymentsApi.devices(siteId), staleTime: 60_000 })
  const device = useTerminalDevice(siteId, devices.data ?? [])
  const qrProvider = useQuery({ queryKey: ['qr-provider', siteId], queryFn: () => paymentsApi.qrProvider(siteId), staleTime: 5 * 60_000, enabled: queue.online })

  // Vente en cours gardée sur l'appareil : relue au montage, réservée à ce site
  useEffect(() => {
    void Promise.resolve(useCartStore.persist.rehydrate()).then(() => useCartStore.getState().bindSite(siteId))
  }, [siteId])

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
  const totals = computeCartTotals(lines, orderDiscount, priceIncludesTax, loyalty?.amount)
  // Articles retirés après la récompense : elle ne peut plus dépasser la vente
  useEffect(() => {
    if (!loyalty) return
    if (loyaltyRoom(lines) + 0.001 < loyalty.amount) setLoyalty(null)
  }, [lines, loyalty, setLoyalty])
  const methods = (config?.paymentMethods ?? []).filter((m) => m.isActive)
  // TTC de chaque ligne, remise globale répartie : base des règles d'encaissement
  // Écran client : ce que voit le client, à chaque changement de la vente
  const lastAddedKey = useCartStore((st) => st.lastAddedKey)
  const displayState: DisplayState = qrShown && !receipt
    ? { kind: 'pay', shop: siteName, amount: totals.total, url: qrShown.url, expiresAt: qrShown.expiresAt, training }
    : receipt
    ? {
        kind: 'done',
        shop: siteName,
        total: receipt.sale.pricing.total,
        change: receipt.change ?? null,
        receiptUrl: receipt.training ? null : receiptUrl(receipt.sale.clientId),
        training: !!receipt.training,
      }
    : lines.length
      ? {
          kind: 'sale',
          shop: siteName,
          lines: lines.map((l) => ({
            key: l.key,
            quantity: isFixedLine(l) ? 1 : l.quantity,
            name: l.customName ?? l.product.name,
            detail: lineDetail(l) || undefined,
            total: Math.round((l.product.price * l.quantity - l.discount) * 100) / 100,
          })),
          lastKey: lastAddedKey,
          discount: totals.discount,
          total: totals.total,
          taxAmount: totals.taxAmount,
          priceIncludesTax,
          training,
        }
      : { kind: 'idle', shop: siteName }
  useDisplayPublisher(siteId, displayState)

  // Formule : chaque composant compte pour son montant et son éligibilité
  const ruleLines = useMemo(
    () => totals.items.map((it, i) => ({ total: totals.lines[i]?.ttc ?? 0, mealVoucherEligible: it.mealVoucher })),
    [totals],
  )

  const cartProduct = (product: ApiProduct, price: number) => ({
    id: product.id,
    name: product.name,
    subtitle: product.subtitle ?? undefined,
    price,
    taxRate: Number(product.taxRate),
    categoryId: product.categoryId ?? undefined,
    mealVoucher: !!product.mealVoucherEligible,
  })

  const add = useCallback(
    (product: ApiProduct, variant?: ApiVariant, serialNumber?: string, modifiers: ModifierChoice[] = []) => {
      addProduct(cartProduct(product, priceWithModifiers(Number(variant?.price ?? product.price), modifiers)), {
        variantId: variant?.id,
        variantName: variant?.name,
        serialNumber,
        ...(modifiers.length ? { modifiers } : {}),
      })
      setPicking(null)
      setModifying(null)
    },
    [addProduct],
  )

  // Variante et n° de série choisis : reste les options, s'il y en a
  const chosen = (product: ApiProduct, variant?: ApiVariant, serialNumber?: string) => {
    if (groupsOf(product).length) {
      setPicking(null)
      return setModifying({ product, variant, serialNumber })
    }
    add(product, variant, serialNumber)
  }

  const addMenu = (menu: ApiProduct, parts: CartMenuPart[]) => {
    const price = Number(menu.price)
    addProduct({ ...cartProduct(menu, priceMenu(price, parts).total), mealVoucher: parts.every((p) => p.mealVoucher) }, { menu: { price, parts } })
    setComposing(null)
  }

  // Pesée : poids saisi, ou étiquette de balance (prix ou poids imprimé)
  const addWeighed = (product: ApiProduct, weight?: number, label?: ScaleBarcode) => {
    const perKg = Number(product.price)
    const kg = label?.weight ?? weight
    const price = label?.price ?? priceForWeight(kg ?? 0, perKg)
    addProduct(cartProduct(product, price), {
      ...(kg !== undefined ? { weight: kg } : {}),
      pricePerKg: perKg,
      ...(label ? { label: label.barcode } : {}),
    })
    setWeighing(null)
  }

  // Produit simple : ajouté d'un geste. Variantes, n° de série, options,
  // formule ou pesée : on demande.
  const pick = (product: ApiProduct, variant?: ApiVariant, label?: ScaleBarcode) => {
    if (product.isMenu) return setComposing(product)
    if (product.soldByWeight) return label ? addWeighed(product, undefined, label) : setWeighing(product)
    if (variant && product.tracking !== 'SERIAL') return chosen(product, variant)
    if (product.variants.length || product.tracking === 'SERIAL') return setPicking(product)
    chosen(product)
  }

  const pay = async (payments: PayLine[], email?: string, clientId?: string, options: PayOptions = {}) => {
    setBusy(true)
    setPayError(null)
    // Récompense fidélité : remises de ligne, imprimées et signées avec la vente
    const sold = withLoyalty([...lines], loyalty?.amount)
    const items = saleItems(sold)
    const labels = new Map(methods.map((m) => [m.code, m.label]))
    const cashCodes = new Set(methods.filter((m) => m.kind === 'CASH').map((m) => m.code))
    const cardCodes = new Set(methods.filter((m) => m.kind === 'CARD').map((m) => m.code))
    const cashPaid = payments.some((p) => cashCodes.has(p.code))
    // Monnaie rendue : espèces remises moins la part payée en espèces
    const cashDue = payments.filter((p) => cashCodes.has(p.code)).reduce((a, p) => a + Math.round(p.amount * 100), 0)
    const change = options.tendered != null ? Math.max(0, Math.round(options.tendered * 100) - cashDue) / 100 : undefined
    if (training) {
      try {
        const pricing = priceOrder(
          items.map((i) => ({ unitPrice: i.unitPrice, quantity: i.quantity, discount: i.discount, taxRate: i.taxRate })),
          { priceIncludesTax, orderDiscount },
        )
        const t = await fiscalApi.trainingTicket(siteId, {
          total: pricing.total,
          terminalId,
          content: {
            lines: items.map((i) => ({ name: i.menuName ? `${i.menuName} : ${i.name}` : i.name, variant: i.variantName ?? null, quantity: i.quantity, price: i.unitPrice, taxRate: i.taxRate })),
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
        discovery.record({ payments: payments.length, card: payments.some((p) => cardCodes.has(p.code)) })
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
        items: items.map(signedItem),
        payments,
        orderDiscount: orderDiscount || undefined,
        customerEmail: email,
        customerId: customer?.id,
        loyaltyPointsUsed: loyalty?.points,
        priceIncludesTax,
        clientId,
        nonResident: options.nonResident || undefined,
      })
      setReceipt({
        sale,
        lines: sold,
        // Référence du TPE imprimée sous le paiement carte
        payments: payments.map((p) => ({ label: labels.get(p.code) ?? p.code, amount: p.amount, ...(p.reference && cardCodes.has(p.code) ? { reference: p.reference } : {}) })),
        email,
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
          onDisplay={() => setDisplayOpen(true)}
          onLock={requestLock}
        />
        <RoutineBanner status={routine.data} onOpen={() => setChecklist('manual')} />
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
            scaleRules={config?.scaleBarcodes}
            onCustom={() => setCustomOpen(true)}
            onGiftCard={() => setGiftOpen(true)}
            onCreate={setCreateSeed}
          />

          {/* Tablette et ordinateur : le ticket reste visible à droite */}
          <aside
            aria-label="Vente en cours"
            className="hidden w-[380px] shrink-0 border-l border-[var(--color-border)] bg-[var(--color-bg-surface)] md:block lg:w-[420px]"
          >
            <Ticket
              totals={totals}
              priceIncludesTax={priceIncludesTax}
              loyalty={loyaltyRules.data}
              onCustomer={() => setCustomerOpen(true)}
              onCheckout={() => setPaying(true)}
              emptyState={discovery.state?.active ? discoveryChecklist('panel') : undefined}
            />
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
              loyalty={loyaltyRules.data}
              onCustomer={() => setCustomerOpen(true)}
              onCheckout={() => {
                setTicketOpen(false)
                setPaying(true)
              }}
            />
          </div>
        </Sheet>

        <VariantPicker product={picking} onClose={() => setPicking(null)} onChoose={chosen} />
        <ModifierSheet
          target={modifying}
          onClose={() => setModifying(null)}
          onAdd={(mods) => modifying && add(modifying.product, modifying.variant, modifying.serialNumber, mods)}
        />
        <MenuComposer menu={composing} products={products.data ?? []} onClose={() => setComposing(null)} onAdd={addMenu} />
        <WeightSheet product={weighing} onClose={() => setWeighing(null)} onAdd={(kg) => weighing && addWeighed(weighing, kg)} />

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

        <GiftCardSheet
          open={giftOpen}
          onClose={() => setGiftOpen(false)}
          onAdd={({ code, amount }) => {
            const gift = giftProduct.data
            if (!gift) return toast.error('Carte cadeau indisponible : connectez la caisse une première fois.')
            const name = giftCardLineName(code)
            addProduct({ id: gift.id, name, price: amount, taxRate: 0, giftCard: true }, { customName: name })
            setGiftOpen(false)
          }}
        />
        <CustomerSheet
          open={customerOpen}
          onClose={() => setCustomerOpen(false)}
          onChoose={(c) => {
            setCustomer({ id: c.id, name: customerName(c), points: c.points })
            setCustomerOpen(false)
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
                  !discovery.state?.active &&
                  (!cash.data.lastClosedAt || new Date(cash.data.lastClosedAt).toDateString() !== new Date().toDateString()))
              }
              onClose={() => {
                setOpenDismissed(true)
                setCashSheet(null)
              }}
            />
            <CashCloseSheet
              siteId={siteId}
              terminalId={terminalId}
              open={cashSheet === 'close'}
              pendingSales={queue.pending}
              onClose={() => {
                void qc.invalidateQueries({ queryKey: ['routine', siteId] })
                // Clôture de la veille faite : on ouvre la journée du jour
                if (retroClosing) {
                  setRetroClosing(false)
                  setCashSheet('open')
                } else setCashSheet(null)
              }}
            />
            {cash.data?.stale && cashSheet !== 'close' && !locked && (
              <YesterdayClosure
                day={cash.data.stale.day}
                onStart={() => {
                  setRetroClosing(true)
                  setCashSheet('close')
                }}
              />
            )}
          </>
        )}

        <ClosingChecklist
          open={!!checklist && !locked}
          siteId={siteId}
          status={routine.data}
          lockIntent={checklist === 'lock'}
          onUpdate={(s) => qc.setQueryData(['routine', siteId], s)}
          onClose={() => {
            // Refermée : elle ne revient pas avant dix minutes
            setChecklistSnooze(Date.now() + 10 * 60_000)
            setChecklist(null)
          }}
          onCloseCash={() => {
            setChecklist(null)
            setCashSheet('close')
          }}
          onLock={() => {
            setChecklist(null)
            setLocked('manual')
          }}
        />
        {discovery.state?.active && !locked && lines.length === 0 && discoveryChecklist('floating')}
        {locked && (
          <LockScreen
            reason={locked}
            error={lockError}
            onUnlock={async (pin) => {
              try {
                await pinLogin(siteId, pin)
                setLockError(null)
                if (locked === 'unclosed') {
                  // Le temps de clôturer : pas de nouveau verrouillage avant 30 minutes
                  setLockSnooze(Date.now() + 30 * 60_000)
                  setChecklist('manual')
                }
                setLocked(null)
              } catch (e) {
                setLockError((e as Error).message)
                throw e
              }
            }}
          />
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

        <DisplaySheet siteId={siteId} terminalId={terminalId} open={displayOpen} onClose={() => setDisplayOpen(false)} />

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
          training={training}
          total={totals.total}
          ruleLines={ruleLines}
          methods={methods}
          siteName={siteName}
          siteAddress={siteAddress}
          receiptSettings={config?.receipt}
          sellerName={sellerName}
          receipt={receipt}
          busy={busy}
          error={payError}
          creditCode={creditCode}
          onPay={pay}
          onClose={closePayment}
          qrAvailable={queue.online && !training && !!qrProvider.data?.provider}
          onQrShow={setQrShown}
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
