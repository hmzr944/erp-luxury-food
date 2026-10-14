import { motion } from 'framer-motion'
import type { ElementType } from 'react'
import { EASE_OUT } from '@/lib/motion'

interface KPICardProps {
  label: string
  value: string
  sub?: string
  icon: ElementType
  accent?: boolean
  index?: number
}

export function KPICard({ label, value, sub, icon: Icon, accent, index = 0 }: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04, ease: EASE_OUT }}
      className={[
        'flex flex-col gap-3 p-4 rounded-[var(--radius-lg)] border',
        accent
          ? 'bg-[var(--color-accent-muted)] border-[var(--color-accent)]/20'
          : 'bg-[var(--color-bg-surface)] border-[var(--color-border)]',
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <span className="font-body text-xs text-[var(--color-text-muted)]">{label}</span>
        <Icon
          size={14}
          weight="regular"
          className={accent ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}
        />
      </div>

      <div>
        <p
          className={[
            'tabular font-display text-3xl font-bold leading-none tracking-[-0.03em]',
            accent ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]',
          ].join(' ')}
        >
          {value}
        </p>
        {sub && (
          <p className="font-body text-sm text-[var(--color-text-muted)] mt-1">{sub}</p>
        )}
      </div>
    </motion.div>
  )
}
