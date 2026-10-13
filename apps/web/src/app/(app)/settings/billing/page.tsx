import type { Metadata } from 'next'
import { BillingSettings } from '@/components/settings/BillingSettings'

export const metadata: Metadata = { title: 'Abonnement' }
export default function BillingPage() { return <BillingSettings /> }
