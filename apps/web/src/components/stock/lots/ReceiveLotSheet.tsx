'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Sheet } from '@/components/pos/Sheet'
import { FieldError } from '@/components/ui/FieldError'
import { productsAdminApi } from '@/lib/api/products-admin'
import { lotsApi } from '@/lib/api/lots'
import { dateKindOf } from '@/components/products/attributes-form'
import { dateKindHelp, dateKindLabel, todayInParis } from './lots-view'

const field = 'w-full h-11 px-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-[var(--radius-md)] font-body text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]'
const label = 'font-body text-sm font-medium'

interface Props {
  siteId: string
  open: boolean
  onClose: () => void
  // Produit proposé d'office (depuis la liste des lots)
  productId?: string
}

export function ReceiveLotSheet({ siteId, open, onClose, productId }: Props) {
  const qc = useQueryClient()
  const products = useQuery({ queryKey: ['products-admin', siteId], queryFn: () => productsAdminApi.getAll(siteId), enabled: open })
  const tracked = useMemo(
    () => (products.data ?? []).filter((p) => p.isActive && !p.isMenu && p.tracking !== 'NONE').sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [products.data],
  )

  const [pid, setPid] = useState('')
  const [variantId, setVariantId] = useState('')
  const [lotNumber, setLotNumber] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [quantity, setQuantity] = useState('')
  const [serials, setSerials] = useState('')
  const [receivedAt, setReceivedAt] = useState(todayInParis())
  const [tried, setTried] = useState(false)

  useEffect(() => {
    if (!open) return
    setPid(productId ?? '')
    setVariantId('')
    setLotNumber('')
    setExpiresAt('')
    setQuantity('')
    setSerials('')
    setReceivedAt(todayInParis())
    setTried(false)
  }, [open, productId])

  const product = tracked.find((p) => p.id === pid)
  const kind = dateKindOf(product?.attributes)
  const serialList = [...new Set(serials.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean))]
  const qty = Number(quantity.replace(',', '.'))

  const errors: Record<string, string> = {}
  if (!product) errors.product = 'Choisissez un produit'
  else {
    if (product.variants.length && !variantId) errors.variant = 'Choisissez la variante reçue'
    if (product.tracking === 'LOT' && !lotNumber.trim()) errors.lot = 'Le numéro de lot est obligatoire'
    if (product.tracking === 'LOT_EXPIRY' && !expiresAt) errors.expires = `Indiquez la ${dateKindLabel(kind)}`
    if (product.tracking === 'SERIAL') {
      if (!serialList.length) errors.serials = 'Saisissez au moins un numéro de série'
    } else if (!qty || qty <= 0) errors.quantity = 'Indiquez la quantité reçue'
    else if (!product.soldByWeight && !Number.isInteger(qty)) errors.quantity = 'La quantité doit être un nombre entier'
  }
  if (receivedAt > todayInParis()) errors.received = 'La réception ne peut pas être dans le futur'

  const mutation = useMutation({
    mutationFn: () =>
      lotsApi.receive(siteId, {
        productId: pid,
        variantId: variantId || undefined,
        lotNumber: lotNumber.trim() || undefined,
        expiresAt: product?.tracking === 'LOT_EXPIRY' ? expiresAt : undefined,
        ...(product?.tracking === 'SERIAL' ? { serialNumbers: serialList } : { quantity: qty }),
        receivedAt: receivedAt || undefined,
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['lots', siteId] })
      qc.invalidateQueries({ queryKey: ['lots-expired-only', siteId] })
      qc.invalidateQueries({ queryKey: ['stock-inventory', siteId] })
      qc.invalidateQueries({ queryKey: ['stock-movements', siteId] })
      toast.success(`${product?.name} : ${r.quantity} reçu${r.quantity > 1 ? 's' : ''}`)
      onClose()
    },
    onError: (e: Error) => toast.error(e.message || 'Réception impossible'),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.keys(errors).length) return
    mutation.mutate()
  }

  const err = (key: string) => (tried ? errors[key] : undefined)
  const described = (key: string) => (err(key) ? `rl-${key}-err` : undefined)

  return (
    <Sheet open={open} title="Réceptionner un lot" onClose={onClose} locked={mutation.isPending}>
      {products.isLoading ? (
        <p className="py-8 text-center font-body text-sm text-[var(--color-text-secondary)]">Chargement des produits…</p>
      ) : !tracked.length ? (
        <div className="space-y-3 py-4">
          <p className="font-body text-sm">Aucun produit n’est suivi par lot pour l’instant.</p>
          <p className="font-body text-sm text-[var(--color-text-secondary)]">
            Ouvrez la fiche d’un produit et choisissez son suivi : par lot, par date limite ou par numéro de série.
          </p>
          <Link href="/products" className="inline-flex h-11 items-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 font-body text-sm font-semibold text-[var(--color-on-accent)]">
            Ouvrir le catalogue
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="rl-product" className={label}>Produit *</label>
            <select id="rl-product" value={pid} onChange={(e) => { setPid(e.target.value); setVariantId('') }} aria-invalid={!!err('product')} aria-describedby={described('product')} className={field + ' cursor-pointer'}>
              <option value="">Choisir un produit suivi</option>
              {tracked.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {err('product') && <FieldError id="rl-product-err">{err('product')}</FieldError>}
          </div>

          {product && product.variants.length > 0 && (
            <div className="space-y-1.5">
              <label htmlFor="rl-variant" className={label}>Variante *</label>
              <select id="rl-variant" value={variantId} onChange={(e) => setVariantId(e.target.value)} aria-invalid={!!err('variant')} aria-describedby={described('variant')} className={field + ' cursor-pointer'}>
                <option value="">Choisir</option>
                {product.variants.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              {err('variant') && <FieldError id="rl-variant-err">{err('variant')}</FieldError>}
            </div>
          )}

          {product && product.tracking !== 'SERIAL' && (
            <div className="space-y-1.5">
              <label htmlFor="rl-lot" className={label}>Numéro de lot{product.tracking === 'LOT' ? ' *' : ''}</label>
              <input id="rl-lot" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} maxLength={60} autoComplete="off" spellCheck={false} aria-invalid={!!err('lot')} aria-describedby={described('lot')} className={field + ' font-data'} placeholder="L2410-A" />
              {err('lot') && <FieldError id="rl-lot-err">{err('lot')}</FieldError>}
              {product.tracking === 'LOT_EXPIRY' && <p className="font-body text-sm text-[var(--color-text-secondary)]">Au dos de l’emballage. Un même numéro reçu une seconde fois s’ajoute au lot existant.</p>}
            </div>
          )}

          {product?.tracking === 'LOT_EXPIRY' && (
            <div className="space-y-1.5">
              <label htmlFor="rl-expires" className={label}>Date limite ({dateKindLabel(kind)}) *</label>
              <input id="rl-expires" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} aria-invalid={!!err('expires')} aria-describedby={described('expires') ?? 'rl-kind-help'} className={field + ' tabular'} />
              {err('expires') ? <FieldError id="rl-expires-err">{err('expires')}</FieldError> : <p id="rl-kind-help" className="font-body text-sm text-[var(--color-text-secondary)]">{dateKindHelp[kind]}</p>}
            </div>
          )}

          {product?.tracking === 'SERIAL' ? (
            <div className="space-y-1.5">
              <label htmlFor="rl-serials" className={label}>Numéros de série * <span className="font-normal text-[var(--color-text-secondary)]">({serialList.length})</span></label>
              <textarea id="rl-serials" value={serials} onChange={(e) => setSerials(e.target.value)} rows={4} spellCheck={false} aria-invalid={!!err('serials')} aria-describedby={described('serials') ?? 'rl-serials-help'} className={field + ' h-auto py-2 font-data'} placeholder={'SN-0001\nSN-0002'} />
              {err('serials') ? <FieldError id="rl-serials-err">{err('serials')}</FieldError> : <p id="rl-serials-help" className="font-body text-sm text-[var(--color-text-secondary)]">Un numéro par ligne. La quantité reçue est le nombre de numéros.</p>}
            </div>
          ) : (
            product && (
              <div className="space-y-1.5">
                <label htmlFor="rl-qty" className={label}>Quantité reçue *</label>
                <input id="rl-qty" inputMode={product.soldByWeight ? 'decimal' : 'numeric'} value={quantity} onChange={(e) => setQuantity(e.target.value)} autoComplete="off" aria-invalid={!!err('quantity')} aria-describedby={described('quantity')} className={field + ' tabular'} placeholder={product.soldByWeight ? '12,5' : '24'} />
                {err('quantity') && <FieldError id="rl-quantity-err">{err('quantity')}</FieldError>}
              </div>
            )
          )}

          {product && (
            <div className="space-y-1.5">
              <label htmlFor="rl-received" className={label}>Reçu le</label>
              <input id="rl-received" type="date" value={receivedAt} max={todayInParis()} onChange={(e) => setReceivedAt(e.target.value)} aria-invalid={!!err('received')} aria-describedby={described('received')} className={field + ' tabular'} />
              {err('received') && <FieldError id="rl-received-err">{err('received')}</FieldError>}
            </div>
          )}

          {product && <p className="font-body text-sm text-[var(--color-text-secondary)]">Le lot est créé et le stock du produit augmente de la quantité reçue, avec un mouvement d’entrée.</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={mutation.isPending} className="h-11 flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] font-body text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]">
              Annuler
            </button>
            <button type="submit" disabled={mutation.isPending} className="h-11 flex-1 rounded-[var(--radius-md)] bg-[var(--color-accent)] font-body text-sm font-semibold text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-60">
              {mutation.isPending ? 'Enregistrement…' : 'Réceptionner'}
            </button>
          </div>
        </form>
      )}
    </Sheet>
  )
}
