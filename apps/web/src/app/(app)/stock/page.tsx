import type { Metadata } from 'next'
import { StockWithSite } from '@/components/stock/StockWithSite'

export const metadata: Metadata = { title: 'Stock' }

export default function StockPage() {
  return <StockWithSite />
}
