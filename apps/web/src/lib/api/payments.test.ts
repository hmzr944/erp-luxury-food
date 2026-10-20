import { describe, expect, it, vi } from 'vitest'

// Réponse de l'API simulée : une fonction simple, pas un espion, pour pouvoir rejeter
let reply: () => Promise<unknown> = async () => ({})
vi.mock('./client', () => ({ apiClient: () => reply() }))

import { CANCEL_UNCONFIRMED_MESSAGE, cancelPayment } from './payments'

describe('annulation d’un paiement TPE', () => {
  it('annulé confirmé : la caisse peut quitter l’attente', async () => {
    reply = async () => ({ status: 'CANCELED' })
    expect(await cancelPayment('s1', 'p1')).toEqual({ done: true })
  })

  it('annulation non confirmée : message clair, la caisse reste en attente', async () => {
    reply = async () => {
      throw new Error("L'annulation n'a pas été confirmée par le terminal : vérifiez sur le TPE")
    }
    const r = await cancelPayment('s1', 'p1')
    expect(r.done).toBe(false)
    expect(r.message).toBe(CANCEL_UNCONFIRMED_MESSAGE)
    expect(CANCEL_UNCONFIRMED_MESSAGE).toBe("L'annulation n'a pas été confirmée par le terminal : vérifiez sur le TPE")
  })

  it('le client a payé entre-temps : pas de sortie, la reprise par le statut conclut la vente', async () => {
    reply = async () => ({ status: 'SUCCEEDED' })
    expect(await cancelPayment('s1', 'p1')).toEqual({ done: false })
  })
})
