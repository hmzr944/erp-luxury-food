import type { Metadata } from 'next'
import { WorkspaceGate } from '@/components/layout/WorkspaceGate'
import { AtelierScreen } from '@/components/atelier/AtelierScreen'

export const metadata: Metadata = { title: 'Atelier' }

export default async function AtelierPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  return (
    <WorkspaceGate workspace="atelier">
      <AtelierScreen siteId={siteId} />
    </WorkspaceGate>
  )
}
