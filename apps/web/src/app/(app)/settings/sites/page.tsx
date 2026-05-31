import type { Metadata } from 'next'
import { SitesSettings } from '@/components/settings/SitesSettings'

export const metadata: Metadata = { title: 'Sites' }
export default function SitesPage() { return <SitesSettings /> }
