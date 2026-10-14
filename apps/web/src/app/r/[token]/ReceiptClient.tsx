'use client'

import { useEffect, useState } from 'react'
import { DownloadSimple, HourglassMedium, Receipt as ReceiptIcon } from '@phosphor-icons/react'
import type { TicketModel } from '@erp/utils'
import { FlowLogo, FlowPulse } from '@/components/brand/FlowLogo'

const API = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api`

type View =
  | { status: 'loading' }
  | { status: 'pending' }
  | { status: 'missing' }
  | { status: 'ready'; kind: 'SALE' | 'REFUND'; shop: { name: string; legalName: string }; ticket: TicketModel; invoice: { number: string; company: string | null; emailed: boolean } | null }

const euros = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

// Ticket dématérialisé : ouvert depuis le QR code de la caisse ou du ticket
export function ReceiptClient({ token }: { token: string }) {
  const [view, setView] = useState<View>({ status: 'loading' })

  useEffect(() => {
    let stop = false
    let timer: number | undefined
    const load = async () => {
      try {
        const res = await fetch(`${API}/receipts/${encodeURIComponent(token)}`, { cache: 'no-store' })
        if (stop) return
        if (res.status === 404) return setView({ status: 'missing' })
        if (!res.ok) throw new Error()
        const data = (await res.json()) as View
        setView(data)
        // Vente encaissée hors ligne : elle arrive au retour du réseau de la boutique
        if (data.status === 'pending') timer = window.setTimeout(load, 5000)
      } catch {
        if (!stop) timer = window.setTimeout(load, 5000)
      }
    }
    void load()
    return () => {
      stop = true
      window.clearTimeout(timer)
    }
  }, [token])

  return (
    <main className="min-h-[100dvh] bg-[var(--color-bg-base)] px-4 py-8 text-[var(--color-text-primary)]">
      <div className="mx-auto max-w-md space-y-6">
        {view.status === 'loading' && (
          <div className="grid place-items-center py-24" role="status" aria-label="Chargement">
            <FlowPulse size={36} />
          </div>
        )}
        {view.status === 'pending' && (
          <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 text-center" role="status">
            <HourglassMedium size={32} aria-hidden className="mx-auto text-[var(--color-accent)]" />
            <h1 className="text-xl font-semibold">Votre ticket arrive</h1>
            <p className="text-[15px] text-[var(--color-text-secondary)]">La caisse l’envoie dès que sa connexion revient. Cette page se met à jour toute seule.</p>
          </section>
        )}
        {view.status === 'missing' && (
          <section className="space-y-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 text-center">
            <h1 className="text-xl font-semibold">Ticket introuvable</h1>
            <p className="text-[15px] text-[var(--color-text-secondary)]">Vérifiez le lien, ou demandez un duplicata en boutique.</p>
          </section>
        )}
        {view.status === 'ready' && <Ticket token={token} view={view} />}
        <p className="flex items-center justify-center gap-2 text-sm text-[var(--color-text-muted)]">
          Ticket émis avec <FlowLogo size={12} />
        </p>
      </div>
    </main>
  )
}

function Ticket({ token, view }: { token: string; view: Extract<View, { status: 'ready' }> }) {
  const t = view.ticket
  const codes = new Map(t.taxes.map((x) => [x.rate, x.code]))
  return (
    <>
      <header className="space-y-1 text-center">
        <p className="text-sm text-[var(--color-text-secondary)]">{view.kind === 'REFUND' ? 'Remboursement' : 'Votre ticket'}</p>
        <h1 className="font-display text-3xl font-bold tracking-[-0.03em]">{t.shop.name}</h1>
        <p className="tabular font-display text-4xl font-bold tracking-[-0.03em]">{euros(t.total)}</p>
      </header>

      <a
        href={`${API}/receipts/${encodeURIComponent(token)}/pdf`}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-[15px] font-semibold text-[var(--color-on-accent)] press"
      >
        <DownloadSimple size={20} aria-hidden /> Télécharger le PDF
      </a>

      {view.invoice && (
        <a
          href={`${API}/receipts/${encodeURIComponent(token)}/invoice`}
          className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 text-[15px] hover:border-[var(--color-border-strong)]"
        >
          <ReceiptIcon size={22} aria-hidden className="shrink-0 text-[var(--color-accent)]" />
          <span>
            <span className="block font-medium">Facture n° {view.invoice.number}</span>
            <span className="block text-sm text-[var(--color-text-secondary)]">
              {view.invoice.company ? `Au nom de ${view.invoice.company}. ` : ''}
              {view.invoice.emailed ? 'Envoyée par e-mail. ' : ''}Télécharger le PDF
            </span>
          </span>
        </a>
      )}

      <article className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 font-data text-[13px] leading-relaxed">
        {t.marks.map((m) => (
          <p key={m} className="text-center font-semibold">
            {m}
          </p>
        ))}
        <div className="text-center text-[var(--color-text-secondary)]">
          {t.shop.address && <p>{t.shop.address}</p>}
          {t.shop.legal.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </div>
        <dl className="space-y-0.5 border-y border-dashed border-[var(--color-border-strong)] py-3">
          {t.meta.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt>{k}</dt>
              <dd className="tabular">{v}</dd>
            </div>
          ))}
        </dl>
        <ul className="space-y-1">
          {t.lines.map((l, i) => (
            <li key={i}>
              <div className="flex justify-between gap-3">
                <span>
                  {l.quantity} × {l.name}
                </span>
                <span className="tabular shrink-0">
                  {euros(l.total)} {codes.get(l.taxRate)}
                </span>
              </div>
              {l.detail && <p className="pl-4 text-[var(--color-text-secondary)]">{l.detail}</p>}
            </li>
          ))}
          {t.discount ? (
            <li className="flex justify-between">
              <span>Remise</span>
              <span className="tabular">-{euros(t.discount)}</span>
            </li>
          ) : null}
        </ul>
        <p className="flex justify-between border-t border-dashed border-[var(--color-border-strong)] pt-3 font-body text-base font-semibold">
          <span>Total TTC</span>
          <span className="tabular">{euros(t.total)}</span>
        </p>
        <table className="w-full text-right">
          <caption className="sr-only">TVA par taux</caption>
          <thead className="text-[var(--color-text-secondary)]">
            <tr>
              <th scope="col" className="text-left font-normal">TVA</th>
              <th scope="col" className="font-normal">HT</th>
              <th scope="col" className="font-normal">TVA</th>
              <th scope="col" className="font-normal">TTC</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {t.taxes.map((x) => (
              <tr key={x.code}>
                <th scope="row" className="text-left font-normal">
                  {x.code} {String(x.rate).replace('.', ',')} %
                </th>
                <td>{euros(x.ht)}</td>
                <td>{euros(x.tax)}</td>
                <td>{euros(x.ttc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="space-y-0.5 border-t border-dashed border-[var(--color-border-strong)] pt-3">
          {t.payments.map((p, i) => (
            <li key={i}>
              <div className="flex justify-between">
                <span>{p.label}</span>
                <span className="tabular">{euros(p.amount)}</span>
              </div>
              {p.reference && <p className="pl-4 text-[var(--color-text-secondary)]">Réf. {p.reference}</p>}
            </li>
          ))}
        </ul>
        <div className="space-y-0.5 text-center text-[var(--color-text-secondary)]">
          {t.footer.map((f) => (
            <p key={f}>{f}</p>
          ))}
          {t.signature && <p className="break-all">Signature {t.signature}</p>}
          <p>{t.software}</p>
        </div>
      </article>
      {!view.invoice && view.kind === 'SALE' && (
        <p className="text-center text-sm text-[var(--color-text-secondary)]">Besoin d’une facture au nom de votre entreprise ? Demandez-la en boutique avec ce ticket.</p>
      )}
    </>
  )
}
