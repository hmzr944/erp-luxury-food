'use client'

// Pattern Command — toute action POS passe par ici
// Règle absolue : jamais de fetch direct depuis le POS
// Le vendeur ne voit JAMAIS "Erreur réseau"

import { db } from './db'
import type { POSCommand } from '@erp/types'

// Applique l'optimistic update dans le store local (Zustand)
// Implémenté en Sprint 2 pour chaque type de commande
function applyOptimisticUpdate(_cmd: POSCommand): void {
  // Sprint 2 : mise à jour Zustand locale selon cmd.type
}

// Exécute la commande contre l'API
async function executeCommand(cmd: POSCommand): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

  // Les ventes ne passent plus par cette file : elles sont signées par la
  // caisse et synchronisées par lib/terminal (sans risque de doublon)
  switch (cmd.type) {
    case 'UPDATE_ORDER_STATUS':
      await fetchApi(`${baseUrl}/api/orders/${cmd.payload.orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: cmd.payload.status }),
      })
      break
  }
}

async function fetchApi(url: string, options: RequestInit): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res
}

export async function dispatchPOSCommand(cmd: POSCommand): Promise<void> {
  // Optimistic update immédiat dans tous les cas
  applyOptimisticUpdate(cmd)

  try {
    await executeCommand(cmd)
  } catch {
    // navigator.onLine peut être true sur un réseau flaky — on file toujours
    await db.pendingCommands.add({
      type: cmd.type,
      payload: cmd.payload,
      createdAt: new Date(),
      synced: 0,
      retries: 0,
    })
  }
}

export async function flushPendingCommands(): Promise<void> {
  const pending = await db.pendingCommands
    .where('synced')
    .equals(0)
    .sortBy('createdAt')  // FIFO strict

  for (const cmd of pending) {
    // Poison pill : skip après 5 échecs
    if ((cmd.retries ?? 0) >= 5) {
      await db.pendingCommands.update(cmd.id!, { synced: -1 })
      continue
    }

    try {
      await executeCommand({ type: cmd.type, payload: cmd.payload } as POSCommand)
      await db.pendingCommands.update(cmd.id!, { synced: 1 })
    } catch {
      await db.pendingCommands.update(cmd.id!, { retries: (cmd.retries ?? 0) + 1 })
      break  // Stop sur le premier échec réseau réel — réessai au prochain 'online'
    }
  }
}

// Sync automatique au retour de la connexion
if (typeof window !== 'undefined') {
  window.addEventListener('online', flushPendingCommands)
}
