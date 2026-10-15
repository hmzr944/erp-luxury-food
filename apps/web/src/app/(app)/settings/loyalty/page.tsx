import type { Metadata } from 'next'
import { LoyaltySettings } from '@/components/settings/LoyaltySettings'

export const metadata: Metadata = { title: 'Fidélité et cartes cadeaux' }
export default function LoyaltyPage() { return <LoyaltySettings /> }
