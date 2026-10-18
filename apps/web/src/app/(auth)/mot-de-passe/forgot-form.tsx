'use client'

import { useState } from 'react'
import Link from 'next/link'
import { forgotPassword } from '@/lib/api/auth'
import { PasswordShell, fieldCls, noticeCls, submitCls } from './shell'

// Demande d'un lien par e-mail. Le message est le même que le compte
// existe ou non : la page ne révèle pas qui a un compte.
export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <PasswordShell title="Mot de passe oublié" lead="Indiquez l’e-mail de votre compte : nous vous envoyons un lien pour en choisir un nouveau.">
      {sent ? (
        <div className="space-y-4">
          <p role="status" className={noticeCls}>
            Si un compte existe pour cette adresse, un e-mail vient de partir. Le lien marche une seule fois, pendant une heure.
          </p>
          <p className="text-center text-sm text-[var(--color-text-secondary)]">
            Rien reçu&nbsp;? Regardez dans les courriers indésirables, ou{' '}
            <button type="button" onClick={() => setSent(false)} className="font-medium text-[var(--color-accent)] underline-offset-4 hover:underline">
              recommencez
            </button>
            .
          </p>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            setError(null)
            setSending(true)
            try {
              await forgotPassword(email.trim())
              setSent(true)
            } catch (err) {
              setError((err as Error).message)
            } finally {
              setSending(false)
            }
          }}
        >
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              spellCheck={false}
              required
              autoFocus
              aria-invalid={!!error}
              aria-describedby={error ? 'forgot-error' : undefined}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldCls}
            />
          </div>
          {error && (
            <p id="forgot-error" role="alert" className="alert-box">
              {error}
            </p>
          )}
          <button type="submit" disabled={sending || !email} className={submitCls}>
            {sending ? 'Envoi...' : 'Recevoir le lien'}
          </button>
        </form>
      )}
      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        <Link href="/login" className="font-medium text-[var(--color-accent)] underline-offset-4 hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </PasswordShell>
  )
}
