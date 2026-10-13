'use client'

import { useEffect, useRef } from 'react'

// Lecture des badges vendeur, quel que soit le matériel :
// - lecteur USB ou Bluetooth (NFC ou QR) qui « tape » le code au clavier,
// - Web NFC (Chrome sur Android) : texte du badge ou identifiant de la puce,
// - caméra de la tablette pour la carte QR (voir BadgeCamera).

// Un lecteur tape beaucoup plus vite qu'une main : on reconnaît la rafale
export function useWedgeScanner(onScan: (code: string) => void, enabled = true) {
  const handler = useRef(onScan)
  handler.current = onScan
  useEffect(() => {
    if (!enabled) return
    let buffer = ''
    let last = 0
    let fast = 0
    const onKey = (e: KeyboardEvent) => {
      const now = performance.now()
      const gap = now - last
      last = now
      if (gap > 80) {
        buffer = ''
        fast = 0
      } else fast++
      if (e.key === 'Enter') {
        if (buffer.length >= 6 && fast >= buffer.length - 1) {
          e.preventDefault()
          handler.current(buffer)
        }
        buffer = ''
        fast = 0
        return
      }
      if (e.key.length === 1) buffer += e.key
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [enabled])
}

interface NdefRecord {
  recordType: string
  data?: DataView
  encoding?: string
}
interface NdefReadingEvent extends Event {
  serialNumber: string
  message: { records: NdefRecord[] }
}
interface NdefReaderLike {
  scan(options?: { signal?: AbortSignal }): Promise<void>
  write(message: string, options?: { signal?: AbortSignal }): Promise<void>
  addEventListener(type: 'reading', cb: (e: NdefReadingEvent) => void): void
}

export const nfcSupported = () => typeof window !== 'undefined' && 'NDEFReader' in window

const reader = (): NdefReaderLike => new (window as unknown as { NDEFReader: new () => NdefReaderLike }).NDEFReader()

// Écoute les badges NFC tant que le signal n'est pas annulé
export async function listenNfc(onBadge: (code: string) => void, signal: AbortSignal) {
  const r = reader()
  r.addEventListener('reading', (e) => {
    const text = e.message.records.find((rec) => rec.recordType === 'text' && rec.data)
    const value = text?.data ? new TextDecoder(text.encoding ?? 'utf-8').decode(text.data) : ''
    onBadge(value.startsWith('FLOW1:') ? value : e.serialNumber)
  })
  await r.scan({ signal })
}

// Inscrit le jeton QR sur une puce NFC vierge : le même badge marche alors
// au QR comme au NFC
export async function writeNfc(payload: string, signal: AbortSignal) {
  await reader().write(payload, { signal })
}
