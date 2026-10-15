// Lecture d'un flux ESC/POS tel qu'une imprimante le recevrait : texte en
// PC858, ouverture du tiroir, coupe, QR code. Sert au banc d'essai sans
// matériel et à vérifier ce que la caisse envoie vraiment.

const ESC = 0x1b
const GS = 0x1d

// Table PC858 inverse (même table que la caisse, apps/web/src/lib/printing/escpos.ts)
const PC858: Record<number, string> = {
  0x80: 'Ç', 0x81: 'ü', 0x82: 'é', 0x83: 'â', 0x84: 'ä', 0x85: 'à', 0x87: 'ç', 0x88: 'ê', 0x89: 'ë', 0x8a: 'è',
  0x8b: 'ï', 0x8c: 'î', 0x8e: 'Ä', 0x90: 'É', 0x93: 'ô', 0x94: 'ö', 0x96: 'û', 0x97: 'ù', 0x99: 'Ö', 0x9a: 'Ü',
  0x9c: '£', 0xa0: 'á', 0xa1: 'í', 0xa2: 'ó', 0xa3: 'ú', 0xa4: 'ñ', 0xa5: 'Ñ', 0xae: '«', 0xaf: '»', 0xb6: 'Â',
  0xb7: 'À', 0xd2: 'Ê', 0xd3: 'Ë', 0xd4: 'È', 0xd5: '€', 0xd7: 'Î', 0xd8: 'Ï', 0xe2: 'Ô', 0xeb: 'Ù', 0xea: 'Û',
  0xf8: '°', 0x9e: '×',
}

export interface EscPosReading {
  lines: string[]
  codepage: number | null
  drawer: Array<{ pin: 2 | 5; onMs: number; offMs: number }>
  cuts: number
  qr: string[]
  // Octets hors de la table PC858 : un caractère que l'imprimante affichera mal
  unknownBytes: number[]
  unknownCommands: string[]
}

export function readEscPos(data: Uint8Array): EscPosReading {
  const r: EscPosReading = { lines: [], codepage: null, drawer: [], cuts: 0, qr: [], unknownBytes: [], unknownCommands: [] }
  let line = ''
  const flush = () => {
    r.lines.push(line)
    line = ''
  }
  let i = 0
  while (i < data.length) {
    const b = data[i]
    if (b === 0x0a) {
      flush()
      i++
    } else if (b === 0x0d) {
      i++
    } else if (b === ESC) {
      const c = data[i + 1]
      if (c === 0x40) i += 2 // initialisation
      else if (c === 0x74) {
        r.codepage = data[i + 2]
        i += 3
      } else if (c === 0x70) {
        r.drawer.push({ pin: data[i + 2] === 1 ? 5 : 2, onMs: data[i + 3] * 2, offMs: data[i + 4] * 2 })
        i += 5
      } else if (c === 0x64) {
        // avance de n lignes
        for (let n = 0; n < data[i + 2]; n++) flush()
        i += 3
      } else if (c === 0x61 || c === 0x45 || c === 0x21 || c === 0x2d || c === 0x47 || c === 0x4d) i += 3
      else {
        r.unknownCommands.push(`ESC 0x${(c ?? 0).toString(16)}`)
        i += 2
      }
    } else if (b === GS) {
      const c = data[i + 1]
      if (c === 0x56) {
        r.cuts++
        // GS V m, ou GS V m n pour m = 65/66
        i += data[i + 2] === 0x41 || data[i + 2] === 0x42 ? 4 : 3
      } else if (c === 0x21) i += 3
      else if (c === 0x28 && data[i + 2] === 0x6b) {
        const len = data[i + 3] | (data[i + 4] << 8)
        const body = data.subarray(i + 5, i + 5 + len)
        // fonction 180 (0x31 0x50 0x30) : données du QR code
        if (body[0] === 0x31 && body[1] === 0x50) r.qr.push(new TextDecoder().decode(body.subarray(3)))
        i += 5 + len
      } else {
        r.unknownCommands.push(`GS 0x${(c ?? 0).toString(16)}`)
        i += 2
      }
    } else if (b < 0x20) {
      i++
    } else if (b < 0x80) {
      line += String.fromCharCode(b)
      i++
    } else {
      const ch = PC858[b]
      if (ch === undefined) r.unknownBytes.push(b)
      line += ch ?? '?'
      i++
    }
  }
  if (line) flush()
  return r
}
