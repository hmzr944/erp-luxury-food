import { Warning } from '@phosphor-icons/react'

// Erreur de saisie : l'identité n'a pas de rouge, l'erreur se reconnaît à
// son icône, sa graisse et son annonce aux lecteurs d'écran
export function FieldError({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <p id={id} role="alert" className={`flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-primary)] ${className}`}>
      <Warning size={16} weight="fill" aria-hidden className="shrink-0" />
      {children}
    </p>
  )
}
