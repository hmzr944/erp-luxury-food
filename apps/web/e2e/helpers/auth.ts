import { type Page } from '@playwright/test'

export const TEST_SELLER = {
  email: 'vendeur@maison-artisane.fr',
  password: 'Seller1234!',
}

export const TEST_OWNER = {
  email: 'owner@maison-artisane.fr',
  password: 'Owner1234!',
}

export async function loginAs(page: Page, user = TEST_SELLER) {
  await page.goto('/login')
  await page.getByLabel('Adresse email').fill(user.email)
  await page.getByLabel('Mot de passe').fill(user.password)
  await page.getByRole('button', { name: /se connecter/i }).click()
  await page.waitForURL(/\/dashboard|\/pos/, { timeout: 10_000 })
}
