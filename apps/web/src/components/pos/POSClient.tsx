'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { POSHeader } from './POSHeader'
import { CategoryTabs } from './CategoryTabs'
import { ProductGrid } from './ProductGrid'
import { Cart } from './Cart'
import { CheckoutModal } from './CheckoutModal'
import { productsApi, type ApiProduct } from '@/lib/api/products'
import { useCartStore } from '@/stores/cart.store'

interface POSClientProps {
  siteId: string
  siteName: string
}

export function POSClient({ siteId, siteName }: POSClientProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  const { addProduct } = useCartStore()

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['products', siteId],
    queryFn: () => productsApi.getAll(siteId),
    staleTime: 60_000,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', siteId],
    queryFn: () => productsApi.getCategories(siteId),
    staleTime: 60_000,
  })

  const handleAddProduct = (product: ApiProduct) => {
    addProduct(
      {
        id: product.id,
        name: product.name,
        subtitle: product.subtitle ?? undefined,
        price: Number(product.price),
        taxRate: Number(product.taxRate),
        categoryId: product.categoryId ?? undefined,
      },
    )

    // Feedback sonore optionnel
    // toast.success(product.name, { duration: 1000 })
  }

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-[var(--color-bg-base)]">
      <POSHeader siteName={siteName} />

      <div className="flex flex-1 overflow-hidden">
        <CategoryTabs
          categories={categories}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
        />

        <ProductGrid
          products={products}
          selectedCategory={selectedCategory}
          onAddProduct={handleAddProduct}
          isLoading={loadingProducts}
        />

        <Cart onCheckout={() => setCheckoutOpen(true)} />
      </div>

      <CheckoutModal
        siteId={siteId}
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
      />
    </div>
  )
}
