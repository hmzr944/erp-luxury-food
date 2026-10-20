'use client'

import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { lotsApi } from '@/lib/api/lots'

// Caisse : prévient quand un produit n'a plus que des lots périmés. Un simple
// avertissement, jamais un blocage : la vente est signée quoi qu'il arrive, et
// sans réseau on n'a pas la liste, donc pas d'avertissement.
export function useExpiredWarning(siteId: string) {
  const { data } = useQuery({
    queryKey: ['lots-expired-only', siteId],
    queryFn: () => lotsApi.expiredOnly(siteId),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: false,
  })
  return useCallback(
    (product: { id: string; name: string }) => {
      if (!data?.productIds.includes(product.id)) return
      toast(`${product.name} : tous les lots en stock sont périmés. Vérifiez la date avant de vendre.`, {
        id: `expired-${product.id}`,
        duration: 7000,
      })
    },
    [data],
  )
}
