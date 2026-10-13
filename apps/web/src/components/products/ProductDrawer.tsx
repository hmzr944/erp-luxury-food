'use client'

import { useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash } from '@phosphor-icons/react'
import type { ApiProduct, ApiCategory } from '@/lib/api/products'

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
  categoryId: z.string().optional(),
  variants: z.array(variantSchema).optional(),
})

export type ProductFormValues = z.infer<typeof productSchema>

const inputCls = 'w-full h-9 px-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-[var(--radius-md)] font-body text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]/40 focus:ring-1 focus:ring-[var(--color-accent)]/20 transition-colors'

const CATEGORY_COLORS = [
  '#92400e', '#7c3aed', '#1d4ed8', '#0e7490',
  '#065f46', '#9f1239', '#b45309', '#374151',
]

interface ProductDrawerProps {
  product: ApiProduct | null
  isNew: boolean
  categories: ApiCategory[]
  onSave: (data: ProductFormValues) => Promise<void>
  onClose: () => void
  isSaving: boolean
}

export function ProductDrawer({
  product, isNew, categories, onSave, onClose, isSaving,
}: ProductDrawerProps) {
  const {
    register, handleSubmit, control, reset,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '', subtitle: '', sku: '', barcode: '',
      price: 0, taxRate: 5.5, categoryId: '', variants: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'variants' })

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
        categoryId: product.categoryId ?? '',
        variants: product.variants?.map((v) => ({
          name: v.name,
          price: Number(v.price),
          barcode: v.barcode ?? '',
        })) ?? [],
      })
    } else {
      reset({ name: '', subtitle: '', sku: '', barcode: '', price: 0, taxRate: 5.5, categoryId: '', variants: [] })
    }
  }, [product, reset])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className="fixed right-0 top-0 h-full w-[480px] bg-[var(--color-bg-elevated)] border-l border-[var(--color-border)] z-50 flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-body text-sm font-semibold text-[var(--color-text-primary)]">
            {isNew ? 'Nouveau produit' : 'Modifier le produit'}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form
          id="product-form"
          onSubmit={handleSubmit(onSave)}
          className="flex-1 overflow-y-auto px-5 py-5 space-y-5"
        >
          {/* Infos principales */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="font-body text-xs text-[var(--color-text-secondary)]">Nom *</label>
              <input {...register('name')} className={inputCls} placeholder="Ganache Grand Cru" />
              {errors.name && <p className="text-xs text-[var(--color-danger)]">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="font-body text-xs text-[var(--color-text-secondary)]">Sous-titre</label>
              <input {...register('subtitle')} className={inputCls} placeholder="Origine Madagascar 72%" />
            </div>

            <div className="space-y-1.5">
              <label className="font-body text-xs text-[var(--color-text-secondary)]">Description</label>
              <textarea
                {...register('description')}
                rows={2}
                className={inputCls + ' h-auto py-2 resize-none'}
                placeholder="Description courte du produit..."
              />
            </div>
          </div>

          {/* Prix + TVA */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-body text-xs text-[var(--color-text-secondary)]">Prix TTC (€) *</label>
              <input
                {...register('price', { valueAsNumber: true })}
                type="number" step="0.01" min="0"
                className={inputCls}
                placeholder="9.50"
              />
              {errors.price && <p className="text-xs text-[var(--color-danger)]">{errors.price.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="font-body text-xs text-[var(--color-text-secondary)]">TVA (%)</label>
              <select {...register('taxRate', { valueAsNumber: true })} className={inputCls + ' cursor-pointer'}>
                <option value={5.5}>5,5% (alimentaire)</option>
                <option value={10}>10% (restauration)</option>
                <option value={20}>20% (standard)</option>
              </select>
            </div>
          </div>

          {/* Catégorie */}
          <div className="space-y-1.5">
            <label className="font-body text-xs text-[var(--color-text-secondary)]">Catégorie</label>
            <select {...register('categoryId')} className={inputCls + ' cursor-pointer'}>
              <option value="">Sans catégorie</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* SKU + Code-barre */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-body text-xs text-[var(--color-text-secondary)]">SKU</label>
              <input {...register('sku')} className={inputCls} placeholder="CHO-001" />
            </div>
            <div className="space-y-1.5">
              <label className="font-body text-xs text-[var(--color-text-secondary)]">Code-barre</label>
              <input {...register('barcode')} className={inputCls} placeholder="3760001234567" />
            </div>
          </div>

          {/* Variants */}
          <div className="space-y-3">
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
            className="flex-1 h-10 bg-[var(--color-accent)] text-[var(--color-on-accent)] font-body text-sm font-semibold rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-all"
          >
            {isSaving ? 'Enregistrement...' : isNew ? 'Créer' : 'Enregistrer'}
          </motion.button>
        </div>
      </motion.div>

      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40"
      />
    </AnimatePresence>
  )
}
