import { Suspense } from 'react'
import type { Metadata } from 'next'
import { InventoryWithSite } from '@/components/stock/InventoryWithSite'

export const metadata: Metadata = { title: 'Inventaire' }

export default function InventoryPage() {
  return (
    <Suspense fallback={null}>
      <InventoryWithSite />
    </Suspense>
  )
}
