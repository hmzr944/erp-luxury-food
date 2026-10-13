'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, HourglassMedium, Coffee, Warning } from '@phosphor-icons/react'
import { formatPrice } from '@erp/utils'

// Fetch public — pas d'auth requise
async function fetchPickup(code: string) {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${base}/api/pickup/${code}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Commande introuvable')
  return res.json()
}

const STATUS_INFO: Record<string, { label: string; icon: React.ElementType; color: string; hint: string }> = {
  PENDING: {
    label: 'Commande reçue',
    icon: HourglassMedium,
    color: 'text-yellow-400',
    hint: 'Votre commande est en file d\'attente.',
  },
  PREPARING: {
    label: 'En préparation',
    icon: Coffee,
    color: 'text-blue-400',
    hint: 'Nos équipes préparent votre commande.',
  },
  READY: {
    label: 'Prête pour le retrait',
    icon: CheckCircle,
    color: 'text-[var(--color-success)]',
    hint: 'Présentez ce code en boutique.',
  },
  COMPLETED: {
    label: 'Retirée',
    icon: CheckCircle,
    color: 'text-[var(--color-text-muted)]',
    hint: 'Commande bien récupérée. Merci !',
  },
}

interface PickupClientProps { code: string }

export function PickupClient({ code }: PickupClientProps) {
  const [order, setOrder] = useState<any>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPickup(code)
      .then(setOrder)
      .catch(() => setError(true))
      .finally(() => setLoading(false))

    // Polling toutes les 15s pour les statuts actifs
    const id = setInterval(async () => {
      if (order?.status === 'COMPLETED') return
      fetchPickup(code).then(setOrder).catch(() => {})
    }, 15_000)

    return () => clearInterval(id)
  }, [code])

  const info = order ? STATUS_INFO[order.status] ?? STATUS_INFO.PENDING : null

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[var(--color-bg-base)] px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        {/* Brand */}
        <p className="font-display text-2xl text-center text-[var(--color-text-primary)] mb-8">
          {order?.site?.name ?? 'Votre commande'}
        </p>

        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-xl)] overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-8 h-8 rounded-full border-2 border-[var(--color-border-strong)] border-t-[var(--color-accent)]"
              />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-3 py-12 px-6 text-center">
              <Warning size={32} weight="fill" className="text-[var(--color-danger)]" />
              <p className="font-body text-sm text-[var(--color-text-secondary)]">
                Code <span className="font-data text-[var(--color-accent)]">{code}</span> introuvable.
              </p>
              <p className="font-body text-xs text-[var(--color-text-muted)]">
                Vérifiez votre code ou contactez la boutique.
              </p>
            </div>
          )}

          {!loading && !error && order && info && (
            <AnimatePresence mode="wait">
              <motion.div
                key={order.status}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col"
              >
                {/* Status hero */}
                <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-6 border-b border-[var(--color-border)]">
                  <motion.div
                    initial={{ scale: 0.7 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    <info.icon size={48} weight="fill" className={info.color} />
                  </motion.div>

                  <div className="text-center">
                    <p className={`font-body text-lg font-semibold ${info.color}`}>
                      {info.label}
                    </p>
                    <p className="font-body text-xs text-[var(--color-text-muted)] mt-1">
                      {info.hint}
                    </p>
                  </div>

                  {/* Code pickup */}
                  <div className="mt-2 px-6 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-[var(--radius-lg)] text-center">
                    <p className="font-data text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest mb-1">
                      Code retrait
                    </p>
                    <p className="font-data text-3xl tracking-[0.3em] text-[var(--color-accent)]">
                      {code}
                    </p>
                  </div>
                </div>

                {/* Détail commande */}
                <div className="px-5 py-4 space-y-2">
                  <p className="font-body text-xs text-[var(--color-text-muted)] mb-3">
                    Votre commande
                  </p>
                  {order.items?.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-1 border-b border-[var(--color-border)] last:border-0">
                      <span className="font-body text-sm text-[var(--color-text-primary)]">
                        {item.name}
                      </span>
                      <span className="font-data text-sm text-[var(--color-text-secondary)]">
                        x{item.quantity}
                      </span>
                    </div>
                  ))}

                  <div className="flex justify-between pt-2">
                    <span className="font-body text-sm text-[var(--color-text-secondary)]">Total</span>
                    <span className="font-data text-base text-[var(--color-text-primary)]">
                      {formatPrice(Number(order.total))}
                    </span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {order?.status !== 'COMPLETED' && !loading && !error && (
          <p className="text-center font-data text-[10px] text-[var(--color-text-muted)] mt-4">
            Mise à jour automatique toutes les 15s
          </p>
        )}
      </motion.div>
    </div>
  )
}
