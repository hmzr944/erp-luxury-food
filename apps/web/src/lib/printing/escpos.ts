import { layoutTicket, type TicketModel } from './ticket'

// Commandes ESC/POS (Epson et compatibles : Star en émulation ESC/POS,
// Bixolon, Sunmi...). Texte en page de code PC858 (PC850 + €).
const ESC = 0x1b
const GS = 0x1d

// Caractères français en PC858 ; le reste est ramené à l'ASCII
const PC858: Record<string, number> = {
  'Ç': 0x80, 'ü': 0x81, 'é': 0x82, 'â': 0x83, 'ä': 0x84, 'à': 0x85, 'ç': 0x87, 'ê': 0x88, 'ë': 0x89, 'è': 0x8a,
  'ï': 0x8b, 'î': 0x8c, 'Ä': 0x8e, 'É': 0x90, 'ô': 0x93, 'ö': 0x94, 'û': 0x96, 'ù': 0x97, 'Ö': 0x99, 'Ü': 0x9a,
  '£': 0x9c, 'á': 0xa0, 'í': 0xa1, 'ó': 0xa2, 'ú': 0xa3, 'ñ': 0xa4, 'Ñ': 0xa5, '«': 0xae, '»': 0xaf, 'Â': 0xb6,
  'À': 0xb7, 'Ê': 0xd2, 'Ë': 0xd3, 'È': 0xd4, '€': 0xd5, 'Î': 0xd7, 'Ï': 0xd8, 'Ô': 0xe2, 'Ù': 0xeb, 'Û': 0xea,
  '°': 0xf8, '×': 0x9e,
}
const REPLACE: Record<string, string> = { '’': "'", '‘': "'", '“': '"', '”': '"', '–': '-', '—': '-', '…': '...', 'œ': 'oe', 'Œ': 'OE', 'Ō': 'O', 'ō': 'o', ' ': ' ', ' ': ' ' }

export function encodePc858(text: string): number[] {
  const out: number[] = []
  for (const ch of text) {
    const c = REPLACE[ch] ?? ch
    for (const x of c) {
      const code = x.charCodeAt(0)
      if (code < 0x80) out.push(code)
      else if (PC858[x] !== undefined) out.push(PC858[x])
      else {
        const plain = x.normalize('NFD').replace(/[̀-ͯ]/g, '')
        out.push(plain.length === 1 && plain.charCodeAt(0) < 0x80 ? plain.charCodeAt(0) : 0x3f)
      }
    }
  }
  return out
}

export const DRAWER_KICK = (pin: 0 | 1 = 0) => [ESC, 0x70, pin, 0x19, 0xfa]

export interface EscPosOptions {
  width?: number // caractères par ligne : 48 (80 mm) ou 32 (58 mm)
  cut?: boolean
  openDrawer?: boolean
  drawerPin?: 0 | 1
}

export function encodeTicket(t: TicketModel, o: EscPosOptions = {}): Uint8Array {
  const width = o.width ?? 48
  const bytes: number[] = [ESC, 0x40, ESC, 0x74, 19] // initialisation, page PC858
  if (o.openDrawer) bytes.push(...DRAWER_KICK(o.drawerPin ?? 0))
  for (const line of layoutTicket(t, width)) {
    bytes.push(ESC, 0x61, line.align === 'center' ? 1 : 0)
    bytes.push(ESC, 0x45, line.bold ? 1 : 0)
    bytes.push(GS, 0x21, line.big ? 0x01 : 0x00) // double hauteur seulement : la largeur reste juste
    bytes.push(...encodePc858(line.text), 0x0a)
  }
  bytes.push(ESC, 0x61, 0, ESC, 0x45, 0, GS, 0x21, 0)
  bytes.push(ESC, 0x64, 4) // avance avant la coupe
  if (o.cut !== false) bytes.push(GS, 0x56, 0x42, 0x00) // coupe partielle avec avance
  return new Uint8Array(bytes)
}

export function encodeDrawerOnly(pin: 0 | 1 = 0): Uint8Array {
  return new Uint8Array([ESC, 0x40, ...DRAWER_KICK(pin)])
}
