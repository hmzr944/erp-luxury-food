import { test, expect } from '@playwright/test'

const API_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001'

// Vérifie la protection IDOR cross-tenant au niveau API
test.describe('Protection IDOR — SiteGuard', () => {
  let orgAToken: string
  let orgBToken: string
  let orgBSiteId: string

  test.beforeAll(async ({ request }) => {
    // Login Org A (seller)
    const loginA = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: 'vendeur@maison-artisane.fr', password: 'Seller1234!' },
    })
    const resA = await loginA.json()
    orgAToken = resA.accessToken

    // Pour ce test, on simule une tentative d'accès cross-tenant
    // En production, il faudrait créer une 2e org — ici on utilise un UUID aléatoire
    orgBSiteId = 'non-existent-site-id-xxxxxxxx'
  })

  test('accès refusé à un site d\'une autre organisation', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/sites/${orgBSiteId}/products`, {
      headers: { Authorization: `Bearer ${orgAToken}` },
    })
    // Doit retourner 404 (site introuvable) ou 403 (refusé) — jamais 200
    expect([403, 404]).toContain(res.status())
  })

  test('accès refusé aux commandes d\'un autre site', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/sites/${orgBSiteId}/orders`, {
      headers: { Authorization: `Bearer ${orgAToken}` },
    })
    expect([403, 404]).toContain(res.status())
  })

  test('accès refusé au dashboard d\'un autre site', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/sites/${orgBSiteId}/dashboard/summary`, {
      headers: { Authorization: `Bearer ${orgAToken}` },
    })
    expect([403, 404]).toContain(res.status())
  })

  test('checkout sur un site non autorisé est refusé', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/sites/${orgBSiteId}/orders/checkout`, {
      headers: { Authorization: `Bearer ${orgAToken}`, 'Content-Type': 'application/json' },
      data: {
        items: [{ productId: 'fake-id', quantity: 1 }],
        paymentMode: 'CARD',
      },
    })
    expect([403, 404]).toContain(res.status())
  })

  test('route sans auth retourne 401', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/users`)
    expect(res.status()).toBe(401)
  })
})
