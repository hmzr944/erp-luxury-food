import { Suspense } from 'react'
import type { Metadata } from 'next'
import { StockWithSite } from '@/components/stock/StockWithSite'

export const metadata: Metadata = { title: 'Stock' }

// Le choix de la vue (site ou réseau) vit dans l'URL (?vue=reseau)
export default function StockPage() {
  return (
    <Suspense fallback={null}>
      <StockWithSite />
    </Suspense>
  )
}
