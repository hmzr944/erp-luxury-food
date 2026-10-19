'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowClockwise, CaretRight, Check, CheckCircle, CreditCard, Plugs, Printer, Tray, WarningCircle } from '@phosphor-icons/react'
import { FlowPulse } from '@/components/brand/FlowLogo'
import { BridgeDownloadButton, PairingCodeForm } from '@/components/settings/BridgePairing'
import {
  DEFAULT_BRIDGE_PORT,
  formatBridgeAddress,
  getBridge,
  getBridgeTpe,
  parseBridgeAddress,
  readBridgeAddress,
  setBridgeAddress,
  setBridgeTpe,
  useBridge,
  useBridgeTpe,
  type BridgeStatus,
  type BridgeTpeConfig,
  type DiscoveredPrinter,
} from '@/lib/bridge'
import { detectBridgePlatform } from '@/lib/bridge/platform'
import { usePlatformConfig } from '@/lib/api/platform'
import { canOpenDrawer, getPrinterConfig, printTicket, setPrinterConfig, usePrinterConfig } from '@/lib/printing/printer'
import { buildTestTicket } from '@/lib/printing/ticket'
import { clearPairingLink, readPairingLink } from '@/lib/hardware/link'
import {
  STEPS,
  canDiscoverTpe,
  canStoreTpe,
  tpeFromBridge,
  tpeSetParams,
  type BridgeStoredTpe,
  parsePrinterAddress,
  pickPrinter,
  pickTerminal,
  printerConfigFor,
  printerKey,
  printerLabel,
  resolveStep,
  stepIndex,
  ticketPrinters,
  tpeConfigFor,
  type DiscoveredTerminal,
  type HardwareStep,
  type PairingLink,
  type TpeDiscoverResult,
} from '@/lib/hardware/wizard'

const field = 'h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 text-[15px]'
const primary =
  'inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 text-[15px] font-semibold text-[var(--color-on-accent)] press disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)]'
const btn = 'inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-[15px] font-semibold press disabled:opacity-60'
const link = 'inline-flex min-h-11 items-center font-medium text-[var(--color-accent)] underline underline-offset-4'
const muted = 'text-[15px] text-[var(--color-text-secondary)]'

// Imprimante validée par un ticket d'essai (réglage de l'appareil)
const VERIFIED_KEY = 'flow-hardware-verified'
function readVerified(): string {
  try {
    return localStorage.getItem(VERIFIED_KEY) ?? ''
  } catch {
    return ''
  }
}
function writeVerified(v: string) {
  try {
    if (v) localStorage.setItem(VERIFIED_KEY, v)
    else localStorage.removeItem(VERIFIED_KEY)
  } catch {
    // Sans stockage, l'essai sera reproposé au prochain passage
  }
}

// Adresse du pont joint par cette caisse, pour dire où lire le code
function bridgeHostPort(): { host: string; port: number } {
  try {
    const u = new URL(getBridge().url.replace(/^ws/, 'http'))
    return { host: u.hostname, port: Number(u.port) || DEFAULT_BRIDGE_PORT }
  } catch {
    return { host: '127.0.0.1', port: DEFAULT_BRIDGE_PORT }
  }
}

// Caisse sans TPE enregistré : reprend celui que garde le pont (2e caisse)
async function adoptBridgeTpe(capabilities: readonly string[] | undefined) {
  if (!canStoreTpe(capabilities)) return
  try {
    if (localStorage.getItem('flow-bridge-tpe')) return
  } catch {
    return
  }
  const r = await getBridge()
    .call<{ tpe: BridgeStoredTpe | null }>('tpe.get', {})
    .catch(() => null)
  const next = tpeFromBridge(r?.tpe, getBridgeTpe())
  if (next) setBridgeTpe(next)
}

// Le pont a ouvert la caisse sur un autre port que celui enregistré : on s'y relie
function followLinkPort(link: PairingLink) {
  const saved = parseBridgeAddress(readBridgeAddress())
  if (saved && !saved.local) return
  if (bridgeHostPort().port === link.port) return
  setBridgeAddress(formatBridgeAddress({ host: '127.0.0.1', port: link.port, local: true }))
}

export interface HardwareWizardProps {
  // h2 sur une page, h3 dans une fenêtre qui a déjà son titre
  headingLevel?: 2 | 3
  // Bouton final « Retour à la caisse » : fermeture de la fenêtre ou lien
  onDone?: () => void
  doneHref?: string
  // « Réglages avancés » : vue détaillée dans la fenêtre ou page de réglages
  onAdvanced?: () => void
  advancedHref?: string
}

// Assistant matériel : pont, appairage, détection de l'imprimante, du tiroir
// et du TPE, ticket d'essai. Chaque étape déjà faite est sautée.
export function HardwareWizard({ headingLevel = 2, onDone, doneHref, onAdvanced, advancedHref }: HardwareWizardProps) {
  const { status } = useBridge()
  const printer = usePrinterConfig()
  const [step, setStep] = useState<HardwareStep | null>(null)
  const [verified, setVerified] = useState('')
  const [link, setLink] = useState<PairingLink | null>(null)
  // Arrivée sur l'essai depuis la détection : le ticket part tout de suite
  const [autoTest, setAutoTest] = useState(false)
  const [animate, setAnimate] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const lastInput = useRef<'key' | 'pointer'>('pointer')
  const firstStep = useRef(true)

  const go = useCallback((next: HardwareStep) => {
    // Pas d'animation pour une action au clavier
    setAnimate(lastInput.current !== 'key')
    setStep(next)
  }, [])

  // Démarrage : lien du pont, puis attente courte de la connexion
  useEffect(() => {
    let alive = true
    const l = readPairingLink()
    if (l) followLinkPort(l)
    setLink(l)
    const v = readVerified()
    setVerified(v)
    getBridge()
      .whenReady(2500)
      .then(() => {
        if (!alive) return
        const bridge = getBridge()
        // Déjà appairé : le code du lien ne sert plus
        if (bridge.status === 'ready' && l) {
          clearPairingLink()
          setLink(null)
        }
        if (bridge.status === 'ready')
          void bridge
            .call('bridge.info')
            .then((info) => adoptBridgeTpe(info.capabilities))
            .catch(() => {})
        setStep(resolveStep({ status: bridge.status, printer: getPrinterConfig(), verified: v }))
      })
    return () => {
      alive = false
    }
  }, [])

  // Le pont répond, l'appairage aboutit : on passe seul à la suite
  useEffect(() => {
    if (!step) return
    if (step === 'pont' || step === 'appairage') {
      const next = resolveStep({ status, printer: getPrinterConfig(), verified })
      if (stepIndex(next) > stepIndex(step)) go(next)
    } else if (status === 'unpaired' && printer.mode !== 'epos') {
      go('appairage')
    }
  }, [status, step, verified, printer.mode, go])

  // Titre de l'étape annoncé : le focus s'y pose à chaque changement
  useEffect(() => {
    if (!step) return
    if (firstStep.current) {
      firstStep.current = false
      return
    }
    heading.current?.focus({ preventScroll: false })
  }, [step])

  const H = headingLevel === 2 ? 'h2' : 'h3'
  const current = step ? stepIndex(step) : 0

  return (
    <div
      className="space-y-5"
      onKeyDownCapture={() => {
        lastInput.current = 'key'
      }}
      onPointerDownCapture={() => {
        lastInput.current = 'pointer'
      }}
    >
      <ol aria-label="Étapes de l’installation" className="grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => {
          const state = !step ? 'todo' : i < current ? 'done' : i === current ? 'current' : 'todo'
          return (
            <li key={s.key} aria-current={state === 'current' ? 'step' : undefined} className="min-w-0">
              <span aria-hidden className="relative block h-1 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--color-border)]">
                <span
                  className={[
                    'tile-bar absolute inset-0',
                    state === 'todo' ? '' : 'is-on',
                    state === 'done' ? 'bg-[var(--color-text-primary)]' : 'bg-[var(--color-accent)]',
                  ].join(' ')}
                />
              </span>
              <span
                className={[
                  'mt-1.5 flex items-center gap-1 truncate text-[13px]',
                  state === 'current' ? 'font-semibold text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]',
                ].join(' ')}
              >
                {state === 'done' && <Check size={12} weight="bold" aria-hidden className="shrink-0" />}
                {s.label}
                <span className="sr-only">{state === 'done' ? ', faite' : state === 'current' ? ', en cours' : ', à venir'}</span>
              </span>
            </li>
          )
        })}
      </ol>

      {!step ? (
        <Waiting label="Recherche de FLŌW-Bridge sur cet ordinateur" />
      ) : (
        <div key={step} className={['space-y-4', animate ? 'step-in' : ''].join(' ')}>
          {step === 'pont' && <BridgeStep H={H} heading={heading} status={status} onAdvanced={onAdvanced} advancedHref={advancedHref} />}
          {step === 'appairage' && (
            <PairingStep
              H={H}
              heading={heading}
              link={link}
              onLinkUsed={() => {
                clearPairingLink()
                setLink(null)
              }}
            />
          )}
          {step === 'detection' && (
            <DetectionStep
              H={H}
              heading={heading}
              status={status}
              onAdvanced={onAdvanced}
              advancedHref={advancedHref}
              onSaved={() => {
                setAutoTest(true)
                go('essai')
              }}
            />
          )}
          {step === 'essai' && (
            <TestStep
              H={H}
              heading={heading}
              auto={autoTest}
              onConfirmed={() => {
                const key = printerKey(getPrinterConfig())
                writeVerified(key)
                setVerified(key)
                setAutoTest(false)
                go('fini')
              }}
              onChangePrinter={() => {
                setAutoTest(false)
                go(getPrinterConfig().mode === 'epos' ? 'essai' : 'detection')
              }}
              onAdvanced={onAdvanced}
              advancedHref={advancedHref}
            />
          )}
          {step === 'fini' && (
            <DoneStep
              H={H}
              heading={heading}
              status={status}
              onDone={onDone}
              doneHref={doneHref}
              onAdvanced={onAdvanced}
              advancedHref={advancedHref}
              onRedo={() => go(resolveStep({ status, printer: getPrinterConfig(), verified, redo: true }))}
            />
          )}
        </div>
      )}
    </div>
  )
}

type Heading = React.RefObject<HTMLHeadingElement | null>
type StepProps = { H: 'h2' | 'h3'; heading: Heading }

function StepTitle({ H, heading, children }: StepProps & { children: React.ReactNode }) {
  return (
    <H ref={heading} tabIndex={-1} className="font-display text-xl font-semibold tracking-tight outline-none focus-visible:outline-2">
      {children}
    </H>
  )
}

// Attente : le flux de la marque et une phrase, annoncés aux lecteurs d'écran
function Waiting({ label }: { label: string }) {
  return (
    <p role="status" className="flex min-h-11 items-center gap-3 text-[15px] font-medium">
      <FlowPulse size={24} />
      {label}
    </p>
  )
}

function Advanced({ onAdvanced, advancedHref, inline, children = 'Réglages avancés' }: { onAdvanced?: () => void; advancedHref?: string; inline?: boolean; children?: React.ReactNode }) {
  // Dans une phrase : lien de texte, la ligne garde sa hauteur
  const cls = inline ? 'whitespace-nowrap font-medium text-[var(--color-accent)] underline underline-offset-4' : link
  if (onAdvanced)
    return (
      <button type="button" onClick={onAdvanced} className={cls}>
        {children}
      </button>
    )
  if (advancedHref)
    return (
      <Link href={advancedHref} className={cls}>
        {children}
      </Link>
    )
  return null
}

// Étape 1 : le pont n'est pas joignable sur cet ordinateur
function BridgeStep({ H, heading, status, onAdvanced, advancedHref }: StepProps & { status: BridgeStatus; onAdvanced?: () => void; advancedHref?: string }) {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const p = detectBridgePlatform(navigator.userAgent, navigator.maxTouchPoints)
    setMobile(p === 'ios' || p === 'ipados')
  }, [])
  const error = getBridge().lastError

  if (mobile) {
    return (
      <>
        <StepTitle H={H} heading={heading}>
          Reliez cet iPad au pont de la boutique
        </StepTitle>
        <p className={muted}>
          FLŌW-Bridge tourne sur un ordinateur de la boutique. Sur cet ordinateur, ouvrez l’accès des iPad, puis saisissez ici l’adresse qu’il affiche.
        </p>
        <Advanced onAdvanced={onAdvanced} advancedHref={advancedHref}>
          Saisir l’adresse du pont
        </Advanced>
        <Waiting label="En attente du pont" />
      </>
    )
  }

  return (
    <>
      <StepTitle H={H} heading={heading}>
        Installez FLŌW-Bridge sur cet ordinateur
      </StepTitle>
      <p className={muted}>Lancez le fichier une fois : il démarrera tout seul ensuite.</p>
      <BridgeDownloadButton withHelp />
      {error && error.code !== 'invalid_token' && (
        <p role="alert" className="alert-box">
          {error.message}
        </p>
      )}
      <Waiting label={status === 'connecting' ? 'Connexion à FLŌW-Bridge' : 'En attente de FLŌW-Bridge'} />
      <p className="text-sm text-[var(--color-text-secondary)]">
        L’écran passe seul à la suite dès que le pont répond. Pont sur un autre ordinateur&nbsp;? <Advanced inline onAdvanced={onAdvanced} advancedHref={advancedHref} />
      </p>
    </>
  )
}

// Étape 2 : appairage, tout seul avec le lien du pont, sinon par le code
function PairingStep({ H, heading, link, onLinkUsed }: StepProps & { link: PairingLink | null; onLinkUsed: () => void }) {
  const [auto, setAuto] = useState<{ busy?: boolean; error?: string }>({})
  const tried = useRef<string | null>(null)
  const hintId = useId()
  const [where, setWhere] = useState(() => ({ host: '127.0.0.1', port: DEFAULT_BRIDGE_PORT }))
  const [mobile, setMobile] = useState(false)

  useEffect(() => {
    setWhere(bridgeHostPort())
    const p = detectBridgePlatform(navigator.userAgent, navigator.maxTouchPoints)
    setMobile(p === 'ios' || p === 'ipados')
  }, [])

  useEffect(() => {
    if (!link || tried.current === link.code) return
    tried.current = link.code
    setAuto({ busy: true })
    getBridge()
      .pair(link.code, mobile ? 'iPad FLŌW' : 'Caisse FLŌW')
      .then(() => {
        onLinkUsed()
        setAuto({})
      })
      .catch((e: Error) => {
        onLinkUsed()
        setAuto({ error: `Appairage automatique impossible : ${e.message} Saisissez le code affiché par le pont.` })
      })
  }, [link, mobile, onLinkUsed])

  // Page d'état servie par le pont : le code n'y est lisible que depuis son ordinateur
  const url = `http://${where.host}:${where.port}`
  return (
    <>
      <StepTitle H={H} heading={heading}>
        Reliez cette caisse au pont
      </StepTitle>
      {auto.busy ? (
        <Waiting label="Appairage avec le code du pont" />
      ) : (
        <>
          <p id={hintId} className={muted}>
            Le code s’affiche sur l’ordinateur où tourne FLŌW-Bridge, à l’adresse{' '}
            <a href={url} target="_blank" rel="noreferrer" className="font-data font-medium text-[var(--color-text-primary)] underline underline-offset-4">
              {url}
            </a>
          </p>
          {auto.error && (
            <p role="alert" className="alert-box">
              {auto.error}
            </p>
          )}
          <PairingCodeForm name={mobile ? 'iPad FLŌW' : 'Caisse FLŌW'} describedBy={hintId} autoFocus />
        </>
      )}
    </>
  )
}

type Choice = { key: string; printer: DiscoveredPrinter }
const keyOf = (p: { host: string; port: number }) => `${p.host}:${p.port}`

interface SearchState {
  phase: 'busy' | 'done' | 'error'
  printers: DiscoveredPrinter[]
  // null : le pont ne sait pas chercher les TPE (réglage manuel gardé)
  terminals: DiscoveredTerminal[] | null
  error?: string
}

// Étape 3 : détection de l'imprimante et du TPE, choix d'office si évident
function DetectionStep({
  H,
  heading,
  status,
  onSaved,
  onAdvanced,
  advancedHref,
}: StepProps & { status: BridgeStatus; onSaved: () => void; onAdvanced?: () => void; advancedHref?: string }) {
  const tpe = useBridgeTpe()
  const [search, setSearch] = useState<SearchState>({ phase: 'busy', printers: [], terminals: null })
  const [manual, setManual] = useState<DiscoveredPrinter[]>([])
  const [printerKeySel, setPrinterKeySel] = useState<string | null>(null)
  const [tpeSel, setTpeSel] = useState<string>('none')
  const [storesTpe, setStoresTpe] = useState(false)
  const started = useRef(false)

  const run = useCallback(async () => {
    setSearch((s) => ({ ...s, phase: 'busy', error: undefined }))
    const bridge = getBridge()
    const info = await bridge.call('bridge.info').catch(() => null)
    const withTpe = canDiscoverTpe(info?.capabilities)
    setStoresTpe(canStoreTpe(info?.capabilities))
    await adoptBridgeTpe(info?.capabilities)
    const [p, t] = await Promise.allSettled([
      bridge.call('printer.discover', { timeoutMs: 3000, scan: true }, 20_000),
      withTpe ? bridge.call<TpeDiscoverResult>('tpe.discover', { timeoutMs: 3000 }, 20_000) : Promise.resolve(null),
    ])
    const printers = p.status === 'fulfilled' ? ticketPrinters(p.value.printers) : []
    const terminals = withTpe ? (t.status === 'fulfilled' && t.value ? t.value.terminals : []) : null
    const current = getPrinterConfig()
    const chosen = pickPrinter(printers, current)
    setPrinterKeySel(chosen ? keyOf(chosen) : null)
    if (terminals) {
      const tpeNow = getBridgeTpe()
      const term = pickTerminal(terminals, tpeNow)
      const keep = tpeNow.enabled && !term
      setTpeSel(term ? keyOf(term) : keep ? 'keep' : terminals.length > 1 ? '' : 'none')
    }
    setSearch({
      phase: p.status === 'rejected' ? 'error' : 'done',
      printers,
      terminals,
      error: p.status === 'rejected' ? (p.reason as Error).message : undefined,
    })
  }, [])

  useEffect(() => {
    if (status !== 'ready' || started.current) return
    started.current = true
    void run()
  }, [status, run])

  const choices: Choice[] = [...search.printers, ...manual.filter((m) => !search.printers.some((p) => keyOf(p) === keyOf(m)))].map((p) => ({ key: keyOf(p), printer: p }))
  const selected = choices.find((c) => c.key === printerKeySel)?.printer
  const single = search.phase === 'done' && search.printers.length === 1 && manual.length === 0
  const busy = search.phase === 'busy'

  const save = () => {
    if (!selected) return
    setPrinterConfig(printerConfigFor(selected, getPrinterConfig()))
    if (search.terminals) {
      const term = search.terminals.find((t) => keyOf(t) === tpeSel) ?? null
      if (term || tpeSel === 'none') {
        const next = tpeConfigFor(term, getBridgeTpe())
        setBridgeTpe(next)
        // Le pont le garde aussi, pour une autre caisse. « Pas de TPE » ne
        // l'efface pas : une autre caisse peut en avoir un.
        const params = term && storesTpe ? tpeSetParams(next) : null
        if (params) void getBridge().call('tpe.set', params).catch(() => {})
      }
    }
    onSaved()
  }

  return (
    <>
      <StepTitle H={H} heading={heading}>
        {busy ? 'Recherche du matériel' : 'Votre matériel'}
      </StepTitle>
      {status !== 'ready' && <Waiting label="Connexion au pont perdue, nouvel essai en cours" />}
      {busy ? (
        <Waiting label="Recherche de l’imprimante et du terminal sur le réseau de la boutique" />
      ) : (
        <>
          <fieldset className="space-y-2">
            <legend className="mb-2 flex items-center gap-2 text-[15px] font-semibold">
              <Printer size={20} aria-hidden /> Imprimante de tickets et tiroir
            </legend>
            {choices.length > 0 && (
              <>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {single ? 'Une imprimante trouvée, retenue d’office. Le tiroir se branche dessus.' : choices.length > 1 ? 'Choisissez l’imprimante de cette caisse. Le tiroir se branche dessus.' : 'Le tiroir se branche sur l’imprimante.'}
                </p>
                <div className="grid gap-2">
                  {choices.map(({ key, printer: p }) => (
                    <RadioCard key={key} name="hw-printer" checked={printerKeySel === key} onChange={() => setPrinterKeySel(key)} title={printerLabel(p)} detail={p.port === 9100 ? p.host : keyOf(p)} />
                  ))}
                </div>
              </>
            )}
            {search.phase === 'error' && (
              <p role="alert" className="alert-box">
                {search.error}
              </p>
            )}
            {choices.length === 0 && (
              <div className="space-y-2">
                <p className="text-[15px] font-medium">Aucune imprimante trouvée.</p>
                <ul className="list-disc space-y-1 pl-5 text-[15px] text-[var(--color-text-secondary)]">
                  <li>Elle est allumée et son voyant est fixe.</li>
                  <li>Elle est sur le même réseau que l’ordinateur du pont (même box, même Wi-Fi).</li>
                  <li>Le câble réseau est bien enfoncé des deux côtés.</li>
                </ul>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button type="button" className={btn} onClick={() => void run()}>
                <ArrowClockwise size={18} aria-hidden /> Chercher à nouveau
              </button>
            </div>
            <ManualPrinter
              open={choices.length === 0}
              onFound={(p) => {
                setManual((m) => [...m.filter((x) => keyOf(x) !== keyOf(p)), p])
                setPrinterKeySel(keyOf(p))
              }}
            />
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="mb-2 flex items-center gap-2 text-[15px] font-semibold">
              <CreditCard size={20} aria-hidden /> Terminal de paiement
            </legend>
            {search.terminals ? (
              <div className="grid gap-2">
                {search.terminals.map((t) => (
                  <RadioCard key={keyOf(t)} name="hw-tpe" checked={tpeSel === keyOf(t)} onChange={() => setTpeSel(keyOf(t))} title="TPE Caisse-AP" detail={t.port === 8888 ? t.host : keyOf(t)} />
                ))}
                {tpe.enabled && !search.terminals.some((t) => t.host === tpe.host) && (
                  <RadioCard name="hw-tpe" checked={tpeSel === 'keep'} onChange={() => setTpeSel('keep')} title="Garder le TPE enregistré" detail={tpeSummary(tpe)} />
                )}
                <RadioCard name="hw-tpe" checked={tpeSel === 'none'} onChange={() => setTpeSel('none')} title="Pas de TPE relié" detail="J’encaisse la carte sur mon terminal à part." />
              </div>
            ) : (
              <p className={muted}>
                {tpe.enabled ? `${tpeSummary(tpe)}. ` : 'Pas de TPE relié : la carte s’encaisse sur votre terminal à part. '}
                Un TPE Caisse-AP se règle dans les{' '}
                <Advanced inline onAdvanced={onAdvanced} advancedHref={advancedHref}>
                  réglages avancés
                </Advanced>
                .
              </p>
            )}
          </fieldset>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button type="button" className={primary} disabled={!selected || (!!search.terminals && tpeSel === '')} onClick={save} data-autofocus>
              Continuer
            </button>
            {!selected && <p className="text-sm text-[var(--color-text-secondary)]">Choisissez une imprimante pour continuer.</p>}
          </div>
        </>
      )}
    </>
  )
}

function tpeSummary(t: BridgeTpeConfig): string {
  if (!t.enabled) return 'Pas de TPE relié : la carte s’encaisse sur le terminal à part'
  if (t.adapter === 'simulator') return 'TPE simulé par le pont (essai)'
  return `TPE Caisse-AP, ${t.host ?? 'adresse à saisir'}${t.port && t.port !== 8888 ? `:${t.port}` : ''}`
}

function RadioCard({ name, checked, onChange, title, detail }: { name: string; checked: boolean; onChange: () => void; title: string; detail: string }) {
  return (
    <label
      className={[
        'flex min-h-14 cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border px-3 py-2.5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-accent)]',
        checked ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)]' : 'border-[var(--color-border-strong)] hover:bg-[var(--color-bg-hover)]',
      ].join(' ')}
    >
      <input type="radio" name={name} className="sr-only" checked={checked} onChange={onChange} />
      <span
        aria-hidden
        className={[
          'grid size-5 shrink-0 place-items-center rounded-full border-2',
          checked ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-on-accent)]' : 'border-[var(--color-border-strong)]',
        ].join(' ')}
      >
        {checked && <Check size={12} weight="bold" />}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold">{title}</span>
        <span className="block text-sm text-[var(--color-text-secondary)] tabular">{detail}</span>
      </span>
    </label>
  )
}

// Dernier recours : l'adresse de l'imprimante, vérifiée par le pont
function ManualPrinter({ open, onFound }: { open: boolean; onFound: (p: DiscoveredPrinter) => void }) {
  const [value, setValue] = useState('')
  const [state, setState] = useState<{ busy?: boolean; error?: string }>({})
  const id = useId()
  const errorId = useId()

  return (
    <details className="group rounded-[var(--radius-md)] bg-[var(--color-bg-base)] px-3 text-[15px]" open={open || undefined}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-medium [&::-webkit-details-marker]:hidden">
        <CaretRight size={16} aria-hidden className="transition-transform duration-200 ease-[var(--ease-out)] group-open:rotate-90 motion-reduce:transition-none" />
        Saisir l’adresse de l’imprimante
      </summary>
      <form
        className="space-y-2 pb-3"
        onSubmit={async (e) => {
          e.preventDefault()
          const parsed = parsePrinterAddress(value)
          if (!parsed) {
            setState({ error: 'Adresse illisible. Elle s’imprime en maintenant le bouton d’avance papier à l’allumage, par exemple 192.168.1.50.' })
            return
          }
          setState({ busy: true })
          try {
            const r = await getBridge().call('printer.probe', { host: parsed.host, port: parsed.port })
            if (!r.reachable) throw new Error(r.message ?? 'Aucune réponse à cette adresse. Vérifiez-la et que l’imprimante est allumée.')
            onFound({ name: 'Imprimante de tickets', host: parsed.host, port: parsed.port, protocols: ['escpos'], source: 'scan' })
            setState({})
            setValue('')
          } catch (err) {
            setState({ error: (err as Error).message })
          }
        }}
      >
        <label htmlFor={id} className="block text-sm text-[var(--color-text-secondary)]">
          Adresse imprimée sur le ticket de configuration de l’imprimante
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id={id}
            className={`${field} max-w-[14rem] tabular`}
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            placeholder="192.168.1.50"
            value={value}
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? errorId : undefined}
            onChange={(e) => {
              setValue(e.target.value)
              setState({})
            }}
          />
          <button type="submit" className={btn} disabled={!value.trim() || state.busy}>
            {state.busy ? 'Vérification' : 'Utiliser cette adresse'}
          </button>
        </div>
        {state.error && (
          <p id={errorId} role="alert" className="alert-box">
            {state.error}
          </p>
        )}
      </form>
    </details>
  )
}

// Étape 4 : ticket d'essai et tiroir, puis la question au commerçant
function TestStep({
  H,
  heading,
  auto,
  onConfirmed,
  onChangePrinter,
  onAdvanced,
  advancedHref,
}: StepProps & { auto: boolean; onConfirmed: () => void; onChangePrinter: () => void; onAdvanced?: () => void; advancedHref?: string }) {
  const config = usePrinterConfig()
  const { data: platform } = usePlatformConfig()
  const [state, setState] = useState<{ phase: 'idle' | 'busy' | 'ask' | 'no' | 'error'; message?: string; warning?: string }>({ phase: 'idle' })
  const ran = useRef(false)
  const drawer = canOpenDrawer(config)

  const test = useCallback(async () => {
    setState({ phase: 'busy' })
    try {
      const outcome = await printTicket(buildTestTicket(platform?.receipt), { openDrawer: true })
      setState({ phase: 'ask', warning: outcome?.warning })
    } catch (e) {
      setState({ phase: 'error', message: (e as Error).message })
    }
  }, [platform?.receipt])

  useEffect(() => {
    if (!auto || ran.current) return
    ran.current = true
    void test()
  }, [auto, test])

  const question = drawer ? 'Le ticket est sorti et le tiroir s’est ouvert ?' : 'Le ticket est sorti ?'
  return (
    <>
      <StepTitle H={H} heading={heading}>
        {state.phase === 'ask' ? question : 'Ticket d’essai'}
      </StepTitle>
      <p className={muted}>
        {config.name || config.host ? `${config.name ?? 'Imprimante'}, ${config.host}. ` : ''}
        Un ticket fictif, marqué « Essai », sans valeur ni trace dans le journal{drawer ? ' ; le tiroir s’ouvre en même temps' : ''}.
      </p>
      {state.phase === 'idle' && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={primary} onClick={() => void test()} data-autofocus>
            <Printer size={18} aria-hidden /> Imprimer le ticket d’essai
          </button>
          <button type="button" className={btn} onClick={onChangePrinter}>
            Changer d’imprimante
          </button>
        </div>
      )}
      {state.phase === 'busy' && <Waiting label={drawer ? 'Impression du ticket et ouverture du tiroir' : 'Impression du ticket'} />}
      {state.phase === 'ask' && (
        <>
          {state.warning && (
            <p role="status" className="flex items-center gap-2 text-[15px] font-medium">
              <WarningCircle size={20} aria-hidden /> {state.warning}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
            <button type="button" className={primary} onClick={onConfirmed} data-autofocus>
              Oui
            </button>
            <button type="button" className={btn} onClick={() => setState({ phase: 'no' })}>
              Non
            </button>
          </div>
        </>
      )}
      {state.phase === 'error' && (
        <p role="alert" className="alert-box">
          {state.message}
        </p>
      )}
      {(state.phase === 'no' || state.phase === 'error') && (
        <>
          <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-[var(--color-text-secondary)]">
            <li>Pas de ticket : vérifiez le rouleau de papier, le capot bien fermé et le voyant de l’imprimante.</li>
            {drawer && <li>Ticket sorti mais tiroir fermé : son câble se branche sur la prise de l’imprimante marquée DK ou Drawer, et le tiroir ne doit pas être verrouillé à clé.</li>}
            <li>Rien ne se passe : l’imprimante et l’ordinateur du pont doivent être sur le même réseau.</li>
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={primary} onClick={() => void test()}>
              <ArrowClockwise size={18} aria-hidden /> Réessayer
            </button>
            <button type="button" className={btn} onClick={onChangePrinter}>
              Changer d’imprimante
            </button>
            <Advanced onAdvanced={onAdvanced} advancedHref={advancedHref} />
          </div>
        </>
      )}
    </>
  )
}

// Fin : récapitulatif et état de chaque appareil
function DoneStep({
  H,
  heading,
  status,
  onDone,
  doneHref,
  onAdvanced,
  advancedHref,
  onRedo,
}: StepProps & { status: BridgeStatus; onDone?: () => void; doneHref?: string; onAdvanced?: () => void; advancedHref?: string; onRedo: () => void }) {
  const printer = usePrinterConfig()
  const tpe = useBridgeTpe()
  const [reach, setReach] = useState<'unknown' | 'ok' | 'down'>('unknown')
  const viaBridge = printer.mode === 'bridge'

  useEffect(() => {
    if (!viaBridge || !printer.host || status !== 'ready') return
    let alive = true
    getBridge()
      .call('printer.probe', { host: printer.host, port: printer.port ?? 9100, timeoutMs: 3000 })
      .then((r) => alive && setReach(r.reachable ? 'ok' : 'down'))
      .catch(() => alive && setReach('down'))
    return () => {
      alive = false
    }
  }, [viaBridge, printer.host, printer.port, status])

  const bridgeOk = status === 'ready'
  const printerState: Row['state'] = viaBridge ? (!bridgeOk ? 'down' : reach === 'unknown' ? 'wait' : reach) : 'ok'
  const rows: Row[] = [
    ...(viaBridge || tpe.enabled
      ? [{ icon: Plugs, label: 'FLŌW-Bridge', detail: bridgeOk ? 'Relié à cette caisse' : status === 'unpaired' ? 'À appairer' : 'Injoignable sur cet ordinateur', state: (bridgeOk ? 'ok' : 'down') as Row['state'] }]
      : []),
    {
      icon: Printer,
      label: 'Imprimante',
      detail: `${printer.name ?? (printer.mode === 'epos' ? 'Epson ePOS' : 'Imprimante de tickets')}, ${printer.host}`,
      state: printerState,
    },
    {
      icon: Tray,
      label: 'Tiroir',
      detail: canOpenDrawer(printer) ? (printer.drawerOnCash ? 'Sur l’imprimante, s’ouvre à chaque paiement en espèces' : 'Sur l’imprimante, ouverture à la demande') : 'Sans tiroir piloté',
      state: canOpenDrawer(printer) ? printerState : 'none',
    },
    // Le TPE n'est pas interrogé ici : seul un pont injoignable se signale
    { icon: CreditCard, label: 'Terminal de paiement', detail: tpeSummary(tpe), state: tpe.enabled && !bridgeOk ? 'down' : 'none' },
  ]
  const allOk = rows.every((r) => r.state === 'ok' || r.state === 'none' || r.state === 'wait')

  return (
    <>
      <StepTitle H={H} heading={heading}>
        {allOk ? 'Votre matériel est prêt' : 'Un appareil ne répond pas'}
      </StepTitle>
      <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3 px-4 py-3">
            <r.icon size={22} aria-hidden className="shrink-0 text-[var(--color-text-secondary)]" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">{r.label}</span>
              <span className="block text-sm text-[var(--color-text-secondary)] [overflow-wrap:anywhere]">{r.detail}</span>
            </span>
            <StateLabel state={r.state} />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        {onDone ? (
          <button type="button" className={primary} onClick={onDone} data-autofocus>
            Retour à la caisse
          </button>
        ) : doneHref ? (
          <Link href={doneHref} className={primary}>
            Retour à la caisse
          </Link>
        ) : null}
        <button type="button" className={btn} onClick={onRedo}>
          <ArrowClockwise size={18} aria-hidden /> Refaire la détection
        </button>
        {/* Sur la page Matériel, les réglages fins sont déjà liés en bas */}
        <Advanced onAdvanced={onAdvanced} />
      </div>
    </>
  )
}

interface Row {
  icon: typeof Printer
  label: string
  detail: string
  state: 'ok' | 'down' | 'wait' | 'none'
}

// Un état se dit par un libellé et une icône, jamais par la couleur seule
function StateLabel({ state }: { state: Row['state'] }) {
  if (state === 'none') return null
  if (state === 'wait')
    return (
      <span className="shrink-0 text-sm text-[var(--color-text-secondary)]" role="status">
        Vérification
      </span>
    )
  return state === 'ok' ? (
    <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[var(--color-accent)]">
      <CheckCircle size={18} weight="fill" aria-hidden /> Prêt
    </span>
  ) : (
    <span className="flex shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-bg-inverse)] px-2.5 py-1 text-sm font-semibold text-[var(--color-text-inverse)]">
      <WarningCircle size={16} weight="bold" aria-hidden /> Ne répond pas
    </span>
  )
}

