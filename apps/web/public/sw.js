// Service Worker ERP — Offline-first POS
// Sprint 4 : cache produits + queuing des commandes

const CACHE_NAME = 'erp-v2'
const API_CACHE  = 'erp-api-v2'
const STATIC_CACHE = 'erp-static-v2'
const CACHE_DURATION_MS = 60 * 60 * 1000 // 1h

// Assets statiques à précacher
const STATIC_ASSETS = [
  '/',
  '/login',
  '/manifest.json',
]

// ── Installation ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting()),
  )
})

// ── Activation ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![CACHE_NAME, API_CACHE, STATIC_CACHE].includes(k))
          .map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  )
})

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Fichiers de l'application (noms versionnés, jamais modifiés) — cache d'abord :
  // la caisse se recharge sans réseau après une première visite
  if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(event.request))
    return
  }

  // Catalogue et configuration — réseau d'abord (prix à jour), cache si hors ligne
  const isCatalogAPI = url.pathname.includes('/api/') && (
    (url.pathname.includes('/api/sites/') &&
      (url.pathname.includes('/products') || url.pathname.includes('/categories'))) ||
    url.pathname.endsWith('/organizations/me/platform')
  )

  if (isCatalogAPI && event.request.method === 'GET') {
    event.respondWith(networkFirst(event.request, API_CACHE))
    return
  }

  // Navigation — network-first avec fallback cache
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request))
    return
  }

  // Tout le reste — network only
})

// ── Stratégies ────────────────────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE)
    cache.put(request, response.clone())
  }
  return response
}

// Réseau d'abord, mais pas plus de 4 s : sur un réseau qui rame, la caisse
// repart sur sa copie locale au lieu de rester bloquée
async function networkFirst(request, cacheName = CACHE_NAME) {
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
    ])
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    return cached ?? new Response('Offline', { status: 503 })
  }
}

// ── Background Sync ───────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-commands') {
    event.waitUntil(notifyClientsToSync())
  }
})

async function notifyClientsToSync() {
  const clients = await self.clients.matchAll({ type: 'window' })
  clients.forEach((client) => client.postMessage({ type: 'SYNC_PENDING' }))
}
