import type { ReactNode } from 'react'
import { FlowLogo, FlowMark } from '@/components/brand/FlowLogo'

export const fieldCls =
  'h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-4 text-base focus:border-[var(--color-accent)]'

export const submitCls =
  'h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)]'

export const noticeCls = 'rounded-[var(--radius-md)] bg-[var(--color-accent-muted)] p-3 text-[15px] font-medium'

// Même mise en page que la connexion : aplat encre à gauche sur grand écran
export function PasswordShell({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <main className="grid min-h-[100dvh] bg-[var(--color-bg-base)] text-[var(--color-text-primary)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside aria-hidden className="relative hidden overflow-hidden bg-[var(--color-bg-inverse)] lg:flex lg:items-center lg:justify-center">
        <FlowMark size={300} inverse />
      </aside>
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm space-y-8">
          <header className="space-y-1 text-center">
            <div className="mb-5">
              <FlowLogo size={26} />
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight">{title}</h1>
            <p className="text-[15px] text-[var(--color-text-secondary)]">{lead}</p>
          </header>
          {children}
        </div>
      </div>
    </main>
  )
}
