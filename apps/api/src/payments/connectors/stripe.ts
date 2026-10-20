import { ConnectorError, type ConnectorContext, type PaymentConnector } from './types'

// Stripe Terminal, intégration pilotée par le serveur : le lecteur (S700,
// S710...) est relié à internet, la caisse n'a besoin d'aucun pilote local.
// https://docs.stripe.com/terminal/payments/setup-integration?terminal-sdk-platform=server-driven

const API = 'https://api.stripe.com/v1'

function form(params: Record<string, string | number | undefined>): string {
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined) body.append(k, String(v))
  return body.toString()
}

async function call<T>(ctx: ConnectorContext, method: string, path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const res = await ctx.http(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${ctx.credentials.secretKey}`,
      ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: params ? form(params) : undefined,
  })
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } } & T
  if (!res.ok) throw new ConnectorError(json.error?.message ?? `Stripe a répondu ${res.status}`, res.status)
  return json
}

interface Reader {
  id: string
  action?: {
    status: 'in_progress' | 'succeeded' | 'failed'
    failure_message?: string | null
    process_payment_intent?: { payment_intent: string }
  } | null
}

export const stripeConnector: PaymentConnector = {
  async verify(ctx) {
    const key = ctx.credentials.secretKey ?? ''
    if (!/^(sk|rk)_(test|live)_/.test(key)) throw new ConnectorError('Clé secrète Stripe attendue (sk_test_… ou sk_live_…)')
    await call(ctx, 'GET', '/terminal/locations?limit=1')
    return { testMode: key.includes('_test_'), label: 'Stripe Terminal' }
  },

  async pair(ctx, input) {
    let locationId = ctx.credentials.locationId
    const credentials = { ...ctx.credentials }
    if (!locationId) {
      if (!input.address) throw new ConnectorError("L'adresse de la boutique est nécessaire pour un premier lecteur Stripe")
      const location = await call<{ id: string }>(ctx, 'POST', '/terminal/locations', {
        display_name: input.name,
        'address[line1]': input.address.line1,
        'address[city]': input.address.city,
        'address[postal_code]': input.address.postalCode,
        'address[country]': input.address.country,
      })
      locationId = credentials.locationId = location.id
    }
    const reader = await call<Reader>(ctx, 'POST', '/terminal/readers', {
      registration_code: input.code,
      label: input.name,
      location: locationId,
    })
    return { externalId: reader.id, credentials }
  },

  async start(ctx, input) {
    const intent = await call<{ id: string }>(ctx, 'POST', '/payment_intents', {
      amount: input.amount,
      currency: input.currency.toLowerCase(),
      'payment_method_types[]': 'card_present',
      capture_method: 'automatic',
      description: input.description,
      'metadata[reference]': input.reference,
    })
    try {
      await call(ctx, 'POST', `/terminal/readers/${input.readerId}/process_payment_intent`, { payment_intent: intent.id })
    } catch (e) {
      await call(ctx, 'POST', `/payment_intents/${intent.id}/cancel`, {}).catch(() => {})
      throw e
    }
    return { providerRef: intent.id }
  },

  async status(ctx, input) {
    const intent = await call<{ status: string; last_payment_error?: { message?: string } | null }>(
      ctx, 'GET', `/payment_intents/${input.providerRef}`,
    )
    if (intent.status === 'succeeded') return { status: 'SUCCEEDED' }
    if (intent.status === 'canceled') return { status: 'CANCELED' }
    const reader = await call<Reader>(ctx, 'GET', `/terminal/readers/${input.readerId}`)
    const action = reader.action
    if (action?.process_payment_intent?.payment_intent === input.providerRef && action.status === 'failed') {
      return { status: 'FAILED', failureReason: action.failure_message ?? intent.last_payment_error?.message ?? 'Paiement refusé' }
    }
    return { status: 'PENDING' }
  },

  async cancel(ctx, input) {
    // Le lecteur peut n'avoir aucune action en cours : seule l'annulation de
    // l'intention de paiement fait foi, et son échec remonte à la caisse
    await call(ctx, 'POST', `/terminal/readers/${input.readerId}/cancel_action`, {}).catch(() => {})
    await call(ctx, 'POST', `/payment_intents/${input.providerRef}/cancel`, {})
  },

  async refund(ctx, input) {
    const refund = await call<{ id: string; status: string }>(ctx, 'POST', '/refunds', {
      payment_intent: input.providerRef,
      amount: input.amount,
    })
    if (refund.status === 'failed' || refund.status === 'canceled') throw new ConnectorError('Remboursement refusé par Stripe')
    return { refundRef: refund.id }
  },

  // Paiement par QR : session Stripe Checkout, page de paiement hébergée par Stripe
  // https://docs.stripe.com/api/checkout/sessions/create
  async createLink(ctx, input) {
    const session = await call<{ id: string; url: string }>(ctx, 'POST', '/checkout/sessions', {
      mode: 'payment',
      success_url: input.doneUrl,
      'line_items[0][quantity]': 1,
      'line_items[0][price_data][currency]': input.currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': input.amount,
      'line_items[0][price_data][product_data][name]': input.description,
      'metadata[reference]': input.reference,
      'payment_intent_data[metadata][reference]': input.reference,
      expires_at: Math.floor(input.expiresAt.getTime() / 1000),
    })
    return { providerRef: session.id, url: session.url }
  },

  async linkStatus(ctx, input) {
    const session = await call<{ status: string; payment_status: string; payment_intent: string | null }>(ctx, 'GET', `/checkout/sessions/${input.providerRef}`)
    if (session.status === 'complete' && session.payment_status === 'paid') return { status: 'SUCCEEDED', paymentRef: session.payment_intent ?? undefined }
    if (session.status === 'expired') return { status: 'CANCELED', failureReason: 'QR code expiré' }
    return { status: 'PENDING' }
  },

  async cancelLink(ctx, input) {
    await call(ctx, 'POST', `/checkout/sessions/${input.providerRef}/expire`, {})
  },

  // Lecteur simulé Stripe (mode test) : carte acceptée ou refusée
  async simulate(ctx, input) {
    await call(ctx, 'POST', `/test_helpers/terminal/readers/${input.readerId}/present_payment_method`, {
      type: 'card_present',
      ...(input.approve ? {} : { 'card_present[number]': '4000000000000002' }),
    })
  },
}
