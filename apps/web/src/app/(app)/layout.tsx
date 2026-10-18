import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { WorkspaceGate } from '@/components/layout/WorkspaceGate'
import { AccessNotice } from '@/components/billing/AccessNotice'

// Back-office : gérant et titulaire. Vendeur et atelier sont renvoyés vers leur espace.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceGate workspace="backoffice">
      <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--color-bg-base)] md:flex-row">
        <Sidebar />
        <MobileNav />
        <main className="min-w-0 flex-1 overflow-auto pb-20 md:pb-0">
          {/* Back-office : gérant et titulaire, qui peuvent ouvrir l'abonnement */}
          <AccessNotice canSubscribe />
          {children}
        </main>
      </div>
    </WorkspaceGate>
  )
}
