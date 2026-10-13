'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Storefront, Users, Printer, ArrowRight } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api/client'
import { useSiteStore } from '@/stores/site.store'
import { useAuthStore } from '@/stores/auth.store'

const STEPS = [
  { id: 1, title: 'Votre boutique',   icon: Storefront, description: 'Configurez votre premier point de vente' },
  { id: 2, title: 'Votre équipe',     icon: Users,      description: 'Invitez vos collaborateurs (optionnel)' },
  { id: 3, title: 'Impression',       icon: Printer,    description: 'Connectez votre imprimante ticket (optionnel)' },
  { id: 4, title: "C'est parti !",    icon: CheckCircle, description: 'Votre espace est prêt' },
]

const inputCls = 'w-full h-10 px-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-[var(--radius-md)] font-body text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]/40 focus:ring-1 focus:ring-[var(--color-accent)]/20 transition-colors'

export function OnboardingWizard() {
  const router = useRouter()
  const { setSites, selectSite } = useSiteStore()
  const { user } = useAuthStore()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  const [siteData, setSiteData] = useState({ name: '', address: '' })
  const [createdSiteId, setCreatedSiteId] = useState<string | null>(null)

  const handleCreateSite = async () => {
    if (!siteData.name.trim()) { toast.error('Nommez votre boutique'); return }
    setLoading(true)
    try {
      const site = await apiClient<{ id: string; name: string }>('/sites', {
        method: 'POST',
        body: JSON.stringify(siteData),
      })
      setCreatedSiteId(site.id)
      setSites([{ id: site.id, name: site.name, timezone: 'Europe/Paris' }])
      selectSite({ id: site.id, name: site.name, timezone: 'Europe/Paris' })
      setStep(2)
    } catch (err: any) {
      toast.error(err.message ?? 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  const handleFinish = () => {
    localStorage.setItem('erp-onboarded', 'true')
    if (createdSiteId) {
      router.push(`/pos/${createdSiteId}`)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[var(--color-bg-base)] px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
        {/* Brand */}
        <p className="font-display text-2xl text-center text-[var(--color-text-primary)] mb-2">
          Bienvenue{user?.firstName ? `, ${user.firstName}` : ''}
        </p>
        <p className="font-body text-sm text-center text-[var(--color-text-muted)] mb-8">
          Configurez votre espace en quelques minutes
        </p>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={[
                  'w-6 h-6 rounded-full flex items-center justify-center font-data text-[10px] transition-all',
                  s.id < step
                    ? 'bg-[var(--color-success)] text-[var(--color-on-accent)]'
                    : s.id === step
                    ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                    : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border border-[var(--color-border)]',
                ].join(' ')}
              >
                {s.id < step ? <CheckCircle size={12} weight="bold" /> : s.id}
              </div>
              {s.id < STEPS.length && (
                <div className={['w-8 h-px', s.id < step ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border)]'].join(' ')} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-xl)] p-6">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                className="space-y-4"
              >
                <p className="font-body text-base font-semibold text-[var(--color-text-primary)]">
                  Votre boutique
                </p>
                <div className="space-y-3">
                  <input
                    value={siteData.name}
                    onChange={(e) => setSiteData({ ...siteData, name: e.target.value })}
                    className={inputCls} placeholder="ex. Boutique Chocolat Paris 8e"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateSite()}
                    autoFocus
                  />
                  <input
                    value={siteData.address}
                    onChange={(e) => setSiteData({ ...siteData, address: e.target.value })}
                    className={inputCls} placeholder="Adresse (optionnel)"
                  />
                </div>
                <motion.button
                  onClick={handleCreateSite}
                  disabled={loading || !siteData.name.trim()}
                  whileTap={{ scale: 0.98 }}
                  className="w-full h-11 bg-[var(--color-accent)] text-[var(--color-on-accent)] font-body text-sm font-semibold rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] disabled:opacity-40 flex items-center justify-center gap-2 transition-all"
                >
                  {loading ? 'Création...' : <>Continuer <ArrowRight size={14} weight="bold" /></>}
                </motion.button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                className="space-y-4"
              >
                <p className="font-body text-base font-semibold text-[var(--color-text-primary)]">
                  Votre équipe
                </p>
                <p className="font-body text-sm text-[var(--color-text-muted)]">
                  Vous pouvez inviter vos vendeurs depuis Paramètres / Équipe à tout moment.
                </p>
                <motion.button
                  onClick={() => setStep(3)}
                  whileTap={{ scale: 0.98 }}
                  className="w-full h-11 bg-[var(--color-accent)] text-[var(--color-on-accent)] font-body text-sm font-semibold rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] flex items-center justify-center gap-2 transition-all"
                >
                  Continuer <ArrowRight size={14} weight="bold" />
                </motion.button>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                className="space-y-4"
              >
                <p className="font-body text-base font-semibold text-[var(--color-text-primary)]">
                  Impression thermique
                </p>
                <p className="font-body text-sm text-[var(--color-text-muted)]">
                  Connectez une imprimante Epson ou Star via PrintNode. Cette étape peut être
                  configurée plus tard dans Paramètres / Impression.
                </p>
                <motion.button
                  onClick={() => setStep(4)}
                  whileTap={{ scale: 0.98 }}
                  className="w-full h-11 bg-[var(--color-accent)] text-[var(--color-on-accent)] font-body text-sm font-semibold rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] flex items-center justify-center gap-2 transition-all"
                >
                  Continuer <ArrowRight size={14} weight="bold" />
                </motion.button>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4 py-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
                >
                  <CheckCircle size={48} weight="fill" className="text-[var(--color-success)]" />
                </motion.div>

                <div className="text-center space-y-1">
                  <p className="font-body text-base font-semibold text-[var(--color-text-primary)]">
                    Votre espace est prêt
                  </p>
                  <p className="font-body text-sm text-[var(--color-text-muted)]">
                    Ouvrez la caisse pour commencer à vendre.
                  </p>
                </div>

                <motion.button
                  onClick={handleFinish}
                  whileTap={{ scale: 0.98 }}
                  className="w-full h-11 bg-[var(--color-accent)] text-[var(--color-on-accent)] font-body text-sm font-semibold rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] transition-all"
                >
                  Ouvrir la caisse
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center mt-4 font-body text-xs text-[var(--color-text-muted)]">
          Étape {step} sur {STEPS.length}
        </p>
      </motion.div>
    </div>
  )
}
