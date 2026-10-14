'use client'

import { useState } from 'react'
import { Plugs } from '@phosphor-icons/react'
import { getBridge, useBridge } from '@/lib/bridge'

const field = 'h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 text-[15px]'
const btn = 'inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-[15px] font-semibold press disabled:opacity-60'

// État du pont sur cet ordinateur et appairage par le code à six chiffres
export function BridgePairing() {
  const { status, bridge } = useBridge()
  const [code, setCode] = useState('')
  const [state, setState] = useState<{ busy?: boolean; error?: string }>({})

  return (
    <section aria-labelledby="bridge-title" className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
      <h3 id="bridge-title" className="flex items-center gap-2 text-[15px] font-semibold">
        <Plugs size={20} aria-hidden /> FLŌW-Bridge
        <span className="ml-auto rounded-[var(--radius-pill)] bg-[var(--color-bg-hover)] px-2.5 py-0.5 text-sm font-medium">
          {status === 'ready' ? 'Connecté' : status === 'unpaired' ? 'À appairer' : status === 'connecting' ? 'Connexion' : 'Introuvable'}
        </span>
      </h3>
      <p className="text-sm text-[var(--color-text-secondary)]">
        Le pont s’installe sur un ordinateur de la boutique et pilote l’imprimante, le tiroir et le terminal de paiement. Au démarrage, il affiche un code à six chiffres.
      </p>
      {bridge?.lastError && status !== 'ready' && <p className="text-sm text-[var(--color-text-secondary)]">{bridge.lastError.message}</p>}
      {status === 'off' && (
        <div className="space-y-2 rounded-[var(--radius-md)] bg-[var(--color-bg-base)] p-3 text-sm">
          <p className="font-medium">Pas encore installé sur cet ordinateur ?</p>
          <ol className="list-decimal space-y-1 pl-5 text-[var(--color-text-secondary)]">
            <li>
              Installez Node.js 22 depuis{' '}
              <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--color-accent)] underline underline-offset-4">
                nodejs.org
              </a>{' '}
              (version LTS).
            </li>
            <li>Téléchargez FLŌW-Bridge, décompressez-le et double-cliquez sur « Démarrer FLŌW-Bridge ».</li>
            <li>Saisissez ici le code à six chiffres qui s’affiche.</li>
          </ol>
          <a
            href="/downloads/flow-bridge.zip"
            download
            className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 text-[15px] font-semibold text-[var(--color-on-accent)] press"
          >
            Télécharger FLŌW-Bridge
          </a>
          <p className="text-[var(--color-text-secondary)]">Windows, macOS et Linux. Sur iPad ou tablette Android, le pont tourne sur un ordinateur de la boutique.</p>
        </div>
      )}
      {status !== 'ready' && (
        <div className="flex flex-wrap gap-2">
          <input
            className={`${field} max-w-[12rem] tabular tracking-[0.3em]`}
            inputMode="numeric"
            maxLength={7}
            placeholder="123 456"
            aria-label="Code d’appairage"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))}
          />
          <button
            type="button"
            className={btn}
            disabled={code.replace(/\s/g, '').length !== 6 || state.busy}
            onClick={async () => {
              setState({ busy: true })
              try {
                await getBridge().pair(code.replace(/\s/g, ''), 'Caisse FLŌW')
                setCode('')
                setState({})
              } catch (e) {
                setState({ error: (e as Error).message })
              }
            }}
          >
            Appairer
          </button>
        </div>
      )}
      {state.error && (
        <p role="alert" className="alert-box">
          {state.error}
        </p>
      )}
    </section>
  )
}
