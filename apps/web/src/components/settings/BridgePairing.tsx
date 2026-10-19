'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { DownloadSimple, LockKey, Plugs, WifiHigh } from '@phosphor-icons/react'
import {
  bridgePageUrl,
  bridgeUrls,
  formatBridgeAddress,
  getBridge,
  parseBridgeAddress,
  probeBridge,
  readBridgeAddress,
  setBridgeAddress,
  useBridge,
  type BridgeAddress,
  type BridgeNetwork,
  type BridgeProbe,
} from '@/lib/bridge'
import { detectBridgePlatform, type BridgePlatform } from '@/lib/bridge/platform'

const field = 'h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 text-[15px]'
const link = 'font-medium text-[var(--color-accent)] underline underline-offset-4'
const primary = 'inline-flex h-11 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 text-[15px] font-semibold text-[var(--color-on-accent)] press'
const btn = 'inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-[15px] font-semibold press disabled:opacity-60'
const panel = 'space-y-2 rounded-[var(--radius-md)] bg-[var(--color-bg-base)] p-3 text-sm'

// État du pont sur cet ordinateur et appairage par le code à six chiffres
export function BridgePairing() {
  const { status, bridge } = useBridge()
  const [platform, setPlatform] = useState<BridgePlatform>('other')
  const [saved, setSaved] = useState('')
  const titleId = useId()

  useEffect(() => {
    setPlatform(detectBridgePlatform(navigator.userAgent, navigator.maxTouchPoints))
    setSaved(readBridgeAddress())
  }, [])

  const address = parseBridgeAddress(saved) ?? parseBridgeAddress('')!
  const apple = platform !== 'other'
  // Un iPad ou un iPhone ne fait jamais tourner le pont : il lui faut l'adresse de l'ordinateur
  const mobile = platform === 'ios' || platform === 'ipados'

  return (
    <section aria-labelledby={titleId} className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
      <h3 id={titleId} className="flex items-center gap-2 text-[15px] font-semibold">
        <Plugs size={20} aria-hidden /> FLŌW-Bridge
        <span className="ml-auto rounded-[var(--radius-pill)] bg-[var(--color-bg-hover)] px-2.5 py-0.5 text-sm font-medium">
          {status === 'ready' ? (bridge?.secure ? 'Connecté, sécurisé' : 'Connecté') : status === 'unpaired' ? 'À appairer' : status === 'connecting' ? 'Connexion' : 'Introuvable'}
        </span>
      </h3>
      <p className="text-sm text-[var(--color-text-secondary)]">
        Le pont s’installe sur un ordinateur de la boutique et pilote l’imprimante, le tiroir et le terminal de paiement. Au démarrage, il affiche un code à six chiffres.
      </p>
      {bridge?.lastError && status !== 'ready' && <p className="text-sm text-[var(--color-text-secondary)]">{bridge.lastError.message}</p>}
      {status === 'off' && !mobile && <BridgeDownload />}
      <BridgeAddressField
        value={saved}
        mobile={mobile}
        onSave={(v) => {
          setSaved(v)
          setBridgeAddress(v)
        }}
      />
      {(apple || !address.local) && <SecureConnection platform={platform} address={address} needed={status !== 'ready'} />}
      {status === 'ready' && address.local && <LanAccess />}
      {status !== 'ready' && <PairingCodeForm name={mobile ? 'iPad FLŌW' : 'Caisse FLŌW'} disabled={status === 'off' || status === 'connecting'} />}
    </section>
  )
}

// Saisie du code à six chiffres affiché par le pont (réglages et assistant)
export function PairingCodeForm({
  name,
  disabled,
  describedBy,
  autoFocus,
  onPaired,
}: {
  name: string
  disabled?: boolean
  describedBy?: string
  autoFocus?: boolean
  onPaired?: () => void
}) {
  const [code, setCode] = useState('')
  const [state, setState] = useState<{ busy?: boolean; error?: string }>({})
  const codeId = useId()
  const errorId = useId()
  const digits = code.replace(/\s/g, '')

  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault()
        if (digits.length !== 6 || state.busy || disabled) return
        setState({ busy: true })
        try {
          await getBridge().pair(digits, name)
          setCode('')
          setState({})
          onPaired?.()
        } catch (err) {
          setState({ error: (err as Error).message })
        }
      }}
    >
      <label htmlFor={codeId} className="sr-only">
        Code d’appairage
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={codeId}
          name="bridge-pairing-code"
          className={`${field} max-w-[12rem] tabular tracking-[0.3em]`}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus={autoFocus}
          data-autofocus={autoFocus ? '' : undefined}
          maxLength={7}
          placeholder="123 456"
          aria-describedby={[describedBy, state.error ? errorId : ''].filter(Boolean).join(' ') || undefined}
          aria-invalid={state.error ? true : undefined}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))}
        />
        <button type="submit" className={btn} disabled={digits.length !== 6 || state.busy || disabled}>
          {state.busy ? 'Appairage' : 'Appairer'}
        </button>
      </div>
      {state.error && (
        <p id={errorId} role="alert" className="alert-box">
          {state.error}
        </p>
      )}
    </form>
  )
}

// Adresse du pont pour CET appareil : vide sur l'ordinateur du pont,
// adresse de cet ordinateur sur un iPad
function BridgeAddressField({ value, mobile, onSave }: { value: string; mobile: boolean; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()
  const hintId = useId()
  useEffect(() => setDraft(value), [value])
  const dirty = draft.trim() !== value

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        Adresse du pont
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={id}
          ref={inputRef}
          name="bridge-address"
          autoComplete="off"
          className={`${field} max-w-[16rem]`}
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={mobile ? '192.168.1.20' : 'Cet ordinateur'}
          aria-describedby={hintId}
          aria-invalid={error ? true : undefined}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setError(null)
          }}
        />
        <button
          type="button"
          className={btn}
          disabled={!dirty}
          onClick={() => {
            const parsed = parseBridgeAddress(draft)
            if (!parsed) {
              setError('Adresse illisible. Saisissez celle affichée par le pont, par exemple 192.168.1.20.')
              inputRef.current?.focus()
              return
            }
            const next = formatBridgeAddress(parsed)
            setDraft(next)
            onSave(next)
          }}
        >
          Enregistrer
        </button>
      </div>
      <p id={hintId} className={`text-sm ${error ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)]'}`} aria-live="polite">
        {error ??
          (mobile
            ? 'Saisissez l’adresse affichée par le pont sur l’ordinateur de la boutique (accès réseau ouvert).'
            : 'Laissez vide si le pont tourne sur cet ordinateur.')}
      </p>
    </div>
  )
}

const PROBE_TEXT: Record<BridgeProbe, string> = {
  paired: 'Connexion sécurisée établie : le certificat est approuvé et cet appareil est appairé.',
  pairing: 'Connexion sécurisée établie : le certificat est approuvé. Il reste à saisir le code d’appairage.',
  origin_refused: 'Le certificat est approuvé, mais le pont n’autorise pas ce site (réglage FLOW_BRIDGE_ORIGINS du pont).',
  failed: 'Connexion sécurisée impossible : le certificat n’est pas encore approuvé sur cet appareil, ou le pont est injoignable.',
}

// Procédure « approuver le certificat » pour Safari, en une étape par appareil.
// Libellés relevés sur les pages d'assistance d'Apple (octobre 2026) :
// - iPhone, iPad, installer un profil : https://support.apple.com/fr-fr/102400
//   (« Profil téléchargé », « Installer », suppression après 8 minutes) ;
// - confiance totale : https://support.apple.com/fr-fr/102390
//   (Réglages > Général > Informations > Réglages des certificats,
//   « Activer la confiance totale pour les certificats racine ») ;
// - Mac : https://support.apple.com/fr-fr/guide/keychain-access/kyca11871/mac
//   (app « Trousseaux d'accès », section « Se fier ») et
//   https://support.apple.com/fr-fr/guide/keychain-access/mchlp2824/mac (« Toujours approuver »).
// Sur Mac, un profil (.mobileconfig) ne suffit pas : macOS 13 et suivants
// n'approuvent pas pour TLS une racine installée par profil, il faudrait de
// toute façon passer par Trousseaux d'accès
// (https://support.apple.com/fr-fr/guide/deployment/depb5eff8914/web). Le .cer est plus direct.
// Le bouton « Autoriser » du téléchargement de profil n'est pas décrit par Apple :
// libellé à vérifier sur un iPad.
function SecureConnection({ platform, address, needed }: { platform: BridgePlatform; address: BridgeAddress; needed: boolean }) {
  const [probe, setProbe] = useState<{ busy?: boolean; result?: BridgeProbe }>({})
  const mobile = platform === 'ios' || platform === 'ipados'
  const missingAddress = mobile && address.local
  const certUrl = bridgePageUrl(address, '/certificat')
  const cerUrl = bridgePageUrl(address, '/certificat/flow-bridge.cer')
  const checkUrl = bridgePageUrl(address, '/', true)
  const device = platform === 'ios' ? 'iPhone' : platform === 'ipados' ? 'iPad' : 'Mac'

  return (
    <details className={panel} open={needed}>
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-medium">
        <LockKey size={18} aria-hidden /> Connexion sécurisée{platform === 'other' ? '' : ` sur ${device}`}
      </summary>
      {platform === 'other' ? (
        <p className="text-[var(--color-text-secondary)]">
          Chrome, Edge et Firefox joignent le pont de cet ordinateur sans rien installer. Vers un pont situé sur un autre ordinateur, la connexion est
          chiffrée : installez son <a className={link} href={cerUrl}>certificat</a> sur cet appareil.
        </p>
      ) : missingAddress ? (
        <p className="text-[var(--color-text-secondary)]">
          Saisissez d’abord l’adresse du pont ci-dessus. Sur l’ordinateur de la boutique, ouvrez l’accès des iPad : l’adresse s’affiche dans la fenêtre du pont et
          dans ces réglages.
        </p>
      ) : mobile ? (
        <ol className="list-decimal space-y-1.5 pl-5 text-[var(--color-text-secondary)]">
          <li>
            Sur cet {device}, dans Safari, ouvrez{' '}
            <a className={`${link} break-all`} href={certUrl}>
              {certUrl}
            </a>{' '}
            et touchez «&nbsp;Autoriser&nbsp;» pour télécharger le profil.
          </li>
          <li>Dans les 8 minutes : ouvrez Réglages, touchez «&nbsp;Profil téléchargé&nbsp;», puis «&nbsp;Installer&nbsp;» en haut à droite, et suivez les instructions.</li>
          <li>
            Réglages, Général, Informations, Réglages des certificats : sous «&nbsp;Activer la confiance totale pour les certificats racine&nbsp;», activez «&nbsp;FLŌW-Bridge&nbsp;».
          </li>
          <li>Revenez ici et touchez «&nbsp;Tester la connexion sécurisée&nbsp;».</li>
        </ol>
      ) : (
        <ol className="list-decimal space-y-1.5 pl-5 text-[var(--color-text-secondary)]">
          <li>
            Téléchargez le{' '}
            <a className={link} href={cerUrl}>
              certificat du pont
            </a>{' '}
            et ouvrez-le depuis Téléchargements : l’app Trousseaux d’accès l’ajoute.
          </li>
          <li>
            Dans Trousseaux d’accès, double-cliquez sur «&nbsp;FLŌW-Bridge&nbsp;», dépliez «&nbsp;Se fier&nbsp;» et choisissez «&nbsp;Toujours approuver&nbsp;». Fermez la fenêtre et confirmez
            avec le mot de passe du Mac.
          </li>
          <li>Revenez ici et cliquez sur «&nbsp;Tester la connexion sécurisée&nbsp;».</li>
        </ol>
      )}
      {!missingAddress && (
        <div className="space-y-2 pt-1">
          <button
            type="button"
            className={btn}
            disabled={probe.busy}
            onClick={async () => {
              setProbe({ busy: true })
              const result = await probeBridge(bridgeUrls(address)[0])
              setProbe({ result })
              if (result !== 'failed') getBridge().reconnect()
            }}
          >
            {probe.busy ? 'Test en cours…' : 'Tester la connexion sécurisée'}
          </button>
          <div role="status" aria-live="polite">
            {probe.result && (
              <p className={probe.result === 'failed' || probe.result === 'origin_refused' ? 'font-medium text-[var(--color-danger)]' : 'font-medium text-[var(--color-success)]'}>
                {PROBE_TEXT[probe.result]}
              </p>
            )}
            {probe.result === 'failed' && (
              <p className="text-[var(--color-text-secondary)]">
                Pour savoir lequel, ouvrez{' '}
                <a className={`${link} break-all`} href={checkUrl} target="_blank" rel="noreferrer">
                  {checkUrl}
                </a>
                . Un avertissement de connexion non privée : le certificat n’est pas encore approuvé. Page introuvable : le pont est éteint, sur un autre réseau, ou
                son accès réseau est fermé.
              </p>
            )}
          </div>
        </div>
      )}
    </details>
  )
}

// Sur l'ordinateur du pont : ouvrir l'accès aux iPad du magasin
function LanAccess() {
  const [network, setNetwork] = useState<BridgeNetwork | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const labelId = useId()

  useEffect(() => {
    let alive = true
    getBridge()
      .call('bridge.info')
      .then((info) => alive && setNetwork(info.network ?? null))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // Pont trop ancien : pas d'accès réseau
  if (!network) return null

  return (
    <div className={panel}>
      <div className="flex flex-wrap items-center gap-3">
        <WifiHigh size={18} aria-hidden />
        <span id={labelId} className="font-medium">
          Accès des iPad du magasin
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={network.lan}
          aria-describedby={labelId}
          className={`${btn} ml-auto`}
          disabled={busy || !network.tls}
          onClick={async () => {
            setBusy(true)
            setError(null)
            try {
              setNetwork(await getBridge().call('bridge.setLan', { enabled: !network.lan }))
            } catch (e) {
              setError((e as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          {network.lan ? 'Fermer l’accès' : 'Ouvrir l’accès'}
        </button>
      </div>
      {network.lan ? (
        network.addresses.length > 0 ? (
          <p className="text-[var(--color-text-secondary)]">
            Sur l’iPad, adresse du pont : <b className="tabular text-[var(--color-text-primary)]">{network.addresses.join(', ')}</b>. Certificat à installer :{' '}
            <span className="break-all">http://{network.addresses[0]}:{network.port}/certificat</span>
            {network.certificate && (
              <span className="mt-1 block break-all text-xs">Empreinte SHA-256 : {network.certificate.fingerprint}</span>
            )}
          </p>
        ) : (
          <p className="text-[var(--color-text-secondary)]">Aucune adresse sur le réseau local détectée sur cet ordinateur.</p>
        )
      ) : (
        <p className="text-[var(--color-text-secondary)]">
          {network.tls
            ? 'Fermé : seul cet ordinateur joint le pont. Ouvrez-le pour une caisse sur iPad ; l’appairage reste obligatoire.'
            : 'Indisponible : la connexion sécurisée du pont est désactivée.'}
        </p>
      )}
      {error && (
        <p role="alert" className="alert-box">
          {error}
        </p>
      )}
    </div>
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
  const os = useDetectedOs()

  if (!DOWNLOAD_BASE) return <NodePackageDownload />

  const main = os ? BINARIES[os] : null
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
      <BridgeDownloadButton />
    </div>
  )
}

function useDetectedOs() {
  const [os, setOs] = useState<Os | null>(null)
  useEffect(() => setOs(detectOs()), [])
  return os
}

// Bouton de téléchargement adapté au système de cet ordinateur, autres
// systèmes en liens (réglages et assistant matériel). withHelp : rappelle
// comment ouvrir le fichier et l'avertissement du système au premier lancement.
export function BridgeDownloadButton({ withHelp = false }: { withHelp?: boolean }) {
  const os = useDetectedOs()

  if (!DOWNLOAD_BASE) {
    return (
      <div className="space-y-2 text-sm">
        <a href="/downloads/flow-bridge.zip" download className={primary}>
          <DownloadSimple size={18} aria-hidden /> Télécharger FLŌW-Bridge
        </a>
        {withHelp && (
          <p className="text-[var(--color-text-secondary)]">
            Demande Node.js 22 (
            <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" className={link}>
              nodejs.org
            </a>
            , version LTS). Décompressez, puis double-cliquez sur « Démarrer FLŌW-Bridge ».
          </p>
        )}
      </div>
    )
  }

  const main = os ? BINARIES[os] : null
  const others = ORDER.filter((o) => o !== os)
  return (
    <div className="space-y-2 text-sm">
      {main ? (
        <a href={`${DOWNLOAD_BASE}/${main.file}`} download className={primary}>
          <DownloadSimple size={18} aria-hidden /> Télécharger pour {main.label}
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
      {withHelp && main && (
        <p className="text-[var(--color-text-secondary)]">
          {main.open} {main.warning}
        </p>
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
