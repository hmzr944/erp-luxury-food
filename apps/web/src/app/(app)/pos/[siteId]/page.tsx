import { POSClient } from '@/components/pos/POSClient'
import type { Metadata } from 'next'

interface POSPageProps {
  params: Promise<{ siteId: string }>
}

export const metadata: Metadata = { title: 'Caisse' }

export default async function POSPage({ params }: POSPageProps) {
  const { siteId } = await params

  return <POSClient siteId={siteId} siteName="Boutique" />
}
