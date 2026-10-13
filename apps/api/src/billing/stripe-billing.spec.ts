import { describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import { mapStripeStatus, verifyStripeSignature } from './stripe-billing'

const sign = (body: string, secret: string, t: number) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`

describe('webhooks Stripe Billing', () => {
  const body = '{"type":"customer.subscription.updated"}'
  const now = 1_760_000_000_000
  const t = now / 1000

  it('accepte une signature valide', () => {
    expect(verifyStripeSignature(Buffer.from(body), sign(body, 'whsec_x', t), 'whsec_x', 300, now)).toBe(true)
  })
  it('refuse un corps modifié, un mauvais secret ou un vieil envoi', () => {
    expect(verifyStripeSignature(Buffer.from(body + ' '), sign(body, 'whsec_x', t), 'whsec_x', 300, now)).toBe(false)
    expect(verifyStripeSignature(Buffer.from(body), sign(body, 'whsec_y', t), 'whsec_x', 300, now)).toBe(false)
    expect(verifyStripeSignature(Buffer.from(body), sign(body, 'whsec_x', t - 3600), 'whsec_x', 300, now)).toBe(false)
    expect(verifyStripeSignature(Buffer.from(body), undefined, 'whsec_x', 300, now)).toBe(false)
  })
  it('traduit les statuts', () => {
    expect(mapStripeStatus('active')).toBe('ACTIVE')
    expect(mapStripeStatus('past_due')).toBe('PAST_DUE')
    expect(mapStripeStatus('canceled')).toBe('CANCELED')
  })
})
