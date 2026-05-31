'use client'

import { SignOut, Lightning, Clock } from '@phosphor-icons/react'
import { useAuthStore } from '@/stores/auth.store'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface POSHeaderProps {
  siteName: string
}

export function POSHeader({ siteName }: POSHeaderProps) {
  const { user, logout } = useAuthStore()
  const router = useRouter()
  const [time, setTime] = useState('')

  useEffect(() => {
    const update = () => {
      setTime(
        new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      )
    }
    update()
    const id = setInterval(update, 30_000)
    return () => clearInterval(id)
  }, [])

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <header className="flex items-center justify-between h-12 px-4 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] shrink-0">
      <div className="flex items-center gap-3">
        <span className="font-display text-base text-[var(--color-text-primary)] leading-none">
          {siteName}
        </span>
        <span className="h-3 w-px bg-[var(--color-border-strong)]" />
        <span className="flex items-center gap-1 font-data text-xs text-[var(--color-text-muted)]">
          <Clock size={11} weight="regular" />
          {time}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Lightning size={10} weight="fill" className="text-[var(--color-success)]" />
          <span className="font-data text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">
            En ligne
          </span>
        </div>

        {user && (
          <span className="font-body text-xs text-[var(--color-text-secondary)]">
            {user.firstName} {user.lastName[0]}.
          </span>
        )}

        <button
          onClick={handleLogout}
          className="flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
          aria-label="Se déconnecter"
        >
          <SignOut size={13} weight="regular" />
        </button>
      </div>
    </header>
  )
}
