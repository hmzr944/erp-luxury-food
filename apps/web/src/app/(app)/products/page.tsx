import type { Metadata } from 'next'
import { ProductsWithSite } from '@/components/products/ProductsWithSite'

export const metadata: Metadata = { title: 'Catalogue' }

export default function ProductsPage() {
  return <ProductsWithSite />
}
