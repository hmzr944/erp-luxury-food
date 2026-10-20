import type { Metadata } from 'next'
import { LotsWithSite } from '@/components/stock/lots/LotsWithSite'

export const metadata: Metadata = { title: 'Lots et dates' }

export default function LotsPage() {
  return <LotsWithSite />
}
