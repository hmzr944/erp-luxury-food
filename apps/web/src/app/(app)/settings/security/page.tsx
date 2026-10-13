import type { Metadata } from 'next'
import { AuditSettings } from '@/components/settings/AuditSettings'

export const metadata: Metadata = { title: 'Journal de sécurité' }
export default function SecurityPage() { return <AuditSettings /> }
