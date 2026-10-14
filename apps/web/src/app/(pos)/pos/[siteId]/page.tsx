import { POSClient } from '@/components/pos/POSClient'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Caisse' }

interface Props { params: Promise<{ siteId: string }>; searchParams: Promise<{ decouverte?: string }> }

export default async function POSPage({ params, searchParams }: Props) {
  const { siteId } = await params
  const { decouverte } = await searchParams
  return <POSClient siteId={siteId} discovery={decouverte === '1'} />
}
