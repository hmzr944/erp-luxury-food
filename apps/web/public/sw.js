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

  // Navigation : réseau d'abord avec copie locale. Seules la caisse et
  // l'atelier coupent au bout de 4 s (il faut pouvoir vendre) ; le reste
  // attend le réseau normalement
  if (event.request.mode === 'navigate') {
    const urgent = url.pathname.startsWith('/pos') || url.pathname.startsWith('/atelier')
    event.respondWith(networkFirst(event.request, CACHE_NAME, urgent ? 4000 : 0, true))
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
async function networkFirst(request, cacheName = CACHE_NAME, timeout = 4000, page = false) {
  try {
    const response = await (timeout
      ? Promise.race([fetch(request), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout))])
      : fetch(request))
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    return page
      ? new Response(OFFLINE_PAGE, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      : new Response('Hors ligne', { status: 503 })
  }
}

// Page affichée quand une page n'a jamais été ouverte sur cet appareil et que
// le réseau manque : en français, aux trois couleurs FLŌW, avec un bouton pour réessayer
const OFFLINE_PAGE = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hors ligne · FLŌW</title>
<style>:root{color-scheme:light dark}body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#F4F2ED;color:#14141A;font:16px/1.5 system-ui,sans-serif;padding:24px}
@media (prefers-color-scheme:dark){body{background:#14141A;color:#F4F2ED}}
main{max-width:22rem;text-align:center}h1{font-size:1.75rem;margin:20px 0 8px;letter-spacing:-.02em}p{margin:0 0 24px;opacity:.85}
button{height:48px;padding:0 24px;border:0;border-radius:999px;background:#1F3FFF;color:#F4F2ED;font:600 16px system-ui,sans-serif;cursor:pointer}
button:focus-visible{outline:2px solid #1F3FFF;outline-offset:3px}</style></head>
<body><main><svg width="56" height="56" viewBox="0 0 48 48" aria-hidden="true"><rect x="11" y="5" width="26" height="6" rx="3" fill="#1F3FFF"/><path d="M23 15.5 A13 13 0 0 0 23 41.5 Z" fill="currentColor"/><path d="M25 18.5 A13 13 0 0 1 25 44.5 Z" fill="currentColor"/></svg>
<h1>Pas de réseau</h1><p>Cette page n'a pas encore été ouverte sur cet appareil. Les ventes déjà en caisse continuent hors ligne.</p>
<button onclick="location.reload()">Réessayer</button></main></body></html>`

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
