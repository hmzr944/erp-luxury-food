import type { Metadata } from 'next'
import { SupplyHub } from '@/components/supply/SupplyHub'

export const metadata: Metadata = { title: 'Approvisionnement' }
export default function SupplyPage() { return <SupplyHub /> }
