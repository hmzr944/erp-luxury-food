import type { Metadata } from 'next'
import { PaymentSettings } from '@/components/settings/PaymentSettings'

export const metadata: Metadata = { title: 'Paiement' }
export default function PaymentsPage() { return <PaymentSettings /> }
