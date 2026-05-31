import { test, expect } from '@playwright/test'
import { loginAs, TEST_OWNER } from './helpers/auth'

test.describe('Hub commandes — changement de statut', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_OWNER)
  })

  test('navigation vers le hub commandes', async ({ page }) => {
    await page.getByRole('link', { name: /commandes/i }).click()
    await expect(page).toHaveURL(/\/orders/)
    await expect(page.getByText('Commandes')).toBeVisible()
  })

  test('filtre par onglet de statut', async ({ page }) => {
    await page.goto('/orders')
    await page.getByRole('button', { name: /en attente/i }).click()
    // L'onglet actif est mis en évidence
    await expect(page.getByRole('button', { name: /en attente/i })).toHaveClass(/bg-\[var\(--color-bg-elevated\)\]/)
  })

  test('indicateur temps réel visible', async ({ page }) => {
    await page.goto('/orders')
    // Vérifie la présence de l'indicateur de connexion WebSocket
    await expect(page.getByText(/temps réel|hors ligne/i)).toBeVisible({ timeout: 8_000 })
  })
})

test.describe('Login page', () => {
  test('erreur sur identifiants invalides', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Adresse email').fill('faux@email.fr')
    await page.getByLabel('Mot de passe').fill('mauvaismdp')
    await page.getByRole('button', { name: /se connecter/i }).click()
    await expect(page.getByText(/identifiants invalides/i)).toBeVisible({ timeout: 6_000 })
  })

  test('redirection vers dashboard après login', async ({ page }) => {
    await loginAs(page, TEST_OWNER)
    await expect(page).toHaveURL(/\/dashboard|\/pos/)
  })
})
