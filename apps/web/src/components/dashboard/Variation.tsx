import { ArrowDown, ArrowUp, Minus, Prohibit } from '@phosphor-icons/react'
import { describeVariation } from './network'

// Variation par rapport à la période précédente. Ni rouge ni vert : la
// direction se dit par une flèche et par le signe, et les lecteurs d'écran
// lisent « en hausse de 12 % par rapport à la période précédente ».
export function Variation({ value, className = '' }: { value: number | null; className?: string }) {
  const v = describeVariation(value)
  const Icon = v.direction === 'up' ? ArrowUp : v.direction === 'down' ? ArrowDown : v.direction === 'flat' ? Minus : Prohibit
  return (
    <span
      className={`inline-flex items-center gap-1 font-body text-sm ${v.direction === 'none' ? 'text-[var(--color-text-secondary)]' : 'font-medium text-[var(--color-text-primary)]'} ${className}`}
    >
      <Icon size={14} weight={v.direction === 'none' ? 'regular' : 'bold'} aria-hidden className="shrink-0" />
      <span aria-hidden>{v.visible}</span>
      <span className="sr-only">{v.spoken}</span>
    </span>
  )
}
