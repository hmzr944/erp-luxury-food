'use client'

import { useState } from 'react'
import { CheckCircle, Printer, Tray } from '@phosphor-icons/react'
import { BridgePairing } from './BridgePairing'
import { PrinterSearch } from './PrinterSearch'
import { canOpenDrawer, openDrawer, printTicket, setPrinterConfig, usePrinterConfig, type PrinterConfig } from '@/lib/printing/printer'
import { buildTestTicket } from '@/lib/printing/ticket'
import { usePlatformConfig } from '@/lib/api/platform'

const MODES: Array<{ key: PrinterConfig['mode']; label: string; hint: string }> = [
  { key: 'bridge', label: 'Imprimante réseau', hint: 'Epson, Star, Bixolon en ESC/POS, par FLŌW-Bridge installé sur un ordinateur de la boutique. Ouvre le tiroir.' },
  { key: 'epos', label: 'Epson ePOS en direct', hint: 'TM-m30, TM-T88 : le navigateur imprime sans rien installer. Ouvre le tiroir.' },
  { key: 'system', label: 'Imprimante de l’appareil', hint: 'Imprimante USB ou installée sur l’ordinateur, par la fenêtre d’impression.' },
  { key: 'none', label: 'Aucune', hint: 'Tickets par e-mail seulement.' },
]

const field = 'h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 text-[15px]'
const btn = 'inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-[15px] font-semibold press disabled:opacity-60'

// Imprimante et tiroir de CET appareil : réglage local, comme le TPE
export function PrinterDevice() {
  const config = usePrinterConfig()
  const { data: platform } = usePlatformConfig()
  const [draft, setDraft] = useState(config)
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'error'; message?: string }>({ kind: 'idle' })
  const dirty = JSON.stringify(draft) !== JSON.stringify(config)
  const needsHost = draft.mode === 'bridge' || draft.mode === 'epos'

  // fn peut préciser le message (ex. papier presque fini)
  const run = async (label: string, fn: () => Promise<string | void>) => {
    setState({ kind: 'busy' })
    try {
      const detail = await fn()
      setState({ kind: 'ok', message: detail ? `${label}. ${detail}` : label })
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message })
    }
  }

  const testTicket = () => buildTestTicket(platform?.receipt)

  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">Type d’imprimante</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {MODES.map((m) => (
            <label
              key={m.key}
              className={[
                'flex cursor-pointer flex-col rounded-[var(--radius-md)] border p-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--color-accent)]',
                draft.mode === m.key ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)]' : 'border-[var(--color-border-strong)]',
              ].join(' ')}
            >
              <input type="radio" name="printer-mode" className="sr-only" checked={draft.mode === m.key} onChange={() => setDraft({ ...draft, mode: m.key })} />
              <span className="text-[15px] font-semibold">{m.label}</span>
              <span className="text-sm text-[var(--color-text-secondary)]">{m.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {draft.mode === 'bridge' && <PrinterSearch kind="ticket" onPick={(p) => setDraft({ ...draft, host: p.host, port: p.port, name: p.model || p.name })} />}

      {needsHost && (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Adresse de l’imprimante</span>
            <input className={field} inputMode="url" placeholder="192.168.1.50" value={draft.host ?? ''} onChange={(e) => setDraft({ ...draft, host: e.target.value.trim(), name: undefined })} />
          </label>
          {draft.mode === 'bridge' && (
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Port</span>
              <input className={field} inputMode="numeric" value={draft.port ?? 9100} onChange={(e) => setDraft({ ...draft, port: Number(e.target.value) || 9100 })} />
            </label>
          )}
        </div>
      )}

      {draft.mode !== 'none' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Largeur du papier</span>
            <select className={field} value={draft.width} onChange={(e) => setDraft({ ...draft, width: Number(e.target.value) as 48 | 32 })}>
              <option value={48}>80 mm (48 caractères)</option>
              <option value={32}>58 mm (32 caractères)</option>
            </select>
          </label>
          {canOpenDrawer(draft) && (
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Tiroir-caisse</span>
              <select className={field} value={draft.drawerPin} onChange={(e) => setDraft({ ...draft, drawerPin: Number(e.target.value) as 0 | 1 })}>
                <option value={0}>Branché sur l’imprimante (broche 2)</option>
                <option value={1}>Second tiroir (broche 5)</option>
              </select>
            </label>
          )}
        </div>
      )}

      {canOpenDrawer(draft) && (
        <label className="flex items-center gap-3 text-[15px]">
          <input type="checkbox" className="size-5 accent-[var(--color-accent)]" checked={draft.drawerOnCash} onChange={(e) => setDraft({ ...draft, drawerOnCash: e.target.checked })} />
          Ouvrir le tiroir à chaque paiement en espèces
        </label>
      )}

      {draft.mode === 'bridge' && <BridgePairing />}

      <fieldset className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
        <legend className="px-1 text-sm font-semibold">Factures A4</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            ['system', 'Fenêtre d’impression', 'AirPrint sur iPad et Mac, ou l’imprimante installée sur l’ordinateur.'],
            ['ipp', 'Imprimante de bureau en direct', 'Wi-Fi ou Ethernet, sans pilote, par FLŌW-Bridge (IPP).'],
          ] as const).map(([key, label, hint]) => (
            <label
              key={key}
              className={[
                'flex cursor-pointer flex-col rounded-[var(--radius-md)] border p-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--color-accent)]',
                (draft.a4?.mode ?? 'system') === key ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)]' : 'border-[var(--color-border-strong)]',
              ].join(' ')}
            >
              <input type="radio" name="a4-mode" className="sr-only" checked={(draft.a4?.mode ?? 'system') === key} onChange={() => setDraft({ ...draft, a4: { ...draft.a4, mode: key } })} />
              <span className="text-[15px] font-semibold">{label}</span>
              <span className="text-sm text-[var(--color-text-secondary)]">{hint}</span>
            </label>
          ))}
        </div>
        {draft.a4?.mode === 'ipp' && (
          <>
            <BridgePairing />
            <PrinterSearch
              kind="a4"
              onPick={(p) =>
                setDraft({ ...draft, a4: { mode: 'ipp', name: p.model || p.name, host: p.host, port: p.ippPort ?? p.port, path: p.rp ? `/${p.rp.replace(/^\//, '')}` : undefined, tls: p.protocols.includes('ipps') && !p.protocols.includes('ipp') } })
              }
            />
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Adresse de l’imprimante A4</span>
              <input className={field} inputMode="url" placeholder="192.168.1.40" value={draft.a4.host ?? ''} onChange={(e) => setDraft({ ...draft, a4: { ...draft.a4!, host: e.target.value.trim() } })} />
            </label>
            {draft.a4.name && <p className="text-sm text-[var(--color-text-secondary)]">{draft.a4.name}</p>}
          </>
        )}
      </fieldset>

      {state.kind === 'error' && (
        <p role="alert" className="alert-box">
          {state.message}
        </p>
      )}
      {state.kind === 'ok' && (
        <p role="status" className="flex items-center gap-2 text-[15px] font-medium">
          <CheckCircle size={20} weight="fill" aria-hidden className="text-[var(--color-accent)]" /> {state.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 text-[15px] font-semibold text-[var(--color-on-accent)] press disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)]"
          disabled={!dirty || (needsHost && !draft.host) || (draft.a4?.mode === 'ipp' && !draft.a4.host)}
          onClick={() => {
            setPrinterConfig(draft)
            setState({ kind: 'ok', message: 'Réglage enregistré sur cet appareil' })
          }}
        >
          Enregistrer
        </button>
        {config.mode !== 'none' && (
          <button type="button" className={btn} disabled={dirty || state.kind === 'busy'} onClick={() => run('Ticket d’essai envoyé', async () => (await printTicket(testTicket()))?.warning)}>
            <Printer size={18} aria-hidden /> Ticket d’essai
          </button>
        )}
        {canOpenDrawer(config) && (
          <button type="button" className={btn} disabled={dirty || state.kind === 'busy'} onClick={() => run('Tiroir ouvert', () => openDrawer())}>
            <Tray size={18} aria-hidden /> Ouvrir le tiroir
          </button>
        )}
      </div>
    </div>
  )
}
