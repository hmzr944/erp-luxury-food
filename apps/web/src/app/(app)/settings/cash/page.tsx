import type { Metadata } from 'next'
import { CashSettings } from '@/components/settings/CashSettings'

export const metadata: Metadata = { title: 'Caisse' }
export default function CashPage() { return <CashSettings /> }
