import { describe, expect, it } from 'vitest'
import {
  buildGetPrinterAttributes,
  buildPrintJob,
  decodeIpp,
  encodeIpp,
  findAttribute,
  ippStatusError,
  normalizePath,
  OP_GET_PRINTER_ATTRIBUTES,
  OP_PRINT_JOB,
  TAG_JOB,
  TAG_OPERATION,
  TAG_PRINTER,
  VT_BOOLEAN,
  VT_ENUM,
  VT_INTEGER,
  VT_KEYWORD,
  VT_MIME,
  VT_TEXT,
  type IppMessage,
} from './ipp.js'

const target = { host: '192.168.1.60', ip: '192.168.1.60', port: 631, path: '/ipp/print', tls: false }

describe('encodage IPP (RFC 8010)', () => {
  it('aller-retour encode / décode, valeurs multiples et données', () => {
    const msg: IppMessage = {
      version: [1, 1],
      code: 0x0000,
      requestId: 42,
      groups: [
        {
          tag: TAG_OPERATION,
          attributes: [{ tag: VT_TEXT, name: 'status-message', values: ['successful-ok'] }],
        },
        {
          tag: TAG_PRINTER,
          attributes: [
            { tag: VT_MIME, name: 'document-format-supported', values: ['application/pdf', 'image/urf', 'image/jpeg'] },
            { tag: VT_ENUM, name: 'printer-state', values: [3] },
            { tag: VT_BOOLEAN, name: 'printer-is-accepting-jobs', values: [true] },
            { tag: VT_INTEGER, name: 'copies-default', values: [-1] },
          ],
        },
      ],
      data: Buffer.from('%PDF-1.4'),
    }
    const buf = encodeIpp(msg)
    // En-tête : version 1.1, statut, requestId
    expect([...buf.subarray(0, 8)]).toEqual([1, 1, 0, 0, 0, 0, 0, 42])
    expect(decodeIpp(buf)).toEqual(msg)
  })

  it('Get-Printer-Attributes : charset puis langue en tête, attributs demandés', () => {
    const m = decodeIpp(buildGetPrinterAttributes(target, 7))
    expect(m.code).toBe(OP_GET_PRINTER_ATTRIBUTES)
    expect(m.requestId).toBe(7)
    const op = m.groups[0]
    expect(op.tag).toBe(TAG_OPERATION)
    expect(op.attributes.map((a) => a.name).slice(0, 4)).toEqual([
      'attributes-charset',
      'attributes-natural-language',
      'printer-uri',
      'requesting-user-name',
    ])
    expect(findAttribute(m, 'printer-uri')?.values).toEqual(['ipp://192.168.1.60:631/ipp/print'])
    expect(findAttribute(m, 'requested-attributes')).toMatchObject({
      tag: VT_KEYWORD,
      values: ['document-format-supported', 'printer-state', 'printer-make-and-model'],
    })
  })

  it('Print-Job : format PDF, copies dans le groupe travail, PDF après la fin des attributs', () => {
    const pdf = Buffer.from('%PDF-1.7\n...')
    const m = decodeIpp(buildPrintJob({ ...target, tls: true }, pdf, 'Facture F-12', 3))
    expect(m.code).toBe(OP_PRINT_JOB)
    expect(findAttribute(m, 'printer-uri')?.values).toEqual(['ipps://192.168.1.60:631/ipp/print'])
    expect(findAttribute(m, 'document-format')?.values).toEqual(['application/pdf'])
    expect(findAttribute(m, 'job-name')?.values).toEqual(['Facture F-12'])
    expect(findAttribute(m, 'requesting-user-name')?.values).toEqual(['FLOW'])
    expect(findAttribute(m, 'copies', TAG_JOB)?.values).toEqual([3])
    expect(m.data?.equals(pdf)).toBe(true)
    // Une seule copie : pas de groupe travail
    expect(decodeIpp(buildPrintJob(target, pdf, 'X', 1)).groups.map((g) => g.tag)).toEqual([TAG_OPERATION])
  })

  it('refuse une réponse tronquée', () => {
    const buf = buildGetPrinterAttributes(target)
    expect(() => decodeIpp(buf.subarray(0, buf.length - 5))).toThrow()
  })

  it('messages d’erreur lisibles', () => {
    const e = ippStatusError(0x040a, 'HP')
    expect(e.code).toBe('format_unsupported')
    expect(e.message).toContain('client-error-document-format-not-supported')
    expect(ippStatusError(0x0507, 'HP')).toMatchObject({ code: 'printer_busy' })
    expect(ippStatusError(0x0404, 'HP').message).toContain('client-error-not-possible')
    expect(ippStatusError(0x0999, 'HP').message).toContain('0x0999')
  })

  it('normalise le chemin (TXT rp sans barre)', () => {
    expect(normalizePath(undefined)).toBe('/ipp/print')
    expect(normalizePath('ipp/print')).toBe('/ipp/print')
    expect(normalizePath('/printers/bureau')).toBe('/printers/bureau')
  })
})
