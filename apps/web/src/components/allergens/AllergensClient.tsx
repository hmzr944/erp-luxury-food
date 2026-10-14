'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { CaretDown, CheckCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { allergensApi, type ProductWithAllergens, type AllergenApi } from '@/lib/api/allergens'
import { EASE_OUT } from '@/lib/motion'
import { Loading } from '@/components/brand/FlowLogo'

const ALLERGEN_COLORS: Record<string, string> = {
  GLUTEN:       'bg-[var(--color-accent-muted)] text-[var(--color-text-primary)] border-[var(--color-border)]',
  CRUSTACES:    'bg-[var(--color-accent-muted)] text-[var(--color-text-primary)] border-[var(--color-border)]',
  OEUFS:        'bg-[var(--color-accent-muted)] text-[var(--color-text-primary)] border-[var(--color-border)]',
  POISSONS:     'bg-[var(--color-accent-muted)] text-[var(--color-text-primary)] border-[var(--color-border)]',
  ARACHIDES:    'bg-[var(--color-accent-muted)] text-[var(--color-text-primary)] border-[var(--color-border)]',
  SOJA:         'bg-[var(--color-accent-muted)] text-[var(--color-text-primary)] border-[var(--color-border)]',
  LAIT:         'bg-[var(--color-accent-muted)] text-[var(--color-text-primary)] border-[var(--color-border)]',
  FRUITS_COQUE: 'bg-[var(--color-accent-muted)] text-[var(--color-text-primary)] border-[var(--color-border)]',
  CELERI:       'bg-[var(--color-accent-muted)] text-[var(--color-text-primary)] border-[var(--color-border)]',
  MOUTARDE:     'bg-[var(--color-accent-muted)] text-[var(--color-text-primary)] border-[var(--color-border)]',
  SESAME:       'bg-[var(--color-accent-muted)] text-[var(--color-text-primary)] border-[var(--color-border)]',
  SULFITES:     'bg-[var(--color-accent-muted)] text-[var(--color-text-primary)] border-[var(--color-border)]',
  LUPIN:        'bg-[var(--color-accent-muted)] text-[var(--color-text-primary)] border-[var(--color-border)]',
  MOLLUSQUES:   'bg-[var(--color-accent-muted)] text-[var(--color-text-primary)] border-[var(--color-border)]',
}

interface AllergenChipProps {
  allergen: AllergenApi
  active: boolean
  traces: boolean
  onToggle: () => void
  onToggleTraces: () => void
}

function AllergenChip({ allergen, active, traces, onToggle, onToggleTraces }: AllergenChipProps) {
  const colors = ALLERGEN_COLORS[allergen.code] ?? 'bg-[var(--color-accent-muted)] text-[var(--color-text-primary)] border-[var(--color-border)]'

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={onToggle}
        className={[
          'px-2.5 py-1.5 rounded-[var(--radius-md)] border font-body text-sm font-medium press',
          active ? colors : 'bg-transparent border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]',
        ].join(' ')}
      >
        {allergen.name.split(' ')[0]}
      </button>

      {active && (
        <button
          onClick={onToggleTraces}
          className={[
            'tabular text-xs px-1.5 py-0.5 rounded-full border transition-colors',
            traces
              ? 'border-[var(--color-warning)]/30 text-[var(--color-warning)] bg-[var(--color-warning)]/10'
              : 'border-[var(--color-border)] text-[var(--color-text-muted)]',
          ].join(' ')}
        >
          traces
        </button>
      )}
    </div>
  )
}

interface ProductRowProps {
  product: ProductWithAllergens
  allergens: AllergenApi[]
  siteId: string
}

function ProductRow({ product, allergens, siteId }: ProductRowProps) {
  const [expanded, setExpanded] = useState(false)
  const qc = useQueryClient()

  const activeMap = new Map(product.allergens.map((pa) => [pa.allergenId, pa.traces]))

  const save = useMutation({
    mutationFn: (data: Array<{ allergenId: string; traces: boolean }>) =>
      allergensApi.setProductAllergens(siteId, product.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products-allergens', siteId] })
      toast.success(`Allergènes mis à jour : ${product.name}`)
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  })

  const handleToggle = (allergenId: string) => {
    const next = new Map(activeMap)
    if (next.has(allergenId)) {
      next.delete(allergenId)
    } else {
      next.set(allergenId, false)
    }
    save.mutate(Array.from(next.entries()).map(([id, traces]) => ({ allergenId: id, traces })))
  }

  const handleToggleTraces = (allergenId: string) => {
    const next = new Map(activeMap)
    next.set(allergenId, !next.get(allergenId))
    save.mutate(Array.from(next.entries()).map(([id, traces]) => ({ allergenId: id, traces })))
  }

  const activeCount = product.allergens.length

  return (
    <div className="border-b border-[var(--color-border)] last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-3 text-left hover:bg-[var(--color-bg-hover)] px-2 rounded-[var(--radius-md)] transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div>
            <p className="font-body text-sm text-[var(--color-text-primary)]">{product.name}</p>
            {product.subtitle && (
              <p className="font-body text-sm text-[var(--color-text-muted)]">{product.subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <div className="flex items-center gap-1">
              {product.allergens.slice(0, 4).map((pa) => (
                <span
                  key={pa.allergenId}
                  className={[
                    'px-1.5 py-0.5 rounded-[var(--radius-sm)] font-data text-xs border',
                    ALLERGEN_COLORS[pa.allergen.code] ?? 'bg-[var(--color-accent-muted)] text-[var(--color-text-primary)] border-[var(--color-border)]',
                    pa.traces ? 'opacity-60' : '',
                  ].join(' ')}
                >
                  {pa.allergen.code.slice(0, 4)}
                </span>
              ))}
              {activeCount > 4 && (
                <span className="tabular text-xs text-[var(--color-text-muted)]">
                  +{activeCount - 4}
                </span>
              )}
            </div>
          )}

          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <CaretDown size={13} weight="regular" className="text-[var(--color-text-muted)]" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-4 pt-2">
              <div className="flex flex-wrap gap-2">
                {allergens.map((allergen) => (
                  <AllergenChip
                    key={allergen.id}
                    allergen={allergen}
                    active={activeMap.has(allergen.id)}
                    traces={activeMap.get(allergen.id) ?? false}
                    onToggle={() => handleToggle(allergen.id)}
                    onToggleTraces={() => handleToggleTraces(allergen.id)}
                  />
                ))}
              </div>

              {save.isPending && (
                <Loading label="Enregistrement" className="mt-3" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface AllergensClientProps { siteId: string }

export function AllergensClient({ siteId }: AllergensClientProps) {
  const { data: allergens = [] } = useQuery({
    queryKey: ['allergens'],
    queryFn: () => allergensApi.getAll(),
    staleTime: Infinity,
  })

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products-allergens', siteId],
    queryFn: () => allergensApi.getProductsWithAllergens(siteId),
  })

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-[var(--color-border)]">
        <h1 className="page-title">Allergènes</h1>
        <p className="font-body text-xs text-[var(--color-text-muted)] mt-0.5">
          14 allergènes INCO (Règlement EU 1169/2011)
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 mb-2 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border)] animate-pulse" />
            ))
          : products.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                allergens={allergens}
                siteId={siteId}
              />
            ))}
      </div>
    </div>
  )
}
