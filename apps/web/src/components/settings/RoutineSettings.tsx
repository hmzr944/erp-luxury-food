'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { sitesApi } from '@/lib/api/sites'
import { routineApi, type RoutineSettings as Settings } from '@/lib/api/routine'

const field = 'h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 text-[15px] focus:border-[var(--color-accent)]'
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

type Draft = Omit<Settings, 'configured' | 'canOrderSupply'>

// Studio de routines : heure de fermeture et tâches de fin de journée,
// rappelées sur la caisse sans interrompre une vente
export function RoutineSettings() {
  const qc = useQueryClient()
  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: sitesApi.getAll })
  const [siteId, setSiteId] = useState('')
  const site = siteId || sites[0]?.id || ''
  const settings = useQuery({ queryKey: ['routine-settings', site], queryFn: () => routineApi.settings(site), enabled: !!site })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [emails, setEmails] = useState('')

  useEffect(() => {
    if (!settings.data) return
    const { configured, canOrderSupply, ...rest } = settings.data
    void configured
    void canOrderSupply
    // Première visite : on propose d'activer, réglages de base
    setDraft({ ...rest, enabled: settings.data.configured ? rest.enabled : true })
    setEmails(rest.notifyEmails.join(', '))
  }, [settings.data])

  const save = useMutation({
    mutationFn: (d: Draft) => routineApi.update(site, { ...d, notifyEmails: emails.split(/[,;\s]+/).filter(Boolean) }),
    onSuccess: (s) => {
      qc.setQueryData(['routine-settings', site], s)
      void qc.invalidateQueries({ queryKey: ['routine', site] })
      toast.success('Routine enregistrée')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d))

  return (
    <div className="max-w-3xl space-y-8 p-6 md:p-8">
      <header className="space-y-1">
        <h1 className="page-title">Routines et rappels</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          L’heure de fermeture et ce qu’il faut avoir fait avant. La caisse le rappelle d’abord par un bandeau discret, puis par une liste quand elle est inactive, et prévient le gérant si la journée n’est pas clôturée.
        </p>
      </header>

      {sites.length > 1 && (
        <label className="block space-y-2">
          <span className="block text-sm font-medium">Boutique</span>
          <select value={site} onChange={(e) => setSiteId(e.target.value)} className={`${field} sm:w-72`}>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {draft && (
        <form
          className="space-y-8"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate(draft)
          }}
        >
          <label className="flex items-center gap-3 text-[15px] font-medium">
            <input type="checkbox" className="size-5 accent-[var(--color-accent)]" checked={draft.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
            Rappels de fermeture sur la caisse
          </label>

          <fieldset className="space-y-4" disabled={!draft.enabled}>
            <legend className="mb-3 text-lg font-semibold">Fermeture</legend>
            <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Heure de fermeture</span>
                <input type="time" required className={`${field} tabular`} value={draft.closingTime} onChange={(e) => set({ closingTime: e.target.value })} />
              </label>
              <div className="space-y-1.5">
                <span className="text-sm font-medium" id="days-label">
                  Jours d’ouverture
                </span>
                <div role="group" aria-labelledby="days-label" className="flex flex-wrap gap-1.5">
                  {DAYS.map((d, i) => {
                    const on = draft.days.includes(i + 1)
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set({ days: on ? draft.days.filter((x) => x !== i + 1) : [...draft.days, i + 1].sort() })}
                        className={[
                          'h-11 min-w-12 rounded-[var(--radius-pill)] border px-3 text-sm font-medium press',
                          on ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)]' : 'border-[var(--color-border-strong)] text-[var(--color-text-secondary)]',
                        ].join(' ')}
                      >
                        {d}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3" disabled={!draft.enabled}>
            <legend className="mb-3 text-lg font-semibold">Avant de fermer</legend>
            <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)]">
              {settings.data?.canOrderSupply && (
                <TaskLine
                  label="Commande fournisseur envoyée"
                  hint="Labo, dépôt ou centrale : rappel si la commande n’est pas partie."
                  active={!!draft.supplyDeadline}
                  time={draft.supplyDeadline ?? '18:00'}
                  onActive={(on) => set({ supplyDeadline: on ? '18:00' : null })}
                  onTime={(t) => set({ supplyDeadline: t })}
                />
              )}
              <TaskLine
                label="Comptage et clôture de la caisse"
                hint="Toujours rappelée. Sans heure : à la fermeture."
                active
                fixed
                time={draft.cashDeadline ?? draft.closingTime}
                onTime={(t) => set({ cashDeadline: t })}
              />
              {draft.tasks.map((t, i) => (
                <li key={t.key} className="flex flex-wrap items-end gap-3 px-4 py-3">
                  <label className="min-w-0 flex-1 space-y-1">
                    <span className="sr-only">Tâche</span>
                    <input className={field} value={t.label} maxLength={80} onChange={(e) => set({ tasks: draft.tasks.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                  </label>
                  <label className="w-32 space-y-1">
                    <span className="text-sm font-medium">Avant</span>
                    <input type="time" className={`${field} tabular`} value={t.deadline ?? ''} onChange={(e) => set({ tasks: draft.tasks.map((x, j) => (j === i ? { ...x, deadline: e.target.value || null } : x)) })} />
                  </label>
                  <button type="button" aria-label={`Retirer « ${t.label} »`} onClick={() => set({ tasks: draft.tasks.filter((_, j) => j !== i) })} className="grid size-11 place-items-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]">
                    <Trash size={18} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              {['Vitrine rangée', 'Lumières de la vitrine éteintes', 'Terminal de paiement en charge', 'Commande client à préparer'].filter((l) => !draft.tasks.some((t) => t.label === l)).slice(0, 3).map((l) => (
                <button key={l} type="button" onClick={() => set({ tasks: [...draft.tasks, { key: '', label: l, deadline: null }] })} className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] px-4 text-sm font-medium press">
                  <Plus size={16} aria-hidden /> {l}
                </button>
              ))}
              <button type="button" onClick={() => set({ tasks: [...draft.tasks, { key: '', label: 'Nouvelle tâche', deadline: null }] })} className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-pill)] border border-dashed border-[var(--color-border-strong)] px-4 text-sm font-medium press">
                <Plus size={16} aria-hidden /> Autre tâche
              </button>
            </div>
          </fieldset>

          <fieldset className="space-y-4" disabled={!draft.enabled}>
            <legend className="mb-3 text-lg font-semibold">Rappels</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Bandeau discret, avant l’échéance</span>
                <select className={field} value={draft.reminderMinutes} onChange={(e) => set({ reminderMinutes: Number(e.target.value) })}>
                  {[15, 30, 45, 60].map((m) => (
                    <option key={m} value={m}>
                      {m} minutes avant
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Caisse oubliée : alerte au gérant</span>
                <select className={field} value={draft.alertAfterMinutes} onChange={(e) => set({ alertAfterMinutes: Number(e.target.value) })}>
                  {[30, 60, 90, 120].map((m) => (
                    <option key={m} value={m}>
                      {m === 60 ? '1 heure' : m === 120 ? '2 heures' : `${m} minutes`} après la fermeture
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex items-start gap-3 text-[15px]">
              <input type="checkbox" className="mt-0.5 size-5 accent-[var(--color-accent)]" checked={draft.autoLock} onChange={(e) => set({ autoLock: e.target.checked })} />
              <span>
                Verrouiller la caisse oubliée
                <span className="block text-sm text-[var(--color-text-secondary)]">Plus d’encaissement possible sans le code d’un membre de l’équipe.</span>
              </span>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">E-mails d’alerte</span>
              <input className={field} inputMode="email" placeholder="Vides : propriétaires et gérants de la boutique" value={emails} onChange={(e) => setEmails(e.target.value)} />
            </label>
          </fieldset>

          <button
            type="submit"
            disabled={save.isPending}
            className="inline-flex h-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 text-[15px] font-semibold text-[var(--color-on-accent)] press disabled:opacity-60"
          >
            Enregistrer
          </button>
        </form>
      )}
    </div>
  )
}

function TaskLine({ label, hint, active, fixed, time, onActive, onTime }: { label: string; hint: string; active: boolean; fixed?: boolean; time: string; onActive?: (on: boolean) => void; onTime: (t: string) => void }) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <label className="flex min-w-0 flex-1 items-start gap-3">
        <input type="checkbox" className="mt-0.5 size-5 accent-[var(--color-accent)]" checked={active} disabled={fixed} onChange={(e) => onActive?.(e.target.checked)} />
        <span>
          <span className="block text-[15px] font-medium">{label}</span>
          <span className="block text-sm text-[var(--color-text-secondary)]">{hint}</span>
        </span>
      </label>
      {active && (
        <label className="w-32 space-y-1">
          <span className="text-sm font-medium">Avant</span>
          <input type="time" className={`${field} tabular`} value={time} onChange={(e) => onTime(e.target.value)} />
        </label>
      )}
    </li>
  )
}
