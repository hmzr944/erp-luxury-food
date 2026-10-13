'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DownloadSimple, FileArrowUp, WarningCircle, CheckCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { toCsv } from '@erp/utils'
import { authorizedFetch } from '@/lib/api/client'
import { sitesApi } from '@/lib/api/sites'

interface ImportReport {
  dryRun: boolean
  imported: boolean
  products: number
  variants: number
  categories: string[]
  errors: Array<{ line: number; message: string }>
  skipped: Array<{ line: number; message: string }>
  preview: Array<{ line: number; name: string; category: string | null; price: number; taxRate: number; variants: string[] }>
}

const EXPORTS = [
  { file: 'sales', label: 'Ventes', hint: 'Une ligne par article vendu', dated: true },
  { file: 'payments', label: 'Paiements', hint: 'Pour la comptabilité', dated: true },
  { file: 'products', label: 'Catalogue', hint: 'Réimportable tel quel', dated: false },
  { file: 'stock', label: 'Stock', hint: 'Avec lots et numéros de série', dated: false },
] as const

const isoDay = (d: Date) => d.toISOString().slice(0, 10)
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

async function download(path: string, filename: string) {
  const res = await authorizedFetch(path)
  if (!res.ok) throw new Error(res.status === 403 ? 'Réservé aux responsables' : `Export impossible (${res.status})`)
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadTemplate() {
  const rows = [
    { nom: 'Pull col rond', categorie: 'Maille', prix: 290, tva: 20, option_1: 'Taille', valeur_1: 'S', option_2: 'Couleur', valeur_2: 'Marine', stock: 3 },
    { nom: 'Pull col rond', categorie: 'Maille', prix: 290, tva: 20, option_1: 'Taille', valeur_1: 'M', option_2: 'Couleur', valeur_2: 'Marine', stock: 5 },
    { nom: 'Ceinture cuir', categorie: 'Accessoires', prix: 95, tva: 20, stock: 8 },
  ]
  const columns = ['nom', 'sous_titre', 'description', 'categorie', 'prix', 'tva', 'sku', 'code_barres', 'option_1', 'valeur_1', 'option_2', 'valeur_2', 'stock']
  const csv = toCsv(rows, columns.map((c) => ({ header: c, value: (r: Record<string, unknown>) => r[c] as string | number | undefined })))
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'modele_catalogue.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function DataSettings() {
  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: sitesApi.getAll })
  const [siteId, setSiteId] = useState('')
  const site = siteId || sites[0]?.id || ''
  const [from, setFrom] = useState(isoDay(new Date(Date.now() - 30 * 86_400_000)))
  const [to, setTo] = useState(isoDay(new Date()))
  const [busy, setBusy] = useState<string | null>(null)
  const [file, setFile] = useState<{ name: string; text: string } | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)

  const exportFile = async (key: string, dated: boolean, label: string) => {
    setBusy(key)
    try {
      const qs = dated ? `?from=${from}&to=${to}` : ''
      const path = key === 'clients' ? '/organizations/me/data/clients.csv' : `/sites/${site}/data/${key}.csv${qs}`
      await download(path, `${label.toLowerCase().replace(/\s+/g, '_')}_${isoDay(new Date())}.csv`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const runImport = async (dryRun: boolean, text = file?.text) => {
    if (!text) return
    setBusy(dryRun ? 'preview' : 'import')
    try {
      const res = await authorizedFetch(`/sites/${site}/data/import/products`, {
        method: 'POST',
        body: JSON.stringify({ csv: text, dryRun }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(Array.isArray(body.message) ? body.message.join(' ') : body.message)
      setReport(body)
      if (body.imported) {
        toast.success(`${plural(body.products, 'produit importé', 'produits importés')}`)
        setFile(null)
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const onFile = async (f: File | undefined) => {
    setReport(null)
    if (!f) return setFile(null)
    const text = await f.text()
    setFile({ name: f.name, text })
    await runImport(true, text)
  }

  const fieldCls =
    'h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 text-sm focus:border-[var(--color-accent)] focus:outline-none'

  return (
    <div className="max-w-3xl space-y-10 p-6 md:p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Données</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Vos ventes, votre catalogue et vos clients vous appartiennent. Exportez-les quand vous voulez, en CSV lisible par
          Excel.
        </p>
      </header>

      {sites.length > 1 && (
        <div className="space-y-2">
          <label htmlFor="data-site" className="block text-sm font-medium">
            Boutique
          </label>
          <select id="data-site" value={site} onChange={(e) => setSiteId(e.target.value)} className={fieldCls + ' w-full sm:w-72'}>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <section className="space-y-4" aria-labelledby="exports-title">
        <h2 id="exports-title" className="text-lg font-semibold">
          Exporter
        </h2>
        <div className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <label htmlFor="from" className="block text-sm font-medium">
              Du
            </label>
            <input id="from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={fieldCls} />
          </div>
          <div className="space-y-2">
            <label htmlFor="to" className="block text-sm font-medium">
              Au
            </label>
            <input id="to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={fieldCls} />
          </div>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {[...EXPORTS, { file: 'clients', label: 'Clients professionnels', hint: 'Toute l’organisation', dated: false }].map((x) => (
            <li key={x.file}>
              <button
                type="button"
                disabled={!site || busy !== null}
                onClick={() => exportFile(x.file, x.dated, x.label)}
                className="flex min-h-14 w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 py-2 text-left hover:border-[var(--color-accent)] disabled:opacity-50"
              >
                <DownloadSimple size={20} aria-hidden className="shrink-0 text-[var(--color-accent)]" />
                <span>
                  <span className="block text-[15px] font-medium">{busy === x.file ? 'Préparation...' : x.label}</span>
                  <span className="block text-sm text-[var(--color-text-secondary)]">
                    {x.hint}
                    {x.dated ? ', sur la période' : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4" aria-labelledby="import-title">
        <div className="space-y-1">
          <h2 id="import-title" className="text-lg font-semibold">
            Importer un catalogue
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Une ligne par article. Les lignes au même nom deviennent un produit et ses variantes (tailles, couleurs, formats).
            Les produits déjà présents ne sont pas modifiés. Rien n&apos;est importé sans votre confirmation.
          </p>
          <button type="button" onClick={downloadTemplate} className="h-11 text-sm font-medium text-[var(--color-accent)] underline-offset-4 hover:underline">
            Télécharger le modèle
          </button>
        </div>

        <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] p-6 text-center hover:border-[var(--color-accent)] focus-within:border-[var(--color-accent)]">
          <FileArrowUp size={24} aria-hidden className="text-[var(--color-accent)]" />
          <span className="text-[15px] font-medium">{file ? file.name : 'Choisir un fichier CSV'}</span>
          <span className="text-sm text-[var(--color-text-secondary)]">Séparateur point-virgule ou virgule</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>

        {busy === 'preview' && <p role="status" className="text-sm text-[var(--color-text-secondary)]">Lecture du fichier...</p>}

        {report && <ImportResult report={report} busy={busy === 'import'} onConfirm={() => runImport(false)} />}
      </section>
    </div>
  )
}

function ImportResult({ report, busy, onConfirm }: { report: ImportReport; busy: boolean; onConfirm: () => void }) {
  if (report.imported) {
    return (
      <p role="status" className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent-muted)] p-4 text-[15px] font-medium">
        <CheckCircle size={20} aria-hidden weight="fill" className="text-[var(--color-accent)]" />
        {plural(report.products, 'produit', 'produits')}
        {report.variants > 0 && <> et {plural(report.variants, 'variante', 'variantes')}</>}{' '}
        {report.products + report.variants > 1 ? 'importés' : 'importé'}.
      </p>
    )
  }

  return (
    <div className="space-y-4" aria-live="polite">
      {report.errors.length > 0 ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border-strong)] p-4">
          <p className="flex items-center gap-2 text-[15px] font-semibold">
            <WarningCircle size={20} aria-hidden weight="fill" />
            {report.errors.length} {report.errors.length > 1 ? 'erreurs à corriger' : 'erreur à corriger'}, rien n&apos;a été importé
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {report.errors.slice(0, 30).map((e, i) => (
              <li key={i}>
                <span className="tabular font-medium">Ligne {e.line}</span> : {e.message}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[15px]">
            <span className="font-semibold">{plural(report.products, 'produit', 'produits')}</span>
            {report.variants > 0 && <> et {plural(report.variants, 'variante', 'variantes')}</>}{' '}
            {report.products + report.variants > 1 ? 'prêts' : 'prêt'} à importer
            {report.categories.length > 0 && (
              <>, avec {plural(report.categories.length, 'nouvelle catégorie', 'nouvelles catégories')} ({report.categories.join(', ')})</>
            )}
            .
          </p>
          {report.preview.length > 0 && (
            <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)] text-sm">
              {report.preview.slice(0, 8).map((p) => (
                <li key={p.line} className="flex justify-between gap-4 px-4 py-2">
                  <span className="min-w-0">
                    <span className="font-medium">{p.name}</span>
                    {p.variants.length > 0 && (
                      <span className="block truncate text-[var(--color-text-secondary)]">{p.variants.join(', ')}</span>
                    )}
                  </span>
                  <span className="tabular shrink-0">{p.price.toFixed(2).replace('.', ',')} €</span>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || report.products === 0}
            className="h-12 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 text-[15px] font-semibold text-[var(--color-on-accent)] disabled:opacity-50"
          >
            {busy ? 'Import...' : `Importer ${plural(report.products, 'produit', 'produits')}`}
          </button>
        </div>
      )}
      {report.skipped.length > 0 && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          {report.skipped.length} {report.skipped.length > 1 ? 'produits déjà présents ignorés' : 'produit déjà présent ignoré'} :{' '}
          {report.skipped.slice(0, 5).map((s) => s.message.match(/« (.*) »/)?.[1]).join(', ')}
          {report.skipped.length > 5 ? '...' : ''}
        </p>
      )}
    </div>
  )
}
