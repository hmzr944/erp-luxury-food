'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CaretLeft, CaretRight, Check, SignOut } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useSocket } from '@/hooks/useSocket'
import { FlowPulse } from '@/components/brand/FlowLogo'
import { useAuthStore } from '@/stores/auth.store'
import { sitesApi } from '@/lib/api/sites'
import { STATUS_LABEL, deliveryLabel, qty, supplyApi, type Production, type SupplyOrder } from '@/lib/api/supply'
import { BRAND } from '@/lib/brand'
import { FlowMark } from '@/components/brand/FlowLogo'

const shift = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

type Tab = 'total' | 'colis' | 'incidents'

// Écran de production : thème sombre imposé, chiffres lisibles à trois mètres,
// boutons faits pour des mains gantées. Aucune vente ni chiffre d'affaires ici.
export function AtelierScreen({ siteId }: { siteId: string }) {
  const router = useRouter()
  const qc = useQueryClient()
  const { user, logout } = useAuthStore()
  const [tab, setTab] = useState<Tab>('total')
  const [day, setDay] = useState<string | undefined>()
  const sites = useQuery({ queryKey: ['sites'], queryFn: sitesApi.getAll })
  const site = sites.data?.find((s) => s.id === siteId)
  const prod = useQuery({
    queryKey: ['supply', siteId, 'production', day],
    queryFn: () => supplyApi.production(siteId, day),
    refetchInterval: 20_000,
  })
  const time = useClock()

  // Thème sombre pour tout l'écran, rétabli en quittant l'atelier
  useEffect(() => {
    const html = document.documentElement
    const previous = html.dataset.theme
    html.dataset.theme = 'dark'
    return () => {
      if (previous) html.dataset.theme = previous
      else delete html.dataset.theme
    }
  }, [])

  // Une commande envoyée ou modifiée apparaît sans recharger
  const { on, status } = useSocket(siteId)
  useEffect(() => {
    const stop = on('supply:updated', () => void qc.invalidateQueries({ queryKey: ['supply', siteId] }))
    return () => {
      stop()
    }
    // on() change à chaque rendu : on se réabonne quand la connexion change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, qc, siteId])

  const p = prod.data
  const manager = user?.role === 'OWNER' || user?.role === 'MANAGER'

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      <header className="flex flex-wrap items-center gap-4 border-b border-[var(--color-border)] px-4 py-3 md:px-8">
        <FlowMark size={44} className="shrink-0" />
        <div className="min-w-0">
          <p className="font-display text-2xl font-bold tracking-tight">{site?.name ?? 'Atelier'}</p>
          <p className="text-base text-[var(--color-text-secondary)]">
            {BRAND}, atelier{user?.firstName ? `, ${user.firstName}` : ''}
          </p>
        </div>
        {p && (
          <div className="flex items-center gap-2 md:ml-6">
            <button type="button" aria-label="Jour précédent" onClick={() => setDay(shift(p.day, -1))} className="grid size-16 place-items-center rounded-[var(--radius-lg)] border border-[var(--color-border-strong)]">
              <CaretLeft size={28} />
            </button>
            <p className="min-w-64 text-center text-2xl font-semibold">Livraison {deliveryLabel(p.day).toLowerCase()}</p>
            <button type="button" aria-label="Jour suivant" onClick={() => setDay(shift(p.day, 1))} className="grid size-16 place-items-center rounded-[var(--radius-lg)] border border-[var(--color-border-strong)]">
              <CaretRight size={28} />
            </button>
          </div>
        )}
        <p className="tabular ml-auto text-4xl font-semibold">{time}</p>
        {manager && (
          <Link href="/supply" className="flex h-16 items-center rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] px-5 text-lg font-semibold">
            Back-office
          </Link>
        )}
        <button
          type="button"
          onClick={() => {
            logout()
            router.push('/login')
          }}
          aria-label="Se déconnecter"
          className="grid size-16 place-items-center rounded-[var(--radius-lg)] border border-[var(--color-border-strong)]"
        >
          <SignOut size={28} />
        </button>
      </header>

      <nav role="tablist" aria-label="Vues de l'atelier" className="grid grid-cols-3 gap-2 px-4 pt-4 md:px-8">
        {(
          [
            ['total', 'À produire'],
            ['colis', 'Colisage'],
            ['incidents', 'Incidents'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={[
              'h-20 rounded-[var(--radius-lg)] text-2xl font-semibold transition-colors duration-150',
              tab === key ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]' : 'border border-[var(--color-border-strong)] text-[var(--color-text-secondary)]',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="flex-1 px-4 py-6 md:px-8">
        {!p ? (
          prod.isError ? (
            <p className="text-2xl text-[var(--color-text-secondary)]">{(prod.error as Error).message}</p>
          ) : (
            <p className="flex items-center gap-4 text-2xl text-[var(--color-text-secondary)]" role="status">
              <FlowPulse size={36} /> Chargement des commandes
            </p>
          )
        ) : tab === 'total' ? (
          <Totals siteId={siteId} p={p} />
        ) : tab === 'colis' ? (
          <Packing siteId={siteId} p={p} />
        ) : (
          <Incidents siteId={siteId} p={p} />
        )}
      </main>
    </div>
  )
}

// Les lignes dont la quantité vient de changer (une boutique a commandé) :
// elles s'éclairent une seconde pour que l'équipe le voie de loin
function useChangedTotals(rows: Production['consolidated']) {
  const prev = useRef<Map<string, number> | null>(null)
  const [changed, setChanged] = useState<Set<string>>(new Set())
  useEffect(() => {
    const now = new Map(rows.map((c) => [`${c.productId}:${c.variantId}`, c.total]))
    const before = prev.current
    prev.current = now
    if (!before) return
    const diff = new Set([...now].filter(([k, v]) => before.get(k) !== v).map(([k]) => k))
    if (!diff.size) return
    setChanged(diff)
    const t = window.setTimeout(() => setChanged(new Set()), 1300)
    return () => window.clearTimeout(t)
  }, [rows])
  return changed
}

function Totals({ siteId, p }: { siteId: string; p: Production }) {
  const qc = useQueryClient()
  const changed = useChangedTotals(p.consolidated)
  const [busy, setBusy] = useState(false)
  const toStart = p.orders.filter((o) => o.status === 'SENT').length
  return (
    <div className="space-y-6">
      {p.waitingFor.length > 0 && (
        <p className="rounded-[var(--radius-lg)] border-2 border-[var(--color-accent)] p-5 text-2xl">
          Pas encore de commande : <span className="font-semibold">{p.waitingFor.map((s) => s.name).join(', ')}</span>
        </p>
      )}
      {p.consolidated.length === 0 ? (
        <p className="py-10 text-3xl text-[var(--color-text-secondary)]">Aucune commande pour ce jour.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {p.consolidated.map((c) => (
            <li
              key={`${c.productId}:${c.variantId}`}
              className={`grid grid-cols-[minmax(9rem,auto)_1fr] items-baseline gap-x-8 py-5 ${changed.has(`${c.productId}:${c.variantId}`) ? 'kds-flash' : ''}`}
            >
              <p className="tabular text-right font-display text-7xl font-bold leading-none tracking-tight">
                {qty(c.total)}
                {c.unit && c.unit !== 'pièce' ? <span className="text-3xl"> {c.unit}</span> : null}
              </p>
              <div className="min-w-0">
                <p className="text-4xl font-semibold leading-tight">{c.variantName ? `${c.name}, ${c.variantName}` : c.name}</p>
                <p className="mt-1 text-xl text-[var(--color-text-secondary)]">{c.bySite.map((b) => `${b.siteName} ${qty(b.quantity)}`).join(', ')}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {toStart > 0 && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              const r = await supplyApi.start(siteId, p.day)
              toast.success(`${r.started} ${r.started > 1 ? 'commandes' : 'commande'} en fabrication`)
              await qc.invalidateQueries({ queryKey: ['supply', siteId] })
            } catch (e) {
              toast.error((e as Error).message)
            } finally {
              setBusy(false)
            }
          }}
          className="h-24 w-full rounded-[var(--radius-xl)] bg-[var(--color-accent)] text-3xl font-semibold text-[var(--color-on-accent)] disabled:opacity-60"
        >
          Lancer la fabrication ({toStart} {toStart > 1 ? 'boutiques' : 'boutique'})
        </button>
      )}
    </div>
  )
}

function Packing({ siteId, p }: { siteId: string; p: Production }) {
  const [selected, setSelected] = useState<string | null>(null)
  const order = p.orders.find((o) => o.id === selected) ?? p.orders.find((o) => o.status === 'SENT' || o.status === 'IN_PRODUCTION') ?? p.orders[0]
  if (!p.orders.length) return <p className="py-10 text-3xl text-[var(--color-text-secondary)]">Rien à préparer pour ce jour.</p>
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(16rem,1fr)_3fr]">
      <ul className="space-y-3" aria-label="Boutiques">
        {p.orders.map((o) => {
          const done = o.status === 'SHIPPED' || o.status === 'RECEIVED'
          return (
            <li key={o.id}>
              <button
                type="button"
                aria-pressed={o.id === order?.id}
                onClick={() => setSelected(o.id)}
                className={[
                  'flex min-h-20 w-full items-center justify-between gap-3 rounded-[var(--radius-lg)] px-5 text-left text-2xl font-semibold',
                  o.id === order?.id ? 'bg-[var(--color-text-primary)] text-[var(--color-bg-base)]' : 'border border-[var(--color-border-strong)]',
                ].join(' ')}
              >
                {o.fromSite.name}
                <span className="text-lg font-medium opacity-80">{done ? 'Expédié' : STATUS_LABEL[o.status]}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {order && <PackingOrder key={order.id} siteId={siteId} order={order} />}
    </div>
  )
}

function PackingOrder({ siteId, order }: { siteId: string; order: SupplyOrder }) {
  const qc = useQueryClient()
  const shipped = order.status === 'SHIPPED' || order.status === 'RECEIVED'
  const [prepared, setPrepared] = useState<Record<string, number>>(() => Object.fromEntries(order.lines.map((l) => [l.id, l.prepared ?? l.ordered])))
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const allChecked = order.lines.every((l) => checked[l.id])

  return (
    <section aria-label={`Colis de ${order.fromSite.name}`} className="space-y-4">
      <ul className="space-y-3">
        {order.lines.map((l) => {
          const v = prepared[l.id] ?? 0
          const short = v < l.ordered
          return (
            <li key={l.id} className={['flex flex-wrap items-center gap-4 rounded-[var(--radius-lg)] border p-4', checked[l.id] || shipped ? 'border-[var(--color-accent)]' : 'border-[var(--color-border-strong)]'].join(' ')}>
              <button
                type="button"
                disabled={shipped}
                aria-pressed={!!checked[l.id]}
                aria-label={`Bac prêt : ${l.name}`}
                onClick={() => setChecked({ ...checked, [l.id]: !checked[l.id] })}
                className={['grid size-20 shrink-0 place-items-center rounded-[var(--radius-lg)] border-2', checked[l.id] || shipped ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-on-accent)]' : 'border-[var(--color-border-strong)]'].join(' ')}
              >
                {(checked[l.id] || shipped) && <Check size={40} weight="bold" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-3xl font-semibold">{l.variantName ? `${l.name}, ${l.variantName}` : l.name}</p>
                <p className="text-xl text-[var(--color-text-secondary)]">
                  Commandé {qty(l.ordered)}
                  {l.unit && l.unit !== 'pièce' ? ` ${l.unit}` : ''}
                  {short ? `, il en manque ${qty(l.ordered - v)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" disabled={shipped || v <= 0} aria-label={`Un de moins, ${l.name}`} onClick={() => setPrepared({ ...prepared, [l.id]: Math.max(0, v - (l.unit === 'kg' ? 0.5 : 1)) })} className="grid size-20 place-items-center rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] text-4xl disabled:opacity-30">
                  −
                </button>
                <span className="tabular w-28 text-center text-5xl font-semibold">{qty(v)}</span>
                <button type="button" disabled={shipped} aria-label={`Un de plus, ${l.name}`} onClick={() => setPrepared({ ...prepared, [l.id]: v + (l.unit === 'kg' ? 0.5 : 1) })} className="grid size-20 place-items-center rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] text-4xl disabled:opacity-30">
                  +
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      {!shipped && (
        <button
          type="button"
          disabled={saving || !allChecked}
          onClick={async () => {
            setSaving(true)
            try {
              await supplyApi.ship(siteId, order.id, order.lines.map((l) => ({ lineId: l.id, prepared: prepared[l.id] ?? 0 })))
              toast.success(`Colis de ${order.fromSite.name} expédié`)
              await qc.invalidateQueries({ queryKey: ['supply', siteId] })
            } catch (e) {
              toast.error((e as Error).message)
            } finally {
              setSaving(false)
            }
          }}
          className="h-24 w-full rounded-[var(--radius-xl)] bg-[var(--color-accent)] text-3xl font-semibold text-[var(--color-on-accent)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)]"
        >
          {saving ? 'Expédition...' : allChecked ? `Expédier vers ${order.fromSite.name}` : 'Cochez chaque bac prêt'}
        </button>
      )}
    </section>
  )
}

const CAUSES = ['Pénurie de matière', 'Panne de four', 'Retard de livraison matière', 'Équipe réduite']
const CUTS = [25, 50, 100]

function Incidents({ siteId, p }: { siteId: string; p: Production }) {
  const qc = useQueryClient()
  const alerts = useQuery({ queryKey: ['supply', siteId, 'alerts'], queryFn: () => supplyApi.alerts(siteId) })
  const products = useMemo(() => [...new Set(p.consolidated.map((c) => c.name))], [p.consolidated])
  const [cause, setCause] = useState<string | null>(null)
  const [detail, setDetail] = useState('')
  const [product, setProduct] = useState<string | null>(null)
  const [cut, setCut] = useState(50)
  const [sending, setSending] = useState(false)
  const fullCause = [cause, detail.trim()].filter(Boolean).join(' : ')
  const preview = [fullCause, product ? (cut === 100 ? `${product} non produit` : `${product} réduit de ${cut} %`) : null].filter(Boolean).join(' : ')

  const chip = (active: boolean) =>
    ['min-h-16 rounded-[var(--radius-lg)] px-5 text-xl font-semibold', active ? 'bg-[var(--color-text-primary)] text-[var(--color-bg-base)]' : 'border border-[var(--color-border-strong)]'].join(' ')

  return (
    <div className="grid gap-8 xl:grid-cols-2">
      <section aria-labelledby="new-alert" className="space-y-5">
        <h2 id="new-alert" className="text-3xl font-semibold">
          Prévenir toutes les boutiques
        </h2>
        <div className="flex flex-wrap gap-3">
          {CAUSES.map((c) => (
            <button key={c} type="button" aria-pressed={cause === c} onClick={() => setCause(cause === c ? null : c)} className={chip(cause === c)}>
              {c}
            </button>
          ))}
        </div>
        <label className="block space-y-2">
          <span className="text-xl">Précision (facultatif)</span>
          <input
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="fraises"
            className="h-16 w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-5 text-2xl focus:border-[var(--color-accent)] focus:outline-none"
          />
        </label>
        {products.length > 0 && (
          <fieldset className="space-y-3">
            <legend className="text-xl">Produit touché</legend>
            <div className="flex flex-wrap gap-3">
              {products.map((n) => (
                <button key={n} type="button" aria-pressed={product === n} onClick={() => setProduct(product === n ? null : n)} className={chip(product === n)}>
                  {n}
                </button>
              ))}
            </div>
            {product && (
              <div className="flex flex-wrap gap-3">
                {CUTS.map((c) => (
                  <button key={c} type="button" aria-pressed={cut === c} onClick={() => setCut(c)} className={chip(cut === c)}>
                    {c === 100 ? 'Pas de production' : `−${c} %`}
                  </button>
                ))}
              </div>
            )}
          </fieldset>
        )}
        {preview && <p className="rounded-[var(--radius-lg)] bg-[var(--color-bg-surface)] p-5 text-2xl">« {preview} »</p>}
        <button
          type="button"
          disabled={!preview || sending}
          onClick={async () => {
            setSending(true)
            try {
              await supplyApi.createAlert(siteId, { cause: fullCause || undefined, productName: product ?? undefined, reductionPct: product ? cut : undefined, day: p.day })
              toast.success('Message envoyé à toutes les boutiques')
              setCause(null)
              setDetail('')
              setProduct(null)
              await qc.invalidateQueries({ queryKey: ['supply', siteId, 'alerts'] })
            } catch (e) {
              toast.error((e as Error).message)
            } finally {
              setSending(false)
            }
          }}
          className="h-24 w-full rounded-[var(--radius-xl)] bg-[var(--color-accent)] text-3xl font-semibold text-[var(--color-on-accent)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)]"
        >
          {sending ? 'Envoi...' : 'Envoyer au réseau'}
        </button>
      </section>
      <section aria-labelledby="active-alerts" className="space-y-4">
        <h2 id="active-alerts" className="text-3xl font-semibold">
          Messages en cours
        </h2>
        {alerts.data?.length ? (
          <ul className="space-y-3">
            {alerts.data.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] p-5">
                <div className="min-w-0 flex-1">
                  <p className="text-2xl font-semibold">{a.message}</p>
                  <p className="text-lg text-[var(--color-text-secondary)]">Livraison {deliveryLabel(a.day).toLowerCase()}</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await supplyApi.deleteAlert(siteId, a.id).catch((e) => toast.error((e as Error).message))
                    await qc.invalidateQueries({ queryKey: ['supply', siteId, 'alerts'] })
                  }}
                  className="h-16 rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] px-5 text-xl font-semibold"
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-2xl text-[var(--color-text-secondary)]">Aucun message en cours.</p>
        )}
      </section>
    </div>
  )
}

function useClock() {
  const [t, setT] = useState('')
  useEffect(() => {
    const tick = () => setT(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
    tick()
    const id = window.setInterval(tick, 15_000)
    return () => window.clearInterval(id)
  }, [])
  return t
}
