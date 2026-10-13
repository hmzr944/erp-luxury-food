'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import {
  Armchair, CaretLeft, Cookie, Diamond, Drop, Eye, EyeSlash, Scissors, Storefront, TShirt, Wine,
} from '@phosphor-icons/react'
import { SECTOR_PRESETS, Sector } from '@erp/types'
import { useAuthStore } from '@/stores/auth.store'

const SECTOR_ICON: Record<Sector, React.ElementType> = {
  [Sector.FOOD]: Cookie,
  [Sector.FASHION]: TShirt,
  [Sector.BEAUTY]: Drop,
  [Sector.JEWELRY]: Diamond,
  [Sector.WINE]: Wine,
  [Sector.HOME]: Armchair,
  [Sector.SERVICES]: Scissors,
  [Sector.GENERAL]: Storefront,
}

const ORDER = [Sector.FOOD, Sector.FASHION, Sector.BEAUTY, Sector.JEWELRY, Sector.WINE, Sector.HOME, Sector.SERVICES, Sector.GENERAL]

const fieldCls =
  'h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-4 text-base focus:border-[var(--color-accent)] focus:outline-none'

// Inscription en trois écrans, une seule question par écran
export function SignupFlow() {
  const router = useRouter()
  const { register, isLoading } = useAuthStore()
  const [step, setStep] = useState(0)
  const [sector, setSector] = useState<Sector | null>(null)
  const [business, setBusiness] = useState({ businessName: '', siteName: '' })
  const [account, setAccount] = useState({ firstName: '', lastName: '', email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!sector) return
    setError(null)
    try {
      const { siteId } = await register({
        sector,
        businessName: business.businessName.trim(),
        siteName: business.siteName.trim() || undefined,
        ...account,
        email: account.email.trim(),
      })
      router.push(`/onboarding?site=${siteId}`)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const titles = ['Quel est votre commerce\u00a0?', 'Le nom de votre commerce', 'Votre compte']

  return (
    <MotionConfig reducedMotion="user">
      <main className="flex min-h-[100dvh] justify-center bg-[var(--color-bg-base)] px-4 py-10 text-[var(--color-text-primary)] md:items-center">
        <div className="w-full max-w-xl space-y-6">
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                aria-label="Étape précédente"
                className="-ml-3 grid size-11 place-items-center rounded-[var(--radius-pill)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
              >
                <CaretLeft size={20} />
              </button>
            )}
            <p className="text-sm text-[var(--color-text-secondary)]">Étape {step + 1} sur 3</p>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{titles[step]}</h1>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            >
              {step === 0 && (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {ORDER.map((s) => {
                    const Icon = SECTOR_ICON[s]
                    const preset = SECTOR_PRESETS[s]
                    return (
                      <li key={s}>
                        <button
                          type="button"
                          aria-pressed={sector === s}
                          onClick={() => {
                            setSector(s)
                            setStep(1)
                          }}
                          className={[
                            'flex h-full min-h-32 w-full flex-col items-start justify-between gap-3 rounded-[var(--radius-lg)] border p-4 text-left transition-[transform,border-color] duration-150 active:scale-[0.98]',
                            sector === s ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)]' : 'border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] hover:border-[var(--color-accent)]',
                          ].join(' ')}
                        >
                          <Icon size={28} aria-hidden className="text-[var(--color-accent)]" />
                          <span>
                            <span className="block text-[15px] font-semibold">{preset.label}</span>
                            <span className="block text-sm text-[var(--color-text-secondary)]">{preset.description}</span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}

              {step === 1 && (
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (business.businessName.trim().length >= 2) setStep(2)
                  }}
                >
                  <div className="space-y-2">
                    <label htmlFor="business" className="block text-sm font-medium">
                      Nom du commerce
                    </label>
                    <input
                      id="business"
                      autoFocus
                      required
                      minLength={2}
                      value={business.businessName}
                      onChange={(e) => setBusiness({ ...business, businessName: e.target.value })}
                      className={fieldCls}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="site" className="block text-sm font-medium">
                      Nom de la boutique (facultatif)
                    </label>
                    <input id="site" value={business.siteName} onChange={(e) => setBusiness({ ...business, siteName: e.target.value })} className={fieldCls} />
                    <p className="text-sm text-[var(--color-text-secondary)]">Si vous en avez plusieurs, par exemple « Boutique Opéra ». Les autres s&apos;ajoutent plus tard.</p>
                  </div>
                  <button type="submit" className="h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)]">
                    Continuer
                  </button>
                </form>
              )}

              {step === 2 && (
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void submit()
                  }}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="first" className="block text-sm font-medium">
                        Prénom
                      </label>
                      <input id="first" autoFocus required autoComplete="given-name" value={account.firstName} onChange={(e) => setAccount({ ...account, firstName: e.target.value })} className={fieldCls} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="last" className="block text-sm font-medium">
                        Nom
                      </label>
                      <input id="last" required autoComplete="family-name" value={account.lastName} onChange={(e) => setAccount({ ...account, lastName: e.target.value })} className={fieldCls} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="email" className="block text-sm font-medium">
                      E-mail
                    </label>
                    <input id="email" type="email" required autoComplete="email" value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} className={fieldCls} />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="password" className="block text-sm font-medium">
                      Mot de passe
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        aria-describedby="password-help"
                        value={account.password}
                        onChange={(e) => setAccount({ ...account, password: e.target.value })}
                        className={fieldCls + ' pr-12'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center text-[var(--color-text-secondary)]"
                      >
                        {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    <p id="password-help" className="text-sm text-[var(--color-text-secondary)]">
                      8 caractères minimum.
                    </p>
                  </div>
                  {error && (
                    <p role="alert" className="rounded-[var(--radius-md)] bg-[var(--color-accent-muted)] p-3 text-sm font-medium">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)] disabled:opacity-60"
                  >
                    {isLoading ? 'Création...' : 'Créer mon espace'}
                  </button>
                </form>
              )}
            </motion.div>
          </AnimatePresence>

          <p className="text-center text-sm text-[var(--color-text-secondary)]">
            Déjà un compte&nbsp;?{' '}
            <Link href="/login" className="font-medium text-[var(--color-accent)] underline-offset-4 hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </main>
    </MotionConfig>
  )
}
