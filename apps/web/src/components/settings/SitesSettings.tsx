'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, PencilSimple, MapPin, Copy } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api/client'
import { useSiteStore } from '@/stores/site.store'
import { useAuthStore } from '@/stores/auth.store'
import { METIERS } from '@erp/types'
import { catalogCopyApi, describeCopyReport, skipReasonLabel, type CatalogCopyReport } from '@/lib/api/catalog-copy'

const inputCls = 'w-full h-11 px-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-[var(--radius-md)] font-body text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-colors'

type StartMode = 'copy' | 'metier' | 'empty'

const START_OPTIONS: Array<{ mode: StartMode; label: string; hint: string }> = [
  { mode: 'copy', label: 'Copier le catalogue d’un autre site', hint: 'Articles, prix, TVA, codes-barres, variantes et options. Sans le stock.' },
  { mode: 'metier', label: 'Commencer avec le catalogue de mon métier', hint: 'Quelques articles d’exemple à retirer d’un geste.' },
  { mode: 'empty', label: 'Commencer vide', hint: 'Vous ajoutez ou importez vos articles ensuite.' },
]

export function SitesSettings() {
  const qc = useQueryClient()
  const canCopy = useAuthStore((s) => s.user?.role === 'OWNER' || s.user?.role === 'MANAGER')
  const [copyingId, setCopyingId] = useState<string | null>(null)
  const [start, setStart] = useState<StartMode>('empty')
  const [sourceId, setSourceId] = useState('')
  const [metier, setMetier] = useState('')
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
    mutationFn: () =>
      apiClient<{ catalogCopy?: CatalogCopyReport; catalogError?: string }>('/sites', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          ...(start === 'copy' ? { copyCatalogFromSiteId: sourceId } : {}),
          ...(start === 'metier' ? { starterMetier: metier } : {}),
        }),
      }),
    onSuccess: (site) => {
      qc.invalidateQueries({ queryKey: ['sites-settings'] })
      qc.invalidateQueries({ queryKey: ['sites'] })
      if (site.catalogError) toast.message(`${form.name} créé`, { description: site.catalogError })
      else if (site.catalogCopy) toast.success(`${form.name} créé`, { description: describeCopyReport(site.catalogCopy)[0] })
      else toast.success(`${form.name} créé`)
      setShowCreate(false)
      setForm({ name: '', address: '', timezone: 'Europe/Paris' })
      setStart('empty')
      setSourceId('')
      setMetier('')
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
                aria-label="Nom du site"
                autoFocus
              />
              <input
                value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                className={inputCls} placeholder="Adresse complète" aria-label="Adresse"
              />
              <select
                value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                className={inputCls + ' cursor-pointer'} aria-label="Fuseau horaire"
              >
                <option value="Europe/Paris">Europe/Paris (UTC+1/+2)</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Europe/Berlin">Europe/Berlin</option>
                <option value="America/Montreal">America/Montreal</option>
              </select>
              <fieldset className="space-y-2 pt-1">
                <legend className="mb-1 font-body text-sm font-medium text-[var(--color-text-primary)]">Catalogue de départ</legend>
                {START_OPTIONS.filter((o) => o.mode !== 'copy' || sites.length > 0).map((o) => {
                  const selected = start === o.mode
                  return (
                    <div key={o.mode}>
                      <label
                        className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border px-3 py-2.5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-accent)] ${selected ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)]' : 'border-[var(--color-border-strong)] hover:bg-[var(--color-bg-hover)]'}`}
                      >
                        <input
                          type="radio" name="catalogue-depart" value={o.mode}
                          checked={selected} onChange={() => setStart(o.mode)}
                          className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
                        />
                        <span>
                          <span className="block font-body text-sm text-[var(--color-text-primary)]">{o.label}</span>
                          <span className="block font-body text-sm text-[var(--color-text-muted)]">{o.hint}</span>
                        </span>
                      </label>
                      {selected && o.mode === 'copy' && (
                        <label className="mt-2 block pl-1">
                          <span className="mb-1 block font-body text-sm text-[var(--color-text-secondary)]">Site à copier</span>
                          <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className={inputCls + ' cursor-pointer'}>
                            <option value="">Choisir un site</option>
                            {sites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </label>
                      )}
                      {selected && o.mode === 'metier' && (
                        <label className="mt-2 block pl-1">
                          <span className="mb-1 block font-body text-sm text-[var(--color-text-secondary)]">Votre métier</span>
                          <select value={metier} onChange={(e) => setMetier(e.target.value)} className={inputCls + ' cursor-pointer'}>
                            <option value="">Choisir un métier</option>
                            {METIERS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                          </select>
                        </label>
                      )}
                    </div>
                  )
                })}
              </fieldset>
              {createSite.isError && (
                <p role="alert" className="font-body text-sm text-[var(--color-text-primary)]">
                  {(createSite.error as Error).message || 'Le site n’a pas pu être créé. Réessayez.'}
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowCreate(false)} className="px-3 h-10 font-body text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
                  Annuler
                </button>
                <button
                  onClick={() => createSite.mutate()}
                  disabled={createSite.isPending || !form.name.trim() || (start === 'copy' && !sourceId) || (start === 'metier' && !metier)}
                  className="px-4 h-10 bg-[var(--color-accent)] text-[var(--color-on-accent)] font-body text-sm rounded-[var(--radius-md)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)] transition-colors"
                >
                  {createSite.isPending ? (start === 'empty' ? 'Création…' : 'Création et copie…') : 'Créer'}
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
                    <div className="flex items-center gap-1">
                      {canCopy && sites.length > 1 && (
                        <button
                          onClick={() => setCopyingId(copyingId === site.id ? null : site.id)}
                          aria-expanded={copyingId === site.id}
                          aria-label={`Copier le catalogue d’un autre site vers ${site.name}`}
                          className="flex h-10 items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 font-body text-sm text-[var(--color-accent)] hover:bg-[var(--color-bg-hover)] transition-colors"
                        >
                          <Copy size={14} />
                          <span className="hidden sm:inline">Copier le catalogue</span>
                        </button>
                      )}
                      <button
                        onClick={() => setEditingId(site.id)}
                        aria-label={`Modifier ${site.name}`}
                        className="flex h-10 w-10 items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                      >
                        <PencilSimple size={14} />
                      </button>
                    </div>
                  </div>
                )}
                {copyingId === site.id && (
                  <CopyCatalogPanel
                    target={site}
                    sources={sites.filter((x: any) => x.id !== site.id)}
                    onClose={() => setCopyingId(null)}
                    onDone={() => qc.invalidateQueries({ queryKey: ['products'] })}
                  />
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

// Copie le catalogue d'un autre site vers un site existant : confirmation, puis rapport
function CopyCatalogPanel({ target, sources, onClose, onDone }: { target: any; sources: any[]; onClose: () => void; onDone: () => void }) {
  const [sourceId, setSourceId] = useState('')
  const [confirming, setConfirming] = useState(false)
  const copy = useMutation({
    mutationFn: () => catalogCopyApi.copy(target.id, sourceId),
    onSuccess: () => {
      setConfirming(false)
      onDone()
    },
  })
  const source = sources.find((x) => x.id === sourceId)
  const report = copy.data

  return (
    <div className="space-y-3 border-t border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-4">
      <p className="font-body text-sm font-medium text-[var(--color-text-primary)]">Copier le catalogue d’un autre site vers {target.name}</p>
      {!report && (
        <>
          <label className="block">
            <span className="mb-1 block font-body text-sm text-[var(--color-text-secondary)]">Site à copier</span>
            <select
              value={sourceId}
              onChange={(e) => { setSourceId(e.target.value); setConfirming(false); copy.reset() }}
              disabled={copy.isPending}
              className={inputCls + ' cursor-pointer'}
            >
              <option value="">Choisir un site</option>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          {confirming && source && (
            <p className="font-body text-sm text-[var(--color-text-primary)]">
              Les articles de {source.name} seront ajoutés à {target.name}. Ceux qui existent déjà (même SKU, code-barres ou nom) sont ignorés. Le stock de départ est à 0 : les stocks, les ventes et les clients ne sont jamais copiés.
            </p>
          )}
        </>
      )}
      <div role="status" aria-live="polite" className="font-body text-sm text-[var(--color-text-primary)]">
        {copy.isPending && 'Copie du catalogue en cours…'}
        {report && (
          <div className="space-y-1">
            <p className="font-medium">Copie terminée</p>
            {describeCopyReport(report).map((line) => <p key={line}>{line}</p>)}
            {report.skippedItems.length > 0 && (
              <details className="pt-1">
                <summary className="min-h-10 cursor-pointer py-2 text-[var(--color-accent)]">Voir les articles ignorés</summary>
                <ul className="list-disc space-y-0.5 pl-5">
                  {report.skippedItems.map((i) => <li key={`${i.name}-${i.reason}`}>{i.name} ({skipReasonLabel(i.reason)})</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
      {copy.isError && (
        <p role="alert" className="font-body text-sm text-[var(--color-text-primary)]">
          {(copy.error as Error).message || 'La copie a échoué. Elle peut être relancée sans risque de doublon.'}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 h-10 font-body text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
          {report ? 'Fermer' : 'Annuler'}
        </button>
        {!report && (
          <button
            onClick={() => (confirming ? copy.mutate() : setConfirming(true))}
            disabled={!sourceId || copy.isPending}
            className="px-4 h-10 bg-[var(--color-accent)] text-[var(--color-on-accent)] font-body text-sm rounded-[var(--radius-md)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)] transition-colors"
          >
            {confirming ? 'Confirmer la copie' : 'Copier'}
          </button>
        )}
      </div>
    </div>
  )
}
