import type { Metadata } from 'next'
import { ApiSettings } from '@/components/settings/ApiSettings'

export const metadata: Metadata = { title: 'API' }
export default function ApiPage() { return <ApiSettings /> }
