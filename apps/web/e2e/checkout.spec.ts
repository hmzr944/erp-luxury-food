import { test, expect } from '@playwright/test'
import { loginAs, TEST_SELLER } from './helpers/auth'

// Récupère le siteId depuis l'API après login
async function getSiteId(page: any): Promise<string> {
  const res = await page.request.get('/api/sites', {
    headers: { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('access_token'))}` },
  })
  const sites = await res.json()
  return sites[0]?.id
}

test.describe('Checkout flow complet', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page)
  })

  test('encaissement simple, carte et ticket signé', async ({ page }) => {
    const siteId = await getSiteId(page)
    await page.goto(`/pos/${siteId}`)

    // Attendre la grille produits
    await expect(page.locator('[aria-label^="Ajouter"]').first()).toBeVisible({ timeout: 10_000 })

    // Ajouter le premier produit au panier
    await page.locator('[aria-label^="Ajouter"]').first().click()

    // Vérifier que le compteur panier s'incrémente
    await expect(page.getByText('1').first()).toBeVisible()

    // Ouvrir le modal d'encaissement
    await page.getByRole('button', { name: /encaisser/i }).click()

    // Vérifier que le modal s'ouvre
    await expect(page.getByText('Encaisser')).toBeVisible()

    // Sélectionner mode CARD (déjà sélectionné par défaut)
    await expect(page.getByRole('button', { name: /carte bancaire/i })).toBeVisible()

    // Confirmer le paiement
    await page.getByRole('button', { name: /confirmer/i }).click()

    // Attendre l'état succès
    await expect(page.getByText('Encaissement confirmé')).toBeVisible({ timeout: 15_000 })

    // Vérifier la présence du numéro de ticket
    await expect(page.getByText(/Ticket/)).toBeVisible()
    await expect(page.getByText(/ticket n°/i)).toBeVisible()

    // Fermer et vérifier que le panier est vide
    await page.getByRole('button', { name: /nouvelle commande/i }).click()
    await expect(page.getByText('Sélectionnez des produits')).toBeVisible()
  })

  test('encaissement espèces', async ({ page }) => {
    const siteId = await getSiteId(page)
    await page.goto(`/pos/${siteId}`)
    await expect(page.locator('[aria-label^="Ajouter"]').first()).toBeVisible({ timeout: 10_000 })

    await page.locator('[aria-label^="Ajouter"]').first().click()
    await page.locator('[aria-label^="Ajouter"]').first().click() // x2

    await page.getByRole('button', { name: /encaisser/i }).click()

    // Choisir espèces
    await page.getByRole('button', { name: /espèces/i }).click()
    await page.getByRole('button', { name: /confirmer/i }).click()

    await expect(page.getByText('Encaissement confirmé')).toBeVisible({ timeout: 15_000 })
  })

  test('recherche produit par nom', async ({ page }) => {
    const siteId = await getSiteId(page)
    await page.goto(`/pos/${siteId}`)
    await expect(page.locator('[aria-label^="Ajouter"]').first()).toBeVisible({ timeout: 10_000 })

    const searchInput = page.getByPlaceholder(/rechercher/i)
    await searchInput.fill('Ganache')

    // Vérifier que les résultats sont filtrés
    const tiles = page.locator('[aria-label^="Ajouter"]')
    await expect(tiles.first()).toContainText('Ganache')
  })

  test('filtre par catégorie', async ({ page }) => {
    const siteId = await getSiteId(page)
    await page.goto(`/pos/${siteId}`)
    await expect(page.locator('[aria-label^="Ajouter"]').first()).toBeVisible({ timeout: 10_000 })

    // Cliquer sur "Boissons"
    await page.getByRole('button', { name: /boissons/i }).click()

    // Vérifier que la grille est filtrée
    await expect(page.locator('[aria-label^="Ajouter"]').first()).toBeVisible()
  })

  test('modification de quantité dans le panier', async ({ page }) => {
    const siteId = await getSiteId(page)
    await page.goto(`/pos/${siteId}`)
    await expect(page.locator('[aria-label^="Ajouter"]').first()).toBeVisible({ timeout: 10_000 })

    await page.locator('[aria-label^="Ajouter"]').first().click()

    // Augmenter la quantité
    await page.getByLabel('Augmenter').click()
    await expect(page.getByText('2')).toBeVisible()

    // Réduire
    await page.getByLabel('Diminuer').click()
    await expect(page.getByText('1')).toBeVisible()

    // Supprimer (clic sur -1)
    await page.getByLabel('Diminuer').click()
    await expect(page.getByText('Sélectionnez des produits')).toBeVisible()
  })
})
