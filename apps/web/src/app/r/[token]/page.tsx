import type { Metadata } from 'next'
import { ReceiptClient } from './ReceiptClient'

interface Props { params: Promise<{ token: string }> }

// Lien privé : jamais indexé
export const metadata: Metadata = { title: 'Votre ticket', robots: { index: false, follow: false } }

export default async function ReceiptPage({ params }: Props) {
  const { token } = await params
  return <ReceiptClient token={token} />
}
