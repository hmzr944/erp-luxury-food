'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash, ArrowsClockwise, Globe } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { webhooksApi } from '@/lib/api/b2b'

const EVENT_LABELS: Record<string, string> = {
  'order.created':   'Nouvelle commande',
  'order.updated':   'Statut commande changé',
  'order.completed': 'Commande complétée',
  'order.cancelled': 'Commande annulée',
  'stock.low':       'Stock bas',
  'day.closed':      'Clôture journalière',
}

export function WebhooksSettings() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ url: '', events: [] as string[] })

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: webhooksApi.getAll,
  })

  const create = useMutation({
    mutationFn: () => webhooksApi.create(form),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('Webhook créé')
      if (data.secret) {
        toast.info(`Secret de signature: ${data.secret}`, { duration: 10000 })
      }
      setShowCreate(false)
      setForm({ url: '', events: [] })
    },
    onError: (e: any) => toast.error(e.message),
  })

  const test = useMutation({
    mutationFn: webhooksApi.test,
    onSuccess: () => toast.success('Événement test envoyé'),
    onError: (e: any) => toast.error(e.message),
  })

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      webhooksApi.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
    onError: (e: any) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: webhooksApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['webhooks'] }); toast.success('Webhook supprimé') },
    onError: (e: any) => toast.error(e.message),
  })

  const toggleEvent = (event: string) =>
    setForm((f) => ({
      ...f,
      events: f.events.includes(event) ? f.events.filter((e) => e !== event) : [...f.events, event],
    }))

  return (
    <div className="max-w-lg px-8 py-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="page-title">Webhooks</h1>
        <motion.button
          onClick={() => setShowCreate(!showCreate)}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-1.5 px-3 h-10 bg-[var(--color-accent)] text-[var(--color-on-accent)] font-body text-sm rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          <Plus size={13} weight="bold" />
          Nouveau
        </motion.button>
      </div>
      <p className="font-body text-xs text-[var(--color-text-muted)] mb-6">
        Recevez les événements ERP en temps réel sur vos serveurs. Signature HMAC-SHA256.
      </p>

      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="mb-5 overflow-hidden"
          >
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-accent)]/20 rounded-[var(--radius-lg)] p-5 space-y-4">
              <p className="font-body text-sm font-medium text-[var(--color-text-primary)]">Nouvel endpoint</p>
              <div className="space-y-1.5">
                <label className="font-body text-xs text-[var(--color-text-secondary)]">URL</label>
                <input
                  value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}
                  className="w-full h-11 px-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-[var(--radius-md)] font-body text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-colors tabular"
                  placeholder="https://monapp.fr/webhooks/erp"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="font-body text-xs text-[var(--color-text-secondary)]">Événements</label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(EVENT_LABELS).map(([event, label]) => (
                    <button
                      key={event}
                      type="button"
                      onClick={() => toggleEvent(event)}
                      className={[
                        'px-2.5 py-1 rounded-[var(--radius-sm)] font-body text-sm border transition-colors',
                        form.events.includes(event)
                          ? 'bg-[var(--color-accent-muted)] border-[var(--color-accent)]/30 text-[var(--color-accent)]'
                          : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowCreate(false)} className="px-3 h-10 font-body text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Annuler</button>
                <button
                  onClick={() => create.mutate()}
                  disabled={create.isPending || !form.url || form.events.length === 0}
                  className="px-4 h-10 bg-[var(--color-accent)] text-[var(--color-on-accent)] font-body text-sm rounded-[var(--radius-md)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)] hover:bg-[var(--color-accent-hover)] transition-colors"
                >
                  Créer
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 rounded-[var(--radius-lg)] bg-[var(--color-bg-surface)] border border-[var(--color-border)] animate-pulse" />
          ))
        ) : webhooks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
            <Globe size={24} weight="regular" className="text-[var(--color-text-muted)]" />
            <p className="font-body text-sm text-[var(--color-text-muted)]">Aucun endpoint configuré</p>
          </div>
        ) : webhooks.map((wh: any) => (
          <div
            key={wh.id}
            className={[
              'bg-[var(--color-bg-surface)] border rounded-[var(--radius-lg)] p-4 transition-colors',
              'border-[var(--color-border)]',
            ].join(' ')}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={['shrink-0 rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-semibold', wh.isActive ? 'bg-[var(--color-accent-muted)] text-[var(--color-text-primary)]' : 'border border-[var(--color-border-strong)] text-[var(--color-text-secondary)]'].join(' ')}>
                  {wh.isActive ? 'Actif' : 'En pause'}
                </span>
                <code className="font-data text-xs text-[var(--color-text-primary)] break-all">{wh.url}</code>
              </div>
              <div className="flex items-center gap-1 ml-3 shrink-0">
                <button type="button" onClick={() => test.mutate(wh.id)} disabled={test.isPending} aria-label="Envoyer un test" className="grid size-10 place-items-center rounded-[var(--radius-pill)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50">
                  <ArrowsClockwise size={18} aria-hidden />
                </button>
                <button type="button" onClick={() => remove.mutate(wh.id)} aria-label="Supprimer ce webhook" className="grid size-10 place-items-center rounded-[var(--radius-pill)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50">
                  <Trash size={18} aria-hidden />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 ml-4">
              {wh.events.map((e: string) => (
                <span key={e} className="font-data text-xs bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] px-1.5 py-0.5 rounded-full">
                  {EVENT_LABELS[e] ?? e}
                </span>
              ))}
            </div>
            {wh.failureCount > 0 && (
              <p className="font-body text-sm text-[var(--color-warning)] mt-2 ml-4">
                {wh.failureCount} échec{wh.failureCount > 1 ? 's' : ''} récent{wh.failureCount > 1 ? 's' : ''}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
