'use client'

import { useEffect, useState } from 'react'
import { Buildings, CheckCircle, FilePdf, MagnifyingGlass, Printer } from '@phosphor-icons/react'
import { companiesApi, invoicePdfUrl, type Company, type InvoiceCompanyInput } from '@/lib/api/companies'
import { printPdf } from '@/lib/printing/printer'

const field = 'h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 text-[15px]'
const btn = 'inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-[15px] font-semibold press disabled:opacity-60'

const EMPTY: InvoiceCompanyInput = { name: '', siret: '', vatNumber: '', address: '', zipCode: '', city: '' }

// Facture entreprise en un geste : SIRET ou nom tapé, l'annuaire de l'État
// remplit la raison sociale et l'adresse, la facture part au comptable
export function BusinessInvoice({ siteId, clientId }: { siteId: string; clientId: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Company[] | null>(null)
  const [searchState, setSearchState] = useState<{ busy?: boolean; error?: string }>({})
  const [company, setCompany] = useState<InvoiceCompanyInput | null>(null)
  const [email, setEmail] = useState('')
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'done' | 'error'; message?: string; number?: string; emailed?: boolean }>({ kind: 'idle' })
  const [print, setPrint] = useState<{ busy?: boolean; error?: string }>({})

  // Recherche au fil de la frappe (SIRET complet ou au moins 3 lettres)
  useEffect(() => {
    if (company) return
    const q = query.trim()
    const compact = q.replace(/\s/g, '')
    if (q.length < 3 || (/^\d+$/.test(compact) && compact.length !== 9 && compact.length !== 14)) {
      setResults(null)
      return
    }
    let stop = false
    const t = window.setTimeout(async () => {
      setSearchState({ busy: true })
      try {
        const found = await companiesApi.search(q)
        if (!stop) {
          setResults(found)
          setSearchState({})
        }
      } catch (e) {
        if (!stop) setSearchState({ error: (e as Error).message })
      }
    }, 350)
    return () => {
      stop = true
      window.clearTimeout(t)
    }
  }, [query, company])

  const pick = (c: Company) =>
    setCompany({ name: c.name, siret: c.siret ?? c.siren, vatNumber: c.vatNumber ?? '', address: c.address ?? '', zipCode: c.zipCode ?? '', city: c.city ?? '' })

  const issue = async () => {
    if (!company?.name.trim()) return
    setState({ kind: 'busy' })
    try {
      const r = await companiesApi.invoice(siteId, clientId, { company, ...(email.trim() ? { email: email.trim() } : {}) })
      setState({ kind: 'done', number: r.invoiceNumber, emailed: r.emailed, message: r.emailed ? email.trim() : r.reason })
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message })
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${btn} w-full`}>
        <Buildings size={20} aria-hidden /> Facture entreprise
      </button>
    )
  }

  if (state.kind === 'done') {
    return (
      <section aria-label="Facture entreprise" className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
        <p role="status" className="flex items-start gap-2 text-[15px] font-medium">
          <CheckCircle size={20} weight="fill" aria-hidden className="mt-px shrink-0 text-[var(--color-accent)]" />
          <span>
            Facture {state.number} {state.emailed ? `envoyée à ${state.message}` : 'émise'}
            {!state.emailed && state.message && <span className="block text-sm font-normal text-[var(--color-text-secondary)]">{state.message}</span>}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btn}
            disabled={print.busy}
            onClick={async () => {
              setPrint({ busy: true })
              try {
                await printPdf(invoicePdfUrl(clientId), { jobName: `Facture ${state.number}` })
                setPrint({})
              } catch (e) {
                setPrint({ error: (e as Error).message })
              }
            }}
          >
            <Printer size={18} aria-hidden /> Imprimer en A4
          </button>
          <a href={invoicePdfUrl(clientId)} target="_blank" rel="noopener noreferrer" className={btn}>
            <FilePdf size={18} aria-hidden /> Ouvrir le PDF
          </a>
        </div>
        {print.error && (
          <p role="alert" className="alert-box">
            {print.error}
          </p>
        )}
      </section>
    )
  }

  return (
    <section aria-labelledby="biz-title" className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
      <h3 id="biz-title" className="flex items-center gap-2 text-[15px] font-semibold">
        <Buildings size={20} aria-hidden /> Facture entreprise
      </h3>

      {!company ? (
        <>
          <label className="relative block">
            <span className="sr-only">SIRET ou nom de l’entreprise</span>
            <MagnifyingGlass size={18} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input data-autofocus className={`${field} pl-9`} placeholder="SIRET ou nom de l’entreprise" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div aria-live="polite">
            {searchState.busy && <p className="text-sm text-[var(--color-text-secondary)]">Recherche dans l’annuaire des entreprises</p>}
            {searchState.error && <p className="text-sm text-[var(--color-text-secondary)]">{searchState.error}</p>}
            {results && results.length === 0 && <p className="text-sm text-[var(--color-text-secondary)]">Aucune entreprise trouvée.</p>}
          </div>
          {results && results.length > 0 && (
            <ul className="max-h-60 divide-y divide-[var(--color-border)] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
              {results.map((c) => (
                <li key={(c.siret ?? c.siren) + c.name}>
                  <button type="button" onClick={() => pick(c)} className="w-full px-3 py-2 text-left hover:bg-[var(--color-bg-hover)]">
                    <span className="block text-[15px] font-medium">
                      {c.name}
                      {!c.active && <span className="ml-2 text-sm font-normal text-[var(--color-text-secondary)]">(fermée)</span>}
                    </span>
                    <span className="block text-sm text-[var(--color-text-secondary)]">
                      {[c.siret ? `SIRET ${c.siret}` : `SIREN ${c.siren}`, [c.zipCode, c.city].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => setCompany({ ...EMPTY, name: /\d/.test(query) ? '' : query.trim(), siret: /^\d[\d\s]*$/.test(query) ? query.replace(/\s/g, '') : '' })} className="h-11 text-sm font-medium text-[var(--color-accent)] underline-offset-4 hover:underline">
            Saisir les coordonnées à la main
          </button>
        </>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 sm:col-span-2">
              <span className="text-sm font-medium">Raison sociale</span>
              <input className={field} value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">SIRET</span>
              <input className={`${field} tabular`} inputMode="numeric" value={company.siret ?? ''} onChange={(e) => setCompany({ ...company, siret: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">N° de TVA</span>
              <input className={`${field} tabular`} value={company.vatNumber ?? ''} onChange={(e) => setCompany({ ...company, vatNumber: e.target.value })} />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-sm font-medium">Adresse</span>
              <input className={field} value={company.address ?? ''} onChange={(e) => setCompany({ ...company, address: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Code postal</span>
              <input className={`${field} tabular`} inputMode="numeric" value={company.zipCode ?? ''} onChange={(e) => setCompany({ ...company, zipCode: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Ville</span>
              <input className={field} value={company.city ?? ''} onChange={(e) => setCompany({ ...company, city: e.target.value })} />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-sm font-medium">E-mail du service comptable</span>
              <input type="email" inputMode="email" autoComplete="off" className={field} placeholder="compta@entreprise.fr" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          </div>
          {state.kind === 'error' && (
            <p role="alert" className="alert-box">
              {state.message}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={state.kind === 'busy' || !company.name.trim()}
              onClick={issue}
              className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 text-[15px] font-semibold text-[var(--color-on-accent)] press disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)]"
            >
              {email.trim() ? 'Envoyer la facture' : 'Émettre la facture'}
            </button>
            <button type="button" onClick={() => setCompany(null)} className={btn}>
              Autre entreprise
            </button>
          </div>
        </>
      )}
    </section>
  )
}
