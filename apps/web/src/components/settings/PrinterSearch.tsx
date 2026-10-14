'use client'

import { useState } from 'react'
import { MagnifyingGlass, Printer } from '@phosphor-icons/react'
import { getBridge, useBridge, type DiscoveredPrinter } from '@/lib/bridge'

const btn = 'inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-[15px] font-semibold press disabled:opacity-60'

// Détection sur le réseau de la boutique (Bonjour/mDNS, puis port 9100) par
// FLŌW-Bridge : aucun pilote, aucune adresse à chercher
export function PrinterSearch({ kind, onPick }: { kind: 'ticket' | 'a4'; onPick: (p: DiscoveredPrinter) => void }) {
  const { status } = useBridge()
  const [state, setState] = useState<{ busy?: boolean; error?: string; printers?: DiscoveredPrinter[] }>({})
  const wanted = (p: DiscoveredPrinter) => (kind === 'ticket' ? p.protocols.includes('escpos') : p.protocols.includes('ipp') || p.protocols.includes('ipps'))

  const search = async () => {
    setState({ busy: true })
    try {
      const { printers } = await getBridge().call('printer.discover', { timeoutMs: 3000, scan: kind === 'ticket' }, 20_000)
      setState({ printers: printers.filter(wanted) })
    } catch (e) {
      setState({ error: (e as Error).message })
    }
  }

  if (status !== 'ready') return null
  return (
    <div className="space-y-2">
      <button type="button" className={btn} disabled={state.busy} onClick={search}>
        <MagnifyingGlass size={18} aria-hidden /> {state.busy ? 'Recherche sur le réseau' : 'Détecter les imprimantes'}
      </button>
      <div aria-live="polite">
        {state.error && <p className="text-sm text-[var(--color-text-secondary)]">{state.error}</p>}
        {state.printers && state.printers.length === 0 && (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Aucune imprimante trouvée. Vérifiez qu’elle est allumée et sur le même réseau que l’ordinateur du pont, ou saisissez son adresse.
          </p>
        )}
      </div>
      {state.printers && state.printers.length > 0 && (
        <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
          {state.printers.map((p) => (
            <li key={`${p.host}:${p.port}`}>
              <button type="button" onClick={() => onPick(p)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--color-bg-hover)]">
                <Printer size={20} aria-hidden className="shrink-0 text-[var(--color-accent)]" />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium">{p.model || p.name}</span>
                  <span className="block text-sm text-[var(--color-text-secondary)]">
                    {p.host}
                    {p.airprint ? ' · AirPrint' : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
