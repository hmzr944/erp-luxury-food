'use client'

import { productsApi } from '@/lib/api/products'
import { cacheProducts, cacheCategories } from './db'
import { flushPendingCommands } from './queue'

// Synchronisation complète au retour online
export async function syncAll(siteId: string): Promise<void> {
  if (!navigator.onLine) return

  await Promise.allSettled([
    syncProducts(siteId),
    flushPendingCommands(),
  ])
}

// Cache les produits d'un site
export async function syncProducts(siteId: string): Promise<void> {
  try {
    const [products, categories] = await Promise.all([
      productsApi.getAll(siteId),
      productsApi.getCategories(siteId),
    ])
    await cacheProducts(siteId, products)
    await cacheCategories(siteId, categories)
  } catch {
    // Erreur réseau — pas critique, on garde le cache existant
  }
}
