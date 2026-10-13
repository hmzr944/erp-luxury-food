import { POSClient } from '@/components/pos/POSClient'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Caisse' }

interface Props { params: Promise<{ siteId: string }> }

export default async function POSPage({ params }: Props) {
  const { siteId } = await params
  return <POSClient siteId={siteId} />
}
