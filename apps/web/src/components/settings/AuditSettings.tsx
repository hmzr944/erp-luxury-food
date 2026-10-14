'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'

interface AuditEntry {
  id: string
  userId: string | null
  action: string
  target: string | null
  detail: string | null
  terminalId: string | null
  createdAt: string
}

const LABEL: Record<string, string> = {
  'auth.login': 'Connexion',
  'auth.login_failed': 'Mot de passe refusé',
  'auth.till_login': 'Connexion en caisse (code ou badge)',
  'auth.till_refused': 'Code ou badge refusé en caisse',
  'auth.logout_everywhere': 'Déconnexion de tous les appareils',
  'user.created': 'Membre ajouté',
  'user.removed': 'Membre retiré',
  'user.role_changed': 'Rôle modifié',
  'user.password_changed': 'Mot de passe changé',
  'user.pin_set': 'Code vendeur créé',
  'user.pin_cleared': 'Code vendeur retiré',
  'user.badge_set': 'Badge créé',
  'user.badge_cleared': 'Badge désactivé',
  'refund.created': 'Remboursement',
  'cash.closed': 'Caisse fermée',
}

const FILTERS: Array<[string, string]> = [
  ['', 'Tout'],
  ['auth', 'Connexions'],
  ['user', 'Équipe'],
  ['refund', 'Remboursements'],
  ['cash', 'Caisse'],
]

// Journal des actions sensibles : connexions, équipe, remboursements, caisse
export function AuditSettings() {
  const [filter, setFilter] = useState('')
  const users = useQuery({ queryKey: ['users-settings'], queryFn: () => apiClient<Array<{ id: string; firstName: string; lastName: string }>>('/users') })
  const log = useQuery({
    queryKey: ['audit', filter],
    queryFn: () => apiClient<AuditEntry[]>(`/organizations/me/audit${filter ? `?action=${filter}` : ''}`),
  })
  const who = (id: string | null) => {
    const u = users.data?.find((x) => x.id === id)
    return u ? `${u.firstName} ${u.lastName}` : ''
  }
  return (
    <div className="max-w-3xl space-y-5 p-6 md:p-8">
      <header>
        <h1 className="page-title">Journal de sécurité</h1>
        <p className="text-[15px] text-[var(--color-text-secondary)]">Les actions sensibles, horodatées. Rien ne peut y être modifié ni effacé depuis l&apos;application.</p>
      </header>
      <div role="radiogroup" aria-label="Filtre" className="flex flex-wrap gap-2">
        {FILTERS.map(([k, l]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={filter === k}
            onClick={() => setFilter(k)}
            className={['h-11 rounded-[var(--radius-pill)] px-4 text-sm font-medium', filter === k ? 'bg-[var(--color-bg-inverse)] text-[var(--color-text-inverse)]' : 'border border-[var(--color-border-strong)]'].join(' ')}
          >
            {l}
          </button>
        ))}
      </div>
      <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
        {(log.data ?? []).map((e) => (
          <li key={e.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
            <span className="tabular w-36 shrink-0 text-sm text-[var(--color-text-secondary)]">
              {new Date(e.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">{LABEL[e.action] ?? e.action}</span>
              <span className="block text-sm text-[var(--color-text-secondary)]">
                {[who(e.userId), e.target && e.target !== e.userId ? who(e.target) : '', e.detail].filter(Boolean).join(', ')}
              </span>
            </span>
          </li>
        ))}
        {log.data?.length === 0 && <li className="px-4 py-6 text-[15px] text-[var(--color-text-secondary)]">Rien pour ce filtre.</li>}
      </ul>
    </div>
  )
}
