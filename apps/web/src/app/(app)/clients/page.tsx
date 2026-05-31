import type { Metadata } from 'next'
import { ClientsClient } from '@/components/b2b/ClientsClient'

export const metadata: Metadata = { title: 'Clients B2B' }

export default function ClientsPage() {
  return <ClientsClient />
}
