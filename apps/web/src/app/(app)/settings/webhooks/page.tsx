import type { Metadata } from 'next'
import { WebhooksSettings } from '@/components/settings/WebhooksSettings'

export const metadata: Metadata = { title: 'Webhooks' }
export default function WebhooksPage() { return <WebhooksSettings /> }
