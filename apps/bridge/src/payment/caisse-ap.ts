// Adaptateur Caisse-AP sur IP : protocole caisse/TPE de l'Association du
// Paiement, implémenté par les terminaux Ingenico et Verifone déployés en France.
//
// Sources (aucun détail inventé, tout ce qui suit en est tiré) :
// - module Odoo OCA « l10n_fr_pos_caisse_ap_ip » (Akretion, Alexis de Lattre),
//   https://raw.githubusercontent.com/OCA/l10n-france/19.0/l10n_fr_pos_caisse_ap_ip/models/pos_payment_method.py
//   paquet https://pypi.org/project/odoo-addon-l10n-fr-pos-caisse-ap-ip/ (version 19.0.1.0.0.3 lue)
// - description du protocole : https://associationdupaiement.fr/protocoles/protocole-caisse/
//
// Ce que dit la source :
// - TCP brut vers le TPE, port 8888 par défaut, texte ASCII ;
// - message = suite de champs « TAG(2) + LONGUEUR(3 chiffres) + VALEUR » ;
// - CZ (version du protocole, « 0300 ») toujours en premier, l'ordre des autres est libre ;
// - requête : CJ (identifiant protocole Concert, « 012345678901 », requis),
//   CA (numéro de caisse, « 01 »), CE (devise ISO 4217 numérique, 978 = EUR),
//   CD (0 = débit, 1 = crédit/remboursement), CB (montant en centimes),
//   CC = « 00C » pour un paiement par chèque ;
// - réponse : AE = « 10 » succès, « 01 » échec avec motif dans AF ;
//   CA, CD, CE renvoyés à l'identique, CB renvoyé (zéros à gauche possibles) ;
//   CC = application carte, CI = mode de lecture ; AA, AB, AC, AI servent
//   d'identifiant de transaction ;
// - une seule réponse par requête, pas d'annulation à distance : le
//   vendeur appuie sur la touche rouge du TPE.
//
// Non couvert faute de source vérifiable : code d'autorisation et PAN masqué
// (la source ne nomme pas les champs qui les portent), ticket client du TPE,
// messages intermédiaires pendant la transaction.

import { Socket } from 'node:net'
import { resolveLanHost } from '../lan.js'
import { BridgeError } from '../protocol.js'
import type { PaymentAdapter, PaymentEventSink, PaymentResult } from './types.js'

export const CAISSE_AP_DEFAULT_PORT = 8888
const PROTOCOL_VERSION = '0300'
const CONCERT_ID = '012345678901'

// Codes numériques ISO 4217 connus de la source ; les autres sont refusés
const CURRENCIES: Record<string, string> = { EUR: '978', XPF: '953', USD: '840' }

// Libellés repris de la source (champ AF : motif d'échec)
const FAILURE_LABELS: Record<string, string> = {
  '00': 'Inconnu',
  '01': 'Transaction autorisée',
  '02': 'Appel phonie',
  '03': 'Forçage',
  '04': 'Refusée',
  '05': 'Interdite',
  '06': 'Abandon',
  '07': 'Non aboutie',
  '08': 'Opération non effectuée : délai de saisie dépassé',
  '09': 'Opération non effectuée : erreur de format du message',
  '10': 'Opération non effectuée : erreur de sélection',
  '11': 'Opération non effectuée : abandon opérateur',
  '12': "Opération non effectuée : type d'action inconnu",
  '13': 'Devise non supportée',
}

// Champ CC (application carte) et CI (mode de lecture), d'après la source
const CARD_LABELS: Record<string, string> = {
  '1': 'CB contact',
  B: 'CB sans contact',
  C: 'Chèque',
  '2': 'Amex contact',
  D: 'Amex sans contact',
  '3': 'CB Enseigne',
  '5': 'Cofinoga',
  '6': 'Diners',
  '7': 'CB-Pass',
  '8': 'Franfinance',
  '9': 'JCB',
  A: 'Banque Accord',
  I: 'CPEI',
  E: 'CMCIC-Pay TPE',
  U: 'CUP',
  '0': 'Autres',
}
const READ_MODE_LABELS: Record<string, string> = {
  '0': 'indifférent',
  '1': 'contact',
  '2': 'sans contact',
  '3': 'piste',
  '4': 'saisie manuelle',
}

export type Fields = Record<string, string>

export function encodeMessage(fields: Fields): string {
  const entries = Object.entries(fields).filter(([tag]) => tag !== 'CZ')
  const all: Array<[string, string]> = [['CZ', fields.CZ ?? PROTOCOL_VERSION], ...entries]
  return all
    .map(([tag, value]) => {
      if (!/^[A-Z0-9]{2}$/.test(tag)) throw new Error(`Tag Caisse-AP invalide : ${tag}`)
      if (value.length < 1 || value.length > 999) throw new Error(`Valeur Caisse-AP hors limites pour ${tag}`)
      if (!/^[\x20-\x7e]*$/.test(value)) throw new Error(`Valeur Caisse-AP non ASCII pour ${tag}`)
      return `${tag}${String(value.length).padStart(3, '0')}${value}`
    })
    .join('')
}

// Renvoie null tant que le message reçu est incomplet (TCP peut couper n'importe où)
export function decodeMessage(data: string): Fields | null {
  const out: Fields = {}
  let i = 0
  while (i < data.length) {
    if (i + 5 > data.length) return null
    const tag = data.slice(i, i + 2)
    const lenStr = data.slice(i + 2, i + 5)
    if (!/^\d{3}$/.test(lenStr)) throw new Error('Réponse Caisse-AP illisible')
    const len = Number(lenStr)
    if (i + 5 + len > data.length) return null
    out[tag] = data.slice(i + 5, i + 5 + len)
    i += 5 + len
  }
  return out
}

export interface CaisseApOptions {
  host: string
  port?: number
  // Numéro de caisse sur 2 caractères (CA)
  posNumber?: string
  mode?: 'card' | 'check'
  // Remboursement (CD = 1) au lieu d'un débit
  refund?: boolean
  // La source attend jusqu'à 3 minutes la fin de la transaction
  timeoutMs?: number
}

export function buildRequest(amountCents: number, currency: string, opts: CaisseApOptions): Fields {
  const cur = CURRENCIES[currency.toUpperCase()]
  if (!cur) throw new BridgeError('payment_currency', `Devise ${currency} non prise en charge par le terminal.`)
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new BridgeError('invalid_params', 'Montant invalide pour le terminal de paiement.')
  }
  const amount = String(amountCents)
  if (amount.length > 12) throw new BridgeError('invalid_params', 'Montant trop élevé pour le terminal de paiement.')
  const posNumber = opts.posNumber ?? '01'
  if (!/^[0-9]{2}$/.test(posNumber)) throw new BridgeError('invalid_params', 'Numéro de caisse invalide (2 chiffres).')
  const fields: Fields = { CZ: PROTOCOL_VERSION, CJ: CONCERT_ID, CA: posNumber, CE: cur, CD: opts.refund ? '1' : '0', CB: amount }
  if (opts.mode === 'check') fields.CC = '00C'
  return fields
}

export function interpretAnswer(answer: Fields, request: Fields): PaymentResult {
  if (answer.AE === '10') {
    // Le TPE renvoie la demande : un écart signale une réponse qui n'est pas la nôtre
    for (const tag of ['CA', 'CD', 'CE']) {
      if (!answer[tag] || answer[tag] !== request[tag]) {
        return { status: 'error', message: `Réponse du terminal incohérente (champ ${tag}). Vérifiez le ticket du TPE.`, raw: answer }
      }
    }
    if (!answer.CB || answer.CB.replace(/^0+/, '') !== request.CB) {
      return { status: 'error', message: 'Montant renvoyé par le terminal différent. Vérifiez le ticket du TPE.', raw: answer }
    }
    const parts: string[] = []
    let cardType: string | undefined
    if (answer.CC && answer.CC.length === 3) {
      const code = answer.CC.replace(/^0+/, '')
      cardType = CARD_LABELS[code] ?? `Application ${code}`
      parts.push(cardType)
    }
    if (answer.CI && answer.CI.length === 1 && READ_MODE_LABELS[answer.CI]) parts.push(READ_MODE_LABELS[answer.CI])
    const transactionId = ['AA', 'AB', 'AC', 'AI', 'CD']
      .filter((t) => answer[t])
      .map((t) => `${t}-${answer[t]}`)
      .join('|')
    return {
      status: 'approved',
      cardType: parts.length ? parts.join(' - ') : cardType,
      transactionId: transactionId || undefined,
      raw: answer,
    }
  }
  if (answer.AE === '01') {
    const label = answer.AF ? FAILURE_LABELS[answer.AF] : undefined
    // Abandon (06) et abandon opérateur (11) : touche rouge ou client parti
    const cancelled = answer.AF === '06' || answer.AF === '11'
    return {
      status: cancelled ? 'cancelled' : 'declined',
      message: label ? `Paiement non abouti : ${label}.` : 'Paiement non abouti.',
      raw: answer,
    }
  }
  return { status: 'error', message: `Réponse du terminal non reconnue (AE=${answer.AE ?? 'absent'}).`, raw: answer }
}

export class CaisseApAdapter implements PaymentAdapter {
  readonly name = 'caisse-ap'
  readonly target: string
  private readonly port: number

  constructor(private readonly opts: CaisseApOptions) {
    this.port = opts.port ?? CAISSE_AP_DEFAULT_PORT
    this.target = `caisse-ap:${opts.host.trim().toLowerCase()}:${this.port}`
  }

  async start(amountCents: number, currency: string, _reference: string, onEvent: PaymentEventSink): Promise<PaymentResult> {
    // La référence de vente n'a pas de champ vérifié dans la source : elle
    // reste côté caisse et n'est pas envoyée au TPE.
    const request = buildRequest(amountCents, currency, this.opts)
    const ip = await resolveLanHost(this.opts.host)
    const timeoutMs = this.opts.timeoutMs ?? 180_000
    const label = `${this.opts.host}:${this.port}`

    return new Promise<PaymentResult>((resolve) => {
      const socket = new Socket()
      let buffer = ''
      let done = false
      let sent = false
      const finish = (r: PaymentResult) => {
        if (done) return
        done = true
        clearTimeout(timer)
        socket.destroy()
        resolve(r)
      }
      const timer = setTimeout(
        () =>
          finish({
            status: 'error',
            message: "Aucune réponse du terminal dans le délai. Vérifiez sur le TPE si le paiement est passé avant d'encaisser à nouveau.",
          }),
        timeoutMs,
      )
      const tryParse = (final: boolean) => {
        let fields: Fields | null
        try {
          fields = decodeMessage(buffer)
        } catch {
          finish({ status: 'error', message: 'Réponse du terminal illisible. Vérifiez le ticket du TPE.', raw: buffer })
          return
        }
        if (fields && fields.AE) finish(interpretAnswer(fields, request))
        else if (final) {
          finish({
            status: 'error',
            message: buffer
              ? 'Réponse du terminal incomplète. Vérifiez le ticket du TPE.'
              : 'Le terminal a fermé la connexion sans répondre.',
            raw: buffer || undefined,
          })
        }
      }

      socket.setEncoding('ascii')
      socket.on('data', (chunk: string) => {
        buffer += chunk
        tryParse(false)
      })
      socket.on('end', () => tryParse(true))
      socket.on('close', () => tryParse(true))
      socket.on('error', (err: NodeJS.ErrnoException) => {
        const message =
          err.code === 'ECONNREFUSED'
            ? `Terminal de paiement injoignable à ${label} (connexion refusée). Vérifiez que le mode caisse IP est activé sur le TPE.`
            : err.code === 'EHOSTUNREACH' || err.code === 'ENETUNREACH'
              ? `Terminal de paiement injoignable à ${label} (absent du réseau).`
              : `Erreur de communication avec le terminal ${label} : ${err.code ?? err.message}.`
        // Après l'envoi, une coupure laisse un doute : le paiement a pu passer
        finish({ status: 'error', message: sent ? `${message} Vérifiez le ticket du TPE.` : message })
      })
      socket.connect({ host: ip, port: this.port }, () => {
        socket.write(encodeMessage(request), 'ascii', () => {
          sent = true
        })
        onEvent({ step: 'card_wait', message: 'Montant envoyé au terminal. Suivez les instructions du TPE.' })
      })
    })
  }

  cancel() {
    return {
      accepted: false,
      message: 'Le terminal ne peut pas être annulé à distance : appuyez sur la touche rouge du TPE.',
    }
  }
}
