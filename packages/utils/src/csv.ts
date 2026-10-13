// CSV lisible par Excel en français (séparateur ; et BOM UTF-8) et
// relecture tolérante (séparateur ; ou , détecté, guillemets, BOM).

export type CsvCell = string | number | boolean | null | undefined | Date

export interface CsvColumn<T> {
  header: string
  value: (row: T) => CsvCell
}

// Une cellule qui commence par = + - @ serait exécutée comme formule par un
// tableur : on la neutralise (sauf les nombres négatifs, légitimes)
function safeText(s: string): string {
  if (/^[=+\-@\t\r]/.test(s) && !/^-\d+([.,]\d+)?$/.test(s)) return `'${s}`
  return s
}

function formatCell(v: CsvCell): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'number') return Number.isFinite(v) ? String(v).replace('.', ',') : ''
  if (typeof v === 'boolean') return v ? 'oui' : 'non'
  const s = safeText(v)
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => formatCell(c.header)).join(';')]
  for (const row of rows) lines.push(columns.map((c) => formatCell(c.value(row))).join(';'))
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}

export function parseCsv(text: string): Record<string, string>[] {
  const src = text.replace(/^\uFEFF/, '')
  const firstLine = src.split(/\r?\n/, 1)[0] ?? ''
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','

  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"' && field === '') quoted = true
    else if (c === sep) {
      record.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      record.push(field)
      records.push(record)
      record = []
      field = ''
    } else field += c
  }
  if (field !== '' || record.length) {
    record.push(field)
    records.push(record)
  }

  const [header, ...body] = records.filter((r) => r.some((cell) => cell.trim() !== ''))
  if (!header) return []
  const keys = header.map((h) => normalizeHeader(h))
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])))
}

// « Code-barres », « code barres », « CODE_BARRES » → « code_barres »
export function normalizeHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

// « 1 234,50 », « 1234.5 », « 12 € » → nombre ; vide ou illisible → null
export function parseNumber(s: string | undefined): number | null {
  if (!s) return null
  const cleaned = s.replace(/[\s €%]/g, '').replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null
  return Number(cleaned)
}
