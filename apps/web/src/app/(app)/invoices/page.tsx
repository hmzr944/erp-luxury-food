import type { Metadata } from 'next'
import { InvoicesClient } from '@/components/invoices/InvoicesClient'

export const metadata: Metadata = { title: 'Factures' }
export default function InvoicesPage() { return <InvoicesClient /> }
