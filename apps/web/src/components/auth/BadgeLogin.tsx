'use client'

import { useEffect, useState } from 'react'
import { Camera, IdentificationBadge } from '@phosphor-icons/react'
import { listenNfc, nfcSupported, useWedgeScanner } from '@/lib/badge'
import { BadgeCamera } from './BadgeCamera'

// Badge vendeur : un lecteur USB marche toujours en fond ; la caméra (carte
// QR) et le NFC du téléphone ou de la tablette se lancent d'un geste
export function BadgeLogin({ onBadge, active = true }: { onBadge: (code: string) => Promise<void>; active?: boolean }) {
  const [camera, setCamera] = useState(false)
  const [nfc, setNfc] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const submit = async (code: string) => {
    setMessage(null)
    try {
      await onBadge(code)
    } catch (e) {
      setMessage((e as Error).message)
      setCamera(false)
    }
  }
  useWedgeScanner((code) => void submit(code), active)

  useEffect(() => {
    if (!nfc || !active) return
    const ctrl = new AbortController()
    listenNfc((code) => void submit(code), ctrl.signal).catch(() => {
      setMessage('NFC refusé : autorisez-le dans le navigateur')
      setNfc(false)
    })
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nfc, active])

  return (
    <div className="space-y-3">
      {camera && <BadgeCamera onCode={(c) => void submit(c)} onError={(m) => { setMessage(m); setCamera(false) }} />}
      {message && (
        <p role="alert" className="text-center text-[15px] font-medium">
          {message}
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => setCamera(!camera)}
          aria-pressed={camera}
          className="flex h-12 items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] px-4 text-[15px] font-medium"
        >
          <Camera size={20} aria-hidden /> {camera ? 'Fermer la caméra' : 'Carte QR'}
        </button>
        {nfcSupported() && (
          <button
            type="button"
            onClick={() => setNfc(!nfc)}
            aria-pressed={nfc}
            className="flex h-12 items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] px-4 text-[15px] font-medium"
          >
            <IdentificationBadge size={20} aria-hidden /> {nfc ? 'Approchez le badge' : 'Badge NFC'}
          </button>
        )}
      </div>
      <p className="text-center text-sm text-[var(--color-text-secondary)]">Un lecteur de badge branché sur la tablette est reconnu sans rien toucher.</p>
    </div>
  )
}
