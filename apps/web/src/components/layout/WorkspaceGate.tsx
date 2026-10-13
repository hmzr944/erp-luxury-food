'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { WORKSPACE_ROLES, homePath, type Workspace } from '@/lib/workspace'

// Garde d'espace côté écran : renvoie chacun vers le sien. Le serveur refuse
// de toute façon ce que le rôle ne permet pas ; ceci évite d'afficher un
// écran vide d'erreurs.
export function WorkspaceGate({ workspace, children }: { workspace: Workspace; children: React.ReactNode }) {
  const router = useRouter()
  const { user } = useAuthStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('access_token')) {
      router.replace('/login')
      return
    }
    if (user && !WORKSPACE_ROLES[workspace].includes(user.role)) {
      void homePath(user.role).then((p) => router.replace(p))
      return
    }
    setReady(true)
  }, [user, workspace, router])

  return ready ? <>{children}</> : null
}
