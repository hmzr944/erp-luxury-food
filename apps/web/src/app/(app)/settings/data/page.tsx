import type { Metadata } from 'next'
import { DataSettings } from '@/components/settings/DataSettings'

export const metadata: Metadata = { title: 'Données' }
export default function DataPage() { return <DataSettings /> }
