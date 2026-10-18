'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Printer, ArrowLeft } from '@phosphor-icons/react'
import { formatPrice, formatDate } from '@erp/utils'
import { apiClient } from '@/lib/api/client'
import type { B2BOrder } from '@/lib/api/b2b'
import { useSiteStore } from '@/stores/site.store'
import { FlowPulse } from '@/components/brand/FlowLogo'

interface InvoicePageProps { orderId: string }

export function InvoicePage({ orderId }: InvoicePageProps) {
  const { currentSite } = useSiteStore()
  const [order, setOrder] = useState<B2BOrder | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentSite) return
    apiClient<B2BOrder>(`/sites/${currentSite.id}/b2b-orders/${orderId}/invoice`)
      .then(setOrder)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [orderId, currentSite])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <FlowPulse size={32} />
    </div>
  )

  if (!order) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <p className="text-[#727276] font-body text-sm">Facture introuvable</p>
    </div>
  )

  const subtotal = order.items.reduce((s, i) => s + Number(i.price) * i.quantity, 0)
  const taxTotal = order.items.reduce((s, i) => s + Number(i.price) * i.quantity * (Number(i.taxRate) / 100), 0)
  const total = subtotal + taxTotal

  const dueDate = order.paymentTerms
    ? new Date(new Date(order.createdAt).getTime() + order.paymentTerms * 86400000)
    : null

  return (
    <>
      {/* Barre d'actions — masquée à l'impression */}
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-[var(--color-bg-surface)] border-b border-[var(--color-border)]">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-1.5 font-body text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <ArrowLeft size={14} />
          Retour
        </button>
        <div className="flex items-center gap-2">
          {!order.invoiceNumber && (
            <span className="font-data text-[10px] text-[var(--color-warning)] bg-[var(--color-warning)]/10 px-2 py-1 rounded-full">
              Brouillon : générez la facture depuis les commandes B2B
            </span>
          )}
          <motion.button
            onClick={() => window.print()}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-1.5 px-4 h-8 bg-[var(--color-accent)] text-[var(--color-on-accent)] font-body text-sm rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            <Printer size={13} weight="regular" />
            Imprimer / PDF
          </motion.button>
        </div>
      </div>

      {/* Document facture */}
      <div className="min-h-screen bg-[#F4EFE6] print:bg-white pt-16 print:pt-0 px-4 print:px-0">
        <div
          id="invoice"
          className="bg-white mx-auto max-w-2xl shadow-lg print:shadow-none print:max-w-none p-10 print:p-8"
          style={{ fontFamily: 'var(--font-body)', color: '#1C1726' }}
        >
          {/* En-tête */}
          <div className="flex justify-between items-start mb-10">
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '700', letterSpacing: '-0.03em', marginBottom: '4px' }}>
                {order.site?.organization?.name ?? 'Maison Artisane'}
              </h1>
              {order.site?.name && (
                <p style={{ fontSize: '13px', color: '#4A4A4F' }}>{order.site.name}</p>
              )}
              {order.site?.address && (
                <p style={{ fontSize: '12px', color: '#727276', marginTop: '2px' }}>{order.site.address}</p>
              )}
            </div>

            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '22px', fontWeight: '600', color: '#1C1726' }}>
                {order.invoiceNumber ? `FACTURE ${order.invoiceNumber}` : 'FACTURE (BROUILLON)'}
              </p>
              <p style={{ fontSize: '12px', color: '#727276', marginTop: '4px' }}>
                Date: {new Date(order.invoicedAt ?? order.createdAt).toLocaleDateString('fr-FR')}
              </p>
              {dueDate && (
                <p style={{ fontSize: '12px', color: '#727276' }}>
                  Échéance: {dueDate.toLocaleDateString('fr-FR')}
                </p>
              )}
              {order.receiptChain && (
                <p style={{ fontSize: '10px', color: '#727276', marginTop: '4px', fontFamily: 'var(--font-data)' }}>
                  Ticket n° {order.receiptChain.counter}
                </p>
              )}
            </div>
          </div>

          {/* Client */}
          {order.b2bClient && (
            <div style={{ marginBottom: '32px', padding: '16px', background: '#F4EFE6', borderRadius: '8px' }}>
              <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#727276', marginBottom: '8px' }}>
                Facturé à
              </p>
              <p style={{ fontSize: '15px', fontWeight: '600' }}>{order.b2bClient.name}</p>
              {order.b2bClient && (order.b2bClient as any).siret && (
                <p style={{ fontSize: '12px', color: '#4A4A4F' }}>SIRET: {(order.b2bClient as any).siret}</p>
              )}
              {order.b2bClient && (order.b2bClient as any).vatNumber && (
                <p style={{ fontSize: '12px', color: '#4A4A4F' }}>TVA: {(order.b2bClient as any).vatNumber}</p>
              )}
            </div>
          )}

          {/* Lignes */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #1C1726' }}>
                <th style={{ textAlign: 'left', padding: '8px 0', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4A4A4F' }}>
                  Désignation
                </th>
                <th style={{ textAlign: 'center', padding: '8px 0', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4A4A4F' }}>
                  Qté
                </th>
                <th style={{ textAlign: 'right', padding: '8px 0', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4A4A4F' }}>
                  PU HT
                </th>
                <th style={{ textAlign: 'right', padding: '8px 0', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4A4A4F' }}>
                  TVA
                </th>
                <th style={{ textAlign: 'right', padding: '8px 0', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4A4A4F' }}>
                  Total TTC
                </th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, i) => {
                const ht = Number(item.price) * item.quantity
                const ttc = ht * (1 + Number(item.taxRate) / 100)
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #E3E3E4' }}>
                    <td style={{ padding: '10px 0', fontSize: '13px' }}>
                      {item.name}
                      {(item as any).product?.subtitle && (
                        <span style={{ display: 'block', fontSize: '11px', color: '#727276' }}>
                          {(item as any).product.subtitle}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 0', fontSize: '13px', textAlign: 'center' }}>
                      {item.quantity}
                    </td>
                    <td style={{ padding: '10px 0', fontSize: '13px', textAlign: 'right', fontFamily: 'var(--font-data)' }}>
                      {formatPrice(ht / item.quantity)}
                    </td>
                    <td style={{ padding: '10px 0', fontSize: '12px', textAlign: 'right', color: '#727276' }}>
                      {Number(item.taxRate)}%
                    </td>
                    <td style={{ padding: '10px 0', fontSize: '13px', textAlign: 'right', fontFamily: 'var(--font-data)', fontWeight: '500' }}>
                      {formatPrice(ttc)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Totaux */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
            <div style={{ width: '220px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', color: '#4A4A4F' }}>
                <span>Sous-total HT</span>
                <span style={{ fontFamily: 'var(--font-data)' }}>{formatPrice(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', color: '#4A4A4F', borderBottom: '1px solid #E3E3E4' }}>
                <span>TVA</span>
                <span style={{ fontFamily: 'var(--font-data)' }}>{formatPrice(taxTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: '16px', fontWeight: '700' }}>
                <span>Total TTC</span>
                <span style={{ fontFamily: 'var(--font-data)' }}>{formatPrice(total)}</span>
              </div>
              {order.paymentTerms !== undefined && (
                <div style={{ padding: '8px', background: '#F4EFE6', borderRadius: '6px', fontSize: '11px', color: '#4A4A4F', marginTop: '8px' }}>
                  Paiement: {order.paymentTerms === 0 ? 'Comptant' : `${order.paymentTerms} jours`}
                  {dueDate ? ` (${dueDate.toLocaleDateString('fr-FR')})` : ''}
                </div>
              )}
            </div>
          </div>

          {/* Pied de page */}
          <div style={{ borderTop: '1px solid #E3E3E4', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ fontSize: '10px', color: '#727276' }}>
              <p>Facture émise depuis le logiciel de caisse de {order.site?.organization?.name ?? 'la boutique'}</p>
              {order.receiptChain && (
                <p style={{ fontFamily: 'var(--font-data)', marginTop: '2px' }}>
                  Ticket n° {order.receiptChain ? order.receiptChain.counter : '-'}
                </p>
              )}
            </div>
            <div style={{ fontSize: '11px', color: '#727276', textAlign: 'right' }}>
              <p>Mentions légales :</p>
              <p>En cas de retard, pénalité de 3× le taux légal</p>
              <p>Indemnité forfaitaire de recouvrement: 40€</p>
            </div>
          </div>
        </div>
      </div>

      {/* CSS print */}
      <style jsx global>{`
        @media print {
          @page { margin: 15mm; size: A4; }
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </>
  )
}
