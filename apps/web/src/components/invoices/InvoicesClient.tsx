'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Receipt, DownloadSimple, CheckCircle, XCircle, FunnelSimple,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { formatPrice } from '@erp/utils'
import { invoicesApi, type InvoiceRecord } from '@/lib/api/invoices'

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  COMPLETED:  { label: 'Payée',       cls: 'status-completed' },
  PENDING:    { label: 'En attente',  cls: 'status-pending' },
  CANCELLED:  { label: 'Refusée',     cls: 'status-cancelled' },
  PREPARING:  { label: 'En cours',    cls: 'status-preparing' },
}

export function InvoicesClient() {
  const qc = useQueryClient()
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear())
  const currentYear = new Date().getFullYear()

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', yearFilter],
    queryFn: () => invoicesApi.list({ year: yearFilter }),
  })

  const markPaid = useMutation({
    mutationFn: invoicesApi.markPaid,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Facture marquée payée') },
    onError: (e: any) => toast.error(e.message),
  })

  const markRefused = useMutation({
    mutationFn: invoicesApi.markRefused,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Facture refusée') },
    onError: (e: any) => toast.error(e.message),
  })

  const totalRevenue = invoices
    .filter((i) => i.status === 'COMPLETED')
    .reduce((s, i) => s + Number(i.total), 0)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
        <div>
          <h1 className="page-title">Factures</h1>
          <p className="font-body text-xs text-[var(--color-text-muted)] mt-0.5">
            {invoices.length} facture{invoices.length > 1 ? 's' : ''} · {formatPrice(totalRevenue)} encaissé{totalRevenue > 0 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(Number(e.target.value))}
            className="h-10 px-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-[var(--radius-md)] tabular text-sm text-[var(--color-text-secondary)] cursor-pointer"
          >
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 rounded bg-[var(--color-bg-surface)] animate-pulse" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20">
            <Receipt size={32} weight="regular" className="text-[var(--color-text-muted)]" />
            <p className="font-body text-sm text-[var(--color-text-muted)]">
              Aucune facture pour {yearFilter}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {invoices.map((inv) => {
              const status = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.PENDING
              const dueDate = inv.paymentTerms
                ? new Date(new Date(inv.invoicedAt).getTime() + inv.paymentTerms * 86400000)
                : null
              const isOverdue = dueDate && dueDate < new Date() && inv.status !== 'COMPLETED'

              return (
                <div
                  key={inv.id}
                  className="flex items-center px-6 py-3 hover:bg-[var(--color-bg-hover)] transition-colors group"
                >
                  {/* N° + client */}
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-data text-sm text-[var(--color-text-primary)]">
                        {inv.invoiceNumber}
                      </span>
                      <span className={`${status.cls} text-xs px-1.5 py-0.5 rounded-full tabular`}>
                        {status.label}
                      </span>
                      {isOverdue && (
                        <span className="text-xs text-[var(--color-danger)] tabular">
                          En retard
                        </span>
                      )}
                    </div>
                    <p className="font-body text-sm text-[var(--color-text-muted)] truncate">
                      {inv.b2bClient?.name ?? 'Client'}
                      {inv.site?.name ? ` · ${inv.site.name}` : ''}
                    </p>
                  </div>

                  {/* Dates */}
                  <div className="hidden lg:block w-28 shrink-0">
                    <p className="tabular text-xs text-[var(--color-text-muted)]">
                      {new Date(inv.invoicedAt).toLocaleDateString('fr-FR')}
                    </p>
                    {dueDate && (
                      <p className={`tabular text-xs ${isOverdue ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'}`}>
                        Éch. {dueDate.toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>

                  {/* Total */}
                  <span className="font-data text-sm text-[var(--color-text-primary)] w-24 text-right mr-4">
                    {formatPrice(Number(inv.total))}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={invoicesApi.exportFacturXUrl(inv.id)}
                      download
                      className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] rounded-[var(--radius-sm)] hover:bg-[var(--color-accent-muted)] transition-colors"
                      title="Export Factur-X"
                    >
                      <DownloadSimple size={13} />
                    </a>

                    {inv.status !== 'COMPLETED' && inv.status !== 'CANCELLED' && (
                      <>
                        <button
                          onClick={() => markPaid.mutate(inv.id)}
                          className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-success)] rounded-[var(--radius-sm)] hover:bg-[var(--color-success)]/10 transition-colors"
                          title="Marquer payée"
                        >
                          <CheckCircle size={13} />
                        </button>
                        <button
                          onClick={() => { if (confirm('Marquer comme refusée ?')) markRefused.mutate(inv.id) }}
                          className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] rounded-[var(--radius-sm)] hover:bg-[var(--color-danger)]/10 transition-colors"
                          title="Marquer refusée"
                        >
                          <XCircle size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
