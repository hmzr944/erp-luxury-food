import type { Metadata } from 'next'
import { VirtualTerminal } from '@/components/payments/VirtualTerminal'

export const metadata: Metadata = { title: 'TPE virtuel' }

interface Props { params: Promise<{ siteId: string; deviceId: string }> }

export default async function VirtualTerminalPage({ params }: Props) {
  const { siteId, deviceId } = await params
  return <VirtualTerminal siteId={siteId} deviceId={deviceId} />
}
