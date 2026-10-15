'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CaretLeft, Clock, EnvelopeSimple, LockKey, WarningOctagon } from '@phosphor-icons/react'
import { FlowLogo } from '@/components/brand/FlowLogo'
import { ApiError } from '@/lib/api/client'
import { supportApi, type AgentThread, type AgentThreadSummary, type SupportStatus } from '@/lib/api/support'
import { AGENT_STATUS, formatGap, formatMessageTime, formatWhen } from '@/lib/support/format'
import { ContextList, Message } from './SupportSheet'
import { ROLE_LABEL } from '@/lib/workspace'

const SUBSCRIPTION: Record<string, string> = { TRIALING: 'en essai', ACTIVE: 'abonnée', PAST_DUE: 'paiement en attente', CANCELED: 'abonnement arrêté' }

type Filter = 'active' | 'RESOLVED' | 'all'
const FILTERS: Array<[Filter, string]> = [
  ['active', 'À traiter'],
  ['RESOLVED', 'Résolues'],
  ['all', 'Toutes'],
]
const STATUSES: SupportStatus[] = ['OPEN', 'WAITING_CUSTOMER', 'RESOLVED']
const field = 'w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 text-[15px] focus:border-[var(--color-accent)]'

// Échéance de la file : en retard, à rendre avant, ou rien à faire
function DueLabel({ t, now }: { t: Pick<AgentThreadSummary, 'status' | 'dueAt' | 'overdue'>; now: Date }) {
  if (t.status !== 'OPEN') return <span className="text-[var(--color-text-secondary)]">{AGENT_STATUS[t.status]}</span>
  if (t.overdue || new Date(t.dueAt) < now) {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-bg-inverse)] px-2 py-0.5 font-semibold text-[var(--color-text-inverse)]">
        <Clock size={14} weight="bold" aria-hidden />
        En retard de {formatGap(now.getTime() - new Date(t.dueAt).getTime())}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 font-medium">
      <Clock size={14} aria-hidden />
      Avant {formatWhen(t.dueAt, now)}
    </span>
  )
}

function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), ms)
    return () => window.clearInterval(id)
  }, [ms])
  return now
}

export function SupportTeam() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [filter, setFilter] = useState<Filter>('active')
  const [selected, setSelected] = useState<string | null>(null)
  const now = useNow()

  useEffect(() => {
    if (!localStorage.getItem('access_token')) {
      router.replace('/login')
      return
    }
    // Lien de l'e-mail d'alerte : /support-team?demande=<id>
    const fromLink = new URLSearchParams(window.location.search).get('demande')
    if (fromLink) setSelected(fromLink)
    setReady(true)
  }, [router])

  const inbox = useQuery({
    queryKey: ['support-team', filter],
    queryFn: () => supportApi.agentThreads(filter),
    enabled: ready,
    refetchInterval: 20_000,
    retry: (n, e) => !(e instanceof ApiError && e.status === 403) && n < 1,
  })

  if (!ready) return null
  if (inbox.error instanceof ApiError && inbox.error.status === 403) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[var(--color-bg-base)] p-6">
        <div className="max-w-sm space-y-4 text-center">
          <LockKey size={40} aria-hidden className="mx-auto text-[var(--color-text-secondary)]" />
          <h1 className="font-display text-2xl font-semibold">Accès réservé à l’équipe FLŌW</h1>
          <p className="text-[15px] text-[var(--color-text-secondary)]">Pour écrire à l’équipe, ouvrez « Aide et support » depuis le back-office ou le menu de la caisse.</p>
          <Link href="/" className="press inline-flex h-11 items-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 font-semibold text-[var(--color-on-accent)]">
            Revenir à FLŌW
          </Link>
        </div>
      </main>
    )
  }

  const list = inbox.data ?? []
  const late = list.filter((t) => t.status === 'OPEN' && new Date(t.dueAt) < now).length
  const todo = list.filter((t) => t.status === 'OPEN').length

  return (
    <div className="flex h-[100dvh] flex-col bg-[var(--color-bg-base)]">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4">
        <FlowLogo size={18} />
        <h1 className="font-display text-base font-semibold">Support</h1>
        <p className="ml-auto text-sm text-[var(--color-text-secondary)] tabular" aria-live="polite">
          {todo} à traiter{late > 0 && <strong className="font-semibold text-[var(--color-text-primary)]">, {late} en retard</strong>}
        </p>
      </header>

      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
        <section aria-label="Demandes" className={`min-h-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-surface)] ${selected ? 'hidden md:flex' : 'flex'}`}>
          <div role="group" aria-label="Filtrer" className="flex gap-1 border-b border-[var(--color-border)] p-2">
            {FILTERS.map(([f, label]) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={`h-11 flex-1 rounded-[var(--radius-pill)] text-sm font-medium ${filter === f ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <ul className="min-h-0 flex-1 divide-y divide-[var(--color-border)] overflow-y-auto" aria-busy={inbox.isLoading}>
            {inbox.isLoading && <li className="p-4 text-sm text-[var(--color-text-secondary)]">Chargement…</li>}
            {!inbox.isLoading && list.length === 0 && (
              <li className="p-6 text-center text-[15px] text-[var(--color-text-secondary)]">{filter === 'active' ? 'Rien à traiter. Toutes les demandes ont une réponse.' : 'Aucune demande.'}</li>
            )}
            {list.map((t) => {
              const overdue = t.status === 'OPEN' && new Date(t.dueAt) < now
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(t.id)}
                    aria-current={selected === t.id ? 'true' : undefined}
                    className={[
                      'relative flex w-full flex-col gap-1 px-4 py-3 text-left',
                      selected === t.id ? 'bg-[var(--color-bg-elevated)]' : 'hover:bg-[var(--color-bg-hover)]',
                    ].join(' ')}
                  >
                    {overdue && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[var(--color-text-primary)]" />}
                    <span className="flex items-center gap-2">
                      {t.priority === 'URGENT' && <WarningOctagon size={16} weight="fill" role="img" aria-label="Urgente" className="shrink-0" />}
                      <span className={`min-w-0 flex-1 truncate text-[15px] ${t.unread ? 'font-semibold' : 'font-medium'}`}>{t.subject}</span>
                      {t.unread > 0 && (
                        <span className="shrink-0 rounded-[var(--radius-pill)] bg-[var(--color-accent)] px-1.5 text-xs font-semibold text-[var(--color-on-accent)] tabular">
                          {t.unread}
                          <span className="sr-only"> non lu{t.unread > 1 ? 's' : ''}</span>
                        </span>
                      )}
                    </span>
                    <span className="truncate text-sm text-[var(--color-text-secondary)]">
                      {[t.organizationName, t.siteName].filter(Boolean).join(', ')}
                    </span>
                    <span className="flex items-center justify-between gap-2 text-xs">
                      <DueLabel t={t} now={now} />
                      <time dateTime={t.lastMessageAt} className="text-[var(--color-text-secondary)]">{formatMessageTime(t.lastMessageAt, now)}</time>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <section aria-label="Demande" className={`min-h-0 overflow-y-auto ${selected ? 'block' : 'hidden md:block'}`}>
          {selected ? (
            <AgentConversation key={selected} id={selected} now={now} onBack={() => setSelected(null)} />
          ) : (
            <p className="grid h-full place-items-center p-6 text-[15px] text-[var(--color-text-secondary)]">Choisissez une demande.</p>
          )}
        </section>
      </div>
    </div>
  )
}

function AgentConversation({ id, now, onBack }: { id: string; now: Date; onBack: () => void }) {
  const qc = useQueryClient()
  const thread = useQuery({ queryKey: ['support-team', 'thread', id], queryFn: () => supportApi.agentThread(id), refetchInterval: 15_000 })
  const [reply, setReply] = useState('')
  const [after, setAfter] = useState<SupportStatus>('WAITING_CUSTOMER')
  const heading = useRef<HTMLHeadingElement>(null)
  const t = thread.data

  useEffect(() => {
    heading.current?.focus()
  }, [t?.id])

  const update = (next: AgentThread) => {
    qc.setQueryData(['support-team', 'thread', id], next)
    void qc.invalidateQueries({ queryKey: ['support-team'], exact: false })
  }
  const send = useMutation({
    mutationFn: () => supportApi.agentReply(id, reply.trim(), after),
    onSuccess: (next) => {
      update(next)
      setReply('')
      toast.success('Réponse envoyée')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const status = useMutation({
    mutationFn: (s: SupportStatus) => supportApi.agentStatus(id, s),
    onSuccess: update,
    onError: (e: Error) => toast.error(e.message),
  })

  if (!t) {
    return thread.isError ? <p role="alert" className="p-6">Demande introuvable.</p> : <div className="m-6 h-40 animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-bg-elevated)]" />
  }

  const ctx = t.context ?? {}
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <button type="button" onClick={onBack} className="-ml-2 flex h-11 items-center gap-1 rounded-[var(--radius-pill)] px-2 text-[15px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] md:hidden">
        <CaretLeft size={18} aria-hidden />
        Demandes
      </button>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {t.priority === 'URGENT' && (
            <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-bg-inverse)] px-2.5 py-1 font-semibold text-[var(--color-text-inverse)]">
              <WarningOctagon size={14} weight="fill" aria-hidden /> Caisse bloquée
            </span>
          )}
          <DueLabel t={t} now={now} />
          {t.slaMet !== null && <span className="text-[var(--color-text-secondary)]">Première réponse {t.slaMet ? 'dans le délai' : 'hors délai'}</span>}
        </div>
        <h2 ref={heading} tabIndex={-1} className="font-display text-2xl font-semibold leading-tight text-balance">
          {t.subject}
        </h2>
        <p className="text-[15px]">
          <strong className="font-semibold">{t.organizationName ?? 'Organisation inconnue'}</strong>
          {t.siteName && `, ${t.siteName}`}
          {t.organization && <span className="text-[var(--color-text-secondary)]">, {SUBSCRIPTION[t.organization.subscriptionStatus] ?? t.organization.subscriptionStatus}, offre {t.organization.plan.toLowerCase()}</span>}
        </p>
        {t.user && (
          <p className="flex flex-wrap items-center gap-x-2 text-[15px] text-[var(--color-text-secondary)]">
            {t.user.name} ({(ROLE_LABEL[t.user.role as keyof typeof ROLE_LABEL] ?? t.user.role).toLowerCase()})
            <a href={`mailto:${t.user.email}`} className="inline-flex items-center gap-1 underline underline-offset-2">
              <EnvelopeSimple size={16} aria-hidden />
              {t.user.email}
            </a>
          </p>
        )}
        <div role="group" aria-label="Statut" className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={t.status === s}
              disabled={status.isPending}
              onClick={() => t.status !== s && status.mutate(s)}
              className={`press h-11 rounded-[var(--radius-pill)] border px-3 text-sm font-medium ${t.status === s ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)]' : 'border-[var(--color-border-strong)] text-[var(--color-text-secondary)]'}`}
            >
              {AGENT_STATUS[s]}
            </button>
          ))}
        </div>
      </header>

      <details open={t.priority === 'URGENT'} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold">Contexte joint par l’application</summary>
        <div className="space-y-3 pt-3">
          <ContextList context={ctx} />
          {ctx.userAgent && <p className="break-words font-data text-xs text-[var(--color-text-secondary)]">{ctx.userAgent}</p>}
          {!!ctx.errors?.length && (
            <ul className="space-y-1 font-data text-xs">
              {ctx.errors.map((e, i) => (
                <li key={i} className="break-words rounded-[var(--radius-sm)] bg-[var(--color-bg-elevated)] px-2 py-1">
                  {e}
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      <ol role="log" aria-live="polite" aria-relevant="additions" aria-label="Messages" className="space-y-3">
        {t.messages.map((m) => (
          <Message key={m.id} message={m} mine={m.author === 'AGENT'} agentView />
        ))}
      </ol>

      <form
        className="space-y-3 border-t border-[var(--color-border)] pt-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (reply.trim()) send.mutate()
        }}
      >
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Réponse au commerçant</span>
          <textarea required maxLength={5000} rows={5} value={reply} onChange={(e) => setReply(e.target.value)} className={`${field} py-2.5`} />
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1.5">
            <span className="block text-sm font-medium">Après l’envoi</span>
            <select value={after} onChange={(e) => setAfter(e.target.value as SupportStatus)} className={`${field} h-11 sm:w-64`}>
              <option value="WAITING_CUSTOMER">En attente du commerçant</option>
              <option value="RESOLVED">Résolue</option>
              <option value="OPEN">Reste à traiter</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={send.isPending || !reply.trim()}
            className="press ml-auto h-11 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 text-[15px] font-semibold text-[var(--color-on-accent)] disabled:opacity-50"
          >
            {send.isPending ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
      </form>
    </div>
  )
}
