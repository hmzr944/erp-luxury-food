'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import {
  Armchair, Bread, CaretLeft, Diamond, Eye, EyeSlash, Hamburger, Jar, Scissors, Storefront, TShirt, Wine, Wrench,
} from '@phosphor-icons/react'
import { METIERS, Sector, type Metier } from '@erp/types'
import { useAuthStore } from '@/stores/auth.store'
import { EASE_OUT } from '@/lib/motion'
import { FlowLogo, FlowPulse } from '@/components/brand/FlowLogo'

const ICON: Record<string, React.ElementType> = {
  boulangerie: Bread,
  restauration: Hamburger,
  epicerie: Jar,
  mode: TShirt,
  beaute: Scissors,
  detail: Storefront,
  bijouterie: Diamond,
  maison: Armchair,
  cave: Wine,
  services: Wrench,
}

const fieldCls =
  'h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-4 text-base focus:border-[var(--color-accent)]'

// Inscription en deux écrans : le compte (trois champs, sans carte
// bancaire), puis le métier en un geste. La caisse s'ouvre aussitôt, réglée
// pour le métier et garnie d'un catalogue d'exemple.
export function SignupFlow() {
  const router = useRouter()
  const { register, isLoading } = useAuthStore()
  const [step, setStep] = useState(0)
  const [account, setAccount] = useState({ businessName: '', email: '', password: '', acceptTerms: false })
  const [showPassword, setShowPassword] = useState(false)
  const [others, setOthers] = useState(false)
  const [chosen, setChosen] = useState<Metier | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async (metier: Metier | null) => {
    setChosen(metier)
    setError(null)
    try {
      const { siteId } = await register({
        sector: metier?.sector ?? Sector.GENERAL,
        ...(metier ? { metier: metier.key } : {}),
        businessName: account.businessName.trim(),
        email: account.email.trim(),
        password: account.password,
        acceptTerms: true,
      })
      // Directement en caisse, en mode découverte : ventes d'essai fictives
      router.push(`/pos/${siteId}?decouverte=1`)
    } catch (e) {
      setChosen(null)
      setError((e as Error).message)
    }
  }

  const main = METIERS.filter((m) => !m.secondary)
  const secondary = METIERS.filter((m) => m.secondary)
  const titles = ['Essayez FLŌW gratuitement', 'Quel est votre commerce ?']

  if (isLoading || chosen) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[var(--color-bg-base)] px-4 text-[var(--color-text-primary)]">
        <div className="max-w-sm space-y-4 text-center" role="status" aria-live="polite">
          <FlowPulse size={44} className="mx-auto" />
          <p className="font-display text-2xl font-bold tracking-[-0.03em]">Votre caisse se prépare</p>
          <p className="text-[15px] text-[var(--color-text-secondary)]">
            {chosen ? `${chosen.label} : TVA, moyens de paiement et catalogue d’exemple.` : 'TVA et moyens de paiement.'}
          </p>
        </div>
      </main>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <main className="flex min-h-[100dvh] justify-center bg-[var(--color-bg-base)] px-4 py-10 text-[var(--color-text-primary)] md:items-center">
        <div className="w-full max-w-2xl space-y-6">
          <Link href="/" aria-label="FLŌW, accueil" className="inline-flex">
            <FlowLogo size={18} />
          </Link>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(0)}
                aria-label="Étape précédente"
                className="-ml-3 grid size-11 place-items-center rounded-[var(--radius-pill)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
              >
                <CaretLeft size={20} />
              </button>
            )}
            <p className="text-sm text-[var(--color-text-secondary)]">Étape {step + 1} sur 2</p>
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-4xl font-bold tracking-[-0.035em]">{titles[step]}</h1>
            <p className="text-[15px] text-[var(--color-text-secondary)]">
              {step === 0
                ? '30 jours d’essai, sans carte bancaire. Votre caisse est prête en moins de trois minutes.'
                : 'Un geste : la TVA, les moyens de paiement et un catalogue d’exemple se règlent pour votre métier.'}
            </p>
          </div>

          {error && (
            <p role="alert" className="alert-box">
              {error}
            </p>
          )}

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
            >
              {step === 0 && (
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (account.businessName.trim().length >= 2 && account.acceptTerms) setStep(1)
                  }}
                >
                  <div className="space-y-2">
                    <label htmlFor="business" className="block text-sm font-medium">
                      Nom de la boutique
                    </label>
                    <input
                      id="business"
                      autoFocus
                      required
                      minLength={2}
                      autoComplete="organization"
                      value={account.businessName}
                      onChange={(e) => setAccount({ ...account, businessName: e.target.value })}
                      className={fieldCls}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="email" className="block text-sm font-medium">
                      E-mail
                    </label>
                    <input id="email" type="email" required autoComplete="email" spellCheck={false} value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} className={fieldCls} />
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
                        minLength={10}
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
                      10 caractères minimum.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <input
                      id="terms"
                      type="checkbox"
                      required
                      checked={account.acceptTerms}
                      onChange={(e) => setAccount({ ...account, acceptTerms: e.target.checked })}
                      className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]"
                    />
                    <label htmlFor="terms" className="text-sm text-[var(--color-text-secondary)]">
                      J’accepte les{' '}
                      <TermsLink href="/legal/cgu">conditions générales d’utilisation</TermsLink> et{' '}
                      <TermsLink href="/legal/cgv">de vente</TermsLink> et la{' '}
                      <TermsLink href="/legal/confidentialite">politique de confidentialité</TermsLink>.
                    </label>
                  </div>
                  <button type="submit" className="h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)] press">
                    Continuer
                  </button>
                  <p className="text-center text-sm text-[var(--color-text-secondary)]">Aucune carte bancaire demandée. Rien n’est prélevé pendant l’essai.</p>
                </form>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {main.map((m) => (
                      <MetierTile key={m.key} metier={m} onPick={() => void submit(m)} />
                    ))}
                  </ul>
                  {others ? (
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {secondary.map((m) => (
                        <MetierTile key={m.key} metier={m} onPick={() => void submit(m)} />
                      ))}
                      <li>
                        <button
                          type="button"
                          onClick={() => void submit(null)}
                          className="flex h-full min-h-36 w-full flex-col items-start gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] p-4 text-left hover:border-[var(--color-accent)] press"
                        >
                          <span className="text-[15px] font-semibold">Autre</span>
                          <span className="text-sm text-[var(--color-text-secondary)]">Caisse vide, réglages généraux</span>
                        </button>
                      </li>
                    </ul>
                  ) : (
                    <button type="button" onClick={() => setOthers(true)} className="h-11 text-sm font-medium text-[var(--color-accent)] underline-offset-4 hover:underline">
                      Autre activité
                    </button>
                  )}
                </div>
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

// S'ouvre dans un nouvel onglet : le formulaire en cours reste rempli
function TermsLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--color-accent)] underline underline-offset-4">
      {children}
      <span className="sr-only"> (nouvel onglet)</span>
    </a>
  )
}

function MetierTile({ metier, onPick }: { metier: Metier; onPick: () => void }) {
  const Icon = ICON[metier.key] ?? Storefront
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className="flex h-full min-h-36 w-full flex-col items-start gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] p-4 text-left hover:border-[var(--color-accent)] press"
      >
        <span className="grid size-12 place-items-center rounded-[var(--radius-md)] bg-[var(--color-accent-muted)] text-[var(--color-accent)]">
          <Icon size={28} aria-hidden />
        </span>
        <span>
          <span className="block text-[15px] font-semibold leading-snug">{metier.label}</span>
          <span className="mt-1 block text-sm text-[var(--color-text-secondary)]">{metier.hint}</span>
        </span>
      </button>
    </li>
  )
}
