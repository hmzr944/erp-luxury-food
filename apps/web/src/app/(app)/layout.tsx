import { Sidebar } from '@/components/layout/Sidebar'
import { WorkspaceGate } from '@/components/layout/WorkspaceGate'

// Back-office : gérant et titulaire. Vendeur et atelier sont renvoyés vers leur espace.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceGate workspace="backoffice">
      <div className="flex h-[100dvh] overflow-hidden bg-[var(--color-bg-base)]">
        <Sidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </WorkspaceGate>
  )
}
