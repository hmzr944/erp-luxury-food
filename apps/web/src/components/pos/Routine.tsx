'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { CheckCircle, Circle, ClockCountdown, LockSimple, Warning, WifiSlash } from '@phosphor-icons/react'
import { hhmm, routineApi, type RoutineStatus, type RoutineTask } from '@/lib/api/routine'
import { FlowMark } from '@/components/brand/FlowLogo'
import { PinPad } from '@/components/auth/PinPad'
import { EASE_OUT } from '@/lib/motion'
import { Sheet } from './Sheet'

export function useRoutine(siteId: string, online: boolean) {
  return useQuery({
    queryKey: ['routine', siteId],
    queryFn: () => routineApi.status(siteId),
    enabled: online,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  })
}

// Inactivité de la caisse (aucun toucher, aucune touche) depuis `ms`
export function useIdle(ms: number) {
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    let t = window.setTimeout(() => setIdle(true), ms)
    const wake = () => {
      setIdle(false)
      window.clearTimeout(t)
      t = window.setTimeout(() => setIdle(true), ms)
    }
    const events = ['pointerdown', 'keydown'] as const
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }))
    return () => {
      window.clearTimeout(t)
      events.forEach((e) => window.removeEventListener(e, wake))
    }
  }, [ms])
  return idle
}

const pendingOf = (s?: RoutineStatus) => (s ? s.tasks.filter((t) => !t.done) : [])

// Niveau 1 et 2 : un bandeau fin sous l'en-tête, jamais bloquant
export function RoutineBanner({ status, onOpen }: { status?: RoutineStatus; onOpen: () => void }) {
  const pending = pendingOf(status)
  if (!status || status.level === 0 || !pending.length) return null
  const next = pending[0]
  const late = status.level >= 2
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, transform: 'translateY(-6px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
      className={[
        'flex w-full items-center gap-3 px-4 py-2 text-left text-sm sm:px-6',
        late ? 'bg-[var(--color-bg-inverse)] text-[var(--color-text-inverse)]' : 'bg-[var(--color-accent-muted)] text-[var(--color-text-primary)]',
      ].join(' ')}
    >
      {late ? <Warning size={18} aria-hidden className="shrink-0" /> : <ClockCountdown size={18} aria-hidden className="shrink-0 text-[var(--color-accent)]" />}
      <span className="min-w-0 flex-1 truncate">
        {late ? (
          <>
            <strong className="font-semibold">Fin de journée</strong> : {pending.length === 1 ? '1 tâche à faire' : `${pending.length} tâches à faire`}
          </>
        ) : (
          <>
            <strong className="font-semibold">{next.label}</strong> avant {hhmm(next.deadlineAt)}
            <span className="hidden sm:inline"> · fermeture à {hhmm(status.closingAt)}</span>
          </>
        )}
      </span>
      <span className="shrink-0 font-semibold underline-offset-4 hover:underline">Voir la liste</span>
    </motion.button>
  )
}

function TaskRow({ task, onToggle }: { task: RoutineTask; onToggle: (done: boolean) => void }) {
  const when = task.done
    ? task.doneAt
      ? `${task.kind === 'SUPPLY' ? 'Envoyée' : 'Fait'} à ${hhmm(task.doneAt)}${task.doneBy ? ` par ${task.doneBy}` : ''}`
      : 'Rien à clôturer'
    : `${task.overdue ? 'En retard, prévu' : 'Avant'} ${hhmm(task.deadlineAt)}`
  return (
    <li className="flex items-center gap-3 py-3">
      {task.done ? (
        <CheckCircle size={26} weight="fill" aria-hidden className="shrink-0 text-[var(--color-accent)]" />
      ) : (
        <Circle size={26} aria-hidden className={['shrink-0', task.overdue ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'].join(' ')} />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium">{task.label}</p>
        <p className={['text-sm', task.overdue ? 'font-medium text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'].join(' ')}>{when}</p>
      </div>
      {task.kind === 'CUSTOM' && (
        <button
          type="button"
          onClick={() => onToggle(!task.done)}
          className="h-11 shrink-0 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-sm font-semibold press"
        >
          {task.done ? 'Annuler' : 'Fait'}
        </button>
      )}
      {task.kind === 'SUPPLY' && !task.done && (
        <Link href="/supply" className="inline-flex h-11 shrink-0 items-center rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-sm font-semibold press">
          Commander
        </Link>
      )}
    </li>
  )
}

// Niveau 2 : la liste de fin de journée, à l'inactivité ou au verrouillage
export function ClosingChecklist({
  open,
  siteId,
  status,
  lockIntent,
  onClose,
  onCloseCash,
  onLock,
  onUpdate,
}: {
  open: boolean
  siteId: string
  status?: RoutineStatus
  lockIntent: boolean
  onClose: () => void
  onCloseCash: () => void
  onLock: () => void
  onUpdate: (s: RoutineStatus) => void
}) {
  const [error, setError] = useState<string | null>(null)
  if (!status) return null
  const cash = status.tasks.find((t) => t.kind === 'CASH')
  const pending = pendingOf(status)
  return (
    <Sheet open={open} title={pending.length ? 'Fin de journée' : 'Tout est fait'} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-[var(--color-text-secondary)]">Fermeture à {hhmm(status.closingAt)}.</p>
        <ul className="divide-y divide-[var(--color-border)]">
          {status.tasks.map((t) => (
            <TaskRow
              key={t.key}
              task={t}
              onToggle={async (done) => {
                setError(null)
                try {
                  onUpdate(await routineApi.check(siteId, t.key, done))
                } catch (e) {
                  setError((e as Error).message)
                }
              }}
            />
          ))}
        </ul>
        {error && (
          <p role="alert" className="alert-box">
            {error}
          </p>
        )}
        {cash && !cash.done && (
          <button
            type="button"
            data-autofocus
            onClick={onCloseCash}
            className="h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)] press"
          >
            Lancer la clôture de caisse
          </button>
        )}
        {lockIntent ? (
          <button type="button" onClick={onLock} className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-[15px] font-semibold press">
            <LockSimple size={18} aria-hidden /> {pending.length ? 'Verrouiller quand même' : 'Verrouiller la caisse'}
          </button>
        ) : (
          <button type="button" onClick={onClose} className="h-11 w-full text-sm font-medium text-[var(--color-text-secondary)]">
            Plus tard
          </button>
        )}
      </div>
    </Sheet>
  )
}

// Caisse verrouillée : déverrouillage par le code d'un membre de l'équipe
export function LockScreen({
  reason,
  error,
  online = true,
  onUnlock,
}: {
  reason: 'manual' | 'unclosed' | 'reauth'
  error: string | null
  online?: boolean
  onUnlock: (pin: string) => Promise<void>
}) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(t)
  }, [])
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="lock-title" className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-[var(--color-bg-base)] p-4">
      <div className="w-full max-w-sm space-y-6 py-8 text-center">
        <FlowMark size={44} className="mx-auto" />
        <p className="tabular font-display text-5xl font-bold tracking-[-0.03em]">{now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
        <div className="space-y-1">
          <h1 id="lock-title" className="flex items-center justify-center gap-2 text-xl font-semibold">
            <LockSimple size={22} aria-hidden /> Caisse verrouillée
          </h1>
          <p className="text-[15px] text-[var(--color-text-secondary)]">
            {reason === 'unclosed'
              ? 'La journée n’a pas été clôturée après la fermeture. Le gérant a été prévenu. Entrez votre code pour clôturer la caisse.'
              : reason === 'reauth'
                ? 'La connexion est revenue. Entrez votre code pour confirmer votre session.'
                : 'Entrez votre code pour reprendre.'}
          </p>
        </div>
        {!online && (
          <p className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2 text-left text-sm text-[var(--color-text-secondary)]">
            <WifiSlash size={18} aria-hidden className="mt-0.5 shrink-0" />
            <span>Sans réseau : la caisse reconnaît les codes déjà utilisés ici ces 7 derniers jours, pour vendre seulement.</span>
          </p>
        )}
        <div className="text-left">
          <PinPad error={error} onSubmit={onUnlock} />
        </div>
      </div>
    </div>
  )
}

// Le matin : la caisse d'hier est restée ouverte. On ne bloque pas la
// journée : on la clôture d'abord, en comptant le tiroir tel qu'il a été laissé.
export function YesterdayClosure({ day, onStart }: { day: string; onStart: () => void }) {
  const label = new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="retro-title" className="fixed inset-0 z-40 grid place-items-center bg-[var(--scrim)] p-4">
      <motion.div
        initial={{ opacity: 0, transform: 'scale(0.97)' }}
        animate={{ opacity: 1, transform: 'scale(1)' }}
        transition={{ duration: 0.2, ease: EASE_OUT }}
        className="w-full max-w-md space-y-4 rounded-[var(--radius-xl)] bg-[var(--color-bg-elevated)] p-6 shadow-2xl"
      >
        <ClockCountdown size={32} aria-hidden className="text-[var(--color-accent)]" />
        <h2 id="retro-title" className="text-xl font-semibold">
          La caisse du {label} n’a pas été clôturée
        </h2>
        <p className="text-[15px] text-[var(--color-text-secondary)]">
          Comptez le tiroir tel qu’il a été laissé : trente secondes, puis la journée commence. La clôture sera notée à votre nom, avec l’heure.
        </p>
        <button
          type="button"
          data-autofocus
          onClick={onStart}
          className="h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)] press"
        >
          Clôturer cette journée
        </button>
      </motion.div>
    </div>
  )
}
