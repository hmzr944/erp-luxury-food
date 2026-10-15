'use client'

import { Lifebuoy } from '@phosphor-icons/react'
import { useSupportUnread } from '@/lib/api/support'
import { openSupport } from '@/lib/support/context'

// Entrée « Aide et support » des menus, avec le nombre de réponses non lues
export function SupportNavButton({ className, onOpen, iconSize = 18 }: { className: string; onOpen?: () => void; iconSize?: number }) {
  const unread = useSupportUnread().data?.count ?? 0
  return (
    <button
      type="button"
      onClick={() => {
        onOpen?.()
        openSupport()
      }}
      className={className}
    >
      <Lifebuoy size={iconSize} aria-hidden />
      <span className="flex-1 text-left">Aide et support</span>
      {unread > 0 && (
        <span className="rounded-[var(--radius-pill)] bg-[var(--color-accent)] px-2 py-0.5 text-xs font-semibold text-[var(--color-on-accent)] tabular">
          {unread}
          <span className="sr-only"> {unread > 1 ? 'réponses non lues' : 'réponse non lue'}</span>
        </span>
      )}
    </button>
  )
}
