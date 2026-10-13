'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bank, CheckCircle, DeviceMobile, Plus, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { sitesApi } from '@/lib/api/sites'
import { PROVIDER_LABEL, paymentsApi, type PaymentAccount, type PaymentProvider } from '@/lib/api/payments'

type Choice = PaymentProvider | 'BANK'

const CHOICES: Array<{ id: Choice; title: string; text: string }> = [
  { id: 'SIMULATOR', title: 'Essayer sans matériel', text: 'Un téléphone joue le TPE. Idéal pour découvrir et former l’équipe.' },
  { id: 'SUMUP', title: 'SumUp Solo', text: 'Lecteur relié en Wi-Fi ou 4G, appairé avec un code.' },
  { id: 'STRIPE', title: 'Stripe Terminal', text: 'Lecteurs S700 et S710, appairés avec un code.' },
  { id: 'BANK', title: 'Mon TPE bancaire', text: 'Ingenico, Verifone... fourni par votre banque.' },
]

const fieldCls =
  'h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 text-[15px] focus:border-[var(--color-accent)] focus:outline-none'

export function PaymentSettings() {
  const qc = useQueryClient()
  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: sitesApi.getAll })
  const [siteId, setSiteId] = useState('')
  const site = siteId || sites[0]?.id || ''
  const [choice, setChoice] = useState<Choice | null>(null)

  const devices = useQuery({
    queryKey: ['payment-devices', site],
    queryFn: () => paymentsApi.devices(site),
    enabled: !!site,
  })
  const accounts = useQuery({ queryKey: ['payment-accounts'], queryFn: paymentsApi.accounts })

  const remove = useMutation({
    mutationFn: (id: string) => paymentsApi.removeDevice(site, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-devices', site] }),
  })

  const paired = () => {
    qc.invalidateQueries({ queryKey: ['payment-devices', site] })
    setChoice(null)
  }

  return (
    <div className="max-w-3xl space-y-10 p-6 md:p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Paiement</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Reliez un TPE : la caisse lui envoie le montant et ferme la vente dès que le paiement est accepté. Plus rien à retaper.
        </p>
      </header>

      {sites.length > 1 && (
        <div className="space-y-2">
          <label htmlFor="pay-site" className="block text-sm font-medium">
            Boutique
          </label>
          <select id="pay-site" value={site} onChange={(e) => setSiteId(e.target.value)} className={fieldCls + ' sm:w-72'}>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <section className="space-y-3" aria-labelledby="devices-title">
        <h2 id="devices-title" className="text-lg font-semibold">
          TPE de la boutique
        </h2>
        {devices.data?.length ? (
          <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
            {devices.data.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-2">
                <DeviceMobile size={20} aria-hidden className="text-[var(--color-accent)]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">{d.name}</span>
                  <span className="block text-sm text-[var(--color-text-secondary)]">{PROVIDER_LABEL[d.provider]}</span>
                </span>
                {d.provider === 'SIMULATOR' && (
                  <a href={`/tpe/${site}/${d.id}`} target="_blank" rel="noreferrer" className="h-11 content-center px-2 text-sm font-medium text-[var(--color-accent)]">
                    Ouvrir
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => remove.mutate(d.id)}
                  aria-label={`Retirer ${d.name}`}
                  className="grid size-11 place-items-center rounded-[var(--radius-pill)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
                >
                  <Trash size={18} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Aucun TPE relié. La caisse fonctionne quand même : encaissez sur votre TPE, puis touchez « Carte ».
          </p>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="add-title">
        <h2 id="add-title" className="text-lg font-semibold">
          Ajouter un TPE
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {CHOICES.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                aria-pressed={choice === c.id}
                onClick={() => setChoice(choice === c.id ? null : c.id)}
                className={[
                  'flex h-full min-h-20 w-full flex-col items-start gap-1 rounded-[var(--radius-md)] border p-4 text-left',
                  choice === c.id ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)]' : 'border-[var(--color-border-strong)] hover:border-[var(--color-accent)]',
                ].join(' ')}
              >
                <span className="text-[15px] font-semibold">{c.title}</span>
                <span className="text-sm text-[var(--color-text-secondary)]">{c.text}</span>
              </button>
            </li>
          ))}
        </ul>

        {choice === 'SIMULATOR' && <SimulatorSetup siteId={site} onDone={paired} />}
        {(choice === 'SUMUP' || choice === 'STRIPE') && (
          <ProviderSetup
            key={choice}
            provider={choice}
            siteId={site}
            account={accounts.data?.find((a) => a.provider === choice)}
            onAccount={() => qc.invalidateQueries({ queryKey: ['payment-accounts'] })}
            onDone={paired}
          />
        )}
        {choice === 'BANK' && (
          <div className="flex gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4 text-sm">
            <Bank size={22} aria-hidden className="shrink-0 text-[var(--color-accent)]" />
            <div className="space-y-2">
              <p>
                Les TPE bancaires se relient à la caisse par le réseau de la boutique (protocole Concert). Cette liaison passe par un
                petit logiciel à installer sur place ; elle n&apos;est pas encore disponible.
              </p>
              <p className="text-[var(--color-text-secondary)]">
                En attendant, rien ne change pour vous : encaissez sur votre TPE comme d&apos;habitude, puis touchez « Carte » dans la
                caisse. Le ticket et la comptabilité restent justes.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function SimulatorSetup({ siteId, onDone }: { siteId: string; onDone: () => void }) {
  const add = useMutation({
    mutationFn: () => paymentsApi.pair(siteId, { provider: 'SIMULATOR', name: 'TPE virtuel' }),
    onSuccess: () => {
      toast.success('TPE virtuel ajouté')
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  return (
    <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Ouvrez ensuite le TPE virtuel sur un téléphone connecté au même compte. Aucun argent réel ne circule.
      </p>
      <button
        type="button"
        onClick={() => add.mutate()}
        disabled={add.isPending}
        className="flex h-12 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 text-[15px] font-semibold text-[var(--color-on-accent)] disabled:opacity-50"
      >
        <Plus size={18} aria-hidden />
        Ajouter le TPE virtuel
      </button>
    </div>
  )
}

const PAIRING_HELP: Record<'SUMUP' | 'STRIPE', string> = {
  SUMUP: 'Sur le Solo : Connexions, puis API, puis Connecter. Un code de 8 caractères s’affiche (valable 5 minutes).',
  STRIPE: 'Sur le lecteur : faites glisser l’écran, ouvrez Paramètres et générez un code d’appairage. En mode test, saisissez simulated-s700.',
}

function ProviderSetup({
  provider,
  siteId,
  account,
  onAccount,
  onDone,
}: {
  provider: 'SUMUP' | 'STRIPE'
  siteId: string
  account?: PaymentAccount
  onAccount: () => void
  onDone: () => void
}) {
  const [creds, setCreds] = useState<Record<string, string>>({})
  const [pair, setPair] = useState({ code: '', name: 'Comptoir', line1: '', city: '', postalCode: '' })
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setCreds((c) => ({ ...c, [k]: e.target.value }))

  const connect = useMutation({
    mutationFn: () => paymentsApi.saveAccount(provider, creds),
    onSuccess: () => {
      toast.success(`Compte ${PROVIDER_LABEL[provider]} relié`)
      onAccount()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const pairDevice = useMutation({
    mutationFn: () =>
      paymentsApi.pair(siteId, {
        provider,
        name: pair.name,
        code: pair.code,
        ...(provider === 'STRIPE' && pair.line1
          ? { address: { line1: pair.line1, city: pair.city, postalCode: pair.postalCode, country: 'FR' } }
          : {}),
      }),
    onSuccess: () => {
      toast.success('TPE relié à la caisse')
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-6 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
      <ol className="space-y-6">
        <li className="space-y-3">
          <p className="text-[15px] font-semibold">1. Relier votre compte {PROVIDER_LABEL[provider]}</p>
          {account ? (
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle size={18} weight="fill" aria-hidden className="text-[var(--color-accent)]" />
              Compte relié ({account.key}
              {account.merchantCode ? `, ${account.merchantCode}` : ''}){account.testMode ? ', mode test' : ''}.
            </p>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                connect.mutate()
              }}
            >
              {provider === 'STRIPE' ? (
                <Field id="sk" label="Clé secrète" help="Tableau de bord Stripe, Développeurs, Clés API. Commence par sk_.">
                  <input id="sk" autoComplete="off" required className={fieldCls} onChange={set('secretKey')} />
                </Field>
              ) : (
                <>
                  <Field id="ak" label="Clé API" help="Tableau de bord SumUp, Développeurs, Clés API.">
                    <input id="ak" autoComplete="off" required className={fieldCls} onChange={set('apiKey')} />
                  </Field>
                  <Field id="mc" label="Code marchand" help="Visible dans votre profil SumUp, par exemple MH4H92C7.">
                    <input id="mc" autoComplete="off" required className={fieldCls} onChange={set('merchantCode')} />
                  </Field>
                  <Field id="aff" label="Clé affilié (facultatif)" help="Développeurs, Clés affilié. Demandée par SumUp pour les caisses.">
                    <input id="aff" autoComplete="off" className={fieldCls} onChange={set('affiliateKey')} />
                  </Field>
                </>
              )}
              <button
                type="submit"
                disabled={connect.isPending}
                className="h-12 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 text-[15px] font-semibold text-[var(--color-on-accent)] disabled:opacity-50"
              >
                {connect.isPending ? 'Vérification...' : 'Relier le compte'}
              </button>
              <p className="text-sm text-[var(--color-text-secondary)]">La clé est vérifiée puis stockée chiffrée. Elle ne s&apos;affiche plus ensuite.</p>
            </form>
          )}
        </li>

        <li className={['space-y-3', account ? '' : 'opacity-50'].join(' ')} aria-disabled={!account}>
          <p className="text-[15px] font-semibold">2. Appairer le lecteur</p>
          <p className="text-sm text-[var(--color-text-secondary)]">{PAIRING_HELP[provider]}</p>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              pairDevice.mutate()
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="code" label="Code affiché sur le TPE">
                <input id="code" required disabled={!account} autoComplete="off" className={fieldCls + ' font-data uppercase'} value={pair.code} onChange={(e) => setPair({ ...pair, code: e.target.value })} />
              </Field>
              <Field id="dname" label="Nom du TPE">
                <input id="dname" required disabled={!account} className={fieldCls} value={pair.name} onChange={(e) => setPair({ ...pair, name: e.target.value })} />
              </Field>
            </div>
            {provider === 'STRIPE' && (
              <fieldset className="grid gap-3 sm:grid-cols-3" disabled={!account}>
                <legend className="mb-2 text-sm text-[var(--color-text-secondary)]">Adresse de la boutique (demandée par Stripe pour le premier lecteur)</legend>
                <Field id="l1" label="Adresse">
                  <input id="l1" className={fieldCls} value={pair.line1} onChange={(e) => setPair({ ...pair, line1: e.target.value })} />
                </Field>
                <Field id="cp" label="Code postal">
                  <input id="cp" inputMode="numeric" className={fieldCls} value={pair.postalCode} onChange={(e) => setPair({ ...pair, postalCode: e.target.value })} />
                </Field>
                <Field id="city" label="Ville">
                  <input id="city" className={fieldCls} value={pair.city} onChange={(e) => setPair({ ...pair, city: e.target.value })} />
                </Field>
              </fieldset>
            )}
            <button
              type="submit"
              disabled={!account || pairDevice.isPending}
              className="h-12 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 text-[15px] font-semibold text-[var(--color-on-accent)] disabled:opacity-50"
            >
              {pairDevice.isPending ? 'Appairage...' : 'Relier ce TPE'}
            </button>
          </form>
        </li>
      </ol>
    </div>
  )
}

function Field({ id, label, help, children }: { id: string; label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {help && <p className="text-sm text-[var(--color-text-secondary)]">{help}</p>}
    </div>
  )
}
