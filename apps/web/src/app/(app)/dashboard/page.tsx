import { Suspense } from 'react'
import type { Metadata } from 'next'
import { MultiSiteDashboard } from '@/components/dashboard/MultiSiteDashboard'

export const metadata: Metadata = { title: 'Tableau de bord' }

// Tableau de bord du réseau : tous les sites de l'organisation, sur la période
// choisie (?periode=). Le sélecteur de période lit l'URL, d'où le Suspense.
export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <MultiSiteDashboard />
    </Suspense>
  )
}
