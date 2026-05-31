import type { Metadata } from 'next'
import { PrintingSettings } from '@/components/settings/PrintingSettings'

export const metadata: Metadata = { title: 'Impression' }
export default function PrintingPage() { return <PrintingSettings /> }
