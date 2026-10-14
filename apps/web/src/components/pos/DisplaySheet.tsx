'use client'

import { useEffect, useState } from 'react'
import { DeviceTabletSpeaker, Monitor } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { displaysApi } from '@/lib/display/remote'
import { Sheet } from './Sheet'

// Écran client : second écran branché sur cet appareil, ou tablette posée
// sur le comptoir et reliée par un code
export function DisplaySheet({ siteId, terminalId, open, onClose }: { siteId: string; terminalId?: string; open: boolean; onClose: () => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paired, setPaired] = useState<string[]>([])

  useEffect(() => {
    if (open) setPaired(displaysApi.local(siteId))
  }, [open, siteId])

  const openWindow = () => {
    window.open(`/display?site=${encodeURIComponent(siteId)}`, 'flow-display', 'popup,width=1280,height=800')
    onClose()
  }

  const pair = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await displaysApi.pair(siteId, code, terminalId)
      setPaired(displaysApi.local(siteId))
      setCode('')
      toast.success('Tablette reliée à cette caisse')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const unpair = async (id: string) => {
    try {
      await displaysApi.unpair(siteId, id)
    } catch {
      // Déjà déliée côté serveur : on l'oublie ici aussi
      displaysApi.remember(siteId, displaysApi.local(siteId).filter((x) => x !== id))
    }
    setPaired(displaysApi.local(siteId))
  }

  const digits = code.replace(/\D/g, '')

  return (
    <Sheet open={open} title="Écran client" onClose={onClose}>
      <div className="space-y-6 pb-2">
        <p className="text-[15px] text-[var(--color-text-secondary)]">
          Le client voit les articles et le total, puis le QR code de son ticket en fin de vente.
        </p>

        <button
          type="button"
          onClick={openWindow}
          className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] p-4 text-left hover:border-[var(--color-accent)] press"
        >
          <Monitor size={24} aria-hidden className="shrink-0" />
          <span>
            <span className="block text-[15px] font-semibold">Ouvrir sur un second écran</span>
            <span className="block text-sm text-[var(--color-text-secondary)]">Glissez la fenêtre sur l’écran du client, puis passez-la en plein écran.</span>
          </span>
        </button>

        <form onSubmit={pair} className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
          <div className="flex items-start gap-3">
            <DeviceTabletSpeaker size={24} aria-hidden className="mt-0.5 shrink-0" />
            <div>
              <p className="text-[15px] font-semibold">Relier une tablette</p>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Sur la tablette, ouvrez <span className="font-data" translate="no">{typeof window !== 'undefined' ? `${window.location.host}/display` : '/display'}</span>, puis saisissez le code affiché.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <label htmlFor="display-code" className="sr-only">
              Code affiché sur la tablette
            </label>
            <input
              id="display-code"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              placeholder="123 456…"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, '').slice(0, 7))}
              aria-invalid={!!error}
              aria-describedby={error ? 'display-code-err' : undefined}
              className="tabular h-12 min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-4 text-center text-xl font-semibold tracking-[0.2em] focus:border-[var(--color-accent)]"
            />
            <button
              type="submit"
              disabled={busy || digits.length !== 6}
              className="h-12 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 text-[15px] font-semibold text-[var(--color-on-accent)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)] press"
            >
              {busy ? 'Liaison…' : 'Relier'}
            </button>
          </div>
          {error && (
            <p id="display-code-err" role="alert" className="text-sm text-[var(--color-text-secondary)]">
              {error}
            </p>
          )}
          {paired.length > 0 && (
            <ul className="space-y-2 pt-1">
              {paired.map((id, i) => (
                <li key={id} className="flex items-center justify-between gap-3 text-sm">
                  <span>Tablette {i + 1} reliée</span>
                  <button type="button" onClick={() => void unpair(id)} className="h-10 rounded-[var(--radius-pill)] px-3 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]">
                    Délier
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>
      </div>
    </Sheet>
  )
}
