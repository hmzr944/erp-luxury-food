import type { Metadata } from 'next'
import { InvoicePage } from './InvoicePage'

export const metadata: Metadata = { title: 'Facture' }

interface Props { params: Promise<{ orderId: string }> }

export default async function InvoiceRoute({ params }: Props) {
  const { orderId } = await params
  return <InvoicePage orderId={orderId} />
}
