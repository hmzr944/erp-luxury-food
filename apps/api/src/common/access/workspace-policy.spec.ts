import { describe, expect, it } from 'vitest'
import { isAllowed } from './workspace-policy'

describe('espaces par rôle', () => {
  it('atelier : production oui, ventes et chiffres non', () => {
    expect(isAllowed('PRODUCTION', 'GET', '/api/sites/s1/supply/production?day=2026-10-15')).toBe(true)
    expect(isAllowed('PRODUCTION', 'POST', '/api/sites/s1/supply/orders/o1/ship')).toBe(true)
    expect(isAllowed('PRODUCTION', 'POST', '/api/sites/s1/supply/alerts')).toBe(true)
    expect(isAllowed('PRODUCTION', 'GET', '/api/sites/s1/orders')).toBe(false)
    expect(isAllowed('PRODUCTION', 'POST', '/api/sites/s1/orders/checkout')).toBe(false)
    expect(isAllowed('PRODUCTION', 'GET', '/api/sites/s1/dashboard/summary')).toBe(false)
    expect(isAllowed('PRODUCTION', 'GET', '/api/sites/s1/cash/current')).toBe(false)
    expect(isAllowed('PRODUCTION', 'GET', '/api/sites/s1/supply/statement?month=2026-10')).toBe(false)
  })
  it('vendeur : caisse et réassort oui, chiffres globaux et labo non', () => {
    expect(isAllowed('SELLER', 'POST', '/api/sites/s1/orders/sync')).toBe(true)
    expect(isAllowed('SELLER', 'PUT', '/api/sites/s1/supply/orders')).toBe(true)
    expect(isAllowed('SELLER', 'POST', '/api/sites/s1/supply/orders/o1/receive')).toBe(true)
    expect(isAllowed('SELLER', 'GET', '/api/sites/s1/supply/alerts')).toBe(true)
    expect(isAllowed('SELLER', 'GET', '/api/sites/s1/dashboard/summary')).toBe(false)
    expect(isAllowed('SELLER', 'GET', '/api/dashboard/consolidated')).toBe(false)
    expect(isAllowed('SELLER', 'GET', '/api/sites/s1/data/sales.csv')).toBe(false)
    expect(isAllowed('SELLER', 'GET', '/api/organizations/me/data/sales.csv')).toBe(false)
    expect(isAllowed('SELLER', 'POST', '/api/sites/s1/supply/orders/o1/ship')).toBe(false)
    expect(isAllowed('SELLER', 'GET', '/api/sites/s1/supply/statement')).toBe(false)
  })
  it('gérant : tout', () => {
    expect(isAllowed('MANAGER', 'GET', '/api/dashboard/s1')).toBe(true)
    expect(isAllowed('OWNER', 'POST', '/api/sites/s1/supply/orders/o1/ship')).toBe(true)
  })
})
