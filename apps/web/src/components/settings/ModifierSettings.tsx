'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { DEFAULT_SCALE_RULES, ean13CheckDigit, formatPrice, type ScaleBarcodeRule } from '@erp/utils'
import { sitesApi } from '@/lib/api/sites'
import { usePlatformConfig } from '@/lib/api/platform'
import { modifiersApi, type ModifierGroupAdmin, type ModifierGroupPayload } from '@/lib/api/modifiers'
import { useAuthStore } from '@/stores/auth.store'

const field = 'h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 text-[15px] focus:border-[var(--color-accent)]'
const button = 'h-11 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 text-[15px] font-semibold text-[var(--color-on-accent)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)] press'
const ghost = 'flex h-10 items-center gap-1.5 rounded-[var(--radius-pill)] px-3 text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-bg-hover)]'

// Options et suppléments proposés en caisse, et lecture des étiquettes de balance
export function ModifierSettings() {
  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: sitesApi.getAll })
  const [siteId, setSiteId] = useState('')
  const site = siteId || sites[0]?.id || ''
  const owner = useAuthStore((s) => s.user?.role === 'OWNER')

  return (
    <div className="max-w-3xl space-y-10 p-6 md:p-8">
      <header className="space-y-1">
        <h1 className="page-title">Options et balance</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Les options se choisissent en caisse au moment d’ajouter l’article : cuisson, sauce, supplément payant. Rattachez un groupe à ses produits dans leur fiche. Les formules se composent aussi depuis la fiche produit.
        </p>
      </header>

      {sites.length > 1 && (
        <label className="block space-y-2">
          <span className="block text-sm font-medium">Boutique</span>
          <select value={site} onChange={(e) => setSiteId(e.target.value)} className={`${field} sm:w-72`}>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {site && <Groups siteId={site} />}
      <ScaleRules canEdit={owner} />
    </div>
  )
}

type Draft = ModifierGroupPayload & { id?: string }

const emptyGroup = (): Draft => ({ name: '', minSelect: 0, maxSelect: null, modifiers: [{ name: '', price: 0 }] })

function toDraft(g: ModifierGroupAdmin): Draft {
  return { id: g.id, name: g.name, minSelect: g.minSelect, maxSelect: g.maxSelect, modifiers: g.modifiers.map((m) => ({ id: m.id, name: m.name, price: Number(m.price) })) }
}

function Groups({ siteId }: { siteId: string }) {
  const groups = useQuery({ queryKey: ['modifier-groups', siteId], queryFn: () => modifiersApi.list(siteId) })
  const [adding, setAdding] = useState(false)

  return (
    <section aria-labelledby="groups-title" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="groups-title" className="text-lg font-semibold">
          Groupes d’options
        </h2>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className={ghost}>
            <Plus size={16} weight="bold" aria-hidden />
            Nouveau groupe
          </button>
        )}
      </div>
      {groups.data?.length === 0 && !adding && (
        <p className="text-[15px] text-[var(--color-text-secondary)]">Aucun groupe. Exemple : « Cuisson » (1 choix obligatoire) ou « Suppléments » (facultatif, payant).</p>
      )}
      <ul className="space-y-3">
        {adding && (
          <li>
            <GroupEditor siteId={siteId} initial={emptyGroup()} onDone={() => setAdding(false)} />
          </li>
        )}
        {groups.data?.map((g) => (
          <li key={g.id}>
            <GroupEditor siteId={siteId} initial={toDraft(g)} products={g._count?.products ?? 0} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function GroupEditor({ siteId, initial, products, onDone }: { siteId: string; initial: Draft; products?: number; onDone?: () => void }) {
  const qc = useQueryClient()
  const [d, setD] = useState<Draft>(initial)
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['modifier-groups', siteId] })
    void qc.invalidateQueries({ queryKey: ['products', siteId] })
    void qc.invalidateQueries({ queryKey: ['products-admin', siteId] })
  }
  const save = useMutation({
    mutationFn: () => {
      const payload: ModifierGroupPayload = {
        name: d.name.trim(),
        minSelect: d.minSelect,
        maxSelect: d.maxSelect,
        modifiers: d.modifiers.filter((m) => m.name.trim()).map((m) => ({ ...(m.id ? { id: m.id } : {}), name: m.name.trim(), price: m.price })),
      }
      return d.id ? modifiersApi.update(siteId, d.id, payload) : modifiersApi.create(siteId, payload)
    },
    onSuccess: () => {
      refresh()
      toast.success(`Groupe « ${d.name.trim()} » enregistré`)
      onDone?.()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: () => modifiersApi.remove(siteId, d.id!),
    onSuccess: () => {
      refresh()
      toast.success(`Groupe « ${d.name} » supprimé`)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const setMod = (i: number, patch: Partial<Draft['modifiers'][number]>) => setD({ ...d, modifiers: d.modifiers.map((m, k) => (k === i ? { ...m, ...patch } : m)) })
  const valid = d.name.trim() && d.modifiers.some((m) => m.name.trim())

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) save.mutate()
      }}
      className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4"
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_120px_120px]">
        <label className="space-y-1.5">
          <span className="block text-sm font-medium">Nom du groupe</span>
          <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Cuisson" className={field} />
        </label>
        <label className="space-y-1.5">
          <span className="block text-sm font-medium">Minimum</span>
          <input type="number" min={0} max={20} value={d.minSelect} onChange={(e) => setD({ ...d, minSelect: Math.max(0, Number(e.target.value) || 0) })} className={field} />
        </label>
        <label className="space-y-1.5">
          <span className="block text-sm font-medium">Maximum</span>
          <input
            type="number"
            min={1}
            max={20}
            value={d.maxSelect ?? ''}
            placeholder="Sans"
            onChange={(e) => setD({ ...d, maxSelect: e.target.value ? Math.max(1, Number(e.target.value)) : null })}
            className={field}
          />
        </label>
      </div>
      <p className="text-sm text-[var(--color-text-muted)]">Minimum 1 : le choix est obligatoire. Maximum 1 : un seul choix possible.</p>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Options</legend>
        <div aria-hidden className="grid grid-cols-[1fr_110px_44px] gap-2 text-sm text-[var(--color-text-secondary)]">
          <span>Nom</span>
          <span>Supplément (€)</span>
        </div>
        {d.modifiers.map((m, i) => (
          <div key={m.id ?? `n${i}`} className="grid grid-cols-[1fr_110px_44px] items-center gap-2">
            <input aria-label={`Option ${i + 1}`} value={m.name} onChange={(e) => setMod(i, { name: e.target.value })} placeholder={i === 0 ? 'Saignante' : 'Option'} className={field} />
            <input
              aria-label={`Supplément de l'option ${i + 1}`}
              type="number"
              step="0.01"
              min={0}
              value={m.price}
              onChange={(e) => setMod(i, { price: Math.max(0, Number(e.target.value) || 0) })}
              className={`${field} tabular`}
            />
            <button
              type="button"
              onClick={() => setD({ ...d, modifiers: d.modifiers.filter((_, k) => k !== i) })}
              aria-label={`Retirer ${m.name || `l'option ${i + 1}`}`}
              className="grid size-11 place-items-center rounded-[var(--radius-pill)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
            >
              <Trash size={16} />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setD({ ...d, modifiers: [...d.modifiers, { name: '', price: 0 }] })} className={ghost}>
          <Plus size={16} weight="bold" aria-hidden />
          Ajouter une option
        </button>
        <p className="text-sm text-[var(--color-text-muted)]">Supplément à 0 : option gratuite. Un supplément est vendu au taux de TVA de l’article.</p>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-[var(--color-text-secondary)]">
          {products ? `Proposé sur ${products} produit${products > 1 ? 's' : ''}` : d.id ? 'Rattaché à aucun produit' : ''}
        </span>
        <div className="flex gap-2">
          {d.id ? (
            <button type="button" disabled={remove.isPending} onClick={() => remove.mutate()} className="h-11 rounded-[var(--radius-md)] px-4 text-[15px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]">
              Supprimer
            </button>
          ) : (
            <button type="button" onClick={onDone} className="h-11 rounded-[var(--radius-md)] px-4 text-[15px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]">
              Annuler
            </button>
          )}
          <button type="submit" disabled={!valid || save.isPending} className={button}>
            {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </form>
  )
}

// Exemple d'étiquette lisible pour une règle : code article 123, 12,50 € ou 0,452 kg
function example(r: ScaleBarcodeRule) {
  const valueLength = 10 - r.codeLength
  const code = '123'.padStart(r.codeLength, '0')
  const value = (r.mode === 'PRICE' ? '1250' : '452').padStart(valueLength, '0')
  const first12 = r.prefix + code + value
  return first12 + ean13CheckDigit(first12)
}

function ScaleRules({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient()
  const { data: config } = usePlatformConfig()
  const [rules, setRules] = useState<ScaleBarcodeRule[]>(DEFAULT_SCALE_RULES)
  useEffect(() => {
    if (config?.scaleBarcodes) setRules(config.scaleBarcodes)
  }, [config?.scaleBarcodes])
  const save = useMutation({
    mutationFn: () => modifiersApi.saveScaleRules(rules),
    onSuccess: (c) => {
      qc.setQueryData(['platform-config'], c)
      toast.success('Étiquettes de balance enregistrées')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const used = new Set(rules.map((r) => r.prefix))
  const set = (i: number, patch: Partial<ScaleBarcodeRule>) => setRules(rules.map((r, k) => (k === i ? { ...r, ...patch } : r)))

  return (
    <section aria-labelledby="scale-title" className="space-y-4">
      <div className="space-y-1">
        <h2 id="scale-title" className="text-lg font-semibold">
          Étiquettes de balance
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Une balance étiqueteuse imprime un code-barres qui commence par 20 à 29, suivi du code article, puis du prix ou du poids. Reprenez ici le réglage de votre balance, et le code article dans la fiche de chaque produit vendu au poids.
        </p>
      </div>
      <ul className="space-y-2">
        {rules.map((r, i) => (
          <li key={i} className="grid items-end gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 sm:grid-cols-[110px_1fr_150px_44px]">
            <label className="space-y-1.5">
              <span className="block text-sm font-medium">Préfixe</span>
              <select disabled={!canEdit} value={r.prefix} onChange={(e) => set(i, { prefix: e.target.value })} className={field}>
                {Array.from({ length: 10 }, (_, k) => `2${k}`).map((p) => (
                  <option key={p} value={p} disabled={p !== r.prefix && used.has(p)}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="block text-sm font-medium">Contenu</span>
              <select disabled={!canEdit} value={r.mode} onChange={(e) => set(i, { mode: e.target.value as ScaleBarcodeRule['mode'] })} className={field}>
                <option value="PRICE">Prix (en centimes)</option>
                <option value="WEIGHT">Poids (en grammes)</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="block text-sm font-medium">Code article</span>
              <select disabled={!canEdit} value={r.codeLength} onChange={(e) => set(i, { codeLength: Number(e.target.value) })} className={field}>
                {[4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} chiffres
                  </option>
                ))}
              </select>
            </label>
            {canEdit && (
              <button type="button" onClick={() => setRules(rules.filter((_, k) => k !== i))} aria-label={`Retirer le préfixe ${r.prefix}`} className="grid size-11 place-items-center rounded-[var(--radius-pill)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]">
                <Trash size={16} />
              </button>
            )}
            <p className="text-sm text-[var(--color-text-muted)] sm:col-span-4">
              Exemple : <span className="font-data">{example(r)}</span> = article 123, {r.mode === 'PRICE' ? formatPrice(12.5) : '0,452 kg'}
            </p>
          </li>
        ))}
      </ul>
      {canEdit ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {used.size < 10 ? (
            <button
              type="button"
              onClick={() => {
                const free = Array.from({ length: 10 }, (_, k) => `2${k}`).find((p) => !used.has(p))!
                setRules([...rules, { prefix: free, mode: 'PRICE', codeLength: 5 }])
              }}
              className={ghost}
            >
              <Plus size={16} weight="bold" aria-hidden />
              Ajouter un préfixe
            </button>
          ) : (
            <span />
          )}
          <button type="button" disabled={save.isPending} onClick={() => save.mutate()} className={button}>
            {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)]">Seul le titulaire du compte peut modifier ce réglage.</p>
      )}
      <p className="text-sm text-[var(--color-text-muted)]">
        Sans préfixe enregistré, la caisse lit 20 comme un prix et 23 comme un poids.
      </p>
    </section>
  )
}
