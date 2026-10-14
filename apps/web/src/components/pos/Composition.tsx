'use client'

import { useMemo, useState } from 'react'
import { Check, Minus, Plus } from '@phosphor-icons/react'
import { formatPrice, priceForWeight, priceMenu, priceWithModifiers, weightLabel, type ModifierChoice } from '@erp/utils'
import type { ApiModifierGroup, ApiProduct, ApiVariant } from '@/lib/api/products'
import type { CartMenuPart } from '@/stores/cart.store'
import { Sheet } from './Sheet'

const num = (v: number | string | null | undefined) => Number(v ?? 0)
export const groupsOf = (p: ApiProduct): ApiModifierGroup[] => (p.modifierGroups ?? []).map((g) => g.group).filter((g) => g.modifiers.length)

// Choix d'options pour un groupe : obligatoire si minSelect > 0, au plus maxSelect
type Picked = Record<string, string[]>

function missingGroup(groups: ApiModifierGroup[], picked: Picked) {
  return groups.find((g) => (picked[g.id]?.length ?? 0) < g.minSelect)
}

function choicesOf(groups: ApiModifierGroup[], picked: Picked): ModifierChoice[] {
  return groups.flatMap((g) =>
    g.modifiers.filter((m) => picked[g.id]?.includes(m.id)).map((m) => ({ id: m.id, name: m.name, price: num(m.price) })),
  )
}

function ModifierGroups({ groups, picked, onChange }: { groups: ApiModifierGroup[]; picked: Picked; onChange: (p: Picked) => void }) {
  const toggle = (g: ApiModifierGroup, id: string) => {
    const current = picked[g.id] ?? []
    let next: string[]
    if (current.includes(id)) next = current.filter((x) => x !== id)
    // Choix unique : le nouveau remplace l'ancien
    else if (g.maxSelect === 1) next = [id]
    else if (g.maxSelect !== null && current.length >= g.maxSelect) return
    else next = [...current, id]
    onChange({ ...picked, [g.id]: next })
  }
  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const count = picked[g.id]?.length ?? 0
        const rule =
          g.minSelect > 0 && g.maxSelect === g.minSelect
            ? `${g.minSelect} au choix, obligatoire`
            : [g.minSelect > 0 ? `au moins ${g.minSelect}` : 'facultatif', g.maxSelect ? `${g.maxSelect} au plus` : null].filter(Boolean).join(', ')
        return (
          <fieldset key={g.id}>
            <legend className="mb-2 flex w-full items-baseline justify-between gap-3">
              <span className="text-[15px] font-semibold">{g.name}</span>
              <span className={`text-sm ${count < g.minSelect ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}>{rule}</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {g.modifiers.map((m) => {
                const on = picked[g.id]?.includes(m.id) ?? false
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(g, m.id)}
                    className={[
                      'flex h-11 items-center gap-2 rounded-[var(--radius-pill)] border px-4 text-[15px] press',
                      on ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-on-accent)]' : 'border-[var(--color-border-strong)] hover:border-[var(--color-accent)]',
                    ].join(' ')}
                  >
                    {on && <Check size={16} weight="bold" aria-hidden />}
                    {m.name}
                    {num(m.price) > 0 && <span className="tabular opacity-80">+{formatPrice(num(m.price))}</span>}
                  </button>
                )
              })}
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}

const primary =
  'h-12 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-base font-semibold text-[var(--color-on-accent)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)] press'

// ── Options d'un article ────────────────────────────────────

export function ModifierSheet({
  target,
  onClose,
  onAdd,
}: {
  target: { product: ApiProduct; variant?: ApiVariant; serialNumber?: string } | null
  onClose: () => void
  onAdd: (modifiers: ModifierChoice[]) => void
}) {
  return (
    <Sheet open={!!target} title={target ? [target.product.name, target.variant?.name].filter(Boolean).join(' ') : ''} onClose={onClose} width="lg">
      {target && <ModifierBody key={target.product.id + (target.variant?.id ?? '')} {...target} onAdd={onAdd} />}
    </Sheet>
  )
}

function ModifierBody({ product, variant, onAdd }: { product: ApiProduct; variant?: ApiVariant; onAdd: (m: ModifierChoice[]) => void }) {
  const groups = groupsOf(product)
  const [picked, setPicked] = useState<Picked>({})
  const missing = missingGroup(groups, picked)
  const choices = choicesOf(groups, picked)
  const price = priceWithModifiers(num(variant?.price ?? product.price), choices)
  return (
    <div className="space-y-5">
      <ModifierGroups groups={groups} picked={picked} onChange={setPicked} />
      <button type="button" disabled={!!missing} onClick={() => onAdd(choices)} className={primary}>
        {missing ? `Choisissez : ${missing.name.toLowerCase()}` : `Ajouter · ${formatPrice(price)}`}
      </button>
    </div>
  )
}

// ── Formule ────────────────────────────────────────────────

interface Option {
  key: string
  product: ApiProduct
  variant?: ApiVariant
  supplement: number
}

export function MenuComposer({
  menu,
  products,
  onClose,
  onAdd,
}: {
  menu: ApiProduct | null
  products: ApiProduct[]
  onClose: () => void
  onAdd: (menu: ApiProduct, parts: CartMenuPart[]) => void
}) {
  return (
    <Sheet open={!!menu} title={menu?.name ?? ''} onClose={onClose} width="lg">
      {menu && <MenuBody key={menu.id} menu={menu} products={products} onAdd={(parts) => onAdd(menu, parts)} />}
    </Sheet>
  )
}

function MenuBody({ menu, products, onAdd }: { menu: ApiProduct; products: ApiProduct[]; onAdd: (parts: CartMenuPart[]) => void }) {
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  // Articles proposés à chaque étape ; un article à variantes propose chacune
  const steps = useMemo(
    () =>
      (menu.menuSteps ?? []).map((st) => ({
        ...st,
        options: st.choices.flatMap((c): Option[] => {
          const p = byId.get(c.productId)
          if (!p) return []
          const supplement = num(c.supplement)
          if (c.variantId) {
            const v = p.variants.find((x) => x.id === c.variantId)
            return v ? [{ key: `${c.id}:${v.id}`, product: p, variant: v, supplement }] : []
          }
          if (p.variants.length) return p.variants.map((v) => ({ key: `${c.id}:${v.id}`, product: p, variant: v, supplement }))
          return [{ key: c.id, product: p, supplement }]
        }),
      })),
    [menu, byId],
  )
  // Choix de chaque étape (clé d'option, répétable si maxSelect > 1) et options des articles choisis
  const [chosen, setChosen] = useState<Record<string, string[]>>({})
  const [mods, setMods] = useState<Record<string, Picked>>({})

  const pick = (stepId: string, max: number, key: string) => {
    const current = chosen[stepId] ?? []
    if (max === 1) return setChosen({ ...chosen, [stepId]: current[0] === key ? [] : [key] })
    if (current.length >= max) return
    setChosen({ ...chosen, [stepId]: [...current, key] })
  }
  const unpick = (stepId: string, key: string) => {
    const current = [...(chosen[stepId] ?? [])]
    current.splice(current.lastIndexOf(key), 1)
    setChosen({ ...chosen, [stepId]: current })
  }

  // Composants dans l'ordre des étapes
  const selected = steps.flatMap((st) =>
    (chosen[st.id] ?? []).map((key, n) => ({ step: st, option: st.options.find((o) => o.key === key)!, slot: `${st.id}:${key}:${n}` })),
  )
  const missingStep = steps.find((st) => (chosen[st.id]?.length ?? 0) < st.minSelect)
  const missingMods = selected.find((s) => missingGroup(groupsOf(s.option.product), mods[s.slot] ?? {}))

  const parts: CartMenuPart[] = selected.map((s) => ({
    productId: s.option.product.id,
    ...(s.option.variant ? { variantId: s.option.variant.id, variantName: s.option.variant.name } : {}),
    name: s.option.product.name,
    taxRate: num(s.option.product.taxRate),
    alaCarte: num(s.option.variant?.price ?? s.option.product.price),
    supplement: s.option.supplement,
    modifiers: choicesOf(groupsOf(s.option.product), mods[s.slot] ?? {}),
    mealVoucher: !!s.option.product.mealVoucherEligible,
  }))
  const total = parts.length ? priceMenu(num(menu.price), parts).total : num(menu.price)

  if (!steps.length) {
    return <p className="text-[15px] text-[var(--color-text-secondary)]">Cette formule n&apos;a pas encore d&apos;étapes. Composez-la dans Produits.</p>
  }

  return (
    <div className="space-y-6">
      {steps.map((st) => {
        const count = chosen[st.id]?.length ?? 0
        return (
          <section key={st.id} aria-label={st.name}>
            <h3 className="mb-2 flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-semibold">{st.name}</span>
              <span className={`text-sm ${count < st.minSelect ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}>
                {st.minSelect === 0 ? 'facultatif' : st.maxSelect === 1 ? '1 au choix' : `${st.minSelect} à ${st.maxSelect}`}
                {st.maxSelect > 1 ? ` · ${count}/${st.maxSelect}` : ''}
              </span>
            </h3>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {st.options.map((o) => {
                const n = (chosen[st.id] ?? []).filter((k) => k === o.key).length
                const label = [o.product.name, o.variant?.name].filter(Boolean).join(' ')
                return (
                  <li key={o.key} className="relative">
                    <button
                      type="button"
                      aria-pressed={n > 0}
                      onClick={() => pick(st.id, st.maxSelect, o.key)}
                      className={[
                        'flex min-h-14 w-full flex-col justify-center rounded-[var(--radius-md)] border px-3 py-2 text-left press',
                        n > 0 ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)]' : 'border-[var(--color-border-strong)] hover:border-[var(--color-accent)]',
                      ].join(' ')}
                    >
                      <span className="text-[15px] font-semibold">{label}</span>
                      {o.supplement > 0 && <span className="tabular text-sm text-[var(--color-text-secondary)]">+{formatPrice(o.supplement)}</span>}
                    </button>
                    {n > 0 && st.maxSelect > 1 && (
                      <span className="absolute right-1 top-1 flex items-center gap-1">
                        <span className="tabular grid size-7 place-items-center rounded-full bg-[var(--color-accent)] text-sm font-semibold text-[var(--color-on-accent)]">{n}</span>
                        <button type="button" onClick={() => unpick(st.id, o.key)} aria-label={`Un ${label} de moins`} className="grid size-7 place-items-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)]">
                          <Minus size={14} />
                        </button>
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
            {/* Options des articles choisis à cette étape (cuisson, sauce…) */}
            {selected
              .filter((s) => s.step.id === st.id && groupsOf(s.option.product).length)
              .map((s) => (
                <div key={s.slot} className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
                  <p className="mb-2 text-sm font-medium text-[var(--color-text-secondary)]">{[s.option.product.name, s.option.variant?.name].filter(Boolean).join(' ')}</p>
                  <ModifierGroups groups={groupsOf(s.option.product)} picked={mods[s.slot] ?? {}} onChange={(p) => setMods({ ...mods, [s.slot]: p })} />
                </div>
              ))}
          </section>
        )
      })}
      <button type="button" disabled={!!missingStep || !!missingMods} onClick={() => onAdd(parts)} className={primary}>
        {missingStep
          ? `Choisissez : ${missingStep.name.toLowerCase()}`
          : missingMods
            ? `Options à choisir pour ${missingMods.option.product.name}`
            : `Ajouter la formule · ${formatPrice(total)}`}
      </button>
    </div>
  )
}

// ── Pesée ──────────────────────────────────────────────────

export function WeightSheet({ product, onClose, onAdd }: { product: ApiProduct | null; onClose: () => void; onAdd: (weightKg: number) => void }) {
  return (
    <Sheet open={!!product} title={product?.name ?? ''} onClose={onClose}>
      {product && <WeightBody key={product.id} product={product} onAdd={onAdd} />}
    </Sheet>
  )
}

function WeightBody({ product, onAdd }: { product: ApiProduct; onAdd: (weightKg: number) => void }) {
  // Saisie en grammes : plus simple au clavier, sans virgule
  const [grams, setGrams] = useState('')
  const perKg = num(product.price)
  const kg = Number(grams) / 1000
  const valid = Number.isInteger(Number(grams)) && Number(grams) > 0 && Number(grams) <= 9_999_000
  const step = (delta: number) => setGrams(String(Math.max(0, (Number(grams) || 0) + delta)))
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onAdd(kg)
      }}
      className="space-y-4"
    >
      <p className="text-sm text-[var(--color-text-secondary)]">{formatPrice(perKg)} le kilo</p>
      <div className="space-y-2">
        <label htmlFor="weight" className="block text-sm font-medium">
          Poids en grammes
        </label>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => step(-50)} aria-label="50 g de moins" className="grid size-12 shrink-0 place-items-center rounded-[var(--radius-md)] border border-[var(--color-border-strong)]">
            <Minus size={18} />
          </button>
          <input
            id="weight"
            data-autofocus
            inputMode="numeric"
            value={grams}
            onChange={(e) => setGrams(e.target.value.replace(/\D/g, ''))}
            autoComplete="off"
            className="tabular h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-4 text-center text-xl font-semibold focus:border-[var(--color-accent)]"
          />
          <button type="button" onClick={() => step(50)} aria-label="50 g de plus" className="grid size-12 shrink-0 place-items-center rounded-[var(--radius-md)] border border-[var(--color-border-strong)]">
            <Plus size={18} />
          </button>
        </div>
        {valid && <p className="tabular text-center text-sm text-[var(--color-text-secondary)]">{weightLabel(kg, perKg)}</p>}
      </div>
      <p className="text-sm text-[var(--color-text-muted)]">
        Pour une pesée faite par une balance étiqueteuse, scannez plutôt son étiquette : la caisse reprend alors le prix ou le poids imprimé.
      </p>
      <button type="submit" disabled={!valid} className={primary}>
        {valid ? `Ajouter · ${formatPrice(priceForWeight(kg, perKg))}` : 'Saisissez le poids'}
      </button>
    </form>
  )
}
