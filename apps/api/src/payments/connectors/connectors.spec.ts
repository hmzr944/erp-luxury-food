import { describe, it, expect } from 'vitest'
import { stripeConnector } from './stripe'
import { sumupConnector } from './sumup'
import type { Http } from './types'

// Faux serveur : enregistre les appels et rejoue des réponses
function fakeHttp(routes: Array<[RegExp, number, unknown]>) {
  const calls: Array<{ method: string; url: string; body?: string }> = []
  const http: Http = async (url, init) => {
    calls.push({ method: init?.method ?? 'GET', url, body: init?.body as string | undefined })
    const route = routes.find(([re]) => re.test(`${init?.method ?? 'GET'} ${url}`))
    if (!route) return new Response('{}', { status: 500 })
    return new Response(JSON.stringify(route[2]), { status: route[1] })
  }
  return { http, calls }
}

describe('Stripe Terminal', () => {
  const credentials = { secretKey: 'sk_test_abc', locationId: 'tml_1' }

  it('envoie le montant en centimes au lecteur', async () => {
    const { http, calls } = fakeHttp([
      [/POST .*\/payment_intents$/, 200, { id: 'pi_1' }],
      [/POST .*\/readers\/tmr_1\/process_payment_intent/, 200, { id: 'tmr_1' }],
    ])
    const r = await stripeConnector.start({ credentials, http }, { readerId: 'tmr_1', amount: 41000, currency: 'EUR', reference: 'c-1', description: 'Vente' })
    expect(r.providerRef).toBe('pi_1')
    const body = new URLSearchParams(calls[0].body)
    expect(body.get('amount')).toBe('41000')
    expect(body.get('currency')).toBe('eur')
    expect(body.get('payment_method_types[]')).toBe('card_present')
    expect(new URLSearchParams(calls[1].body).get('payment_intent')).toBe('pi_1')
  })

  it('annule l\'intention si le lecteur refuse la demande', async () => {
    const { http, calls } = fakeHttp([
      [/POST .*\/payment_intents$/, 200, { id: 'pi_2' }],
      [/process_payment_intent/, 400, { error: { message: 'Reader is currently busy' } }],
      [/POST .*\/payment_intents\/pi_2\/cancel/, 200, {}],
    ])
    await expect(
      stripeConnector.start({ credentials, http }, { readerId: 'tmr_1', amount: 100, currency: 'EUR', reference: 'c', description: '' }),
    ).rejects.toThrow('Reader is currently busy')
    expect(calls.at(-1)?.url).toContain('/payment_intents/pi_2/cancel')
  })

  it('lit le résultat : accepté, refusé par le lecteur, en attente', async () => {
    const ok = fakeHttp([[/GET .*\/payment_intents\/pi_1/, 200, { status: 'succeeded' }]])
    expect(await stripeConnector.status({ credentials, http: ok.http }, { readerId: 'tmr_1', providerRef: 'pi_1' })).toEqual({ status: 'SUCCEEDED' })

    const declined = fakeHttp([
      [/GET .*\/payment_intents\/pi_1/, 200, { status: 'requires_payment_method' }],
      [/GET .*\/terminal\/readers\/tmr_1/, 200, { action: { status: 'failed', failure_message: 'Your card was declined.', process_payment_intent: { payment_intent: 'pi_1' } } }],
    ])
    expect(await stripeConnector.status({ credentials, http: declined.http }, { readerId: 'tmr_1', providerRef: 'pi_1' })).toEqual({
      status: 'FAILED',
      failureReason: 'Your card was declined.',
    })

    const waiting = fakeHttp([
      [/GET .*\/payment_intents\/pi_1/, 200, { status: 'requires_payment_method' }],
      [/GET .*\/terminal\/readers\/tmr_1/, 200, { action: { status: 'in_progress', process_payment_intent: { payment_intent: 'pi_1' } } }],
    ])
    expect((await stripeConnector.status({ credentials, http: waiting.http }, { readerId: 'tmr_1', providerRef: 'pi_1' })).status).toBe('PENDING')
  })

  it('crée le lieu au premier appairage', async () => {
    const { http, calls } = fakeHttp([
      [/POST .*\/terminal\/locations/, 200, { id: 'tml_new' }],
      [/POST .*\/terminal\/readers$/, 200, { id: 'tmr_9' }],
    ])
    const r = await stripeConnector.pair(
      { credentials: { secretKey: 'sk_test_abc' }, http },
      { code: 'simulated-s700', name: 'Comptoir', address: { line1: '18 rue Vieille-du-Temple', city: 'Paris', postalCode: '75004', country: 'FR' } },
    )
    expect(r).toEqual({ externalId: 'tmr_9', credentials: { secretKey: 'sk_test_abc', locationId: 'tml_new' } })
    expect(new URLSearchParams(calls[1].body).get('location')).toBe('tml_new')
  })

  it('refuse une clé qui n\'est pas une clé secrète', async () => {
    await expect(stripeConnector.verify({ credentials: { secretKey: 'pk_test_x' }, http: fakeHttp([]).http })).rejects.toThrow('Clé secrète')
  })
})

describe('SumUp Solo', () => {
  const credentials = { apiKey: 'sup_sk_x', merchantCode: 'M1234', affiliateKey: 'aff-uuid', appId: 'fr.caisse' }

  it('crée un encaissement sur le lecteur avec la clé affilié', async () => {
    const { http, calls } = fakeHttp([[/POST .*\/readers\/rdr_1\/checkout/, 200, { data: { client_transaction_id: 'ctx-1' } }]])
    const r = await sumupConnector.start({ credentials, http }, { readerId: 'rdr_1', amount: 1550, currency: 'EUR', reference: 'c-9', description: 'Vente' })
    expect(r.providerRef).toBe('ctx-1')
    const body = JSON.parse(calls[0].body!)
    expect(body.total_amount).toEqual({ currency: 'EUR', minor_unit: 2, value: 1550 })
    expect(body.affiliate).toEqual({ app_id: 'fr.caisse', key: 'aff-uuid', foreign_transaction_id: 'c-9' })
  })

  it('reste en attente tant que la carte n\'est pas présentée, puis lit le résultat', async () => {
    const none = fakeHttp([[/GET .*transactions\?client_transaction_id=ctx-1/, 404, {}]])
    expect((await sumupConnector.status({ credentials, http: none.http }, { readerId: 'rdr_1', providerRef: 'ctx-1' })).status).toBe('PENDING')
    const paid = fakeHttp([[/GET .*transactions/, 200, { status: 'SUCCESSFUL' }]])
    expect((await sumupConnector.status({ credentials, http: paid.http }, { readerId: 'rdr_1', providerRef: 'ctx-1' })).status).toBe('SUCCEEDED')
    const failed = fakeHttp([[/GET .*transactions/, 200, { status: 'FAILED' }]])
    expect((await sumupConnector.status({ credentials, http: failed.http }, { readerId: 'rdr_1', providerRef: 'ctx-1' })).status).toBe('FAILED')
  })

  it('appaire avec le code en majuscules et signale un code expiré', async () => {
    const { http, calls } = fakeHttp([[/POST .*\/merchants\/M1234\/readers$/, 200, { id: 'rdr_7' }]])
    expect(await sumupConnector.pair({ credentials, http }, { code: '4wlfdsbf', name: 'Comptoir' })).toEqual({ externalId: 'rdr_7' })
    expect(JSON.parse(calls[0].body!).pairing_code).toBe('4WLFDSBF')
    const expired = fakeHttp([[/POST .*readers$/, 404, {}]])
    await expect(sumupConnector.pair({ credentials, http: expired.http }, { code: 'X', name: 'A' })).rejects.toThrow('expiré')
  })
})
