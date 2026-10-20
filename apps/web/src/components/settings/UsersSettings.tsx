'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api/client'
import { sitesApi } from '@/lib/api/sites'
import { useAuthStore } from '@/stores/auth.store'
import { ROLE_LABEL, type AppRole } from '@/lib/workspace'
import { BadgeSheet } from './BadgeSheet'
import { MemberSites } from './MemberSites'

interface TeamMember {
  id: string
  email: string
  firstName: string
  lastName: string
  role: AppRole
  pinSetAt: string | null
  badgeKind: string | null
  badgeSetAt: string | null
  sites: Array<{ siteId: string }>
}

const ROLE_HELP: Record<AppRole, string> = {
  SELLER: 'La caisse et le réassort de ses boutiques, sans chiffres globaux',
  PRODUCTION: "L'écran de production du labo ou du dépôt, sans ventes",
  MANAGER: 'Tout, sauf l’abonnement',
  OWNER: 'Tout, abonnement compris',
}
const ROLES: AppRole[] = ['SELLER', 'PRODUCTION', 'MANAGER', 'OWNER']

const field =
  'h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 text-[15px] focus:border-[var(--color-accent)]'

// Équipe : chacun son rôle, ses boutiques et son code de caisse à 4 chiffres
export function UsersSettings() {
  const qc = useQueryClient()
  const { user: me } = useAuthStore()
  const canManage = me?.role === 'OWNER' || me?.role === 'MANAGER'
  const [showInvite, setShowInvite] = useState(false)
  const empty = { email: '', firstName: '', lastName: '', role: 'SELLER' as AppRole, password: '', siteIds: [] as string[] }
  const [form, setForm] = useState(empty)
  const [shownPin, setShownPin] = useState<{ id: string; pin: string } | null>(null)
  const [badgeFor, setBadgeFor] = useState<TeamMember | null>(null)

  const { data: users = [], isLoading } = useQuery({ queryKey: ['users-settings'], queryFn: () => apiClient<TeamMember[]>('/users') })
  const sites = useQuery({ queryKey: ['sites'], queryFn: sitesApi.getAll })
  const siteName = (id: string) => sites.data?.find((s) => s.id === id)?.name ?? ''
  const refresh = () => qc.invalidateQueries({ queryKey: ['users-settings'] })

  const invite = useMutation({
    mutationFn: (data: typeof form) => apiClient('/users', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      void refresh()
      toast.success('Membre ajouté')
      setShowInvite(false)
      setForm(empty)
    },
    onError: (err: Error) => toast.error(err.message),
  })
  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => apiClient(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    onSuccess: () => {
      void refresh()
      toast.success('Rôle mis à jour')
    },
    onError: (err: Error) => toast.error(err.message),
  })
  const remove = useMutation({
    mutationFn: (id: string) => apiClient(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void refresh()
      toast.success('Membre retiré')
    },
    onError: (err: Error) => toast.error(err.message),
  })
  const newPin = async (id: string) => {
    try {
      const r = await apiClient<{ pin: string }>(id === me?.id ? '/users/me/pin' : `/users/${id}/pin`, { method: 'PUT', body: '{}' })
      setShownPin({ id, pin: r.pin })
      void refresh()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const needsSites = form.role === 'SELLER' || form.role === 'PRODUCTION'

  return (
    <div className="max-w-3xl space-y-6 p-6 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Équipe</h1>
          <p className="text-[15px] text-[var(--color-text-secondary)]">Code à 4 chiffres ou badge (carte QR, NFC) : on se connecte à une caisse déjà installée sans e-mail.</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowInvite(!showInvite)}
            className="flex h-11 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 text-[15px] font-semibold text-[var(--color-on-accent)]"
          >
            <Plus size={16} aria-hidden /> Ajouter
          </button>
        )}
      </header>

      {showInvite && (
        <form
          className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5"
          onSubmit={(e) => {
            e.preventDefault()
            invite.mutate(form)
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <input aria-label="Prénom" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={field} placeholder="Prénom" />
            <input aria-label="Nom" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={field} placeholder="Nom" />
            <input aria-label="E-mail" required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} placeholder="E-mail" />
            <input aria-label="Mot de passe provisoire" required minLength={8} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={field} placeholder="Mot de passe provisoire" />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Rôle</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {ROLES.filter((r) => r !== 'OWNER' || me?.role === 'OWNER').map((r) => (
                <label
                  key={r}
                  className={[
                    'flex cursor-pointer flex-col rounded-[var(--radius-md)] border p-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--color-accent)]',
                    form.role === r ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)]' : 'border-[var(--color-border-strong)]',
                  ].join(' ')}
                >
                  <input type="radio" name="role" className="sr-only" checked={form.role === r} onChange={() => setForm({ ...form, role: r })} />
                  <span className="text-[15px] font-semibold">{ROLE_LABEL[r]}</span>
                  <span className="text-sm text-[var(--color-text-secondary)]">{ROLE_HELP[r]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {needsSites && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">{form.role === 'PRODUCTION' ? 'Labo ou dépôt' : 'Boutiques'}</legend>
              <div className="flex flex-wrap gap-2">
                {(sites.data ?? [])
                  .filter((s) => (form.role === 'PRODUCTION' ? s.isSupplier : !s.isSupplier))
                  .map((s) => {
                    const on = form.siteIds.includes(s.id)
                    return (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setForm({ ...form, siteIds: on ? form.siteIds.filter((x) => x !== s.id) : [...form.siteIds, s.id] })}
                        className={['h-11 rounded-[var(--radius-pill)] px-4 text-sm font-medium', on ? 'bg-[var(--color-bg-inverse)] text-[var(--color-text-inverse)]' : 'border border-[var(--color-border-strong)]'].join(' ')}
                      >
                        {s.name}
                      </button>
                    )
                  })}
              </div>
            </fieldset>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowInvite(false)} className="h-11 px-4 text-[15px] font-medium text-[var(--color-text-secondary)]">
              Annuler
            </button>
            <button
              type="submit"
              disabled={invite.isPending || (needsSites && !form.siteIds.length)}
              className="h-11 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 text-[15px] font-semibold text-[var(--color-on-accent)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)]"
            >
              {invite.isPending ? 'Ajout...' : 'Ajouter à l’équipe'}
            </button>
          </div>
        </form>
      )}

      <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
        {isLoading
          ? [0, 1, 2].map((i) => <li key={i} className="h-20 animate-pulse" />)
          : users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="text-[15px] font-semibold">
                    {u.firstName} {u.lastName}
                    {u.id === me?.id && <span className="ml-2 text-sm font-normal text-[var(--color-text-secondary)]">vous</span>}
                  </p>
                  <p className="truncate text-sm text-[var(--color-text-secondary)]">
                    {u.email}
                    {u.sites.length > 0 && (u.role === 'SELLER' || u.role === 'PRODUCTION') ? `, ${u.sites.map((s) => siteName(s.siteId)).filter(Boolean).join(', ')}` : ''}
                  </p>
                </div>
                <label className="sr-only" htmlFor={`role-${u.id}`}>
                  Rôle de {u.firstName}
                </label>
                <select
                  id={`role-${u.id}`}
                  value={u.role}
                  disabled={u.id === me?.id || !canManage}
                  onChange={(e) => changeRole.mutate({ id: u.id, role: e.target.value })}
                  className="h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 text-sm disabled:opacity-60"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                {(canManage || u.id === me?.id) && (
                  <div className="flex items-center gap-2">
                    {shownPin?.id === u.id ? (
                      <p className="text-sm" role="status">
                        Code <span className="tabular text-xl font-semibold tracking-[0.3em]">{shownPin.pin}</span>
                        <span className="block text-[var(--color-text-secondary)]">à transmettre, il ne sera plus affiché</span>
                      </p>
                    ) : (
                      <button type="button" onClick={() => newPin(u.id)} className="h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-3 text-sm font-medium">
                        {u.pinSetAt ? 'Nouveau code' : 'Créer un code'}
                      </button>
                    )}
                  </div>
                )}
                {canManage && (
                  <button type="button" onClick={() => setBadgeFor(u)} className="h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-3 text-sm font-medium">
                    {u.badgeKind ? (u.badgeKind === 'QR' ? 'Carte QR' : 'Badge NFC') : 'Badge'}
                  </button>
                )}
                {u.id !== me?.id && canManage && (
                  <button
                    type="button"
                    aria-label={`Retirer ${u.firstName} de l'équipe`}
                    onClick={() => {
                      if (confirm(`Retirer ${u.firstName} de l'équipe ?`)) remove.mutate(u.id)
                    }}
                    className="grid size-11 place-items-center rounded-[var(--radius-pill)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
                  >
                    <Trash size={18} />
                  </button>
                )}
                <MemberSites
                  member={u}
                  sites={sites.data ?? []}
                  canEdit={me?.role === 'OWNER'}
                  onSaved={() => void refresh()}
                />
              </li>
            ))}
      </ul>
      <BadgeSheet member={badgeFor} onClose={() => setBadgeFor(null)} onChanged={() => void refresh()} />
    </div>
  )
}
