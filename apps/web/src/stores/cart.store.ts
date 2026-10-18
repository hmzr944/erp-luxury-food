'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { formatPrice, modifiersLabel, priceMenu, priceOrder, splitDiscount, weightLabel, type ModifierChoice, type SignedSaleItem, type SoldItemView } from '@erp/utils'

export interface CartProduct {
  id: string
  name: string
  subtitle?: string
  price: number // prix de la variante choisie s'il y en a une
  taxRate: number
  categoryId?: string
  // Payable en titre-restaurant
  mealVoucher?: boolean
  // Carte cadeau vendue : ni remise fidélité, ni points
  giftCard?: boolean
}

// Composant choisi dans une formule
export interface CartMenuPart {
  productId: string
  variantId?: string
  name: string
  variantName?: string
  taxRate: number
  alaCarte: number // prix vendu seul : base de la répartition du prix
  supplement: number
  modifiers: ModifierChoice[]
  mealVoucher?: boolean
}

export interface CartLine {
  key: string
  // Formule : product porte le nom et le prix total de la formule
  product: CartProduct
  variantId?: string
  variantName?: string
  serialNumber?: string
  customName?: string // article libre
  quantity: number
  discount: number // remise en euros sur la ligne
  // Options choisies, prix compris dans product.price
  modifiers?: ModifierChoice[]
  // Formule : prix de base et composants
  menu?: { price: number; parts: CartMenuPart[] }
  // Article pesé (product.price est alors le prix de la pesée)
  weight?: number
  pricePerKg?: number
  label?: string
}

interface AddOptions {
  variantId?: string
  variantName?: string
  serialNumber?: string
  customName?: string
  modifiers?: ModifierChoice[]
  menu?: CartLine['menu']
  weight?: number
  pricePerKg?: number
  label?: string
}

// Une ligne pesée ou numérotée est unique : quantité 1, jamais fusionnée
// Carte cadeau : un code par carte, donc une ligne par carte
export const isFixedLine = (l: Pick<CartLine, 'serialNumber' | 'weight' | 'label'> & { product?: Pick<CartProduct, 'giftCard'> }) =>
  !!l.serialNumber || l.weight !== undefined || !!l.label || !!l.product?.giftCard

// Client fidélité rattaché à la vente (hors ticket signé)
export interface CartCustomer {
  id: string
  name: string
  points: number
}

interface CartState {
  // Boutique de la vente en cours : une vente gardée ne passe pas d'un site à l'autre
  siteId: string | null
  savedAt: number
  lines: CartLine[]
  orderDiscount: number
  customer: CartCustomer | null
  // Récompense fidélité utilisée : points dépensés et remise accordée
  loyalty: { points: number; amount: number } | null
  lastAddedKey: string | null
  // Compte verrouillé (essai terminé) : pas de nouvelle vente. Une vente
  // déjà commencée se termine normalement. Jamais gardé sur l'appareil
  salesLocked: boolean
  setSalesLocked: (locked: boolean) => void
  addProduct: (product: CartProduct, options?: AddOptions) => void
  removeLine: (key: string) => void
  setQuantity: (key: string, quantity: number) => void
  setLineDiscount: (key: string, discount: number) => void
  setOrderDiscount: (discount: number) => void
  setCustomer: (customer: CartCustomer | null) => void
  setLoyalty: (loyalty: { points: number; amount: number } | null) => void
  clearCart: () => void
  bindSite: (siteId: string) => void
}

// Vente en cours gardée sur l'appareil : un rechargement, un redémarrage ou une
// coupure de courant ne la perd plus. Au-delà de 12 h, elle est abandonnée.
const CART_MAX_AGE_MS = 12 * 3600_000

// Une pièce numérotée est toujours une ligne à part, en un exemplaire
function lineKey(productId: string, options: AddOptions = {}, price?: number) {
  // Un article libre se distingue par son nom et son prix
  const custom = options.customName ? `${options.customName}@${price}` : ''
  // Mêmes options ou même composition de formule : même ligne
  const mods = (options.modifiers ?? []).map((m) => m.id).sort().join('+')
  const menu = (options.menu?.parts ?? []).map((p) => `${p.productId}/${p.variantId ?? ''}/${p.modifiers.map((m) => m.id).sort().join('+')}`).join(';')
  // Pesée : chaque article pesé est une ligne
  const weighed = options.weight !== undefined || options.label ? `${options.label ?? options.weight}#${Math.random().toString(36).slice(2, 8)}` : ''
  return [productId, options.variantId ?? '', options.serialNumber ?? '', custom, mods, menu, weighed].join(':')
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
  siteId: null,
  savedAt: 0,
  lines: [],
  orderDiscount: 0,
  customer: null,
  loyalty: null,
  lastAddedKey: null,
  salesLocked: false,
  setSalesLocked: (salesLocked) => set({ salesLocked }),

  addProduct: (product, options = {}) => {
    const key = lineKey(product.id, options, product.price)
    set((state) => {
      // Premier article d'une vente : refusé si le compte est verrouillé
      if (state.salesLocked && !state.lines.length) return {}
      const existing = state.lines.find((l) => l.key === key)
      if (existing && !isFixedLine(options)) {
        return {
          lastAddedKey: key,
          lines: state.lines.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l)),
        }
      }
      if (existing) return { lastAddedKey: key }
      return {
        lastAddedKey: key,
        lines: [...state.lines, { key, product, ...options, quantity: 1, discount: 0 }],
      }
    })
  },

  removeLine: (key) => set((state) => ({ lines: state.lines.filter((l) => l.key !== key) })),

  setQuantity: (key, quantity) =>
    set((state) => ({
      lines:
        quantity <= 0
          ? state.lines.filter((l) => l.key !== key)
          : state.lines.map((l) => (l.key === key && !isFixedLine(l) ? { ...l, quantity } : l)),
    })),

  setLineDiscount: (key, discount) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.key === key ? { ...l, discount: Math.max(0, discount) } : l)),
    })),

  setOrderDiscount: (discount) => set({ orderDiscount: Math.max(0, discount) }),
  setCustomer: (customer) => set({ customer, loyalty: null }),
  setLoyalty: (loyalty) => set({ loyalty }),
  clearCart: () => set({ lines: [], orderDiscount: 0, customer: null, loyalty: null, lastAddedKey: null }),
  bindSite: (siteId) =>
    set((state) =>
      state.siteId === siteId && Date.now() - state.savedAt < CART_MAX_AGE_MS
        ? {}
        : { siteId, lines: [], orderDiscount: 0, customer: null, loyalty: null, lastAddedKey: null },
    ),
    }),
    {
      name: 'flow-vente-en-cours',
      storage: createJSONStorage(() => localStorage),
      // Relue par la caisse au montage (pas pendant le rendu serveur)
      skipHydration: true,
      partialize: (s) => ({ siteId: s.siteId, savedAt: Date.now(), lines: s.lines, orderDiscount: s.orderDiscount, customer: s.customer, loyalty: s.loyalty }),
    },
  ),
)

// Ligne vendue : ce que la caisse signe, plus de quoi l'afficher
export interface SaleItem extends SignedSaleItem, Omit<SoldItemView, 'modifiers'> {
  lineKey: string
  mealVoucher: boolean
  // Options avec leur nom et leur prix (modifiers ne porte que les identifiants signés)
  modifierChoices: ModifierChoice[] | null
}

// Lignes vendues d'un panier : une formule devient ses composants, chacun à
// sa part du prix et à son taux de TVA (même calcul que le serveur)
export function saleItems(lines: CartLine[]): SaleItem[] {
  return lines.flatMap((l, group) => {
    if (l.menu) {
      const priced = priceMenu(l.menu.price, l.menu.parts)
      const discounts = splitDiscount(l.discount, priced.unitPrices.map((u) => u * l.quantity))
      return l.menu.parts.map((p, k) => ({
        lineKey: l.key,
        productId: p.productId,
        ...(p.variantId ? { variantId: p.variantId } : {}),
        quantity: l.quantity,
        unitPrice: priced.unitPrices[k],
        ...(discounts[k] > 0 ? { discount: discounts[k] } : {}),
        ...(p.modifiers.length ? { modifiers: p.modifiers.map((m) => m.id) } : {}),
        menu: { productId: l.product.id, group },
        // Affichage et règles d'encaissement
        name: p.name,
        variantName: p.variantName ?? null,
        menuName: l.product.name,
        menuGroup: group,
        taxRate: p.taxRate,
        mealVoucher: !!p.mealVoucher,
        modifierChoices: p.modifiers.length ? p.modifiers : null,
      }))
    }
    const item: SaleItem = {
      lineKey: l.key,
      productId: l.product.id,
      ...(l.variantId ? { variantId: l.variantId } : {}),
      quantity: l.quantity,
      unitPrice: l.product.price,
      taxRate: l.product.taxRate,
      ...(l.discount > 0 ? { discount: l.discount } : {}),
      ...(l.serialNumber ? { serialNumber: l.serialNumber } : {}),
      ...(l.customName ? { customName: l.customName } : {}),
      ...(l.modifiers?.length ? { modifiers: l.modifiers.map((m) => m.id) } : {}),
      ...(l.weight !== undefined ? { weight: l.weight } : {}),
      ...(l.label ? { label: l.label } : {}),
      name: l.customName ?? l.product.name,
      variantName: l.variantName ?? null,
      mealVoucher: !!l.product.mealVoucher,
      pricePerKg: l.pricePerKg ?? null,
      modifierChoices: l.modifiers?.length ? l.modifiers : null,
    }
    return [item]
  })
}

// Contenu signé d'une ligne vendue, sans les champs d'affichage
export function signedItem(i: SaleItem): SignedSaleItem {
  return {
    productId: i.productId,
    ...(i.variantId ? { variantId: i.variantId } : {}),
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    taxRate: i.taxRate,
    ...(i.discount ? { discount: i.discount } : {}),
    ...(i.serialNumber ? { serialNumber: i.serialNumber } : {}),
    ...(i.customName ? { customName: i.customName } : {}),
    ...(i.modifiers?.length ? { modifiers: i.modifiers } : {}),
    ...(i.menu ? { menu: i.menu } : {}),
    ...(i.weight !== undefined && i.weight !== null ? { weight: i.weight } : {}),
    ...(i.label ? { label: i.label } : {}),
  }
}

// Ligne vendue pour le ticket imprimé
export const soldView = (i: SaleItem): SoldItemView => ({ ...i, modifiers: i.modifierChoices })

// Totaux calculés avec la même fonction que le serveur : le montant affiché
// est exactement celui qui sera signé sur le ticket
export function computeCartTotals(lines: CartLine[], orderDiscount: number, priceIncludesTax: boolean, loyaltyAmount = 0) {
  const items = saleItems(withLoyalty(lines, loyaltyAmount))
  const pricing = priceOrder(
    items.map((i) => ({ unitPrice: i.unitPrice, quantity: i.quantity, discount: i.discount, taxRate: i.taxRate })),
    { priceIncludesTax, orderDiscount },
  )
  return { ...pricing, items, itemCount: lines.reduce((sum, l) => sum + (l.weight !== undefined || l.label ? 1 : l.quantity), 0) }
}

// Récompense fidélité : remise répartie sur les lignes, jamais sur une carte
// cadeau (son montant doit rester celui crédité). Remise de ligne : elle est
// enregistrée article par article, tickets et factures la retrouvent.
export function withLoyalty(lines: CartLine[], amount = 0): CartLine[] {
  if (!amount) return lines
  const bases = lines.map((l) => (l.product.giftCard ? 0 : Math.max(0, l.product.price * l.quantity - l.discount)))
  const shares = splitDiscount(amount, bases)
  return lines.map((l, i) => (shares[i] ? { ...l, discount: Math.round((l.discount + shares[i]) * 100) / 100 } : l))
}

// Hors cartes cadeaux : ce sur quoi porte la récompense
export const loyaltyRoom = (lines: CartLine[]) =>
  lines.filter((l) => !l.product.giftCard).reduce((a, l) => a + Math.max(0, l.product.price * l.quantity - l.discount), 0)

// Variante, composants d'une formule, options, poids, n° de série
export function lineDetail(line: CartLine) {
  if (line.product.giftCard) return line.product.name.replace(/^Carte cadeau /, 'Code ')
  const menu = line.menu?.parts
    .map((p) => [p.name, p.variantName, p.modifiers.length ? `(${modifiersLabel(p.modifiers)})` : null, p.supplement ? `+${formatPrice(p.supplement)}` : null].filter(Boolean).join(' '))
    .join(', ')
  return [
    line.variantName,
    menu,
    line.modifiers?.length ? modifiersLabel(line.modifiers) : null,
    line.weight !== undefined ? weightLabel(line.weight, line.pricePerKg) : line.label ? 'Prix de l’étiquette de balance' : null,
    line.serialNumber && `N° ${line.serialNumber}`,
  ]
    .filter(Boolean)
    .join(', ')
}
