'use client'

import { motion } from 'framer-motion'
import type { ApiCategory } from '@/lib/api/products'

interface CategoryTabsProps {
  categories: ApiCategory[]
  selected: string | null
  onSelect: (id: string | null) => void
}

export function CategoryTabs({ categories, selected, onSelect }: CategoryTabsProps) {
  const all = [
    { id: null, name: 'Tous', color: null, _count: { products: categories.reduce((s, c) => s + c._count.products, 0) } },
    ...categories,
  ]

  return (
    <nav className="flex flex-col gap-0.5 py-3 px-2 w-44 shrink-0 border-r border-[var(--color-border)] overflow-y-auto">
      {all.map((cat) => {
        const isActive = selected === (cat.id ?? null)
        return (
          <button
            key={cat.id ?? 'all'}
            onClick={() => onSelect(cat.id ?? null)}
            className={[
              'relative flex items-center justify-between gap-2 px-3 py-2.5 rounded-[var(--radius-md)] text-left transition-colors group',
              isActive
                ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]',
            ].join(' ')}
          >
            {isActive && (
              <motion.span
                layoutId="category-indicator"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                style={{ backgroundColor: cat.color ?? 'var(--color-accent)' }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}

            <span className="font-body text-sm truncate pl-1">{cat.name}</span>

            <span
              className={[
                'font-data text-[10px] shrink-0 transition-colors',
                isActive ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]',
              ].join(' ')}
            >
              {cat._count.products}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
