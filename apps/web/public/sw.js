// Service Worker ERP — Offline-first POS
// Sprint 4 : cache produits + queuing des commandes

const CACHE_NAME = 'erp-v1'
const API_CACHE  = 'erp-api-v1'
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
          .filter((k) => k !== CACHE_NAME && k !== API_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  )
})

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Produits & catégories — stale-while-revalidate
  const isProductsAPI = url.pathname.includes('/api/sites/') &&
    (url.pathname.includes('/products') || url.pathname.includes('/categories'))

  if (isProductsAPI && event.request.method === 'GET') {
    event.respondWith(staleWhileRevalidate(event.request))
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
async function staleWhileRevalidate(request) {
  const cache = await caches.open(API_CACHE)
  const cached = await cache.match(request)

  // Revalidation en arrière-plan
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)

  // Retourne le cache immédiatement si disponible
  if (cached) {
    fetchPromise // fire & forget
    return cached
  }

  // Pas de cache — attend le réseau
  const response = await fetchPromise
  if (response) return response

  return new Response(JSON.stringify({ error: 'offline', cached: false }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
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
