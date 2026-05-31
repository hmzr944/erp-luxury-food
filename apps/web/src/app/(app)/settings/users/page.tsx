import type { Metadata } from 'next'
import { UsersSettings } from '@/components/settings/UsersSettings'

export const metadata: Metadata = { title: 'Équipe' }
export default function UsersSettingsPage() { return <UsersSettings /> }
