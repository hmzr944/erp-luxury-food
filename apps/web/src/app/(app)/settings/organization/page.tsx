import type { Metadata } from 'next'
import { OrganizationSettings } from '@/components/settings/OrganizationSettings'

export const metadata: Metadata = { title: 'Organisation' }
export default function OrgPage() { return <OrganizationSettings /> }
