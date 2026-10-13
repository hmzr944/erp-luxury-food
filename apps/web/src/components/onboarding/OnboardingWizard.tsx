'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, Plus, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { SECTOR_PRESETS, type Sector } from '@erp/types'
import { useAuthStore } from '@/stores/auth.store'
import { usePlatformConfig } from '@/lib/api/platform'
import { sitesApi } from '@/lib/api/sites'
import { productsApi } from '@/lib/api/products'
import { productsAdminApi } from '@/lib/api/products-admin'
import { paymentsApi } from '@/lib/api/payments'

// Sans largeur : chaque champ précise la sienne (deux largeurs se contredisent)
const fieldCls =
  'h-12 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-4 text-base focus:border-[var(--color-accent)] focus:outline-none'

// Après l'inscription : trois choses à faire, dans l'ordre qu'on veut,
// chacune facultative. La caisse est utilisable dès maintenant.
export function OnboardingWizard() {
  const router = useRouter()
  const params = useSearchParams()
  const { user } = useAuthStore()
  const { data: config } = usePlatformConfig()
  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: sitesApi.getAll })
  const siteId = params.get('site') ?? sites[0]?.id ?? ''
  const sector = config?.sector as Sector | undefined

  return (
    <main className="min-h-[100dvh] bg-[var(--color-bg-base)] px-4 py-10 text-[var(--color-text-primary)]">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Bienvenue{user?.firstName ? `, ${user.firstName}` : ''}. Votre caisse est prête.
          </h1>
          <p className="text-[15px] text-[var(--color-text-secondary)]">
            {sector ? `Réglages ${SECTOR_PRESETS[sector].label.toLowerCase()} appliqués : TVA, moyens de paiement et fiches produit. ` : ''}
            Tout se modifie ensuite dans les paramètres.
          </p>
        </header>

        {siteId && <ProductsStep siteId={siteId} defaultRate={Number(config?.taxRates.find((t) => t.isDefault)?.rate ?? 20)} />}
        {siteId && <PaymentStep siteId={siteId} />}

        <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
          <h2 className="text-lg font-semibold">3. Ouvrir la caisse</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Sur la tablette ou le téléphone de la boutique, connectez-vous avec ce compte : l&apos;appareil devient une caisse.
          </p>
          <button
            type="button"
            disabled={!siteId}
            onClick={() => {
              localStorage.setItem('erp-onboarded', 'true')
              router.push(`/pos/${siteId}`)
            }}
            className="h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)] disabled:opacity-50"
          >
            Ouvrir la caisse
          </button>
          <Link href="/dashboard" className="block h-11 content-center text-center text-sm font-medium text-[var(--color-text-secondary)]">
            Aller au back-office
          </Link>
        </section>
      </div>
    </main>
  )
}

function ProductsStep({ siteId, defaultRate }: { siteId: string; defaultRate: number }) {
  const qc = useQueryClient()
  const products = useQuery({ queryKey: ['products', siteId], queryFn: () => productsApi.getAll(siteId) })
  const [rows, setRows] = useState([
    { name: '', price: '' },
    { name: '', price: '' },
    { name: '', price: '' },
  ])
  const [saving, setSaving] = useState(false)
  const count = products.data?.length ?? 0
  const ready = rows.filter((r) => r.name.trim() && Number(r.price.replace(',', '.')) > 0)

  const save = async () => {
    setSaving(true)
    try {
      for (const r of ready) {
        await productsAdminApi.create(siteId, { name: r.name.trim(), price: Number(r.price.replace(',', '.')), taxRate: defaultRate })
      }
      toast.success(`${ready.length} ${ready.length > 1 ? 'produits ajoutés' : 'produit ajouté'}`)
      setRows([{ name: '', price: '' }])
      await qc.invalidateQueries({ queryKey: ['products', siteId] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold">1. Vos produits</h2>
        {count > 0 && (
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <CheckCircle size={18} weight="fill" aria-hidden className="text-[var(--color-accent)]" />
            {count} au catalogue
          </p>
        )}
      </div>
      <p className="text-sm text-[var(--color-text-secondary)]">
        Saisissez vos meilleures ventes, un nom et un prix suffisent. Le reste viendra en caisse : scannez un code-barres pour
        créer un produit, ou vendez en « Article libre ».
      </p>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (ready.length) void save()
        }}
      >
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2">
            <label className="sr-only" htmlFor={`p-name-${i}`}>
              Produit {i + 1}
            </label>
            <input
              id={`p-name-${i}`}
              placeholder="Nom"
              value={r.name}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              className={fieldCls + ' min-w-0 flex-1'}
            />
            <label className="sr-only" htmlFor={`p-price-${i}`}>
              Prix du produit {i + 1}
            </label>
            <input
              id={`p-price-${i}`}
              placeholder="Prix"
              inputMode="decimal"
              value={r.price}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))}
              className={fieldCls + ' tabular w-24 shrink-0 text-right'}
            />
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                aria-label={`Retirer la ligne ${i + 1}`}
                className="grid size-12 shrink-0 place-items-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
              >
                <Trash size={18} />
              </button>
            )}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => setRows([...rows, { name: '', price: '' }])}
            className="flex h-11 items-center gap-1.5 text-sm font-medium text-[var(--color-accent)]"
          >
            <Plus size={16} aria-hidden /> Une ligne
          </button>
          <button
            type="submit"
            disabled={!ready.length || saving}
            className="ml-auto h-12 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 text-[15px] font-semibold text-[var(--color-on-accent)] disabled:opacity-40"
          >
            {saving ? 'Ajout...' : ready.length > 1 ? `Ajouter ces ${ready.length} produits` : 'Ajouter ce produit'}
          </button>
        </div>
      </form>
      <p className="text-sm text-[var(--color-text-secondary)]">
        Un catalogue existant (Excel, autre caisse)&nbsp;?{' '}
        <Link href="/settings/data" className="font-medium text-[var(--color-accent)] underline-offset-4 hover:underline">
          Importez-le en une fois
        </Link>
        , tailles et couleurs comprises.
      </p>
    </section>
  )
}

function PaymentStep({ siteId }: { siteId: string }) {
  const qc = useQueryClient()
  const devices = useQuery({ queryKey: ['payment-devices', siteId], queryFn: () => paymentsApi.devices(siteId) })
  const [adding, setAdding] = useState(false)
  const linked = devices.data ?? []

  return (
    <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold">2. Paiement par carte</h2>
        {linked.length > 0 && (
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <CheckCircle size={18} weight="fill" aria-hidden className="text-[var(--color-accent)]" />
            {linked.map((d) => d.name).join(', ')}
          </p>
        )}
      </div>
      <p className="text-sm text-[var(--color-text-secondary)]">
        Avec un TPE relié, la caisse lui envoie le montant et la vente se ferme seule. Sans TPE relié, encaissez sur votre TPE
        habituel puis touchez « Carte ».
      </p>
      <div className="flex flex-wrap gap-2">
        {!linked.some((d) => d.provider === 'SIMULATOR') && (
          <button
            type="button"
            disabled={adding}
            onClick={async () => {
              setAdding(true)
              try {
                await paymentsApi.pair(siteId, { provider: 'SIMULATOR', name: 'TPE virtuel' })
                await qc.invalidateQueries({ queryKey: ['payment-devices', siteId] })
              } catch (e) {
                toast.error((e as Error).message)
              } finally {
                setAdding(false)
              }
            }}
            className="h-12 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-[15px] font-medium hover:border-[var(--color-accent)]"
          >
            Essayer avec un TPE virtuel
          </button>
        )}
        <Link
          href="/settings/payments"
          className="h-12 content-center rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-[15px] font-medium hover:border-[var(--color-accent)]"
        >
          Relier mon TPE (SumUp, Stripe)
        </Link>
      </div>
    </section>
  )
}
