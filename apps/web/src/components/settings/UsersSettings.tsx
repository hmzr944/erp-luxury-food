'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash, ChevronDown } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api/client'
import { useAuthStore } from '@/stores/auth.store'

const ROLE_LABELS = { OWNER: 'Propriétaire', MANAGER: 'Responsable', SELLER: 'Vendeur' }
const ROLE_COLORS = {
  OWNER:   'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/20',
  MANAGER: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  SELLER:  'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border)]',
}

const inputCls = 'w-full h-9 px-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-[var(--radius-md)] font-body text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]/40 transition-colors'

export function UsersSettings() {
  const qc = useQueryClient()
  const { user: me } = useAuthStore()
  const [showInvite, setShowInvite] = useState(false)
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', role: 'SELLER', password: '' })

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users-settings'],
    queryFn: () => apiClient<any[]>('/users'),
  })

  const invite = useMutation({
    mutationFn: (data: typeof form) => apiClient('/users', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users-settings'] })
      toast.success('Utilisateur ajouté')
      setShowInvite(false)
      setForm({ email: '', firstName: '', lastName: '', role: 'SELLER', password: '' })
    },
    onError: (err: any) => toast.error(err.message ?? 'Erreur'),
  })

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      apiClient(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users-settings'] }); toast.success('Rôle mis à jour') },
    onError: (err: any) => toast.error(err.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => apiClient(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users-settings'] }); toast.success('Utilisateur retiré') },
    onError: (err: any) => toast.error(err.message),
  })

  return (
    <div className="max-w-2xl px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-xl text-[var(--color-text-primary)]">Équipe</h1>
        <motion.button
          onClick={() => setShowInvite(!showInvite)}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-1.5 px-3 h-8 bg-[var(--color-accent)] text-black font-body text-sm rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] transition-all"
        >
          <Plus size={13} weight="bold" />
          Ajouter
        </motion.button>
      </div>

      <AnimatePresence>
        {showInvite && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-6 overflow-hidden"
          >
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-accent)]/20 rounded-[var(--radius-lg)] p-5 space-y-3">
              <p className="font-body text-sm font-medium text-[var(--color-text-primary)]">Nouvel utilisateur</p>

              <div className="grid grid-cols-2 gap-3">
                <input
                  value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  className={inputCls} placeholder="Prénom"
                />
                <input
                  value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  className={inputCls} placeholder="Nom"
                />
              </div>

              <input
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                type="email" className={inputCls} placeholder="email@boutique.fr"
              />

              <input
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                type="password" className={inputCls} placeholder="Mot de passe provisoire"
              />

              <select
                value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className={inputCls + ' cursor-pointer'}
              >
                <option value="SELLER">Vendeur</option>
                <option value="MANAGER">Responsable</option>
                <option value="OWNER">Propriétaire</option>
              </select>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowInvite(false)}
                  className="px-3 h-8 font-body text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => invite.mutate(form)}
                  disabled={invite.isPending || !form.email || !form.firstName}
                  className="px-4 h-8 bg-[var(--color-accent)] text-black font-body text-sm rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-all"
                >
                  {invite.isPending ? 'Création...' : 'Créer'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 border-b border-[var(--color-border)] last:border-0 animate-pulse" />
            ))
          : users.map((u: any) => (
              <div
                key={u.id}
                className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] last:border-0"
              >
                <div>
                  <p className="font-body text-sm text-[var(--color-text-primary)]">
                    {u.firstName} {u.lastName}
                    {u.id === me?.id && (
                      <span className="font-data text-[10px] text-[var(--color-text-muted)] ml-2">vous</span>
                    )}
                  </p>
                  <p className="font-body text-[11px] text-[var(--color-text-muted)]">{u.email}</p>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={u.role}
                    disabled={u.id === me?.id || me?.role === 'SELLER'}
                    onChange={(e) => changeRole.mutate({ id: u.id, role: e.target.value })}
                    className={[
                      'font-data text-[10px] px-2 py-1 rounded-full border cursor-pointer appearance-none',
                      ROLE_COLORS[u.role as keyof typeof ROLE_COLORS],
                      'disabled:cursor-default',
                    ].join(' ')}
                  >
                    <option value="SELLER">Vendeur</option>
                    <option value="MANAGER">Responsable</option>
                    <option value="OWNER">Propriétaire</option>
                  </select>

                  {u.id !== me?.id && (me?.role === 'OWNER' || me?.role === 'MANAGER') && (
                    <button
                      onClick={() => {
                        if (confirm(`Retirer ${u.firstName} de l'équipe ?`)) remove.mutate(u.id)
                      }}
                      className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors p-1"
                    >
                      <Trash size={13} weight="regular" />
                    </button>
                  )}
                </div>
              </div>
            ))}
      </div>
    </div>
  )
}
