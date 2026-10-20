import { ConnectorError, type ConnectorContext, type PaymentConnector } from './types'

// SumUp Solo via la Cloud API : le lecteur est relié à internet (Wi-Fi ou
// réseau mobile) et appairé avec le code affiché dans Connexions > API.
// https://developer.sumup.com/terminal-payments/cloud-api

const API = 'https://api.sumup.com'

async function call<T>(ctx: ConnectorContext, method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
  const res = await ctx.http(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${ctx.credentials.apiKey}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; detail?: string }
  if (res.status === 401 || res.status === 403) {
    throw new ConnectorError('Clé API refusée par SumUp : vérifiez-la dans votre tableau de bord', res.status)
  }
  if (!res.ok && res.status !== 404) {
    throw new ConnectorError(data.detail ?? data.message ?? `SumUp a répondu ${res.status}`, res.status)
  }
  return { status: res.status, data }
}

const merchant = (ctx: ConnectorContext) => encodeURIComponent(ctx.credentials.merchantCode)

export const sumupConnector: PaymentConnector = {
  async verify(ctx) {
    if (!ctx.credentials.apiKey || !ctx.credentials.merchantCode) {
      throw new ConnectorError('Clé API et code marchand SumUp requis')
    }
    const r = await call(ctx, 'GET', `/v0.1/merchants/${merchant(ctx)}/readers`)
    if (r.status === 404) throw new ConnectorError('Code marchand SumUp inconnu')
    return { testMode: ctx.credentials.testMode === 'true', label: `SumUp ${ctx.credentials.merchantCode}` }
  },

  async pair(ctx, input) {
    const r = await call<{ id: string }>(ctx, 'POST', `/v0.1/merchants/${merchant(ctx)}/readers`, {
      pairing_code: input.code.trim().toUpperCase(),
      name: input.name,
    })
    if (r.status === 404) throw new ConnectorError('Code inconnu ou expiré : relancez l\'appairage sur le lecteur')
    return { externalId: r.data.id }
  },

  async start(ctx, input) {
    const r = await call<{ data?: { client_transaction_id: string } }>(
      ctx,
      'POST',
      `/v0.1/merchants/${merchant(ctx)}/readers/${encodeURIComponent(input.readerId)}/checkout`,
      {
        total_amount: { currency: input.currency, minor_unit: 2, value: input.amount },
        description: input.description,
        ...(ctx.credentials.affiliateKey
          ? {
              affiliate: {
                app_id: ctx.credentials.appId ?? 'caisse',
                key: ctx.credentials.affiliateKey,
                foreign_transaction_id: input.reference,
              },
            }
          : {}),
      },
    )
    const ref = r.data.data?.client_transaction_id
    if (r.status === 404 || !ref) throw new ConnectorError('Lecteur SumUp introuvable ou hors ligne')
    return { providerRef: ref }
  },

  async status(ctx, input) {
    const r = await call<{ status?: string }>(
      ctx,
      'GET',
      `/v2.1/merchants/${merchant(ctx)}/transactions?client_transaction_id=${encodeURIComponent(input.providerRef)}`,
    )
    // La transaction n'existe chez SumUp qu'une fois la carte présentée
    if (r.status === 404) return { status: 'PENDING' }
    switch (r.data.status) {
      case 'SUCCESSFUL':
        return { status: 'SUCCEEDED' }
      case 'FAILED':
        return { status: 'FAILED', failureReason: 'Paiement refusé' }
      case 'CANCELLED':
        return { status: 'CANCELED' }
      default:
        return { status: 'PENDING' }
    }
  },

  // Le remboursement se fait sur l'identifiant de transaction SumUp, retrouvé
  // à partir de l'identifiant donné à l'encaissement
  async refund(ctx, input) {
    const tx = await call<{ id?: string }>(
      ctx,
      'GET',
      `/v2.1/merchants/${merchant(ctx)}/transactions?client_transaction_id=${encodeURIComponent(input.providerRef)}`,
    )
    if (tx.status === 404 || !tx.data.id) throw new ConnectorError('Transaction SumUp introuvable')
    const r = await call(ctx, 'POST', `/v1.0/merchants/${merchant(ctx)}/payments/${encodeURIComponent(tx.data.id)}/refunds`, {
      amount: input.amount / 100,
    })
    if (r.status === 404) throw new ConnectorError('Transaction SumUp introuvable')
    return { refundRef: tx.data.id }
  },

  async cancel(ctx, input) {
    await call(ctx, 'POST', `/v0.1/merchants/${merchant(ctx)}/readers/${encodeURIComponent(input.readerId)}/terminate`)
  },
}
