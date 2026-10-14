'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Backspace } from '@phosphor-icons/react'

// Pavé du code vendeur : quatre chiffres, validation automatique, clavier
// physique accepté. Gros boutons pour un pouce pressé.
export function PinPad({
  onSubmit,
  disabled,
  error,
}: {
  onSubmit: (pin: string) => Promise<void>
  disabled?: boolean
  error?: string | null
}) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(false)

  const push = useCallback(
    (d: string) => {
      if (busy || disabled) return
      setPin((p) => (p.length < 4 ? p + d : p))
    },
    [busy, disabled],
  )

  // Le parent peut se redessiner pendant l'envoi : on n'envoie qu'une fois par code
  const submit = useRef(onSubmit)
  submit.current = onSubmit
  useEffect(() => {
    if (pin.length !== 4) return
    setBusy(true)
    submit.current(pin)
      .catch(() => {
        setShake(true)
        window.setTimeout(() => setShake(false), 400)
      })
      .finally(() => {
        setBusy(false)
        setPin('')
      })
  }, [pin])

  // Un lecteur de badge tape aussi des chiffres, mais en rafale : ignorés ici
  useEffect(() => {
    let last = 0
    const onKey = (e: KeyboardEvent) => {
      const now = performance.now()
      const burst = now - last < 35
      last = now
      if (burst) {
        setPin('')
        return
      }
      if (/^\d$/.test(e.key)) push(e.key)
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [push])

  const key =
    'tabular grid h-[72px] place-items-center rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-3xl font-semibold disabled:opacity-40 press'

  return (
    <div className="space-y-6">
      <div className={['flex justify-center gap-4', shake ? 'pin-shake' : ''].join(' ')} role="status" aria-label={`${pin.length} chiffres sur 4`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={['size-4 rounded-full border-2 border-[var(--color-text-primary)] transition-colors duration-100', i < pin.length ? 'bg-[var(--color-bg-inverse)]' : ''].join(' ')}
          />
        ))}
      </div>
      {error && (
        <p role="alert" className="text-center text-[15px] font-medium">
          {error}
        </p>
      )}
      <div className="mx-auto grid max-w-xs grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className={key} onClick={() => push(d)} disabled={busy || disabled}>
            {d}
          </button>
        ))}
        <span />
        <button type="button" className={key} onClick={() => push('0')} disabled={busy || disabled}>
          0
        </button>
        <button type="button" aria-label="Effacer" className={key + ' text-[var(--color-text-secondary)]'} onClick={() => setPin((p) => p.slice(0, -1))} disabled={busy || disabled || !pin}>
          <Backspace size={28} />
        </button>
      </div>
    </div>
  )
}
