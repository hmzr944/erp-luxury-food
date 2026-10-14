'use client'

import { useState } from 'react'
import { CheckCircle } from '@phosphor-icons/react'
import { setBridgeTpe, useBridgeTpe, type BridgeTpeConfig } from '@/lib/bridge'
import { BridgePairing } from './BridgePairing'

const field = 'h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 text-[15px]'

// TPE bancaire de CET appareil relié par FLŌW-Bridge (protocole Caisse-AP sur IP)
export function BridgeTpeSettings() {
  const config = useBridgeTpe()
  const [draft, setDraft] = useState<BridgeTpeConfig>(config)
  const [saved, setSaved] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(config)
  const needsHost = draft.enabled && draft.adapter === 'caisse-ap'

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 text-[15px]">
        <input type="checkbox" className="mt-0.5 size-5 accent-[var(--color-accent)]" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
        <span>
          Envoyer les paiements par carte au TPE de la banque
          <span className="block text-sm text-[var(--color-text-secondary)]">
            TPE compatible Caisse-AP sur IP (à demander à la banque), relié au réseau de la boutique. Le montant part au TPE, la vente se ferme à l’acceptation.
          </span>
        </span>
      </label>

      {draft.enabled && (
        <>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Terminal</span>
            <select className={field} value={draft.adapter} onChange={(e) => setDraft({ ...draft, adapter: e.target.value as BridgeTpeConfig['adapter'] })}>
              <option value="caisse-ap">TPE Caisse-AP (réseau)</option>
              <option value="simulator">TPE simulé par le pont (essai)</option>
            </select>
          </label>
          {needsHost && (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem]">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Adresse du TPE</span>
                <input className={field} inputMode="url" placeholder="192.168.1.60" value={draft.host ?? ''} onChange={(e) => setDraft({ ...draft, host: e.target.value.trim() })} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Port</span>
                <input className={field} inputMode="numeric" value={draft.port ?? 8888} onChange={(e) => setDraft({ ...draft, port: Number(e.target.value) || 8888 })} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">N° de caisse</span>
                <input className={field} inputMode="numeric" placeholder="01" value={draft.posNumber ?? ''} onChange={(e) => setDraft({ ...draft, posNumber: e.target.value.trim() || undefined })} />
              </label>
            </div>
          )}
          <BridgePairing />
        </>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 text-[15px] font-semibold text-[var(--color-on-accent)] press disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)]"
          disabled={!dirty || (needsHost && !draft.host)}
          onClick={() => {
            setBridgeTpe(draft)
            setSaved(true)
          }}
        >
          Enregistrer
        </button>
        {saved && !dirty && (
          <p role="status" className="flex items-center gap-2 text-[15px] font-medium">
            <CheckCircle size={20} weight="fill" aria-hidden className="text-[var(--color-accent)]" /> Réglage enregistré sur cet appareil
          </p>
        )}
      </div>
    </div>
  )
}
