'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'

interface SiteLite {
  id: string
  name: string
  isSupplier?: boolean
}

interface Member {
  id: string
  firstName: string
  role: string
  sites: Array<{ siteId: string }>
}

// Boutiques d'un membre : cases à cocher, enregistrement explicite.
// Titulaire et gérant ont toutes les boutiques (rien à régler). Seul le
// titulaire modifie ; les autres lisent.
export function MemberSites({ member, sites, canEdit, onSaved }: { member: Member; sites: SiteLite[]; canEdit: boolean; onSaved: () => void }) {
  const restricted = member.role === 'SELLER' || member.role === 'PRODUCTION'
  const saved = member.sites.map((s) => s.siteId)
  const [draft, setDraft] = useState<string[] | null>(null)
  const [done, setDone] = useState(false)
  const current = draft ?? saved
  const dirty = draft !== null && (draft.length !== saved.length || draft.some((id) => !saved.includes(id)))

  const save = useMutation({
    mutationFn: (siteIds: string[]) => apiClient(`/users/${member.id}/sites`, { method: 'PUT', body: JSON.stringify({ siteIds }) }),
    onSuccess: () => {
      onSaved()
      setDraft(null)
      setDone(true)
    },
  })

  if (!restricted) {
    return (
      <div className="basis-full">
        <p className="text-sm text-[var(--color-text-secondary)]">Toutes les boutiques, non modifiable pour ce rôle.</p>
      </div>
    )
  }

  const list = sites.filter((s) => (member.role === 'PRODUCTION' ? s.isSupplier : !s.isSupplier) || saved.includes(s.id))
  const legend = member.role === 'PRODUCTION' ? 'Labo ou dépôt' : 'Boutiques'

  return (
    <form
      className="basis-full"
      onSubmit={(e) => {
        e.preventDefault()
        if (draft && draft.length) save.mutate(draft)
      }}
    >
      <fieldset className="min-w-0" disabled={!canEdit || save.isPending}>
        <legend className="text-sm font-semibold">
          {legend} de {member.firstName}
        </legend>
        <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
          {list.map((s) => (
            <label key={s.id} className="flex min-h-11 cursor-pointer items-center gap-2 text-[15px] has-[:disabled]:cursor-default">
              <input
                type="checkbox"
                className="size-5 accent-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                checked={current.includes(s.id)}
                onChange={(e) => {
                  setDone(false)
                  setDraft(e.target.checked ? [...current, s.id] : current.filter((x) => x !== s.id))
                }}
              />
              {s.name}
            </label>
          ))}
        </div>
      </fieldset>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!dirty || current.length === 0 || save.isPending}
            className="h-11 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-on-accent)] transition-transform active:scale-[0.97] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)]"
          >
            {save.isPending ? 'Enregistrement...' : 'Enregistrer les boutiques'}
          </button>
          <p role="status" className="text-sm text-[var(--color-text-secondary)]">
            {save.isError
              ? `Non enregistré : ${(save.error as Error).message}`
              : current.length === 0
                ? 'Cochez au moins une boutique.'
                : done
                  ? `Boutiques de ${member.firstName} enregistrées. L'accès change tout de suite.`
                  : ''}
          </p>
        </div>
      )}
    </form>
  )
}
