import type { Metadata } from 'next'
import { ComplianceWithSite } from '@/components/compliance/ComplianceWithSite'

export const metadata: Metadata = { title: 'Conformité fiscale' }

export default function CompliancePage() {
  return <ComplianceWithSite />
}
