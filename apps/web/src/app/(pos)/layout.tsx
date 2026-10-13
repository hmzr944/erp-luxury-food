import { WorkspaceGate } from '@/components/layout/WorkspaceGate'

// Caisse : plein écran, pas de barre latérale
export default function POSLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceGate workspace="pos">{children}</WorkspaceGate>
}
