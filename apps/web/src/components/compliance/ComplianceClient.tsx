'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, Warning, CheckCircle, DownloadSimple,
  LockKey, Clock,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { formatPrice } from '@erp/utils'
import { complianceApi } from '@/lib/api/products-admin'
import { useAuthStore } from '@/stores/auth.store'

interface ComplianceClientProps { siteId: string }

export function ComplianceClient({ siteId }: ComplianceClientProps) {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [verifying, setVerifying] = useState<string | null>(null)
  const [verifyResult, setVerifyResult] = useState<any>(null)

  const { data: closures = [], isLoading } = useQuery({
    queryKey: ['closures', siteId],
    queryFn: () => complianceApi.getClosures(siteId),
  })

  const closeDay = useMutation({
    mutationFn: () => complianceApi.closeDay(siteId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['closures', siteId] })
      toast.success(`Journée clôturée, ticket Z n° ${data.lastCounter}`)
    },
    onError: (err: any) => toast.error(err.message ?? 'Erreur lors de la clôture'),
  })

  const handleVerify = async (date: string) => {
    setVerifying(date)
    try {
      const result = await complianceApi.verify(siteId, date)
      setVerifyResult({ date, ...result })
    } catch {
      toast.error('Erreur de vérification')
    } finally {
      setVerifying(null)
    }
  }

  const canCloseDay = user?.role === 'OWNER' || user?.role === 'MANAGER'
  const todayAlreadyClosed = closures.some((c) => {
    const d = new Date(c.date)
    const today = new Date()
    return d.toDateString() === today.toDateString()
  })

  const exportUrl = complianceApi.exportUrl(siteId)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <ShieldCheck size={18} weight="regular" className="text-[var(--color-accent)]" />
          <div>
            <h1 className="page-title">Conformité NF525</h1>
            <p className="font-body text-xs text-[var(--color-text-muted)] mt-0.5">
              Chaîne de hachage des tickets · Clôtures journalières · Export DGFiP
            </p>
          </div>
        </div>

        <a
          href={exportUrl}
          download
          className="flex items-center gap-1.5 px-3 h-10 border border-[var(--color-border)] text-[var(--color-text-secondary)] font-body text-sm rounded-[var(--radius-md)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <DownloadSimple size={13} weight="regular" />
          Export DGFiP
        </a>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Close day CTA */}
        {canCloseDay && (
          <div className={[
            'flex items-center justify-between p-5 rounded-[var(--radius-lg)] border',
            todayAlreadyClosed
              ? 'bg-[var(--color-success)]/5 border-[var(--color-success)]/20'
              : 'bg-[var(--color-bg-surface)] border-[var(--color-border)]',
          ].join(' ')}>
            <div className="flex items-center gap-3">
              {todayAlreadyClosed ? (
                <CheckCircle size={20} weight="fill" className="text-[var(--color-success)]" />
              ) : (
                <Clock size={20} weight="regular" className="text-[var(--color-text-muted)]" />
              )}
              <div>
                <p className="font-body text-sm font-medium text-[var(--color-text-primary)]">
                  Clôture journalière
                </p>
                <p className="font-body text-xs text-[var(--color-text-muted)]">
                  {todayAlreadyClosed
                    ? `Journée clôturée le ${new Date().toLocaleDateString('fr-FR')}`
                    : 'À effectuer en fin de journée (obligatoire NF525)'}
                </p>
              </div>
            </div>

            {!todayAlreadyClosed && (
              <motion.button
                onClick={() => {
                  if (confirm('Clôturer la journée ? Cette action est irréversible.')) {
                    closeDay.mutate()
                  }
                }}
                disabled={closeDay.isPending}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-4 h-11 bg-[var(--color-accent)] text-[var(--color-on-accent)] font-body text-sm font-medium rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)] transition-colors"
              >
                <LockKey size={13} weight="fill" />
                {closeDay.isPending ? 'Clôture...' : 'Clôturer la journée'}
              </motion.button>
            )}
          </div>
        )}

        {/* Résultat vérification */}
        <AnimatePresence>
          {verifyResult && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={[
                'p-4 rounded-[var(--radius-lg)] border',
                verifyResult.valid
                  ? 'bg-[var(--color-success)]/5 border-[var(--color-success)]/20'
                  : 'bg-[var(--color-danger)]/5 border-[var(--color-danger)]/20',
              ].join(' ')}
            >
              <div className="flex items-start gap-3">
                {verifyResult.valid
                  ? <CheckCircle size={16} weight="fill" className="text-[var(--color-success)] mt-0.5" />
                  : <Warning size={16} weight="fill" className="text-[var(--color-danger)] mt-0.5" />}
                <div>
                  <p className={`font-body text-sm font-medium ${verifyResult.valid ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                    {verifyResult.valid
                      ? `Chaîne valide : ${verifyResult.checked} tickets vérifiés`
                      : `Chaîne invalide : ${verifyResult.errors?.length} erreur(s)`}
                  </p>
                  {verifyResult.errors?.map((e: string, i: number) => (
                    <p key={i} className="font-data text-xs text-[var(--color-danger)] mt-1">{e}</p>
                  ))}
                  {verifyResult.firstCounter && (
                    <p className="font-data text-xs text-[var(--color-text-muted)] mt-1">
                      Tickets #{verifyResult.firstCounter} à #{verifyResult.lastCounter}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Historique clôtures */}
        <div>
          <p className="font-body text-xs text-[var(--color-text-secondary)] mb-3">
            Historique des clôtures
          </p>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 rounded-[var(--radius-md)] bg-[var(--color-bg-surface)] border border-[var(--color-border)] animate-pulse" />
              ))}
            </div>
          ) : closures.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <ShieldCheck size={28} weight="regular" className="text-[var(--color-text-muted)]" />
              <p className="font-body text-sm text-[var(--color-text-muted)]">
                Aucune clôture enregistrée
              </p>
            </div>
          ) : (
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden">
              {closures.map((closure: any, i: number) => (
                <div
                  key={closure.id}
                  className="flex items-center px-4 py-3 border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-hover)] transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="font-body text-sm text-[var(--color-text-primary)]">
                        {new Date(closure.date).toLocaleDateString('fr-FR', {
                          weekday: 'long', day: 'numeric', month: 'long',
                        })}
                      </p>
                      <span className="font-data text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-elevated)] px-1.5 py-0.5 rounded-full">
                        #{closure.lastCounter} tickets
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-0.5">
                      <span className="tabular text-xs text-[var(--color-text-secondary)]">
                        {closure.totalOrders} commande{closure.totalOrders > 1 ? 's' : ''}
                      </span>
                      <span className="font-data text-xs text-[var(--color-accent)]">
                        {formatPrice(Number(closure.totalAmount))}
                      </span>
                      <span className="font-data text-xs text-[var(--color-text-muted)] font-mono">
                        {closure.hash.substring(0, 12)}...
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleVerify(new Date(closure.date).toISOString().split('T')[0])}
                    disabled={verifying === closure.date}
                    className="opacity-0 group-hover:opacity-100 px-2.5 py-1 border border-[var(--color-border)] text-[var(--color-text-muted)] font-body text-xs rounded-[var(--radius-sm)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] disabled:opacity-30 transition-colors"
                  >
                    {verifying === closure.date ? '...' : 'Vérifier'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
