import { motion } from 'framer-motion'
import type { ElementType } from 'react'

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
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
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
            'font-data text-2xl leading-none',
            accent ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]',
          ].join(' ')}
        >
          {value}
        </p>
        {sub && (
          <p className="font-body text-[11px] text-[var(--color-text-muted)] mt-1">{sub}</p>
        )}
      </div>
    </motion.div>
  )
}
