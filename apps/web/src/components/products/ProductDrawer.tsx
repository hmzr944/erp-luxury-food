'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash } from '@phosphor-icons/react'
import type { ApiProduct, ApiCategory } from '@/lib/api/products'
import { FieldError } from '@/components/ui/FieldError'
import { EASE_DRAWER } from '@/lib/motion'
import { usePlatformConfig } from '@/lib/api/platform'
import { modifiersApi } from '@/lib/api/modifiers'
import { productsAdminApi } from '@/lib/api/products-admin'
import { dateKindOf, parseInputs, toInputs, type AttributeDef, type DateKind } from './attributes-form'
import { TrackingSection, AttributesSection } from './TrackingAttributes'

const variantSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
  barcode: z.string().optional(),
})

const productSchema = z.object({
  name: z.string().min(1, 'Requis'),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  price: z.number({ invalid_type_error: 'Prix requis' }).positive('Prix > 0'),
  taxRate: z.number().min(0).max(100),
  mealVoucherEligible: z.boolean().optional(),
  categoryId: z.string().optional(),
  variants: z.array(variantSchema).optional(),
  // À l'unité, au poids (prix au kilo) ou formule
  saleMode: z.enum(['UNIT', 'WEIGHT', 'MENU']),
  scaleCode: z.string().regex(/^\d{0,6}$/, '1 à 6 chiffres').optional(),
  // Suivi du stock : sans lot, par lot, par date limite ou par numéro de série
  tracking: z.enum(['NONE', 'LOT', 'LOT_EXPIRY', 'SERIAL']),
  // Seuil d'alerte de stock bas : vide = pas d'alerte
  alertAt: z.string().regex(/^(\d+([.,]\d{1,3})?)?$/, 'Un nombre positif, 3 décimales au plus').optional(),
})

export interface MenuStepForm {
  name: string
  minSelect: number
  maxSelect: number
  choices: Array<{ productId: string; supplement: number }>
}

export type ProductFormValues = z.infer<typeof productSchema> & {
  modifierGroupIds: string[]
  menuSteps: MenuStepForm[]
  // Absent : les champs de la fiche n'ont pas pu être chargés, on n'y touche pas
  attributes?: Record<string, unknown>
}

const inputCls = 'w-full h-11 px-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-[var(--radius-md)] font-body text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-colors'

interface ProductDrawerProps {
  siteId: string
  product: ApiProduct | null
  // Catalogue du site : articles proposables dans une formule
  products: ApiProduct[]
  isNew: boolean
  categories: ApiCategory[]
  onSave: (data: ProductFormValues) => Promise<void>
  onClose: () => void
  isSaving: boolean
}

// Seuil d'alerte en vigueur : celui du produit, ou de sa première variante
const thresholdOf = (p: ApiProduct): string => {
  const raw = p.stockItem?.alertAt ?? p.variants?.find((v) => v.stock?.alertAt != null)?.stock?.alertAt ?? null
  return raw === null ? '' : String(Number(raw)).replace('.', ',')
}

const modeOf = (p: ApiProduct | null): ProductFormValues['saleMode'] => (p?.isMenu ? 'MENU' : p?.soldByWeight ? 'WEIGHT' : 'UNIT')

export function ProductDrawer({
  siteId, product, products, isNew, categories, onSave, onClose, isSaving,
}: ProductDrawerProps) {
  const {
    register, handleSubmit, control, reset, watch, setValue,
    formState: { errors, dirtyFields },
  } = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '', subtitle: '', sku: '', barcode: '',
      price: 0, taxRate: 5.5, mealVoucherEligible: true, categoryId: '', variants: [], saleMode: 'UNIT', scaleCode: '', tracking: 'NONE', alertAt: '',
    },
  })

  // Groupes d'options et étapes de formule : hors du formulaire (listes imbriquées)
  const [groupIds, setGroupIds] = useState<string[]>([])
  const [steps, setSteps] = useState<MenuStepForm[]>([])
  const groups = useQuery({ queryKey: ['modifier-groups', siteId], queryFn: () => modifiersApi.list(siteId) })
  const saleMode = watch('saleMode')
  const tracking = watch('tracking')

  // Champs de la fiche (millésime, origine...) selon les packs de l'organisation
  const attrDefs = useQuery({ queryKey: ['attribute-definitions', siteId], queryFn: () => productsAdminApi.attributeDefinitions(siteId) })
  const defs: AttributeDef[] = attrDefs.data ?? []
  const [attrInputs, setAttrInputs] = useState<Record<string, string>>({})
  const [attrErrors, setAttrErrors] = useState<Record<string, string>>({})
  const [dateKind, setDateKind] = useState<DateKind>('DLC')
  useEffect(() => {
    setAttrInputs(toInputs(defs, product?.attributes))
    setAttrErrors({})
    setDateKind(dateKindOf(product?.attributes))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, attrDefs.data])
  useEffect(() => {
    setGroupIds(product?.modifierGroups?.map((g) => g.group.id) ?? [])
    setSteps(
      product?.menuSteps?.map((st) => ({
        name: st.name,
        minSelect: st.minSelect,
        maxSelect: st.maxSelect,
        choices: st.choices.map((c) => ({ productId: c.productId, supplement: Number(c.supplement) })),
      })) ?? [],
    )
  }, [product])

  const { fields, append, remove } = useFieldArray({ control, name: 'variants' })

  // Titre-restaurant : proposé seulement si la boutique l'accepte. Pour un
  // nouveau produit, coché d'office aux taux alimentaires (pas l'alcool à 20 %)
  const { data: platform } = usePlatformConfig()
  const acceptsMealVoucher = !!platform?.paymentMethods.some((m) => m.mealVoucher && m.isActive)
  const taxRate = watch('taxRate')
  useEffect(() => {
    if (!product && !dirtyFields.mealVoucherEligible) setValue('mealVoucherEligible', taxRate !== 20)
  }, [product, taxRate, dirtyFields.mealVoucherEligible, setValue])

  const defaultTracking = platform?.defaultTracking
  useEffect(() => {
    if (!product && defaultTracking && !dirtyFields.tracking) setValue('tracking', defaultTracking)
  }, [product, defaultTracking, dirtyFields.tracking, setValue])

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        subtitle: product.subtitle ?? '',
        description: product.description ?? '',
        sku: product.sku ?? '',
        barcode: product.barcode ?? '',
        price: Number(product.price),
        taxRate: Number(product.taxRate),
        mealVoucherEligible: !!product.mealVoucherEligible,
        categoryId: product.categoryId ?? '',
        variants: product.variants?.map((v) => ({
          name: v.name,
          price: Number(v.price),
          barcode: v.barcode ?? '',
        })) ?? [],
        saleMode: modeOf(product),
        scaleCode: product.scaleCode ?? '',
        tracking: product.tracking ?? 'NONE',
        alertAt: thresholdOf(product),
      })
    } else {
      reset({ name: '', subtitle: '', sku: '', barcode: '', price: 0, taxRate: 5.5, mealVoucherEligible: true, categoryId: '', variants: [], saleMode: 'UNIT', scaleCode: '', tracking: platform?.defaultTracking ?? 'NONE', alertAt: '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, reset])

  // Fenêtre modale : focus au premier champ, Échap ferme, focus rendu ensuite
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null
    const t = window.setTimeout(() => panel.current?.querySelector<HTMLElement>('input')?.focus(), 30)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
      back?.focus?.()
    }
  }, [onClose])

  return (
    <AnimatePresence>
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pd-title"
        initial={{ transform: 'translateX(100%)' }}
        animate={{ transform: 'translateX(0%)' }}
        exit={{ transform: 'translateX(100%)' }}
        transition={{ duration: 0.32, ease: EASE_DRAWER }}
        className="fixed right-0 top-0 h-full w-full max-w-[480px] bg-[var(--color-bg-elevated)] border-l border-[var(--color-border)] z-50 flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h2 id="pd-title" className="font-display text-lg font-bold tracking-tight text-[var(--color-text-primary)]">
            {isNew ? 'Nouveau produit' : 'Modifier le produit'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="grid size-10 place-items-center rounded-[var(--radius-pill)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* Form */}
        <form
          id="product-form"
          onSubmit={handleSubmit((v) => {
            const parsed = parseInputs(defs, attrInputs)
            setAttrErrors(parsed.errors)
            if (Object.keys(parsed.errors).length) {
              window.setTimeout(() => panel.current?.querySelector<HTMLElement>('[data-attr-invalid="true"]')?.focus(), 0)
              return
            }
            const menu = v.saleMode === 'MENU'
            return onSave({
              ...v,
              // Une formule n'a pas de stock propre : ni suivi, ni lots
              tracking: menu ? 'NONE' : v.tracking,
              modifierGroupIds: menu ? [] : groupIds,
              menuSteps: menu ? steps : [],
              attributes: attrDefs.data ? { ...parsed.values, ...(!menu && v.tracking === 'LOT_EXPIRY' ? { dateKind } : {}) } : undefined,
            })
          })}
          className="flex-1 overflow-y-auto px-5 py-5 space-y-5"
        >
          {/* Infos principales */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="pd-name" className="font-body text-xs text-[var(--color-text-secondary)]">Nom *</label>
              <input id="pd-name" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'pd-name-err' : undefined} {...register('name')} className={inputCls} placeholder="Ganache Grand Cru" />
              {errors.name && <FieldError id="pd-name-err">{errors.name.message}</FieldError>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="pd-subtitle" className="font-body text-xs text-[var(--color-text-secondary)]">Sous-titre</label>
              <input id="pd-subtitle" {...register('subtitle')} className={inputCls} placeholder="Origine Madagascar 72%" />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="pd-description" className="font-body text-xs text-[var(--color-text-secondary)]">Description</label>
              <textarea
                id="pd-description" {...register('description')}
                rows={2}
                className={inputCls + ' h-auto py-2 resize-none'}
                placeholder="Description courte du produit…"
              />
            </div>
          </div>

          {/* Type de vente */}
          <fieldset className="space-y-1.5">
            <legend className="font-body text-xs text-[var(--color-text-secondary)]">Vente</legend>
            <div className="grid grid-cols-3 gap-1 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] p-1">
              {([['UNIT', 'À l’unité'], ['WEIGHT', 'Au poids'], ['MENU', 'Formule']] as const).map(([value, label]) => (
                <label key={value} className={`flex h-9 cursor-pointer items-center justify-center rounded-[calc(var(--radius-md)-4px)] text-sm ${saleMode === value ? 'bg-[var(--color-bg-inverse)] font-semibold text-[var(--color-text-inverse)]' : 'text-[var(--color-text-secondary)]'}`}>
                  <input type="radio" value={value} {...register('saleMode')} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Prix + TVA */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`space-y-1.5 ${saleMode === 'MENU' ? 'col-span-2' : ''}`}>
              <label htmlFor="pd-price" className="font-body text-xs text-[var(--color-text-secondary)]">
                {saleMode === 'WEIGHT' ? 'Prix au kilo TTC (€) *' : saleMode === 'MENU' ? 'Prix de la formule TTC (€) *' : 'Prix TTC (€) *'}
              </label>
              <input
                id="pd-price" aria-invalid={!!errors.price} aria-describedby={errors.price ? 'pd-price-err' : undefined} {...register('price', { valueAsNumber: true })}
                type="number" step="0.01" min="0"
                className={inputCls}
                placeholder="9.50"
              />
              {errors.price && <FieldError id="pd-price-err">{errors.price.message}</FieldError>}
            </div>

            <div className={`space-y-1.5 ${saleMode === 'MENU' ? 'hidden' : ''}`}>
              <label htmlFor="pd-taxRate" className="font-body text-xs text-[var(--color-text-secondary)]">TVA (%)</label>
              <select id="pd-taxRate" {...register('taxRate', { valueAsNumber: true })} className={inputCls + ' cursor-pointer'}>
                <option value={5.5}>5,5% (alimentaire)</option>
                <option value={10}>10% (restauration)</option>
                <option value={20}>20% (standard)</option>
              </select>
            </div>
          </div>

          {acceptsMealVoucher && (
            <label className="flex items-center gap-3 font-body text-sm text-[var(--color-text-primary)]">
              <input type="checkbox" {...register('mealVoucherEligible')} className="size-5 accent-[var(--color-accent)]" />
              Payable en titre-restaurant
            </label>
          )}

          {saleMode === 'WEIGHT' && (
            <div className="space-y-1.5">
              <label htmlFor="pd-scaleCode" className="font-body text-xs text-[var(--color-text-secondary)]">Code article de la balance</label>
              <input id="pd-scaleCode" inputMode="numeric" aria-invalid={!!errors.scaleCode} {...register('scaleCode')} autoComplete="off" spellCheck={false} className={inputCls} placeholder="123…" />
              {errors.scaleCode && <FieldError id="pd-scaleCode-err">{errors.scaleCode.message}</FieldError>}
              <p className="font-body text-xs text-[var(--color-text-muted)]">
                Le code programmé sur la balance étiqueteuse : la caisse reconnaît alors ses étiquettes. Sans balance, la caisse demande le poids.
              </p>
            </div>
          )}

          {saleMode === 'MENU' && <MenuSteps steps={steps} onChange={setSteps} products={products.filter((p) => p.isActive && !p.isMenu && !p.soldByWeight && p.id !== product?.id)} />}

          {saleMode !== 'MENU' && (
            <fieldset className="space-y-2">
              <legend className="font-body text-xs text-[var(--color-text-secondary)]">Options proposées en caisse</legend>
              {groups.data?.length ? (
                <div className="flex flex-wrap gap-2">
                  {groups.data.map((g) => {
                    const on = groupIds.includes(g.id)
                    return (
                      <label key={g.id} className={`flex h-9 cursor-pointer items-center gap-2 rounded-[var(--radius-pill)] border px-3 text-sm ${on ? 'border-[var(--color-accent)] text-[var(--color-text-primary)]' : 'border-[var(--color-border-strong)] text-[var(--color-text-secondary)]'}`}>
                        <input type="checkbox" checked={on} onChange={() => setGroupIds(on ? groupIds.filter((x) => x !== g.id) : [...groupIds, g.id])} className="size-4 accent-[var(--color-accent)]" />
                        {g.name}
                      </label>
                    )
                  })}
                </div>
              ) : (
                <p className="font-body text-xs text-[var(--color-text-muted)]">Aucun groupe d’options pour l’instant.</p>
              )}
              <Link href="/settings/options" className="inline-block font-body text-xs text-[var(--color-accent)] hover:underline">Gérer les groupes d’options</Link>
            </fieldset>
          )}

          {/* Catégorie */}
          <div className="space-y-1.5">
            <label htmlFor="pd-categoryId" className="font-body text-xs text-[var(--color-text-secondary)]">Catégorie</label>
            <select id="pd-categoryId" {...register('categoryId')} className={inputCls + ' cursor-pointer'}>
              <option value="">Sans catégorie</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* SKU + Code-barre */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="pd-sku" className="font-body text-xs text-[var(--color-text-secondary)]">SKU</label>
              <input id="pd-sku" {...register('sku')} className={inputCls} placeholder="CHO-001" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="pd-barcode" className="font-body text-xs text-[var(--color-text-secondary)]">Code-barre</label>
              <input id="pd-barcode" {...register('barcode')} className={inputCls} placeholder="3760001234567" />
            </div>
          </div>

          {saleMode !== 'MENU' && (
            <TrackingSection
              register={register}
              tracking={tracking}
              dateKind={dateKind}
              onDateKind={setDateKind}
              hadStock={!isNew && product?.tracking === 'NONE' && tracking !== 'NONE'}
            />
          )}

          {defs.length > 0 && <AttributesSection defs={defs} inputs={attrInputs} errors={attrErrors} onChange={(key, value) => setAttrInputs((cur) => ({ ...cur, [key]: value }))} />}

          {/* Seuil d'alerte de stock bas */}
          <div className="space-y-1.5">
            <label htmlFor="pd-alertAt" className="font-body text-xs text-[var(--color-text-secondary)]">Seuil d’alerte de stock</label>
            <input
              id="pd-alertAt" inputMode="decimal" autoComplete="off"
              aria-invalid={!!errors.alertAt} aria-describedby={errors.alertAt ? 'pd-alertAt-err pd-alertAt-help' : 'pd-alertAt-help'}
              {...register('alertAt')} className={inputCls} placeholder="Ex. 5"
            />
            {errors.alertAt && <FieldError id="pd-alertAt-err">{errors.alertAt.message}</FieldError>}
            <p id="pd-alertAt-help" className="font-body text-xs text-[var(--color-text-muted)]">
              Le produit est signalé « Bas » quand son stock descend à ce niveau ou en dessous. Laissez vide pour ne pas être alerté. Avec des variantes, le seuil s’applique à chacune.
            </p>
          </div>

          {/* Variants */}
          <div className={`space-y-3 ${saleMode === 'UNIT' ? '' : 'hidden'}`}>
            <div className="flex items-center justify-between">
              <label className="font-body text-xs text-[var(--color-text-secondary)]">
                Variantes ({fields.length})
              </label>
              <button
                type="button"
                onClick={() => append({ name: '', price: 0, barcode: '' })}
                className="flex items-center gap-1 font-body text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
              >
                <Plus size={11} weight="bold" />
                Ajouter
              </button>
            </div>

            {fields.map((field, i) => (
              <div key={field.id} className="grid grid-cols-[1fr_80px_28px] gap-2 items-center">
                <input
                  {...register(`variants.${i}.name`)}
                  className={inputCls}
                  placeholder="ex. 150g"
                />
                <input
                  {...register(`variants.${i}.price`, { valueAsNumber: true })}
                  type="number" step="0.01"
                  className={inputCls}
                  placeholder="Prix"
                />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="flex items-center justify-center h-9 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors"
                >
                  <Trash size={13} />
                </button>
              </div>
            ))}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 border border-[var(--color-border)] text-[var(--color-text-secondary)] font-body text-sm rounded-[var(--radius-md)] hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            Annuler
          </button>
          <motion.button
            type="submit"
            form="product-form"
            disabled={isSaving}
            whileTap={{ scale: 0.98 }}
            className="flex-1 h-10 bg-[var(--color-accent)] text-[var(--color-on-accent)] font-body text-sm font-semibold rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)] transition-colors"
          >
            {isSaving ? 'Enregistrement…' : isNew ? 'Créer' : 'Enregistrer'}
          </motion.button>
        </div>
      </motion.div>

      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-[var(--scrim)]"
      />
    </AnimatePresence>
  )
}

// Étapes d'une formule : un nom, combien d'articles à choisir, lesquels
function MenuSteps({ steps, onChange, products }: { steps: MenuStepForm[]; onChange: (s: MenuStepForm[]) => void; products: ApiProduct[] }) {
  const byId = new Map(products.map((p) => [p.id, p]))
  const set = (i: number, patch: Partial<MenuStepForm>) => onChange(steps.map((st, k) => (k === i ? { ...st, ...patch } : st)))
  return (
    <fieldset className="space-y-3">
      <legend className="font-body text-xs text-[var(--color-text-secondary)]">Composition de la formule</legend>
      <p className="font-body text-xs text-[var(--color-text-muted)]">
        Chaque article choisi garde son propre taux de TVA. Le prix de la formule est réparti entre eux au prorata de leur prix à la carte ; un supplément revient en entier à son article.
      </p>
      {steps.map((st, i) => (
        <div key={i} className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
          <div className="grid grid-cols-[1fr_64px_64px_28px] items-end gap-2">
            <label className="space-y-1">
              <span className="block font-body text-xs text-[var(--color-text-secondary)]">Étape</span>
              <input value={st.name} onChange={(e) => set(i, { name: e.target.value })} className={inputCls} autoComplete="off" placeholder={`${['Plat', 'Boisson', 'Dessert'][i] ?? 'Étape'}…`} />
            </label>
            <label className="space-y-1">
              <span className="block font-body text-xs text-[var(--color-text-secondary)]">Min.</span>
              <input type="number" min={0} max={10} value={st.minSelect} onChange={(e) => set(i, { minSelect: Math.max(0, Number(e.target.value) || 0) })} className={inputCls} />
            </label>
            <label className="space-y-1">
              <span className="block font-body text-xs text-[var(--color-text-secondary)]">Max.</span>
              <input type="number" min={1} max={10} value={st.maxSelect} onChange={(e) => set(i, { maxSelect: Math.max(1, Number(e.target.value) || 1) })} className={inputCls} />
            </label>
            <button type="button" onClick={() => onChange(steps.filter((_, k) => k !== i))} aria-label={`Retirer l'étape ${st.name || i + 1}`} className="flex h-11 items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
              <Trash size={13} />
            </button>
          </div>
          <ul className="space-y-1.5">
            {st.choices.map((c, k) => (
              <li key={c.productId} className="grid grid-cols-[1fr_96px_28px] items-center gap-2">
                <span className="truncate font-body text-sm">{byId.get(c.productId)?.name ?? 'Article retiré du catalogue'}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  aria-label={`Supplément pour ${byId.get(c.productId)?.name ?? 'cet article'}`}
                  value={c.supplement}
                  onChange={(e) => set(i, { choices: st.choices.map((x, j) => (j === k ? { ...x, supplement: Math.max(0, Number(e.target.value) || 0) } : x)) })}
                  className={inputCls + ' h-9'}
                  title="Supplément"
                />
                <button type="button" onClick={() => set(i, { choices: st.choices.filter((_, j) => j !== k) })} aria-label={`Retirer ${byId.get(c.productId)?.name ?? 'cet article'}`} className="flex h-9 items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
                  <Trash size={13} />
                </button>
              </li>
            ))}
          </ul>
          <select
            aria-label={`Ajouter un article à l'étape ${st.name || i + 1}`}
            value=""
            onChange={(e) => e.target.value && set(i, { choices: [...st.choices, { productId: e.target.value, supplement: 0 }] })}
            className={inputCls + ' cursor-pointer'}
          >
            <option value="">Ajouter un article…</option>
            {products
              .filter((p) => !st.choices.some((c) => c.productId === p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({Number(p.price).toFixed(2).replace('.', ',')} €)
                </option>
              ))}
          </select>
          {st.choices.length > 0 && <p className="font-body text-xs text-[var(--color-text-muted)]">Second champ : supplément demandé pour ce choix (0 si compris).</p>}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...steps, { name: '', minSelect: 1, maxSelect: 1, choices: [] }])}
        className="flex items-center gap-1 font-body text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
      >
        <Plus size={11} weight="bold" />
        Ajouter une étape
      </button>
    </fieldset>
  )
}
