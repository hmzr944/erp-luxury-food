'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Buildings, PencilSimple, Trash, ArrowRight } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { formatPrice } from '@erp/utils'
import { b2bApi, type B2BClient } from '@/lib/api/b2b'

const inputCls = 'w-full h-9 px-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-[var(--radius-md)] font-body text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]/40 transition-colors'

const EMPTY: Partial<B2BClient> = {
  name: '', siret: '', vatNumber: '', email: '', phone: '',
  address: '', city: '', zipCode: '', country: 'FR',
  paymentTerms: 30, discount: undefined, notes: '',
}

function ClientForm({
  initial, onSave, onClose, isSaving,
}: {
  initial: Partial<B2BClient>
  onSave: (data: Partial<B2BClient>) => void
  onClose: () => void
  isSaving: boolean
}) {
  const [data, setData] = useState(initial)
  const set = (k: string, v: any) => setData((d) => ({ ...d, [k]: v }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <label className="font-body text-xs text-[var(--color-text-secondary)]">Raison sociale *</label>
          <input value={data.name ?? ''} onChange={(e) => set('name', e.target.value)} className={inputCls} placeholder="Hôtel Ritz Paris" autoFocus />
        </div>
        <div className="space-y-1.5">
          <label className="font-body text-xs text-[var(--color-text-secondary)]">SIRET</label>
          <input value={data.siret ?? ''} onChange={(e) => set('siret', e.target.value)} className={inputCls} placeholder="83214578600012" />
        </div>
        <div className="space-y-1.5">
          <label className="font-body text-xs text-[var(--color-text-secondary)]">N° TVA</label>
          <input value={data.vatNumber ?? ''} onChange={(e) => set('vatNumber', e.target.value)} className={inputCls} placeholder="FR12345678900" />
        </div>
        <div className="space-y-1.5">
          <label className="font-body text-xs text-[var(--color-text-secondary)]">Email</label>
          <input value={data.email ?? ''} onChange={(e) => set('email', e.target.value)} type="email" className={inputCls} placeholder="achat@hotel.fr" />
        </div>
        <div className="space-y-1.5">
          <label className="font-body text-xs text-[var(--color-text-secondary)]">Téléphone</label>
          <input value={data.phone ?? ''} onChange={(e) => set('phone', e.target.value)} className={inputCls} placeholder="+33 1 23 45 67 89" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <label className="font-body text-xs text-[var(--color-text-secondary)]">Adresse</label>
          <input value={data.address ?? ''} onChange={(e) => set('address', e.target.value)} className={inputCls} placeholder="15 Place Vendôme" />
        </div>
        <div className="space-y-1.5">
          <label className="font-body text-xs text-[var(--color-text-secondary)]">Code postal</label>
          <input value={data.zipCode ?? ''} onChange={(e) => set('zipCode', e.target.value)} className={inputCls} placeholder="75001" />
        </div>
        <div className="space-y-1.5">
          <label className="font-body text-xs text-[var(--color-text-secondary)]">Ville</label>
          <input value={data.city ?? ''} onChange={(e) => set('city', e.target.value)} className={inputCls} placeholder="Paris" />
        </div>
        <div className="space-y-1.5">
          <label className="font-body text-xs text-[var(--color-text-secondary)]">Remise (%)</label>
          <input value={data.discount ?? ''} onChange={(e) => set('discount', e.target.value ? Number(e.target.value) : undefined)} type="number" min="0" max="100" step="0.5" className={inputCls} placeholder="10" />
        </div>
        <div className="space-y-1.5">
          <label className="font-body text-xs text-[var(--color-text-secondary)]">Délai paiement (j)</label>
          <select value={data.paymentTerms ?? 30} onChange={(e) => set('paymentTerms', Number(e.target.value))} className={inputCls + ' cursor-pointer'}>
            <option value={0}>Comptant</option>
            <option value={30}>30 jours</option>
            <option value={45}>45 jours</option>
            <option value={60}>60 jours</option>
            <option value={90}>90 jours</option>
          </select>
        </div>
        <div className="col-span-2 space-y-1.5">
          <label className="font-body text-xs text-[var(--color-text-secondary)]">Notes internes</label>
          <textarea value={data.notes ?? ''} onChange={(e) => set('notes', e.target.value)} rows={2} className={inputCls + ' h-auto py-2 resize-none'} placeholder="Commandes mensuelles, livraison le lundi..." />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="px-3 h-9 font-body text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Annuler</button>
        <motion.button
          onClick={() => onSave(data)}
          disabled={isSaving || !data.name?.trim()}
          whileTap={{ scale: 0.98 }}
          className="px-4 h-9 bg-[var(--color-accent)] text-black font-body text-sm font-medium rounded-[var(--radius-md)] disabled:opacity-50 hover:bg-[var(--color-accent-hover)] transition-all"
        >
          {isSaving ? 'Enregistrement...' : 'Enregistrer'}
        </motion.button>
      </div>
    </div>
  )
}

export function ClientsClient() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['b2b-clients'],
    queryFn: b2bApi.getClients,
  })

  const create = useMutation({
    mutationFn: b2bApi.createClient,
    onSuccess: (c) => { qc.invalidateQueries({ queryKey: ['b2b-clients'] }); toast.success(`${c.name} créé`); setShowCreate(false) },
    onError: (e: any) => toast.error(e.message),
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<B2BClient> }) => b2bApi.updateClient(id, data),
    onSuccess: (c) => { qc.invalidateQueries({ queryKey: ['b2b-clients'] }); toast.success(`${c.name} mis à jour`); setEditId(null) },
    onError: (e: any) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: b2bApi.deleteClient,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['b2b-clients'] }); toast.success('Client retiré') },
    onError: (e: any) => toast.error(e.message),
  })

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
        <div>
          <h1 className="font-display text-xl text-[var(--color-text-primary)]">Clients B2B</h1>
          <p className="font-body text-xs text-[var(--color-text-muted)] mt-0.5">
            Restaurants, hôtels, épiceries fines
          </p>
        </div>
        <motion.button
          onClick={() => setShowCreate(true)}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-1.5 px-3 h-8 bg-[var(--color-accent)] text-black font-body text-sm rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] transition-all"
        >
          <Plus size={13} weight="bold" />
          Nouveau client
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-5 bg-[var(--color-bg-surface)] border border-[var(--color-accent)]/20 rounded-[var(--radius-lg)] p-5"
            >
              <p className="font-body text-sm font-medium text-[var(--color-text-primary)] mb-4">Nouveau client professionnel</p>
              <ClientForm
                initial={EMPTY}
                onSave={(d) => create.mutate(d)}
                onClose={() => setShowCreate(false)}
                isSaving={create.isPending}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-[var(--radius-lg)] bg-[var(--color-bg-surface)] border border-[var(--color-border)] animate-pulse" />
            ))}
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20">
            <Buildings size={32} weight="regular" className="text-[var(--color-text-muted)]/40" />
            <p className="font-body text-sm text-[var(--color-text-muted)]">
              Aucun client B2B - ajoutez votre premier partenaire
            </p>
          </div>
        ) : editId ? (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-5 mb-5"
          >
            <p className="font-body text-sm font-medium text-[var(--color-text-primary)] mb-4">
              Modifier {clients.find((c) => c.id === editId)?.name}
            </p>
            <ClientForm
              initial={clients.find((c) => c.id === editId) ?? EMPTY}
              onSave={(d) => update.mutate({ id: editId, data: d })}
              onClose={() => setEditId(null)}
              isSaving={update.isPending}
            />
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {clients.map((client) => (
              <motion.div
                key={client.id}
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-4 hover:border-[var(--color-border-strong)] transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-body text-sm font-medium text-[var(--color-text-primary)]">
                      {client.name}
                    </p>
                    {client.city && (
                      <p className="font-body text-[11px] text-[var(--color-text-muted)]">{client.city}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditId(client.id)} className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded-[var(--radius-sm)] hover:bg-[var(--color-bg-elevated)] transition-all">
                      <PencilSimple size={13} />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Supprimer ${client.name} ?`)) remove.mutate(client.id) }}
                      className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] rounded-[var(--radius-sm)] hover:bg-[var(--color-danger)]/10 transition-all"
                    >
                      <Trash size={13} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {client.email && (
                    <span className="font-body text-[11px] text-[var(--color-text-muted)]">{client.email}</span>
                  )}
                  {client.discount && (
                    <span className="font-data text-[10px] text-[var(--color-accent)] bg-[var(--color-accent-muted)] px-1.5 py-0.5 rounded-full">
                      -{client.discount}%
                    </span>
                  )}
                  <span className="font-data text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg-elevated)] px-1.5 py-0.5 rounded-full">
                    {client.paymentTerms === 0 ? 'Comptant' : `${client.paymentTerms}j`}
                  </span>
                  {client._count && (
                    <span className="font-data text-[10px] text-[var(--color-text-muted)]">
                      {client._count.orders} commande{client._count.orders > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
