'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeSlash } from '@phosphor-icons/react'
import { useAuthStore } from '@/stores/auth.store'
import { homePath } from '@/lib/workspace'
import { localTerminals } from '@/lib/terminal/terminal'
import { PinPad } from '@/components/auth/PinPad'
import { BadgeLogin } from '@/components/auth/BadgeLogin'
import { FlowLogo, FlowMark } from '@/components/brand/FlowLogo'

const fieldCls =
  'h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-4 text-base focus:border-[var(--color-accent)]'

type Till = { siteId: string; terminalId: string; name: string }

// Connexion. Sur une tablette déjà caisse, le code vendeur à 4 chiffres
// suffit ; ailleurs, e-mail et mot de passe. Chacun arrive dans son espace.
export default function LoginPage() {
  const router = useRouter()
  const { login, pinLogin, badgeLogin, isLoading, error, clearError } = useAuthStore()
  const [tills, setTills] = useState<Till[] | null>(null)
  const [till, setTill] = useState<Till | null>(null)
  const [mode, setMode] = useState<'pin' | 'email'>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)

  useEffect(() => {
    localTerminals()
      .then((t) => {
        setTills(t)
        if (t.length) {
          setTill(t[0])
          setMode('pin')
        }
      })
      .catch(() => setTills([]))
  }, [])

  const go = async () => {
    const user = useAuthStore.getState().user
    router.replace(await homePath(user?.role, till?.siteId))
  }

  const submitPin = useCallback(
    async (pin: string) => {
      if (!till) return
      setPinError(null)
      try {
        const { offline } = await pinLogin(till.siteId, pin)
        // Sans réseau : directement à la caisse de cet appareil, pour vendre
        if (offline) {
          router.replace(`/pos/${till.siteId}`)
          return
        }
        const user = useAuthStore.getState().user
        router.replace(await homePath(user?.role, till.siteId))
      } catch (e) {
        setPinError((e as Error).message)
        throw e
      }
    },
    [till, pinLogin, router],
  )

  return (
    <main className="grid min-h-[100dvh] bg-[var(--color-bg-base)] text-[var(--color-text-primary)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Grand écran : le signe se forme sur l'aplat encre, une fois ; moitié papier, moitié violette */}
      <aside aria-hidden className="relative hidden overflow-hidden bg-[var(--color-bg-inverse)] lg:flex lg:items-center lg:justify-center">
        <FlowMark size={300} inverse motion="form" />
      </aside>
      <div className="flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-8">
        <header className="space-y-1 text-center">
          {/* Une seule marque visible : elle se forme sur téléphone, le grand signe s'en charge à gauche sur grand écran */}
          <div className="mb-5 lg:hidden">
            <FlowLogo size={26} motion="form" />
          </div>
          <div aria-hidden className="mb-5 hidden lg:block">
            <FlowLogo size={26} />
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight">{mode === 'pin' ? 'Qui encaisse ?' : 'Connexion'}</h1>
          {mode === 'pin' && till && <p className="text-[15px] text-[var(--color-text-secondary)]">Code ou badge, sur {till.name}</p>}
        </header>

        {mode === 'pin' && till ? (
          <>
            {tills && tills.length > 1 && (
              <div role="radiogroup" aria-label="Caisse" className="flex flex-wrap justify-center gap-2">
                {tills.map((t) => (
                  <button
                    key={t.siteId}
                    type="button"
                    role="radio"
                    aria-checked={t.siteId === till.siteId}
                    onClick={() => setTill(t)}
                    className={['h-11 rounded-[var(--radius-pill)] px-4 text-sm font-medium', t.siteId === till.siteId ? 'bg-[var(--color-bg-inverse)] text-[var(--color-text-inverse)]' : 'border border-[var(--color-border-strong)]'].join(' ')}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
            <PinPad onSubmit={submitPin} error={pinError} />
            <BadgeLogin
              onBadge={async (code) => {
                await badgeLogin(till.siteId, code)
                const user = useAuthStore.getState().user
                router.replace(await homePath(user?.role, till.siteId))
              }}
            />
            <button type="button" onClick={() => setMode('email')} className="block h-11 w-full text-[15px] font-medium text-[var(--color-accent)]">
              Se connecter avec un e-mail
            </button>
          </>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault()
              clearError()
              try {
                await login(email.trim(), password)
                await go()
              } catch {
                // message affiché par le store
              }
            }}
          >
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium">
                E-mail
              </label>
              <input id="email" type="email" autoComplete="email" required aria-invalid={!!error} aria-describedby={error ? 'login-error' : undefined} value={email} onChange={(e) => setEmail(e.target.value)} className={fieldCls} />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  aria-invalid={!!error}
                  aria-describedby={error ? 'login-error' : undefined}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
            </div>
            {error && (
              <p id="login-error" role="alert" className="alert-box">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)]"
            >
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </button>
            {tills && tills.length > 0 && (
              <button type="button" onClick={() => setMode('pin')} className="block h-11 w-full text-[15px] font-medium text-[var(--color-accent)]">
                Utiliser un code vendeur
              </button>
            )}
            <p className="text-center text-sm text-[var(--color-text-secondary)]">
              Nouveau commerce&nbsp;?{' '}
              <Link href="/inscription" className="font-medium text-[var(--color-accent)] underline-offset-4 hover:underline">
                Créer mon espace
              </Link>
            </p>
          </form>
        )}
      </div>
      </div>
    </main>
  )
}
