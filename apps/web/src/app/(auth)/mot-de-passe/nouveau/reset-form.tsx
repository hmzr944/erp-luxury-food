'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeSlash } from '@phosphor-icons/react'
import { PASSWORD_MIN, passwordProblem, resetPassword } from '@/lib/api/auth'
import { PasswordShell, fieldCls, submitCls } from '../shell'

// Lien reçu par e-mail : nouveau mot de passe, puis retour à la connexion.
// Les appareils encore connectés sont déconnectés par l'API.
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!token) {
    return (
      <PasswordShell title="Nouveau mot de passe" lead="Ce lien est incomplet.">
        <p role="alert" className="alert-box">
          Ouvrez le lien tel qu’il figure dans l’e-mail, ou demandez-en un nouveau.
        </p>
        <Link href="/mot-de-passe" className={submitCls + ' grid place-items-center'}>
          Demander un nouveau lien
        </Link>
      </PasswordShell>
    )
  }

  return (
    <PasswordShell title="Nouveau mot de passe" lead="Choisissez-le, puis connectez-vous avec.">
      <form
        className="space-y-4"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault()
          const problem = passwordProblem(password, confirm)
          setError(problem)
          if (problem) return
          setSaving(true)
          try {
            await resetPassword(token, password)
            router.replace('/login?mdp=nouveau')
          } catch (err) {
            setError((err as Error).message)
            setSaving(false)
          }
        }}
      >
        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium">
            Nouveau mot de passe
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN}
              autoFocus
              aria-invalid={!!error}
              aria-describedby={error ? 'password-help reset-error' : 'password-help'}
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
          <p id="password-help" className="text-sm text-[var(--color-text-secondary)]">
            {PASSWORD_MIN} caractères minimum.
          </p>
        </div>
        <div className="space-y-2">
          <label htmlFor="confirm" className="block text-sm font-medium">
            Confirmation
          </label>
          <input
            id="confirm"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            aria-invalid={!!error}
            aria-describedby={error ? 'reset-error' : undefined}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={fieldCls}
          />
        </div>
        {error && (
          <p id="reset-error" role="alert" className="alert-box">
            {error}
          </p>
        )}
        <button type="submit" disabled={saving || !password || !confirm} className={submitCls}>
          {saving ? 'Enregistrement...' : 'Enregistrer le mot de passe'}
        </button>
      </form>
      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        Lien expiré&nbsp;?{' '}
        <Link href="/mot-de-passe" className="font-medium text-[var(--color-accent)] underline-offset-4 hover:underline">
          En demander un nouveau
        </Link>
      </p>
    </PasswordShell>
  )
}
