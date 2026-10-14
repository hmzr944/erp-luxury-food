// Écran client : ce que voit le client, publié par la caisse. Même modèle
// pour un second écran du même appareil et pour une tablette appairée.

export interface DisplayLine {
  key: string
  quantity: number
  name: string
  detail?: string
  total: number
}

export type DisplayState =
  | { kind: 'idle'; shop: string }
  | {
      kind: 'sale'
      shop: string
      lines: DisplayLine[]
      // Dernière ligne ajoutée ou modifiée : mise en avant
      lastKey: string | null
      discount: number
      total: number
      taxAmount: number
      priceIncludesTax: boolean
      training: boolean
    }
  // Paiement par QR : le client paie sur son téléphone
  | { kind: 'pay'; shop: string; amount: number; url: string; expiresAt: string | null; training: boolean }
  // Vente terminée : ticket dématérialisé proposé, jamais imposé
  | { kind: 'done'; shop: string; total: number; change: number | null; receiptUrl: string | null; training: boolean }

export type DisplayMessage = { type: 'state'; state: DisplayState } | { type: 'hello' }

// Second écran du même appareil : canal entre fenêtres du même navigateur
export function localChannel(siteId: string) {
  if (typeof BroadcastChannel === 'undefined') return null
  return new BroadcastChannel(`flow-display:${siteId}`)
}
