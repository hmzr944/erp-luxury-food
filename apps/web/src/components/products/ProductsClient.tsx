'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, PencilSimple, Trash, MagnifyingGlass, Tag } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { formatPrice } from '@erp/utils'
import { productsAdminApi, type CreateProductPayload } from '@/lib/api/products-admin'
import { productsApi, type ApiProduct } from '@/lib/api/products'
import { ProductDrawer, type ProductFormValues } from './ProductDrawer'
import { rayonShapes } from '@/lib/brand'
import { RayonGlyph } from '@/components/brand/RayonGlyph'

interface ProductsClientProps { siteId: string }

export function ProductsClient({ siteId }: ProductsClientProps) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [drawerProduct, setDrawerProduct] = useState<ApiProduct | null | 'new'>(null)

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products-admin', siteId],
    queryFn: () => productsAdminApi.getAll(siteId),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', siteId],
    queryFn: () => productsApi.getCategories(siteId),
  })
  const shapeOf = rayonShapes(categories)

  const createProduct = useMutation({
    mutationFn: (data: CreateProductPayload) => productsAdminApi.create(siteId, data),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['products-admin', siteId] })
      qc.invalidateQueries({ queryKey: ['products', siteId] })
      toast.success(`${p.name} créé`)
      setDrawerProduct(null)
    },
    onError: (err: any) => toast.error(err.message ?? 'Erreur'),
  })

  const updateProduct = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateProductPayload> }) =>
      productsAdminApi.update(siteId, id, data),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['products-admin', siteId] })
      qc.invalidateQueries({ queryKey: ['products', siteId] })
      toast.success(`${p.name} mis à jour`)
      setDrawerProduct(null)
    },
    onError: (err: any) => toast.error(err.message),
  })

  const removeProduct = useMutation({
    mutationFn: (id: string) => productsAdminApi.remove(siteId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products-admin', siteId] })
      qc.invalidateQueries({ queryKey: ['products', siteId] })
      toast.success('Produit désactivé')
    },
    onError: (err: any) => toast.error(err.message),
  })

  const handleSave = async (data: ProductFormValues) => {
    const payload: CreateProductPayload = {
      name: data.name,
      subtitle: data.subtitle || undefined,
      description: data.description || undefined,
      sku: data.sku || undefined,
      barcode: data.barcode || undefined,
      price: data.price,
      taxRate: data.taxRate,
      categoryId: data.categoryId || undefined,
      variants: data.variants?.filter((v) => v.name && v.price > 0),
    }

    if (drawerProduct === 'new') {
      await createProduct.mutateAsync(payload)
    } else if (drawerProduct) {
      await updateProduct.mutateAsync({ id: drawerProduct.id, data: payload })
    }
  }

  const filtered = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())
    const matchCat = !categoryFilter || p.categoryId === categoryFilter
    return matchSearch && matchCat
  })

  const activeCount = products.filter((p) => p.isActive).length

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
        <div>
          <h1 className="page-title">Catalogue</h1>
          <p className="font-body text-xs text-[var(--color-text-muted)] mt-0.5">
            {activeCount} produit{activeCount > 1 ? 's' : ''} actif{activeCount > 1 ? 's' : ''}
          </p>
        </div>
        <motion.button
          onClick={() => setDrawerProduct('new')}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-1.5 px-3 h-10 bg-[var(--color-accent)] text-[var(--color-on-accent)] font-body text-sm rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          <Plus size={13} weight="bold" />
          Nouveau produit
        </motion.button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-[var(--color-border)]">
        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlass size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Rechercher un produit"
            placeholder="Nom, SKU..."
            className="w-full h-8 pl-7 pr-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-[var(--radius-md)] font-body text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-colors"
          />
        </div>

        <div role="group" aria-label="Rayons" className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
          <button
            type="button"
            aria-pressed={!categoryFilter}
            onClick={() => setCategoryFilter(null)}
            className={[
              'flex h-10 shrink-0 items-center rounded-[var(--radius-pill)] px-4 font-body text-sm font-medium whitespace-nowrap transition-colors',
              !categoryFilter
                ? 'bg-[var(--color-bg-inverse)] text-[var(--color-text-inverse)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]',
            ].join(' ')}
          >
            Toutes
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={c.id === categoryFilter}
              onClick={() => setCategoryFilter(c.id === categoryFilter ? null : c.id)}
              className={[
                'flex h-10 shrink-0 items-center gap-2 rounded-[var(--radius-pill)] px-4 font-body text-sm font-medium whitespace-nowrap transition-colors',
                c.id === categoryFilter
                  ? 'bg-[var(--color-bg-inverse)] text-[var(--color-text-inverse)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]',
              ].join(' ')}
            >
              {shapeOf.get(c.id) && <RayonGlyph shape={shapeOf.get(c.id)!} size={16} />}
              {c.name}
              <span className="tabular text-xs opacity-60">{c._count.products}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 rounded bg-[var(--color-bg-surface)] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20">
            <Tag size={28} weight="regular" className="text-[var(--color-text-muted)]" />
            <p className="font-body text-sm text-[var(--color-text-muted)]">
              {search ? `Aucun résultat pour "${search}"` : 'Aucun produit. Créez le premier.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {filtered.map((product) => (
              <motion.div
                key={product.id}
                layout
                className={[
                  'flex items-center px-6 py-3 group hover:bg-[var(--color-bg-hover)] transition-colors',
                  !product.isActive ? 'opacity-40' : '',
                ].join(' ')}
              >
                {/* Forme du rayon */}
                <span className="mr-3 grid w-5 shrink-0 place-items-center">
                  {product.categoryId && shapeOf.get(product.categoryId) && <RayonGlyph shape={shapeOf.get(product.categoryId)!} size={16} />}
                </span>

                {/* Name + sub */}
                <div className="flex-1 min-w-0 mr-4">
                  <p className="font-body text-sm text-[var(--color-text-primary)] truncate">
                    {product.name}
                    {!product.isActive && (
                      <span className="ml-2 tabular text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-elevated)] px-1.5 py-0.5 rounded-full">
                        désactivé
                      </span>
                    )}
                  </p>
                  {product.subtitle && (
                    <p className="font-body text-sm text-[var(--color-text-muted)] truncate">
                      {product.subtitle}
                    </p>
                  )}
                </div>

                {/* Category */}
                <span className="font-body text-sm text-[var(--color-text-muted)] w-28 truncate hidden lg:block">
                  {product.category?.name ?? '-'}
                </span>

                {/* SKU */}
                <span className="font-data text-xs text-[var(--color-text-muted)] w-24 hidden xl:block">
                  {product.sku ?? '-'}
                </span>

                {/* Price */}
                <span className="tabular text-sm text-[var(--color-text-primary)] w-20 text-right mr-4">
                  {formatPrice(Number(product.price))}
                </span>

                {/* Actions */}
                {/* Visibles au clavier et au toucher, discrètes à la souris */}
                <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
                  <button
                    type="button"
                    aria-label={`Modifier ${product.name}`}
                    onClick={() => setDrawerProduct(product)}
                    className="grid size-10 place-items-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] rounded-[var(--radius-pill)] transition-colors"
                  >
                    <PencilSimple size={18} aria-hidden />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Désactiver "${product.name}" ?`)) {
                        removeProduct.mutate(product.id)
                      }
                    }}
                    type="button"
                    aria-label={`Désactiver ${product.name}`}
                    className="grid size-10 place-items-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] rounded-[var(--radius-pill)] transition-colors"
                  >
                    <Trash size={18} aria-hidden />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {drawerProduct !== null && (
          <ProductDrawer
            product={drawerProduct === 'new' ? null : drawerProduct}
            isNew={drawerProduct === 'new'}
            categories={categories}
            onSave={handleSave}
            onClose={() => setDrawerProduct(null)}
            isSaving={createProduct.isPending || updateProduct.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
