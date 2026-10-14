'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { MotionConfig } from 'framer-motion'
import { useState, useSyncExternalStore } from 'react'
import { ServiceWorkerRegistrar } from '@/components/ui/ServiceWorkerRegistrar'
import { OfflineIndicator } from '@/components/ui/OfflineIndicator'

// Téléphone : les messages arrivent en haut, la barre de vente reste libre en bas
const PHONE = '(max-width: 767px)'
function usePhone() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(PHONE)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia(PHONE).matches,
    () => false,
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  const phone = usePhone()
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      {/* Mouvement réduit demandé par le système : plus de déplacements, fondus seulement */}
      <MotionConfig reducedMotion="user">
      <ServiceWorkerRegistrar />
      <OfflineIndicator />
      {children}
      <Toaster
        position={phone ? 'top-center' : 'bottom-right'}
        toastOptions={{
          style: {
            background: 'var(--base-ink)',
            border: '1px solid var(--base-ink)',
            color: 'var(--base-bg)',
            fontFamily: 'var(--font-body)',
            borderRadius: 'var(--radius-lg)',
          },
        }}
      />
      </MotionConfig>
    </QueryClientProvider>
  )
}
