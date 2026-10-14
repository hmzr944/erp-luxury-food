'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowsClockwise, CheckCircle, DownloadSimple, FileArrowDown, LockKey, Warning } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { formatPrice } from '@erp/utils'
import { Sheet } from '@/components/pos/Sheet'
import { Loading } from '@/components/brand/FlowLogo'
import { EASE_OUT } from '@/lib/motion'
import { downloadFile, fiscalApi, fiscalPaths, type ClosurePeriod, type FiscalClosure, type VerifyResult } from '@/lib/api/fiscal'
import { useAuthStore } from '@/stores/auth.store'

const PERIODS: Array<{ key: ClosurePeriod; label: string }> = [
  { key: 'DAY', label: 'Jours' },
  { key: 'MONTH', label: 'Mois' },
  { key: 'YEAR', label: 'Années' },
]

const money = (v: string | number) => formatPrice(Number(v))
const frDate = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
const periodLabel = (c: Pick<FiscalClosure, 'period' | 'label'>) => {
  if (c.period === 'DAY') return new Date(`${c.label}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
  if (c.period === 'MONTH') return new Date(`${c.label}-15T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  return c.label
}

const btn = 'inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 text-[15px] font-semibold press'
const primary = `${btn} bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)]`
const secondary = `${btn} border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-hover)] disabled:opacity-60`

// Conformité fiscale (art. 286 I 3° bis du CGI) : grand livre, clôtures,
// archives, journal et attestation, au même endroit
export function ComplianceClient({ siteId }: { siteId: string }) {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const manager = user?.role === 'OWNER' || user?.role === 'MANAGER'
  const [period, setPeriod] = useState<ClosurePeriod>('DAY')
  const [open, setOpen] = useState<FiscalClosure | null>(null)
  const [check, setCheck] = useState<VerifyResult | null>(null)
  const [tab, setTab] = useState<'closures' | 'archives' | 'events'>('closures')

  const summary = useQuery({ queryKey: ['fiscal-summary', siteId], queryFn: () => fiscalApi.summary(siteId) })
  const closures = useQuery({ queryKey: ['fiscal-closures', siteId, period], queryFn: () => fiscalApi.closures(siteId, period) })
  const archives = useQuery({ queryKey: ['fiscal-archives', siteId], queryFn: () => fiscalApi.archives(siteId), enabled: tab === 'archives' })
  const events = useQuery({ queryKey: ['fiscal-events', siteId], queryFn: () => fiscalApi.events(siteId), enabled: tab === 'events' })
  const attestation = useQuery({ queryKey: ['fiscal-attestation'], queryFn: fiscalApi.attestation, enabled: manager })

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['fiscal-summary', siteId] })
    void qc.invalidateQueries({ queryKey: ['fiscal-closures', siteId] })
    void qc.invalidateQueries({ queryKey: ['fiscal-archives', siteId] })
    void qc.invalidateQueries({ queryKey: ['fiscal-events', siteId] })
  }

  const closeDay = useMutation({
    mutationFn: () => fiscalApi.closeDay(siteId),
    onSuccess: (z) => {
      refresh()
      setOpen(z)
      toast.success(`Journée clôturée : ${z.ticketCount} ticket${z.ticketCount > 1 ? 's' : ''}, ${money(z.periodTotal)}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const verify = useMutation({
    mutationFn: () => fiscalApi.verify(siteId),
    onSuccess: (r) => {
      setCheck(r)
      void qc.invalidateQueries({ queryKey: ['fiscal-events', siteId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const download = async (path: string, name: string) => {
    try {
      await downloadFile(path, name)
      if (path.includes('/archives/')) void qc.invalidateQueries({ queryKey: ['fiscal-events', siteId] })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const s = summary.data
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-border)] px-4 py-5 md:px-6">
        <div>
          <h1 className="page-title">Conformité fiscale</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Article 286 I 3° bis du code général des impôts : inaltérabilité, sécurisation, conservation, archivage.</p>
        </div>
        {manager && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondary} onClick={() => verify.mutate()} disabled={verify.isPending}>
              <ArrowsClockwise size={18} aria-hidden className={verify.isPending ? 'animate-spin motion-reduce:animate-none' : ''} />
              {verify.isPending ? 'Vérification' : 'Vérifier le grand livre'}
            </button>
            <button type="button" className={primary} onClick={() => closeDay.mutate()} disabled={closeDay.isPending}>
              <LockKey size={18} aria-hidden />
              {closeDay.isPending ? 'Clôture' : 'Clôturer la journée'}
            </button>
          </div>
        )}
      </header>

      <div className="space-y-6 p-4 md:p-6">
        {check && (
          <p role="status" className={check.valid ? 'flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent-muted)] p-3 text-[15px] font-medium' : 'alert-box'}>
            {check.valid && <CheckCircle size={20} weight="fill" aria-hidden className="text-[var(--color-accent)]" />}
            {check.valid
              ? `Tout est intact : ${check.chain.checked} tickets, ${check.closures.checked} clôtures et ${check.journal.checked} événements vérifiés.`
              : `Anomalie : ${[...check.chain.errors, ...check.closures.errors, ...check.journal.errors].slice(0, 3).join(' ; ')}`}
          </p>
        )}

        {!s ? (
          <Loading />
        ) : (
          <div className="grid grid-cols-2 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] lg:grid-cols-4 [&>*]:border-[var(--color-border)] [&>*:nth-child(odd)]:border-r lg:[&>*]:border-r lg:[&>*:last-child]:border-r-0 [&>*:nth-child(-n+2)]:border-b lg:[&>*:nth-child(-n+2)]:border-b-0">
            <Stat label="Total perpétuel" value={money(s.perpetualTotal)} hint="Depuis le premier ticket, jamais remis à zéro" accent />
            <Stat label="Cumul en valeur absolue" value={money(s.perpetualAbsTotal)} hint="Ventes et retours additionnés" />
            <Stat label="Dernier ticket" value={s.lastCounter ? `n° ${s.lastCounter}` : 'Aucun'} hint={s.lastClosures.DAY ? `Dernière clôture : ${periodLabel(s.lastClosures.DAY)}` : 'Aucune clôture'} />
            <Stat label="À clôturer" value={`${s.pending.tickets} ticket${s.pending.tickets > 1 ? 's' : ''}`} hint={s.pending.tickets ? money(s.pending.total) : 'Rien en attente'} />
          </div>
        )}

        {manager && <AttestationCard status={attestation.data} loading={attestation.isLoading} onDownload={() => download(fiscalPaths.attestation(), 'attestation.pdf')} />}

        <div role="group" aria-label="Rubrique" className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {(
            [
              ['closures', 'Clôtures'],
              ['archives', 'Archives'],
              ['events', 'Journal des événements'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
              className={[
                'flex h-10 shrink-0 items-center rounded-[var(--radius-pill)] px-4 text-sm font-medium transition-colors',
                tab === key ? 'bg-[var(--color-bg-inverse)] text-[var(--color-text-inverse)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'closures' && (
          <section aria-labelledby="z-title" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="z-title" className="font-display text-xl font-semibold tracking-tight">
                Clôtures {PERIODS.find((p) => p.key === period)!.label.toLowerCase()}
              </h2>
              <div className="flex items-center gap-2">
                <div role="group" aria-label="Période" className="flex rounded-[var(--radius-pill)] bg-[var(--color-bg-hover)] p-0.5">
                  {PERIODS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      aria-pressed={period === p.key}
                      onClick={() => setPeriod(p.key)}
                      className={['relative h-9 rounded-[var(--radius-pill)] px-4 text-sm font-medium', period === p.key ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'].join(' ')}
                    >
                      {period === p.key && (
                        <motion.span layoutId="z-period" aria-hidden className="absolute inset-0 rounded-[var(--radius-pill)] bg-[var(--color-bg-surface)] shadow-sm" transition={{ duration: 0.2, ease: EASE_OUT }} />
                      )}
                      <span className="relative">{p.label}</span>
                    </button>
                  ))}
                </div>
                {manager && (
                  <button type="button" className={secondary} onClick={() => download(fiscalPaths.closuresCsv(siteId, period), 'clotures.csv')}>
                    <DownloadSimple size={18} aria-hidden /> Tableur
                  </button>
                )}
              </div>
            </div>
            {closures.isLoading ? (
              <Loading />
            ) : !closures.data?.length ? (
              <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] p-6 text-[15px] text-[var(--color-text-secondary)]">
                {period === 'DAY'
                  ? 'Aucune clôture pour l’instant. Chaque journée terminée est clôturée automatiquement la nuit si personne ne l’a fait.'
                  : 'Les mois et années se clôturent tout seuls une fois terminés, avec leur archive signée.'}
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
                {closures.data.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => setOpen(c)} className="flex w-full flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-left hover:bg-[var(--color-bg-hover)]">
                      <span className="min-w-0 flex-1 basis-48">
                        <span className="block text-[15px] font-semibold first-letter:uppercase">{periodLabel(c)}</span>
                        <span className="block text-sm text-[var(--color-text-secondary)]">
                          Z n° {c.seq}
                          {c.firstCounter ? `, tickets ${c.firstCounter} à ${c.lastCounter}` : ', aucun ticket'}
                          {c.auto ? ', automatique' : ''}
                        </span>
                      </span>
                      <span className="tabular text-right">
                        <span className="block font-display text-lg font-semibold">{money(c.periodTotal)}</span>
                        <span className="block text-sm text-[var(--color-text-secondary)]">
                          {c.ticketCount} ticket{c.ticketCount > 1 ? 's' : ''}
                          {Number(c.refundsTotal) ? `, retours ${money(c.refundsTotal)}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === 'archives' && (
          <section aria-labelledby="arch-title" className="space-y-3">
            <h2 id="arch-title" className="font-display text-xl font-semibold tracking-tight">Archives fiscales</h2>
            <p className="max-w-2xl text-sm text-[var(--color-text-secondary)]">
              Créées à chaque clôture de mois et d’année : fichier JSON lisible sans FLŌW, daté, scellé et signé par l’éditeur. À conserver six ans, sur un support externe de préférence.
            </p>
            {archives.isLoading ? (
              <Loading />
            ) : !archives.data?.length ? (
              <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] p-6 text-[15px] text-[var(--color-text-secondary)]">La première archive sera créée à la clôture du premier mois terminé.</p>
            ) : (
              <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
                {archives.data.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3">
                    <span className="min-w-0 flex-1 basis-48">
                      <span className="block text-[15px] font-semibold first-letter:uppercase">{periodLabel({ period: a.period, label: a.label })}</span>
                      <span className="block truncate font-data text-xs text-[var(--color-text-secondary)]">SHA-256 {a.sha256}</span>
                    </span>
                    <button type="button" className={secondary} onClick={() => download(fiscalPaths.archive(siteId, a.id), `archive-${a.label}.json`)}>
                      <FileArrowDown size={18} aria-hidden /> Télécharger
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === 'events' && (
          <section aria-labelledby="ev-title" className="space-y-3">
            <h2 id="ev-title" className="font-display text-xl font-semibold tracking-tight">Journal des événements</h2>
            {events.isLoading ? (
              <Loading />
            ) : (
              <ol className="divide-y divide-[var(--color-border)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
                {(events.data ?? []).map((e) => (
                  <li key={e.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-4 py-2.5">
                    <span className="tabular w-12 shrink-0 text-sm text-[var(--color-text-secondary)]">n° {e.seq}</span>
                    <span className="min-w-0 flex-1 text-[15px] font-medium">{e.label}</span>
                    <span className="tabular text-sm text-[var(--color-text-secondary)]">{frDate(e.createdAt)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </div>

      <Sheet open={!!open} title={open ? `Clôture ${open.period === 'DAY' ? 'du' : open.period === 'MONTH' ? 'de' : 'de l’année'} ${periodLabel(open)}` : ''} onClose={() => setOpen(null)} width="lg">
        {open && <ClosureDetail z={open} />}
      </Sheet>
    </div>
  )
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <div className="px-5 py-5">
      <p className="text-sm text-[var(--color-text-secondary)]">{label}</p>
      <p className={`tabular mt-2 font-display text-3xl font-bold leading-none tracking-[-0.035em] ${accent ? 'text-[var(--color-accent)]' : ''}`}>{value}</p>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{hint}</p>
    </div>
  )
}

function AttestationCard({ status, loading, onDownload }: { status?: Awaited<ReturnType<typeof fiscalApi.attestation>>; loading: boolean; onDownload: () => void }) {
  const [busy, setBusy] = useState(false)
  return (
    <section aria-labelledby="att-title" className="grid gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div>
        <h2 id="att-title" className="font-display text-xl font-semibold tracking-tight">Attestation de conformité</h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-secondary)]">
          Modèle officiel BOI-LETTRE-000242 : le volet 1 est signé par l’éditeur, le volet 2 est pré-rempli à votre nom. Signez-le et gardez-le avec vos documents comptables.
          {status && ` ${status.software.name} ${status.software.version}, licence ${status.licence}.`}
        </p>
        {status && !status.available && (
          <p className="mt-3 flex items-center gap-2 text-sm font-semibold">
            <Warning size={18} weight="fill" aria-hidden /> Bientôt disponible : l’éditeur finalise ses informations légales.
          </p>
        )}
      </div>
      <button
        type="button"
        className={primary}
        disabled={loading || !status?.available || busy}
        onClick={async () => {
          setBusy(true)
          try {
            await onDownload()
          } finally {
            setBusy(false)
          }
        }}
      >
        <FileArrowDown size={18} aria-hidden /> {busy ? 'Préparation' : 'Télécharger mon attestation'}
      </button>
    </section>
  )
}

function ClosureDetail({ z }: { z: FiscalClosure }) {
  const row = 'flex items-baseline justify-between gap-4 py-1.5'
  return (
    <div className="space-y-5 pb-2">
      <dl className="divide-y divide-[var(--color-border)] text-[15px]">
        <div className={row}>
          <dt className="text-[var(--color-text-secondary)]">Tickets</dt>
          <dd className="tabular">{z.firstCounter ? `n° ${z.firstCounter} à ${z.lastCounter} (${z.ticketCount})` : 'Aucun'}</dd>
        </div>
        <div className={row}>
          <dt className="text-[var(--color-text-secondary)]">Ventes ({z.salesCount})</dt>
          <dd className="tabular">{money(z.salesTotal)}</dd>
        </div>
        <div className={row}>
          <dt className="text-[var(--color-text-secondary)]">Retours ({z.refundCount})</dt>
          <dd className="tabular">{money(z.refundsTotal)}</dd>
        </div>
        <div className={`${row} font-semibold`}>
          <dt>Grand total de la période</dt>
          <dd className="tabular font-display text-xl">{money(z.periodTotal)}</dd>
        </div>
        <div className={row}>
          <dt className="text-[var(--color-text-secondary)]">Total perpétuel</dt>
          <dd className="tabular">{money(z.perpetualTotal)}</dd>
        </div>
        <div className={row}>
          <dt className="text-[var(--color-text-secondary)]">Cumul en valeur absolue</dt>
          <dd className="tabular">{money(z.perpetualAbsTotal)}</dd>
        </div>
      </dl>

      <div>
        <h3 className="mb-2 text-sm font-semibold">TVA par taux</h3>
        <table className="w-full text-[15px]">
          <thead>
            <tr className="text-left text-sm text-[var(--color-text-secondary)]">
              <th className="py-1 font-medium">Taux</th>
              <th className="py-1 text-right font-medium">HT</th>
              <th className="py-1 text-right font-medium">TVA</th>
              <th className="py-1 text-right font-medium">TTC</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {z.taxBreakdown.map((t) => (
              <tr key={t.rate} className="border-t border-[var(--color-border)]">
                <td className="py-1.5">{String(t.rate).replace('.', ',')} %</td>
                <td className="py-1.5 text-right">{money(t.ht)}</td>
                <td className="py-1.5 text-right">{money(t.tax)}</td>
                <td className="py-1.5 text-right">{money(t.ttc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Encaissements</h3>
        <ul className="text-[15px]">
          {z.paymentBreakdown.map((p) => (
            <li key={p.code} className="flex justify-between border-t border-[var(--color-border)] py-1.5">
              <span>{p.label}</span>
              <span className="tabular">{money(p.amount)}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="break-all font-data text-xs text-[var(--color-text-secondary)]">
        Clôturée le {frDate(z.closedAt)}{z.auto ? ' (automatique)' : ''}. Empreinte {z.hash}
      </p>
    </div>
  )
}
