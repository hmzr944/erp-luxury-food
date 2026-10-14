import type { Metadata } from 'next'
import { MultiSiteDashboard } from '@/components/dashboard/MultiSiteDashboard'

export const metadata: Metadata = { title: 'Tableau de bord' }

// Sprint 8 : dashboard consolidé multi-sites (remplace le dashboard site-unique)
// Le dashboard site-specific (CA horaire, top produits) reste accessible via DashboardWithSite
export default function DashboardPage() {
  return <MultiSiteDashboard />
}
