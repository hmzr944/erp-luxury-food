import type { Metadata } from 'next'
import { PickupClient } from './PickupClient'

interface Props { params: Promise<{ code: string }> }

export const metadata: Metadata = { title: 'Retrait commande' }

export default async function PickupPage({ params }: Props) {
  const { code } = await params
  return <PickupClient code={code.toUpperCase()} />
}
