import { CalendarBlank, CalendarCheck, Hourglass, WarningOctagon, Minus } from '@phosphor-icons/react'
import type { DateKind, LotStatus } from '@/lib/api/lots'
import { statusLabel } from './lots-view'

// L'état se dit par un mot et une icône ; la forme de la pastille suit la gravité :
// plein (périmé), cerclé de violet (à écouler), simple filet, ou texte nu
const STYLE: Record<LotStatus, { cls: string; Icon: typeof Hourglass }> = {
  EXPIRED: { cls: 'bg-[var(--color-bg-inverse)] text-[var(--color-text-inverse)] font-semibold', Icon: WarningOctagon },
  TODAY: { cls: 'border-2 border-[var(--color-accent)] text-[var(--color-text-primary)] font-semibold', Icon: Hourglass },
  SOON: { cls: 'border border-[var(--color-accent)] text-[var(--color-text-primary)] font-medium', Icon: Hourglass },
  NEAR: { cls: 'border border-[var(--color-border-strong)] text-[var(--color-text-primary)]', Icon: CalendarBlank },
  OK: { cls: 'text-[var(--color-text-secondary)]', Icon: CalendarCheck },
  NO_DATE: { cls: 'text-[var(--color-text-secondary)]', Icon: Minus },
}

export function LotBadge({ status, daysLeft, kind }: { status: LotStatus; daysLeft: number | null; kind?: DateKind }) {
  const { cls, Icon } = STYLE[status]
  return (
    <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 text-sm ${cls}`}>
      <Icon size={16} weight={status === 'EXPIRED' ? 'fill' : 'regular'} aria-hidden />
      {statusLabel(status, daysLeft, kind)}
    </span>
  )
}
