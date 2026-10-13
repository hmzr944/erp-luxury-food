'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash, Eye, EyeSlash, Copy, CheckCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { apiTokensApi } from '@/lib/api/b2b'

const SCOPE_GROUPS = [
  { label: 'Commandes', scopes: ['orders:read', 'orders:write'] },
  { label: 'Produits',  scopes: ['products:read', 'products:write'] },
  { label: 'Stock',     scopes: ['stock:read', 'stock:write'] },
  { label: 'Dashboard', scopes: ['dashboard:read'] },
  { label: 'Allergènes', scopes: ['allergens:read'] },
]

export function ApiSettings() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', scopes: ['orders:read', 'products:read'] as string[] })
  const [newToken, setNewToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ['api-tokens'],
    queryFn: apiTokensApi.getAll,
  })

  const create = useMutation({
    mutationFn: () => apiTokensApi.create(form),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['api-tokens'] })
      setNewToken(data.token)
      setShowCreate(false)
      setForm({ name: '', scopes: ['orders:read', 'products:read'] })
    },
    onError: (e: any) => toast.error(e.message),
  })

  const revoke = useMutation({
    mutationFn: apiTokensApi.revoke,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['api-tokens'] }); toast.success('Token révoqué') },
    onError: (e: any) => toast.error(e.message),
  })

  const toggleScope = (scope: string) => {
    setForm((f) => ({
      ...f,
      scopes: f.scopes.includes(scope)
        ? f.scopes.filter((s) => s !== scope)
        : [...f.scopes, scope],
    }))
  }

  const copy = () => {
    if (!newToken) return
    navigator.clipboard.writeText(newToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-lg px-8 py-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-xl text-[var(--color-text-primary)]">API</h1>
        <motion.button
          onClick={() => setShowCreate(!showCreate)}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-1.5 px-3 h-8 bg-[var(--color-accent)] text-[var(--color-on-accent)] font-body text-sm rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] transition-all"
        >
          <Plus size={13} weight="bold" />
          Nouveau token
        </motion.button>
      </div>
      <p className="font-body text-xs text-[var(--color-text-muted)] mb-6">
        Les tokens permettent d'accéder à l'API ERP depuis vos intégrations (Yooz, Cegid, TheFork...).
      </p>

      {/* Token affiché une seule fois */}
      <AnimatePresence>
        {newToken && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-5 bg-[var(--color-success)]/5 border border-[var(--color-success)]/20 rounded-[var(--radius-lg)] p-4"
          >
            <p className="font-body text-sm font-medium text-[var(--color-success)] mb-2">
              Token créé - copiez-le maintenant, il ne sera plus affiché
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-data text-xs bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-3 py-2 text-[var(--color-text-primary)] overflow-hidden text-ellipsis">
                {newToken}
              </code>
              <button
                onClick={copy}
                className={['p-2 rounded-[var(--radius-sm)] transition-all', copied ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]'].join(' ')}
              >
                {copied ? <CheckCircle size={16} weight="fill" /> : <Copy size={16} />}
              </button>
            </div>
            <button onClick={() => setNewToken(null)} className="mt-2 font-body text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors">
              J'ai copié le token
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Formulaire création */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="mb-5 overflow-hidden"
          >
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-accent)]/20 rounded-[var(--radius-lg)] p-5 space-y-4">
              <p className="font-body text-sm font-medium text-[var(--color-text-primary)]">Nouveau token d'accès</p>

              <div className="space-y-1.5">
                <label className="font-body text-xs text-[var(--color-text-secondary)]">Nom</label>
                <input
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full h-9 px-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-[var(--radius-md)] font-body text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]/40 transition-colors"
                  placeholder="Intégration Yooz production"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="font-body text-xs text-[var(--color-text-secondary)]">Permissions</label>
                {SCOPE_GROUPS.map(({ label, scopes }) => (
                  <div key={label}>
                    <p className="font-data text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1">{label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {scopes.map((scope) => (
                        <button
                          key={scope}
                          type="button"
                          onClick={() => toggleScope(scope)}
                          className={[
                            'px-2.5 py-1 rounded-[var(--radius-sm)] font-data text-[11px] border transition-all',
                            form.scopes.includes(scope)
                              ? 'bg-[var(--color-accent-muted)] border-[var(--color-accent)]/30 text-[var(--color-accent)]'
                              : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]',
                          ].join(' ')}
                        >
                          {scope}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowCreate(false)} className="px-3 h-8 font-body text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Annuler</button>
                <button
                  onClick={() => create.mutate()}
                  disabled={create.isPending || !form.name.trim() || form.scopes.length === 0}
                  className="px-4 h-8 bg-[var(--color-accent)] text-[var(--color-on-accent)] font-body text-sm rounded-[var(--radius-md)] disabled:opacity-50 hover:bg-[var(--color-accent-hover)] transition-all"
                >
                  Créer
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Liste tokens */}
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden">
        {isLoading ? (
          <div className="h-16 animate-pulse" />
        ) : tokens.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="font-body text-sm text-[var(--color-text-muted)]">Aucun token. Créez-en un pour commencer.</p>
          </div>
        ) : tokens.map((t: any) => (
          <div key={t.id} className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] last:border-0">
            <div>
              <p className="font-body text-sm text-[var(--color-text-primary)]">{t.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <code className="font-data text-[10px] text-[var(--color-text-muted)]">{t.prefix}...</code>
                {t.lastUsedAt && (
                  <span className="font-body text-[11px] text-[var(--color-text-muted)]">
                    Dernière utilisation: {new Date(t.lastUsedAt).toLocaleDateString('fr-FR')}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => { if (confirm(`Révoquer "${t.name}" ?`)) revoke.mutate(t.id) }}
              className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] rounded-[var(--radius-sm)] hover:bg-[var(--color-danger)]/10 transition-all"
            >
              <Trash size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
