'use client'

import { useEffect, useState } from 'react'
import { Plugs } from '@phosphor-icons/react'
import { getBridge, useBridge } from '@/lib/bridge'

const field = 'h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 text-[15px]'
const link = 'font-medium text-[var(--color-accent)] underline underline-offset-4'
const primary = 'inline-flex h-11 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 text-[15px] font-semibold text-[var(--color-on-accent)] press'
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
      {status === 'off' && <BridgeDownload />}
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

// Exécutables autonomes (sans Node.js), publiés par .github/workflows/bridge-binaries.yml,
// par exemple https://github.com/<organisation>/<dépôt>/releases/latest/download
const DOWNLOAD_BASE = process.env.NEXT_PUBLIC_BRIDGE_DOWNLOAD_BASE?.replace(/\/+$/, '') || null

type Os = 'windows' | 'macos' | 'linux'

const BINARIES: Record<Os, { label: string; file: string; open: string; warning: string }> = {
  windows: {
    label: 'Windows',
    file: 'flow-bridge-windows-x64.exe',
    open: 'Double-cliquez sur le fichier téléchargé.',
    warning: 'Windows peut afficher un avertissement : Informations complémentaires, puis Exécuter quand même.',
  },
  macos: {
    label: 'macOS',
    file: 'flow-bridge-macos-universal.zip',
    open: 'Ouvrez le fichier .zip, puis FLOW-Bridge.',
    warning: 'Au premier lancement : clic droit, Ouvrir. Sur macOS 15 : Réglages Système, Confidentialité et sécurité, Ouvrir quand même.',
  },
  linux: {
    label: 'Linux',
    file: 'flow-bridge-linux-x64',
    open: 'Rendez le fichier exécutable (chmod +x), puis lancez-le.',
    warning: '',
  },
}
const ORDER: Os[] = ['windows', 'macos', 'linux']

function detectOs(): Os | null {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  const ua = navigator.userAgent.toLowerCase()
  const platform = (nav.userAgentData?.platform || ua).toLowerCase()
  // iPad se présente comme un Mac : il ne peut pas lancer le pont
  if (platform.includes('mac')) return navigator.maxTouchPoints > 1 ? null : 'macos'
  if (platform.includes('win')) return 'windows'
  if (platform.includes('linux') && !ua.includes('android')) return 'linux'
  return null
}

function BridgeDownload() {
  const [os, setOs] = useState<Os | null>(null)
  useEffect(() => setOs(detectOs()), [])

  if (!DOWNLOAD_BASE) return <NodePackageDownload />

  const main = os ? BINARIES[os] : null
  const others = ORDER.filter((o) => o !== os)
  return (
    <div className="space-y-2 rounded-[var(--radius-md)] bg-[var(--color-bg-base)] p-3 text-sm">
      <p className="font-medium">Pas encore installé sur cet ordinateur ?</p>
      <ol className="list-decimal space-y-1 pl-5 text-[var(--color-text-secondary)]">
        <li>Téléchargez FLŌW-Bridge{main ? ` pour ${main.label}` : ''}. Rien d’autre à installer.</li>
        <li>
          {main ? main.open : 'Ouvrez le fichier téléchargé.'}
          {main?.warning && <span className="block">{main.warning}</span>}
        </li>
        <li>Saisissez ici le code à six chiffres qui s’affiche et laissez la fenêtre ouverte.</li>
      </ol>
      {main ? (
        <a href={`${DOWNLOAD_BASE}/${main.file}`} download className={primary}>
          Télécharger pour {main.label}
        </a>
      ) : (
        <div className="flex flex-wrap gap-2">
          {ORDER.map((o) => (
            <a key={o} href={`${DOWNLOAD_BASE}/${BINARIES[o].file}`} download className={btn}>
              {BINARIES[o].label}
            </a>
          ))}
        </div>
      )}
      <p className="text-[var(--color-text-secondary)]">
        {main && (
          <>
            Autres systèmes :{' '}
            {others.map((o, i) => (
              <span key={o}>
                {i > 0 && ', '}
                <a href={`${DOWNLOAD_BASE}/${BINARIES[o].file}`} download className={link}>
                  {BINARIES[o].label}
                </a>
              </span>
            ))}
            .{' '}
          </>
        )}
        Sur iPad ou tablette Android, le pont tourne sur un ordinateur de la boutique.
      </p>
      {!main && (
        <ul className="space-y-1 text-[var(--color-text-secondary)]">
          {ORDER.filter((o) => BINARIES[o].warning).map((o) => (
            <li key={o}>
              {BINARIES[o].label} : {BINARIES[o].warning}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Sans adresse de téléchargement des exécutables : paquet servi par la caisse,
// qui demande Node.js (apps/bridge/scripts/package.mjs)
function NodePackageDownload() {
  return (
    <div className="space-y-2 rounded-[var(--radius-md)] bg-[var(--color-bg-base)] p-3 text-sm">
      <p className="font-medium">Pas encore installé sur cet ordinateur ?</p>
      <ol className="list-decimal space-y-1 pl-5 text-[var(--color-text-secondary)]">
        <li>
          Installez Node.js 22 depuis{' '}
          <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" className={link}>
            nodejs.org
          </a>{' '}
          (version LTS).
        </li>
        <li>Téléchargez FLŌW-Bridge, décompressez-le et double-cliquez sur « Démarrer FLŌW-Bridge ».</li>
        <li>Saisissez ici le code à six chiffres qui s’affiche.</li>
      </ol>
      <a href="/downloads/flow-bridge.zip" download className={primary}>
        Télécharger FLŌW-Bridge
      </a>
      <p className="text-[var(--color-text-secondary)]">Windows, macOS et Linux. Sur iPad ou tablette Android, le pont tourne sur un ordinateur de la boutique.</p>
    </div>
  )
}
