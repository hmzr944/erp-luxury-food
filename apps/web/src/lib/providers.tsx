'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
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
      <ServiceWorkerRegistrar />
      <OfflineIndicator />
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#111111',
            border: '1px solid #1F1F1F',
            color: '#F5F5F0',
            fontFamily: 'var(--font-body)',
          },
        }}
      />
    </QueryClientProvider>
  )
}
