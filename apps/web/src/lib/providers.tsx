'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { MotionConfig } from 'framer-motion'
import { useState } from 'react'
import { ServiceWorkerRegistrar } from '@/components/ui/ServiceWorkerRegistrar'
import { OfflineIndicator } from '@/components/ui/OfflineIndicator'

export function Providers({ children }: { children: React.ReactNode }) {
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
      {/* En haut : la barre de vente et le bouton Encaisser restent libres en bas */}
      <Toaster
        position="top-center"
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
