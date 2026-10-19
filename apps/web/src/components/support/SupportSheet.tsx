'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CaretLeft, CaretRight, Check, Checks, Clock, Phone, PlugsConnected, ChatCircleText, WarningOctagon, MoonStars } from '@phosphor-icons/react'
import { Sheet } from '@/components/pos/Sheet'
import { useAuthStore } from '@/stores/auth.store'
import { supportApi, useSupportInfo, useSupportUnread, type SupportContext, type SupportInfo, type SupportMessage, type SupportThread, type SupportThreadSummary } from '@/lib/api/support'
import { collectContext, installErrorCapture, openSupport, useSupportPanel } from '@/lib/support/context'
import { MERCHANT_STATUS, formatMessageTime, formatWhen } from '@/lib/support/format'

const field =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 text-[16px] focus:border-[var(--color-accent)]'
const URGENT_SUBJECT = 'La caisse ne peut plus encaisser'

type View = { name: 'home' } | { name: 'new'; urgent: boolean } | { name: 'thread'; id: string }

// Panneau « Aide et support », monté une fois pour toute l'application et
// ouvert depuis la barre latérale, le menu de la caisse ou un lien
export function SupportHost() {
  const { open, start, hide } = useSupportPanel()
  useEffect(() => installErrorCapture(), [])
  return (
    <>
      <ReplyNotifier />
      <Sheet open={open} title="Aide et support" onClose={hide} width="lg">
        {open && <SupportPanel start={start} />}
      </Sheet>
    </>
  )
}

// Pages sans compte connecté : écran client, ticket, paiement, connexion
const PUBLIC = ['/login', '/inscription', '/display', '/r/', '/pickup', '/invoice', '/paiement', '/tpe']

// Réponse de l'équipe arrivée pendant qu'on travaille (caisse comprise) :
// une notification discrète, qui ne coupe pas la vente
function ReplyNotifier() {
  const pathname = usePathname()
  const signedIn = useAuthStore((s) => !!s.user)
  const open = useSupportPanel((s) => s.open)
  const enabled = signedIn && pathname !== '/' && !PUBLIC.some((p) => pathname.startsWith(p))
  const count = useSupportUnread(enabled).data?.count
  const previous = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (count === undefined) return
    if (previous.current !== undefined && count > previous.current && !open) {
      toast('Nouvelle réponse de l’équipe FLŌW', { action: { label: 'Lire', onClick: () => openSupport() } })
    }
    previous.current = count
  }, [count, open])
  return null
}

function SupportPanel({ start }: { start: { urgent?: boolean; threadId?: string } | null }) {
  const [view, setView] = useState<View>(
    start?.threadId ? { name: 'thread', id: start.threadId } : start?.urgent ? { name: 'new', urgent: true } : { name: 'home' },
  )
  const info = useSupportInfo()
  const heading = useRef<HTMLHeadingElement>(null)
  const first = useRef(true)

  // Changement de vue : le lecteur d'écran et le clavier repartent du titre
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    heading.current?.focus()
  }, [view])

  return (
    <div className="pb-2">
      {view.name === 'home' && <Home info={info.data} loading={info.isLoading} headingRef={heading} onNew={(urgent) => setView({ name: 'new', urgent })} onOpen={(id) => setView({ name: 'thread', id })} />}
      {view.name === 'new' && (
        <NewRequest info={info.data} urgent={view.urgent} headingRef={heading} onBack={() => setView({ name: 'home' })} onCreated={(id) => setView({ name: 'thread', id })} />
      )}
      {view.name === 'thread' && <Conversation id={view.id} headingRef={heading} onBack={() => setView({ name: 'home' })} />}
    </div>
  )
}

// --- Accueil : promesse, urgence, demandes en cours ----------------------

function Availability({ info }: { info: SupportInfo }) {
  if (!info.hoursConfigured) return null
  return (
    <p className="flex items-center gap-2 text-[15px] text-[var(--color-text-secondary)]">
      {info.openNow ? (
        <>
          <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
          L’équipe est disponible en ce moment
        </>
      ) : (
        <>
          <MoonStars size={18} aria-hidden className="shrink-0" />
          {info.nextOpenAt ? `L’équipe revient ${formatWhen(info.nextOpenAt)}` : 'L’équipe est absente en ce moment'}
        </>
      )}
    </p>
  )
}

function Home({
  info,
  loading,
  headingRef,
  onNew,
  onOpen,
}: {
  info?: SupportInfo
  loading: boolean
  headingRef: React.RefObject<HTMLHeadingElement | null>
  onNew: (urgent: boolean) => void
  onOpen: (id: string) => void
}) {
  const threads = useQuery({ queryKey: ['support', 'threads'], queryFn: supportApi.threads, refetchInterval: 30_000 })
  const list = threads.data ?? []

  return (
    <div className="space-y-5">
      <h3 ref={headingRef} tabIndex={-1} className="sr-only">
        Accueil de l’aide
      </h3>

      <section aria-label="Délai de réponse" className="space-y-2 rounded-[var(--radius-lg)] bg-[var(--color-bg-elevated)] p-4" aria-busy={loading}>
        {loading ? (
          <div className="h-12 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-bg-hover)]" />
        ) : info ? (
          <>
            <p className="font-display text-[19px] font-semibold leading-snug text-balance">{info.promise ?? 'L’équipe FLŌW vous répond ici.'}</p>
            <Availability info={info} />
            {info.trialContact && (
              <p className="pt-1 text-[15px]">
                Pendant votre essai, votre contact est <strong className="font-semibold">{info.trialContact.name}</strong>
                {info.trialContact.phone && (
                  <>
                    {' '}
                    au{' '}
                    <a href={`tel:${info.trialContact.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 font-semibold underline underline-offset-2">
                      <Phone size={16} aria-hidden />
                      {info.trialContact.phone}
                    </a>
                  </>
                )}
                .
              </p>
            )}
          </>
        ) : (
          <p className="text-[15px] text-[var(--color-text-secondary)]">Informations du support indisponibles. Vous pouvez quand même écrire.</p>
        )}
      </section>

      <button
        type="button"
        onClick={() => onNew(true)}
        className="press flex w-full items-center gap-4 rounded-[var(--radius-lg)] bg-[var(--color-bg-inverse)] p-4 text-left text-[var(--color-text-inverse)]"
      >
        <WarningOctagon size={30} weight="fill" aria-hidden className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-semibold">{URGENT_SUBJECT}</span>
          <span className="block text-sm opacity-80">{info?.urgentPromise ? `Traitée en priorité. ${info.urgentPromise}.` : 'Traitée en priorité par l’équipe.'}</span>
        </span>
        <CaretRight size={20} aria-hidden className="shrink-0" />
      </button>

      <button
        type="button"
        onClick={() => onNew(false)}
        className="press flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-[15px] font-semibold hover:bg-[var(--color-bg-hover)]"
      >
        <ChatCircleText size={20} aria-hidden />
        Poser une question
      </button>

      {list.length > 0 && (
        <section aria-labelledby="support-threads" className="space-y-2">
          <h3 id="support-threads" className="text-sm font-semibold text-[var(--color-text-secondary)]">
            Demandes de votre commerce
          </h3>
          <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)]">
            {list.map((t) => (
              <li key={t.id}>
                <ThreadRow thread={t} onOpen={() => onOpen(t.id)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function ThreadRow({ thread: t, onOpen }: { thread: SupportThreadSummary; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--color-bg-hover)]">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          {t.priority === 'URGENT' && <WarningOctagon size={16} weight="fill" role="img" aria-label="Urgente" className="shrink-0" />}
          <span className={`truncate text-[15px] ${t.unread ? 'font-semibold' : 'font-medium'}`}>{t.subject}</span>
        </span>
        <span className="block truncate text-sm text-[var(--color-text-secondary)]">
          {MERCHANT_STATUS[t.status]}
          {t.dueAt && `, réponse attendue avant ${formatWhen(t.dueAt)}`}
        </span>
      </span>
      {t.unread > 0 && (
        <span className="shrink-0 rounded-[var(--radius-pill)] bg-[var(--color-accent)] px-2 py-0.5 text-xs font-semibold text-[var(--color-on-accent)]">
          {t.unread} {t.unread > 1 ? 'nouvelles' : 'nouvelle'}
        </span>
      )}
      <CaretRight size={18} aria-hidden className="shrink-0 text-[var(--color-text-muted)]" />
    </button>
  )
}

// --- Nouvelle demande -------------------------------------------------

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className="-ml-2 flex h-11 items-center gap-1 rounded-[var(--radius-pill)] px-2 text-[15px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]">
      <CaretLeft size={18} aria-hidden />
      Retour
    </button>
  )
}

const CONTEXT_LABELS: Array<[keyof SupportContext, string]> = [
  ['siteName', 'Boutique'],
  ['terminalName', 'Caisse'],
  ['page', 'Page'],
  ['online', 'Réseau'],
  ['appVersion', 'Version'],
  ['screen', 'Écran'],
]

export function ContextList({ context }: { context: SupportContext }) {
  const rows = CONTEXT_LABELS.filter(([k]) => context[k] !== undefined && context[k] !== '')
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
      {rows.map(([k, label]) => (
        <div key={k} className="contents">
          <dt className="text-[var(--color-text-secondary)]">{label}</dt>
          <dd className="truncate">{k === 'online' ? (context.online ? 'En ligne' : 'Hors ligne') : String(context[k])}</dd>
        </div>
      ))}
      {!!context.errors?.length && (
        <div className="contents">
          <dt className="text-[var(--color-text-secondary)]">Erreurs</dt>
          <dd className="truncate">{context.errors.length} récente{context.errors.length > 1 ? 's' : ''}</dd>
        </div>
      )}
    </dl>
  )
}

function useOnline() {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}

function NewRequest({
  info,
  urgent,
  headingRef,
  onBack,
  onCreated,
}: {
  info?: SupportInfo
  urgent: boolean
  headingRef: React.RefObject<HTMLHeadingElement | null>
  onBack: () => void
  onCreated: (id: string) => void
}) {
  const pathname = usePathname()
  const qc = useQueryClient()
  const online = useOnline()
  const [subject, setSubject] = useState(urgent ? URGENT_SUBJECT : '')
  const [body, setBody] = useState('')
  const [ctx, setCtx] = useState<{ siteId?: string; context: SupportContext } | null>(null)
  useEffect(() => {
    void collectContext(pathname).then(setCtx)
  }, [pathname])

  const send = useMutation({
    mutationFn: async () => {
      // Contexte relu à l'envoi : réseau et erreurs à jour
      const fresh = await collectContext(pathname)
      return supportApi.create({ subject: subject.trim(), body: body.trim(), priority: urgent ? 'URGENT' : 'NORMAL', siteId: fresh.siteId, context: fresh.context })
    },
    onSuccess: (t) => {
      qc.setQueryData(['support', 'thread', t.id], t)
      void qc.invalidateQueries({ queryKey: ['support', 'threads'] })
      toast.success(urgent ? 'Demande urgente envoyée' : 'Demande envoyée')
      onCreated(t.id)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (subject.trim() && body.trim()) send.mutate()
      }}
    >
      <BackButton onBack={onBack} />
      <div className="space-y-1">
        <h3 ref={headingRef} tabIndex={-1} className="flex items-center gap-2 font-display text-[19px] font-semibold">
          {urgent && <WarningOctagon size={22} weight="fill" aria-hidden />}
          {urgent ? 'Urgence caisse' : 'Nouvelle demande'}
        </h3>
        {urgent && info?.urgentPromise && <p className="text-[15px] text-[var(--color-text-secondary)]">{info.urgentPromise}. Décrivez ce que vous voyez à l’écran.</p>}
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Sujet</span>
        <input required maxLength={140} value={subject} onChange={(e) => setSubject(e.target.value)} className={`${field} h-11`} autoComplete="off" data-autofocus={!urgent || undefined} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Message</span>
        <textarea
          required
          maxLength={5000}
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          data-autofocus={urgent || undefined}
          placeholder={urgent ? 'Ex. le TPE affiche « transaction refusée » pour toutes les cartes' : 'Ce que vous faisiez et ce qui s’est passé'}
          className={`${field} min-h-32 py-2.5`}
        />
      </label>

      <details className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2">
        <summary className="cursor-pointer py-1 text-sm font-medium">Joint automatiquement, inutile de le préciser</summary>
        <div className="pt-2 pb-1">{ctx ? <ContextList context={ctx.context} /> : <p className="text-sm text-[var(--color-text-secondary)]">Lecture…</p>}</div>
      </details>

      {!online && (
        <p role="status" className="flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent-muted)] p-3 text-[15px]">
          <PlugsConnected size={20} aria-hidden className="mt-0.5 shrink-0" />
          Pas de connexion internet : la demande ne peut pas partir pour l’instant. Gardez ce panneau ouvert et envoyez-la dès le retour du réseau.
        </p>
      )}

      <button
        type="submit"
        disabled={send.isPending || !online || !subject.trim() || !body.trim()}
        className="press flex h-12 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] text-[16px] font-semibold text-[var(--color-on-accent)] disabled:opacity-50"
      >
        {send.isPending ? 'Envoi…' : urgent ? 'Envoyer en urgence' : 'Envoyer la demande'}
      </button>
    </form>
  )
}

// --- Conversation -----------------------------------------------------

function Conversation({ id, headingRef, onBack }: { id: string; headingRef: React.RefObject<HTMLHeadingElement | null>; onBack: () => void }) {
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user?.id)
  const online = useOnline()
  const thread = useQuery({ queryKey: ['support', 'thread', id], queryFn: () => supportApi.thread(id), refetchInterval: 15_000 })
  const [reply, setReply] = useState('')
  const end = useRef<HTMLLIElement>(null)
  const t = thread.data

  // Réponses de l'équipe lues dès qu'elles sont affichées
  const unread = t?.messages.some((m) => m.author !== 'USER' && !m.readAt) ?? false
  useEffect(() => {
    if (!unread) return
    void supportApi.read(id).then(() => {
      void qc.invalidateQueries({ queryKey: ['support', 'unread'] })
      void qc.invalidateQueries({ queryKey: ['support', 'threads'] })
    })
  }, [unread, id, qc])

  const count = t?.messages.length ?? 0
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' })
  }, [count])

  const send = useMutation({
    mutationFn: () => supportApi.post(id, reply.trim()),
    onSuccess: (next: SupportThread) => {
      qc.setQueryData(['support', 'thread', id], next)
      void qc.invalidateQueries({ queryKey: ['support', 'threads'] })
      setReply('')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-4">
      <BackButton onBack={onBack} />
      {!t ? (
        thread.isError ? (
          <p role="alert" className="text-[15px]">Cette demande est introuvable.</p>
        ) : (
          <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-bg-elevated)]" aria-busy="true" aria-label="Chargement de la conversation" />
        )
      ) : (
        <>
          <header className="space-y-2">
            <h3 ref={headingRef} tabIndex={-1} className="font-display text-[19px] font-semibold leading-snug text-balance">
              {t.subject}
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {t.priority === 'URGENT' && (
                <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-bg-inverse)] px-2.5 py-1 font-semibold text-[var(--color-text-inverse)]">
                  <WarningOctagon size={14} weight="fill" aria-hidden /> Urgente
                </span>
              )}
              <span className="rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] px-2.5 py-1 font-medium">{MERCHANT_STATUS[t.status]}</span>
              {t.dueAt && (
                <span className="inline-flex items-center gap-1 text-[var(--color-text-secondary)]">
                  <Clock size={16} aria-hidden />
                  {new Date(t.dueAt) > new Date() ? `Réponse attendue avant ${formatWhen(t.dueAt)}` : `Réponse attendue depuis ${formatWhen(t.dueAt)}`}
                </span>
              )}
            </div>
          </header>

          <ol role="log" aria-live="polite" aria-relevant="additions" aria-label="Messages" className="space-y-3">
            {t.messages.map((m) => (
              <Message key={m.id} message={m} mine={m.author === 'USER' && t.userId === me} />
            ))}
            <li ref={end} aria-hidden className="h-px" />
          </ol>

          <form
            className="space-y-2 border-t border-[var(--color-border)] pt-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (reply.trim()) send.mutate()
            }}
          >
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">{t.status === 'RESOLVED' ? 'Le problème revient ? Écrivez ici, la demande sera rouverte' : 'Votre message'}</span>
              <textarea required maxLength={5000} rows={3} value={reply} onChange={(e) => setReply(e.target.value)} className={`${field} py-2.5`} />
            </label>
            <button
              type="submit"
              disabled={send.isPending || !online || !reply.trim()}
              className="press flex h-12 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] text-[16px] font-semibold text-[var(--color-on-accent)] disabled:opacity-50 sm:ml-auto sm:w-auto sm:px-6"
            >
              {send.isPending ? 'Envoi…' : online ? 'Envoyer' : 'Hors ligne'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}

export function Message({ message: m, mine, agentView }: { message: SupportMessage; mine: boolean; agentView?: boolean }) {
  if (m.author === 'SYSTEM') {
    return <li className="px-6 text-center text-sm text-[var(--color-text-secondary)] text-pretty">{m.body}</li>
  }
  const fromAgent = m.author === 'AGENT'
  // Côté commerçant, ses messages à droite ; côté équipe, ceux de l'équipe
  const right = agentView ? fromAgent : m.author === 'USER'
  const who = agentView ? (fromAgent ? `${m.authorName}, équipe FLŌW` : m.authorName) : fromAgent ? `${m.authorName}, équipe FLŌW` : mine ? 'Vous' : m.authorName
  // Accusé de lecture : sur les messages envoyés par celui qui regarde
  const showRead = agentView ? fromAgent : m.author === 'USER'
  return (
    <li className={`flex flex-col gap-1 ${right ? 'items-end' : 'items-start'}`}>
      <span className="text-xs font-medium text-[var(--color-text-secondary)]">
        {who}, <time dateTime={m.createdAt}>{formatMessageTime(m.createdAt)}</time>
      </span>
      <p
        className={[
          'max-w-[85%] whitespace-pre-wrap break-words rounded-[var(--radius-lg)] px-3.5 py-2.5 text-[15px] leading-relaxed',
          right ? 'bg-[var(--color-accent-muted)]' : 'bg-[var(--color-bg-elevated)]',
        ].join(' ')}
      >
        {m.body}
      </p>
      {showRead && (
        <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
          {m.readAt ? <Checks size={14} aria-hidden /> : <Check size={14} aria-hidden />}
          {m.readAt ? 'Lu' : 'Envoyé'}
        </span>
      )}
    </li>
  )
}
