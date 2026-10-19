import { describe, expect, it } from 'vitest'
import type { DiscoveredPrinter } from '@/lib/bridge/types'
import type { PrinterConfig } from '@/lib/printing/printer'
import {
  parsePairingFragment,
  parsePrinterAddress,
  pickPrinter,
  pickTerminal,
  printerConfigFor,
  printerKey,
  resolveStep,
  safeReturnPath,
  tpeFromBridge,
  tpeSetParams,
  ticketPrinters,
  tpeConfigFor,
} from './wizard'

const printer = (host: string, over: Partial<DiscoveredPrinter> = {}): DiscoveredPrinter => ({
  name: `Imprimante ${host}`,
  host,
  port: 9100,
  protocols: ['escpos'],
  source: 'scan',
  ...over,
})

const base: PrinterConfig = { mode: 'system', width: 48, drawerPin: 0, drawerOnCash: true }
const saved: PrinterConfig = { ...base, mode: 'bridge', host: '192.168.1.50', port: 9100 }

describe('lien d’appairage du pont', () => {
  it('lit le code et le port', () => {
    expect(parsePairingFragment('#pont=123456&port=51800')).toEqual({ code: '123456', port: 51800 })
  })
  it('prend le port par défaut sans port', () => {
    expect(parsePairingFragment('#pont=123456')).toEqual({ code: '123456', port: 51717 })
  })
  it('accepte un code espacé', () => {
    expect(parsePairingFragment('#pont=123%20456&port=51717')?.code).toBe('123456')
  })
  it('refuse un code ou un port invalide', () => {
    expect(parsePairingFragment('')).toBeNull()
    expect(parsePairingFragment('#pont=12345')).toBeNull()
    expect(parsePairingFragment('#pont=abcdef')).toBeNull()
    expect(parsePairingFragment('#pont=123456&port=70000')).toBeNull()
    expect(parsePairingFragment('#pont=123456&port=80a')).toBeNull()
    expect(parsePairingFragment('#autre=1')).toBeNull()
  })
})

describe('choix de l’imprimante', () => {
  it('retient d’office la seule imprimante de tickets', () => {
    const only = printer('192.168.1.50')
    expect(pickPrinter([only, printer('192.168.1.40', { protocols: ['ipp'] })])).toBe(only)
  })
  it('laisse choisir quand il y en a plusieurs', () => {
    expect(pickPrinter([printer('192.168.1.50'), printer('192.168.1.51')])).toBeNull()
  })
  it('retrouve l’imprimante déjà enregistrée parmi plusieurs', () => {
    const list = [printer('192.168.1.51'), printer('192.168.1.50')]
    expect(pickPrinter(list, saved)?.host).toBe('192.168.1.50')
  })
  it('aucune imprimante : rien de retenu', () => {
    expect(pickPrinter([])).toBeNull()
  })
  it('ignore les doublons et les imprimantes de bureau', () => {
    const list = [printer('192.168.1.50'), printer('192.168.1.50', { source: 'mdns' }), printer('192.168.1.40', { protocols: ['ipp', 'ipps'] })]
    expect(ticketPrinters(list)).toHaveLength(1)
  })
  it('garde la largeur et le tiroir en enregistrant', () => {
    const next = printerConfigFor(printer('192.168.1.60', { model: 'TM-m30III' }), { ...base, width: 32, drawerPin: 1 })
    expect(next).toMatchObject({ mode: 'bridge', host: '192.168.1.60', port: 9100, name: 'TM-m30III', width: 32, drawerPin: 1 })
  })
  it('lit une adresse saisie à la main', () => {
    expect(parsePrinterAddress(' 192.168.1.50 ')).toEqual({ host: '192.168.1.50', port: 9100 })
    expect(parsePrinterAddress('192.168.1.50:9101')).toEqual({ host: '192.168.1.50', port: 9101 })
    expect(parsePrinterAddress('192.168.1.300')).toBeNull()
    expect(parsePrinterAddress('http://x')).toBeNull()
  })
})

describe('choix du TPE', () => {
  const t = (host: string) => ({ host, port: 8888, protocol: 'caisse-ap' as const })
  it('retient le seul TPE trouvé', () => {
    expect(pickTerminal([t('192.168.1.60')])?.host).toBe('192.168.1.60')
  })
  it('plusieurs TPE : celui déjà enregistré, sinon au commerçant de choisir', () => {
    expect(pickTerminal([t('192.168.1.60'), t('192.168.1.61')])).toBeNull()
    expect(pickTerminal([t('192.168.1.60'), t('192.168.1.61')], { enabled: true, host: '192.168.1.61', port: 8888 })?.host).toBe('192.168.1.61')
  })
  it('enregistre comme le réglage manuel, numéro de caisse gardé', () => {
    const current = { enabled: false, adapter: 'caisse-ap' as const, port: 8888, posNumber: '02' }
    expect(tpeConfigFor(t('192.168.1.60'), current)).toEqual({ enabled: true, adapter: 'caisse-ap', host: '192.168.1.60', port: 8888, posNumber: '02' })
    expect(tpeConfigFor(null, { ...current, enabled: true }).enabled).toBe(false)
  })
})

describe('TPE gardé par le pont', () => {
  const empty = { enabled: false, adapter: 'caisse-ap' as const, port: 8888 }
  it('une 2e caisse reprend le TPE du pont', () => {
    expect(tpeFromBridge({ adapter: 'caisse-ap', host: '192.168.1.60', posNumber: '2' }, empty)).toEqual({ enabled: true, adapter: 'caisse-ap', host: '192.168.1.60', port: 8888, posNumber: '2' })
    expect(tpeFromBridge(null, empty)).toBeNull()
    expect(tpeFromBridge({ adapter: 'caisse-ap' }, empty)).toBeNull()
  })
  it('paramètres de tpe.set', () => {
    expect(tpeSetParams({ enabled: true, adapter: 'caisse-ap', host: '192.168.1.60', port: 8888, posNumber: '01' })).toEqual({ adapter: 'caisse-ap', host: '192.168.1.60', port: 8888, posNumber: '01' })
    expect(tpeSetParams({ enabled: true, adapter: 'caisse-ap', host: '192.168.1.60', posNumber: 'abc' })).toEqual({ adapter: 'caisse-ap', host: '192.168.1.60', port: 8888 })
    expect(tpeSetParams({ ...empty })).toBeNull()
  })
})

describe('étapes déjà faites', () => {
  it('pont injoignable : on commence par le pont', () => {
    expect(resolveStep({ status: 'off', printer: base, verified: '' })).toBe('pont')
    expect(resolveStep({ status: 'connecting', printer: saved, verified: printerKey(saved) })).toBe('pont')
  })
  it('pont joint mais pas appairé : appairage', () => {
    expect(resolveStep({ status: 'unpaired', printer: base, verified: '' })).toBe('appairage')
  })
  it('pont appairé : la détection', () => {
    expect(resolveStep({ status: 'ready', printer: base, verified: '' })).toBe('detection')
  })
  it('imprimante enregistrée : droit à l’essai, puis au récapitulatif une fois validée', () => {
    expect(resolveStep({ status: 'ready', printer: saved, verified: '' })).toBe('essai')
    expect(resolveStep({ status: 'ready', printer: saved, verified: printerKey(saved) })).toBe('fini')
  })
  it('imprimante changée depuis l’essai : essai à refaire', () => {
    const moved = { ...saved, host: '192.168.1.51' }
    expect(resolveStep({ status: 'ready', printer: moved, verified: printerKey(saved) })).toBe('essai')
  })
  it('refaire la détection ne la saute pas', () => {
    expect(resolveStep({ status: 'ready', printer: saved, verified: printerKey(saved), redo: true })).toBe('detection')
  })
  it('Epson ePOS en direct se passe du pont', () => {
    const epos: PrinterConfig = { ...base, mode: 'epos', host: '192.168.1.70' }
    expect(resolveStep({ status: 'off', printer: epos, verified: printerKey(epos) })).toBe('fini')
  })
})

describe('retour après connexion', () => {
  it('garde le fragment du pont', () => {
    expect(safeReturnPath('/materiel#pont=123456&port=51717')).toBe('/materiel#pont=123456&port=51717')
  })
  it('refuse les adresses externes et la connexion elle-même', () => {
    expect(safeReturnPath('//exemple.fr')).toBeNull()
    expect(safeReturnPath('https://exemple.fr')).toBeNull()
    expect(safeReturnPath('/\\exemple.fr')).toBeNull()
    expect(safeReturnPath('/login')).toBeNull()
    expect(safeReturnPath(null)).toBeNull()
  })
})
