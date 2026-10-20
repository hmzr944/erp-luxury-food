import { createHmac, timingSafeEqual } from 'node:crypto'

// Stripe Billing par appels HTTP directs (pas de SDK) : Checkout pour
// souscrire, portail client pour la carte et la résiliation, webhooks signés.
const API = 'https://api.stripe.com/v1'

export class StripeBillingError extends Error {}

export async function stripeCall<T>(secretKey: string, path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined) body.append(k, String(v))
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } }
  if (!res.ok) throw new StripeBillingError(json.error?.message ?? `Stripe a répondu ${res.status}`)
  return json
}

export async function stripeGet<T>(secretKey: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${secretKey}` } })
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } }
  if (!res.ok) throw new StripeBillingError(json.error?.message ?? `Stripe a répondu ${res.status}`)
  return json
}

// Client Stripe minimal, remplaçable dans les tests
export interface StripeApi {
  get<T>(secretKey: string, path: string): Promise<T>
  post<T>(secretKey: string, path: string, params: Record<string, string | number | undefined>): Promise<T>
}
export const STRIPE_API = 'STRIPE_API'
export const defaultStripeApi: StripeApi = { get: stripeGet, post: stripeCall }

// Décision commerciale et juridique non tranchée (CGV : « le mois commencé n'est pas remboursé »,
// ajout d'une boutique en cours d'abonnement à valider) : on garde le comportement standard de Stripe,
// qui proratise l'ajout ou le retrait sur le prochain avoir ou la prochaine facture.
export const SITE_QUANTITY_PRORATION = 'create_prorations'

// En-tête Stripe-Signature : t=horodatage,v1=signature HMAC-SHA256 de "t.corps"
export function verifyStripeSignature(rawBody: Buffer, header: string | undefined, secret: string, toleranceSec = 300, now = Date.now()): boolean {
  if (!header) return false
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const i = p.indexOf('=')
      return [p.slice(0, i), p.slice(i + 1)]
    }),
  )
  const t = Number(parts.t)
  const signatures = header
    .split(',')
    .filter((p) => p.startsWith('v1='))
    .map((p) => p.slice(3))
  if (!t || !signatures.length || Math.abs(now / 1000 - t) > toleranceSec) return false
  const expected = createHmac('sha256', secret).update(`${t}.`).update(rawBody).digest()
  return signatures.some((s) => {
    const got = Buffer.from(s, 'hex')
    return got.length === expected.length && timingSafeEqual(got, expected)
  })
}

export function mapStripeStatus(status: string): 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' {
  if (status === 'active') return 'ACTIVE'
  if (status === 'trialing') return 'TRIALING'
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') return 'PAST_DUE'
  return 'CANCELED'
}
