'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, PencilSimple, MapPin } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api/client'
import { useSiteStore } from '@/stores/site.store'

const inputCls = 'w-full h-11 px-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-[var(--radius-md)] font-body text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-colors'

export function SitesSettings() {
  const qc = useQueryClient()
  const { setSites } = useSiteStore()
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', address: '', timezone: 'Europe/Paris' })

  const { data: sites = [], isLoading } = useQuery({
    queryKey: ['sites-settings'],
    queryFn: () => apiClient<any[]>('/sites'),
  })

  // Sync le store quand les sites changent (onSuccess supprimé en TanStack Query v5)
  useEffect(() => {
    if (sites.length > 0) {
      setSites(sites.map((s: any) => ({ id: s.id, name: s.name, timezone: s.timezone })))
    }
  }, [sites, setSites])

  const createSite = useMutation({
    mutationFn: () => apiClient('/sites', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites-settings'] })
      toast.success(`${form.name} créé`)
      setShowCreate(false)
      setForm({ name: '', address: '', timezone: 'Europe/Paris' })
    },
    onError: (err: any) => toast.error(err.message ?? 'Erreur'),
  })

  const updateSite = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiClient(`/sites/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: (s: any) => {
      qc.invalidateQueries({ queryKey: ['sites-settings'] })
      toast.success(`${s.name} mis à jour`)
      setEditingId(null)
    },
    onError: (err: any) => toast.error(err.message),
  })

  return (
    <div className="max-w-lg px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Sites</h1>
        <motion.button
          onClick={() => setShowCreate(!showCreate)}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-1.5 px-3 h-10 bg-[var(--color-accent)] text-[var(--color-on-accent)] font-body text-sm rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          <Plus size={13} weight="bold" />
          Nouveau site
        </motion.button>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="mb-5 overflow-hidden"
          >
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-accent)]/20 rounded-[var(--radius-lg)] p-5 space-y-3">
              <p className="font-body text-sm font-medium text-[var(--color-text-primary)]">Nouveau point de vente</p>
              <input
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputCls} placeholder="Boutique Chocolat Paris 1er"
                autoFocus
              />
              <input
                value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                className={inputCls} placeholder="Adresse complète"
              />
              <select
                value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                className={inputCls + ' cursor-pointer'}
              >
                <option value="Europe/Paris">Europe/Paris (UTC+1/+2)</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Europe/Berlin">Europe/Berlin</option>
                <option value="America/Montreal">America/Montreal</option>
              </select>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowCreate(false)} className="px-3 h-10 font-body text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
                  Annuler
                </button>
                <button
                  onClick={() => createSite.mutate()}
                  disabled={createSite.isPending || !form.name.trim()}
                  className="px-4 h-10 bg-[var(--color-accent)] text-[var(--color-on-accent)] font-body text-sm rounded-[var(--radius-md)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)] transition-colors"
                >
                  Créer
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden">
        {isLoading
          ? Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-16 border-b border-[var(--color-border)] last:border-0 animate-pulse" />
            ))
          : sites.map((site: any) => (
              <div key={site.id} className="border-b border-[var(--color-border)] last:border-0">
                {editingId === site.id ? (
                  <SiteEditRow
                    site={site}
                    onSave={(data: { name: string; address?: string; timezone?: string }) => updateSite.mutate({ id: site.id, data })}
                    onCancel={() => setEditingId(null)}
                    isSaving={updateSite.isPending}
                  />
                ) : (
                  <div className="flex items-center justify-between px-4 py-3 group">
                    <div className="flex items-center gap-3">
                      <MapPin size={14} weight="regular" className="text-[var(--color-text-muted)]" />
                      <div>
                        <p className="font-body text-sm text-[var(--color-text-primary)]">{site.name}</p>
                        {site.address && (
                          <p className="font-body text-sm text-[var(--color-text-muted)]">{site.address}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setEditingId(site.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                    >
                      <PencilSimple size={13} />
                    </button>
                  </div>
                )}
              </div>
            ))}
      </div>
    </div>
  )
}

function SiteEditRow({ site, onSave, onCancel, isSaving }: any) {
  const [data, setData] = useState({ name: site.name, address: site.address ?? '' })
  const inputCls = 'w-full h-10 px-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-[var(--radius-sm)] font-body text-sm text-[var(--color-text-primary)] transition-colors'
  return (
    <div className="px-4 py-3 space-y-2">
      <input value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} className={inputCls} />
      <input value={data.address} onChange={(e) => setData({ ...data, address: e.target.value })} className={inputCls} placeholder="Adresse" />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-2 h-7 font-body text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Annuler</button>
        <button onClick={() => onSave(data)} disabled={isSaving || !data.name.trim()} className="px-3 h-7 bg-[var(--color-accent)] text-[var(--color-on-accent)] font-body text-xs rounded-[var(--radius-sm)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)]">Enregistrer</button>
      </div>
    </div>
  )
}
