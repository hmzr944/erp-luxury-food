'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { WORKSPACE_ROLES, homePath, type Workspace } from '@/lib/workspace'
import { hasOfflineSession } from '@/lib/auth/offline-session'
import { rememberReturnTo, stashPairingFragment } from '@/lib/hardware/link'

// Garde d'espace côté écran : renvoie chacun vers le sien. Le serveur refuse
// de toute façon ce que le rôle ne permet pas ; ceci évite d'afficher un
// écran vide d'erreurs.
export function WorkspaceGate({ workspace, children }: { workspace: Workspace; children: React.ReactNode }) {
  const router = useRouter()
  const { user } = useAuthStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Caisse reprise sans réseau : pas encore de jeton, la session est locale
    if (!localStorage.getItem('access_token') && !(workspace === 'pos' && hasOfflineSession())) {
      // Après la connexion, retour sur cette page, fragment compris (lien
      // d'appairage ouvert par FLŌW-Bridge sur /materiel#pont=...)
      rememberReturnTo(window.location.pathname + window.location.search + window.location.hash)
      router.replace('/login')
      return
    }
    if (user && !WORKSPACE_ROLES[workspace].includes(user.role)) {
      // Vendeur arrivé par le lien du pont : l'appairage se fera depuis la caisse
      stashPairingFragment()
      void homePath(user.role).then((p) => router.replace(p))
      return
    }
    setReady(true)
  }, [user, workspace, router])

  return ready ? <>{children}</> : null
}
