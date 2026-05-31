'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Printer, CheckCircle, Warning } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api/client'
import { useSiteStore } from '@/stores/site.store'

export function PrintingSettings() {
  const { currentSite } = useSiteStore()
  const [selectedPrinter, setSelectedPrinter] = useState<number | null>(null)

  const { data: printers = [], isLoading } = useQuery({
    queryKey: ['printers', currentSite?.id],
    queryFn: () => apiClient<any[]>(`/sites/${currentSite!.id}/printers`),
    enabled: !!currentSite,
  })

  const testPrint = useMutation({
    mutationFn: (printerId: number) =>
      apiClient<{ success: boolean }>(`/sites/${currentSite!.id}/printers/test`, {
        method: 'POST',
        body: JSON.stringify({ printerId }),
      }),
    onSuccess: (data) =>
      data.success ? toast.success('Impression test envoyée') : toast.error('Impression échouée'),
    onError: () => toast.error('Erreur de connexion à PrintNode'),
  })

  if (!currentSite) return (
    <div className="flex items-center justify-center h-48">
      <p className="font-body text-sm text-[var(--color-text-muted)]">Sélectionnez un site</p>
    </div>
  )

  return (
    <div className="max-w-lg px-8 py-6">
      <h1 className="font-display text-xl text-[var(--color-text-primary)] mb-2">Impression</h1>
      <p className="font-body text-sm text-[var(--color-text-muted)] mb-6">
        Imprimantes connectées via PrintNode pour {currentSite.name}
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-16 rounded-[var(--radius-lg)] bg-[var(--color-bg-surface)] border border-[var(--color-border)] animate-pulse" />
          ))}
        </div>
      ) : printers.length === 0 ? (
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-6 text-center">
          <Printer size={28} weight="regular" className="text-[var(--color-text-muted)] mx-auto mb-3" />
          <p className="font-body text-sm text-[var(--color-text-primary)] mb-1">
            Aucune imprimante détectée
          </p>
          <p className="font-body text-xs text-[var(--color-text-muted)]">
            Configurez votre clé API PrintNode dans le fichier .env puis assurez-vous que
            le client PrintNode est installé sur l'ordinateur de la boutique.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {printers.map((printer: any) => (
            <div
              key={printer.id}
              onClick={() => setSelectedPrinter(printer.id)}
              className={[
                'flex items-center justify-between p-4 rounded-[var(--radius-lg)] border cursor-pointer transition-all',
                selectedPrinter === printer.id
                  ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent-muted)]'
                  : 'border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:border-[var(--color-border-strong)]',
              ].join(' ')}
            >
              <div className="flex items-center gap-3">
                <Printer size={16} weight="regular" className="text-[var(--color-text-muted)]" />
                <div>
                  <p className="font-body text-sm text-[var(--color-text-primary)]">{printer.name}</p>
                  <p className="font-data text-[10px] text-[var(--color-text-muted)]">
                    ID: {printer.id} · {printer.computer?.name ?? 'Ordinateur inconnu'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={[
                  'font-data text-[10px] px-1.5 py-0.5 rounded-full',
                  printer.state === 'online'
                    ? 'text-[var(--color-success)] bg-[var(--color-success)]/10'
                    : 'text-[var(--color-text-muted)] bg-[var(--color-bg-elevated)]',
                ].join(' ')}>
                  {printer.state === 'online' ? 'En ligne' : 'Hors ligne'}
                </span>

                {selectedPrinter === printer.id && (
                  <motion.button
                    onClick={(e) => { e.stopPropagation(); testPrint.mutate(printer.id) }}
                    disabled={testPrint.isPending}
                    whileTap={{ scale: 0.97 }}
                    className="px-3 h-7 border border-[var(--color-accent)]/30 text-[var(--color-accent)] font-body text-xs rounded-[var(--radius-sm)] hover:bg-[var(--color-accent)]/10 transition-colors disabled:opacity-50"
                  >
                    Test
                  </motion.button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
        <p className="font-data text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
          Documentation
        </p>
        <p className="font-body text-xs text-[var(--color-text-secondary)]">
          PrintNode supporte les imprimantes Epson TM-Series et Star Micronics.
          Téléchargez le client PrintNode sur printnode.com et connectez-le à votre compte.
        </p>
      </div>
    </div>
  )
}
