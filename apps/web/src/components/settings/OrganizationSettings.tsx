'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ShieldCheck } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { orgSettingsApi } from '@/lib/api/invoices'

const inputCls = 'w-full h-11 px-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-[var(--radius-md)] font-body text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-colors'

export function OrganizationSettings() {
  const { data: settings, isLoading } = useQuery({
    queryKey: ['org-settings'],
    queryFn: orgSettingsApi.get,
  })

  const [form, setForm] = useState({
    siret: '', vatNumber: '', legalForm: '', rcs: '',
    legalAddress: '', legalCity: '', legalZipCode: '',
    pdpName: '', pdpEndpoint: '', pdpApiKey: '', pdpEnabled: false,
  })

  useEffect(() => {
    if (settings) {
      setForm((f) => ({ ...f, ...settings }))
    }
  }, [settings])

  const save = useMutation({
    mutationFn: () => orgSettingsApi.save(form),
    onSuccess: () => toast.success('Paramètres enregistrés'),
    onError: (e: any) => toast.error(e.message),
  })

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }))

  if (isLoading) return (
    <div className="max-w-lg px-8 py-6 space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-9 rounded bg-[var(--color-bg-surface)] animate-pulse" />
      ))}
    </div>
  )

  return (
    <div className="max-w-lg px-8 py-6">
      <h1 className="page-title mb-6">Organisation</h1>

      {/* Identité légale */}
      <div className="mb-6">
        <p className="font-body text-sm font-semibold text-[var(--color-text-primary)] mb-4">
          Identité légale
        </p>
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-body text-xs text-[var(--color-text-secondary)]">SIRET</label>
              <input value={form.siret} onChange={(e) => set('siret', e.target.value)} className={inputCls} placeholder="12345678900012" maxLength={14} />
            </div>
            <div className="space-y-1.5">
              <label className="font-body text-xs text-[var(--color-text-secondary)]">N° TVA intracommunautaire</label>
              <input value={form.vatNumber} onChange={(e) => set('vatNumber', e.target.value)} className={inputCls} placeholder="FR12345678900" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-body text-xs text-[var(--color-text-secondary)]">Forme juridique</label>
              <select value={form.legalForm} onChange={(e) => set('legalForm', e.target.value)} className={inputCls + ' cursor-pointer'}>
                <option value="">-</option>
                <option value="SAS">SAS</option>
                <option value="SARL">SARL</option>
                <option value="SA">SA</option>
                <option value="EI">EI</option>
                <option value="EURL">EURL</option>
                <option value="SNC">SNC</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="font-body text-xs text-[var(--color-text-secondary)]">RCS</label>
              <input value={form.rcs} onChange={(e) => set('rcs', e.target.value)} className={inputCls} placeholder="RCS Paris 123 456 789" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="font-body text-xs text-[var(--color-text-secondary)]">Adresse du siège</label>
            <input value={form.legalAddress} onChange={(e) => set('legalAddress', e.target.value)} className={inputCls} placeholder="12 rue du Faubourg Saint-Honoré" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-body text-xs text-[var(--color-text-secondary)]">Code postal</label>
              <input value={form.legalZipCode} onChange={(e) => set('legalZipCode', e.target.value)} className={inputCls} placeholder="75008" />
            </div>
            <div className="space-y-1.5">
              <label className="font-body text-xs text-[var(--color-text-secondary)]">Ville</label>
              <input value={form.legalCity} onChange={(e) => set('legalCity', e.target.value)} className={inputCls} placeholder="Paris" />
            </div>
          </div>
        </div>
      </div>

      {/* E-invoicing PDP */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck size={14} weight="regular" className="text-[var(--color-accent)]" />
          <p className="font-body text-sm font-semibold text-[var(--color-text-primary)]">
            Facturation électronique : plateforme agréée
          </p>
          <span className="tabular text-xs text-[var(--color-warning)] bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20 px-1.5 py-0.5 rounded-full">
            Obligatoire sept. 2026
          </span>
        </div>

        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-body text-sm text-[var(--color-text-primary)]">Transmission automatique au PDP</p>
              <p className="font-body text-xs text-[var(--color-text-muted)]">
                Envoie chaque facture B2B à votre plateforme agréée
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.pdpEnabled}
              aria-label="Facturation électronique via PDP"
              onClick={() => set('pdpEnabled', !form.pdpEnabled)}
              className={[
                'w-10 h-6 rounded-full transition-colors relative',
                form.pdpEnabled ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)]',
              ].join(' ')}
            >
              <span className={[
                'absolute top-0.5 w-4 h-4 rounded-full transition-transform duration-200',
                form.pdpEnabled ? 'translate-x-5 bg-[var(--color-on-accent)]' : 'translate-x-0.5 bg-[var(--color-bg-inverse)]',
              ].join(' ')} />
            </button>
          </div>

          {form.pdpEnabled && (
            <>
              <div className="space-y-1.5">
                <label className="font-body text-xs text-[var(--color-text-secondary)]">Nom du PDP</label>
                <select value={form.pdpName} onChange={(e) => set('pdpName', e.target.value)} className={inputCls + ' cursor-pointer'}>
                  <option value="">Sélectionner...</option>
                  <option value="Chorus Pro">Chorus Pro (plateforme publique)</option>
                  <option value="Yooz">Yooz</option>
                  <option value="Pennylane">Pennylane</option>
                  <option value="Sage">Sage</option>
                  <option value="Cegid">Cegid</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="font-body text-xs text-[var(--color-text-secondary)]">URL API PDP</label>
                <input value={form.pdpEndpoint} onChange={(e) => set('pdpEndpoint', e.target.value)} className={inputCls + ' tabular'} placeholder="https://api.monpdp.fr/invoices" />
              </div>
              <div className="space-y-1.5">
                <label className="font-body text-xs text-[var(--color-text-secondary)]">Clé API PDP</label>
                <input value={form.pdpApiKey} onChange={(e) => set('pdpApiKey', e.target.value)} type="password" className={inputCls + ' font-data'} placeholder="sk_live_..." />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <motion.button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          whileTap={{ scale: 0.98 }}
          className="px-5 h-10 bg-[var(--color-accent)] text-[var(--color-on-accent)] font-body text-sm font-semibold rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)] transition-colors"
        >
          {save.isPending ? 'Enregistrement...' : 'Enregistrer'}
        </motion.button>
      </div>
    </div>
  )
}
