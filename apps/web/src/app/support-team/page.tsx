import type { Metadata } from 'next'
import { SupportTeam } from '@/components/support/SupportTeam'

export const metadata: Metadata = { title: 'Support FLŌW' }

// Boîte de réception de l'équipe FLŌW : l'API décide de l'accès
export default function SupportTeamPage() {
  return <SupportTeam />
}
