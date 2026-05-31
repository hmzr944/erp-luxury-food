'use client'

// Dexie Sprint 1 (tables définies) + Sprint 4 (tables peuplées)
// POS fonctionne offline grâce au cache produits/catégories

import Dexie, { type Table } from 'dexie'
import type { POSCommand } from '@erp/types'
import type { ApiProduct, ApiCategory } from '@/lib/api/products'

interface PendingCommand {
  id?: number
  type: POSCommand['type']
  payload: any
  createdAt: Date
  synced: 0 | 1 | -1   // 0=pending, 1=synced, -1=failed
  retries: number
}

interface CachedProduct extends ApiProduct {
  _cachedAt: number
}

interface CachedCategory extends ApiCategory {
  _cachedAt: number
}

interface SyncMeta {
  id?: number
  key: string
  lastSync: number
}

class ERPDatabase extends Dexie {
  pendingCommands!: Table<PendingCommand>
  products!: Table<CachedProduct>
  categories!: Table<CachedCategory>
  syncMeta!: Table<SyncMeta>

  constructor() {
    super('erp-db')

    this.version(1).stores({
      pendingCommands: '++id, synced, createdAt',
    })

    // Sprint 4 — version 2 du schéma Dexie (migration additive)
    this.version(2).stores({
      pendingCommands: '++id, synced, createdAt',
      products: 'id, siteId, categoryId, barcode',
      categories: 'id, siteId',
      syncMeta: '++id, key',
    })
  }
}

export const db = new ERPDatabase()
export type { PendingCommand, CachedProduct, CachedCategory }

// Cache les produits d'un site en local
export async function cacheProducts(siteId: string, products: ApiProduct[]) {
  const now = Date.now()
  await db.products.where('siteId').equals(siteId).delete()
  await db.products.bulkPut(products.map((p) => ({ ...p, _cachedAt: now })))
  await db.syncMeta.put({ key: `products:${siteId}`, lastSync: now })
}

export async function cacheCategories(siteId: string, categories: ApiCategory[]) {
  const now = Date.now()
  await db.categories.where('siteId').equals(siteId).delete()
  await db.categories.bulkPut(categories.map((c) => ({ ...c, _cachedAt: now })))
}

// Récupère les produits depuis le cache (offline fallback)
export async function getCachedProducts(siteId: string): Promise<CachedProduct[]> {
  return db.products.where('siteId').equals(siteId).toArray()
}

export async function getCachedCategories(siteId: string): Promise<CachedCategory[]> {
  return db.categories.where('siteId').equals(siteId).toArray()
}

// Vérifie si le cache est valide (< 1h)
export async function isCacheValid(siteId: string): Promise<boolean> {
  const meta = await db.syncMeta.where('key').equals(`products:${siteId}`).first()
  if (!meta) return false
  return Date.now() - meta.lastSync < 60 * 60 * 1000
}
