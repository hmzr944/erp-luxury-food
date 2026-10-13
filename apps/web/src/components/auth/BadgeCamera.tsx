'use client'

import { useEffect, useRef, useState } from 'react'

type Detector = { detect: (src: CanvasImageSource) => Promise<Array<{ rawValue: string }>> }

// Lit une carte QR avec la caméra de la tablette. BarcodeDetector quand le
// navigateur l'a, sinon jsQR (iPad). L'image ne quitte jamais l'appareil.
export function BadgeCamera({ onCode, onError }: { onCode: (code: string) => void; onError: (message: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const done = useRef(false)
  const handler = useRef(onCode)
  handler.current = onCode

  useEffect(() => {
    let stream: MediaStream | null = null
    let raf = 0
    let stopped = false
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 } }, audio: false })
      } catch {
        onError("Caméra indisponible : autorisez-la dans le navigateur, ou utilisez le code")
        return
      }
      if (stopped || !video.current) return
      video.current.srcObject = stream
      await video.current.play().catch(() => {})
      setReady(true)
      const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector
      const detector = Native ? new Native({ formats: ['qr_code'] }) : null
      const jsQR = detector ? null : (await import('jsqr')).default

      const tick = async () => {
        if (stopped || done.current || !video.current) return
        const v = video.current
        if (v.readyState >= 2) {
          let code: string | undefined
          if (detector) {
            code = (await detector.detect(v).catch(() => []))[0]?.rawValue
          } else if (jsQR && ctx) {
            canvas.width = v.videoWidth
            canvas.height = v.videoHeight
            ctx.drawImage(v, 0, 0)
            code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)?.data
          }
          if (code) {
            done.current = true
            handler.current(code)
            return
          }
        }
        raf = requestAnimationFrame(() => void tick())
      }
      void tick()
    }
    void start()
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-text-primary)]">
      <video ref={video} playsInline muted className="h-full w-full -scale-x-100 object-cover" aria-label="Aperçu de la caméra" />
      <div aria-hidden className="pointer-events-none absolute inset-8 rounded-[var(--radius-lg)] border-4 border-[var(--color-on-accent)] opacity-80" />
      {!ready && <p className="absolute inset-0 grid place-items-center text-[15px] text-[var(--color-bg-base)]">Ouverture de la caméra...</p>}
    </div>
  )
}
