import { AttributeType, Pack, PaymentKind, Sector, TrackingMode } from './enums'

// Préréglages appliqués quand une organisation choisit son secteur.
// Tout reste modifiable ensuite : ce ne sont que des points de départ.

export interface TaxRatePreset {
  label: string
  rate: number
  isDefault?: boolean
}

export interface PaymentMethodPreset {
  code: string
  label: string
  kind: PaymentKind
  // Règles françaises
  mealVoucher?: boolean
  giveChange?: boolean
  maxAmount?: number
  requiresReference?: boolean
}

export interface AttributePreset {
  key: string
  label: string
  type: AttributeType
  options?: string[]
  pack: Pack
}

export interface OptionPreset {
  name: string
  values: string[]
}

export interface SectorPreset {
  label: string
  description: string
  packs: Pack[]
  priceIncludesTax: boolean
  taxRates: TaxRatePreset[]
  paymentMethods: PaymentMethodPreset[]
  // Suivi proposé par défaut à la création d'un produit
  defaultTracking: TrackingMode
  // Axes de variantes suggérés à la création d'un produit
  suggestedOptions: OptionPreset[]
}

// Taux français en vigueur
const FR_RATES_STANDARD: TaxRatePreset[] = [
  { label: 'Taux normal', rate: 20, isDefault: true },
  { label: 'Taux intermédiaire', rate: 10 },
  { label: 'Taux réduit', rate: 5.5 },
  { label: 'Taux particulier', rate: 2.1 },
]

const FR_RATES_FOOD: TaxRatePreset[] = [
  { label: 'Taux réduit alimentaire', rate: 5.5, isDefault: true },
  { label: 'Taux intermédiaire', rate: 10 },
  { label: 'Taux normal', rate: 20 },
]

// Plafond journalier du titre-restaurant en 2026 : 25 €
export const MEAL_VOUCHER_CAP = 25

const BASE_PAYMENTS: PaymentMethodPreset[] = [
  { code: 'CARD', label: 'Carte', kind: PaymentKind.CARD },
  { code: 'CASH', label: 'Espèces', kind: PaymentKind.CASH, giveChange: true },
  { code: 'CHEQUE', label: 'Chèque', kind: PaymentKind.OTHER, requiresReference: true },
  { code: 'GIFT_CARD', label: 'Carte cadeau', kind: PaymentKind.VOUCHER },
  // Avoir émis lors d'un retour, utilisable sur une prochaine vente
  { code: 'CREDIT', label: 'Avoir', kind: PaymentKind.VOUCHER },
]

export const PACK_ATTRIBUTES: Record<Pack, AttributePreset[]> = {
  [Pack.FOOD]: [
    { key: 'origin', label: 'Origine', type: AttributeType.TEXT, pack: Pack.FOOD },
    { key: 'producer', label: 'Producteur', type: AttributeType.TEXT, pack: Pack.FOOD },
    { key: 'netWeight', label: 'Poids net (g)', type: AttributeType.NUMBER, pack: Pack.FOOD },
    { key: 'packaging', label: 'Conditionnement', type: AttributeType.TEXT, pack: Pack.FOOD },
    { key: 'storage', label: 'Conservation', type: AttributeType.TEXT, pack: Pack.FOOD },
  ],
  [Pack.FASHION]: [
    { key: 'collection', label: 'Collection', type: AttributeType.TEXT, pack: Pack.FASHION },
    {
      key: 'season',
      label: 'Saison',
      type: AttributeType.SELECT,
      options: ['Printemps-été', 'Automne-hiver', 'Permanent'],
      pack: Pack.FASHION,
    },
    { key: 'material', label: 'Matière', type: AttributeType.TEXT, pack: Pack.FASHION },
    { key: 'care', label: 'Entretien', type: AttributeType.TEXT, pack: Pack.FASHION },
  ],
  [Pack.BEAUTY]: [
    { key: 'volume', label: 'Contenance (ml)', type: AttributeType.NUMBER, pack: Pack.BEAUTY },
    { key: 'paoMonths', label: 'Durée après ouverture (mois)', type: AttributeType.NUMBER, pack: Pack.BEAUTY },
    { key: 'isTester', label: 'Testeur', type: AttributeType.BOOLEAN, pack: Pack.BEAUTY },
  ],
  [Pack.JEWELRY]: [
    { key: 'metal', label: 'Métal', type: AttributeType.TEXT, pack: Pack.JEWELRY },
    { key: 'stones', label: 'Pierres', type: AttributeType.TEXT, pack: Pack.JEWELRY },
    { key: 'certificate', label: 'Certificat', type: AttributeType.TEXT, pack: Pack.JEWELRY },
    { key: 'warrantyMonths', label: 'Garantie (mois)', type: AttributeType.NUMBER, pack: Pack.JEWELRY },
  ],
  [Pack.WINE]: [
    { key: 'vintage', label: 'Millésime', type: AttributeType.NUMBER, pack: Pack.WINE },
    { key: 'appellation', label: 'Appellation', type: AttributeType.TEXT, pack: Pack.WINE },
    { key: 'region', label: 'Région', type: AttributeType.TEXT, pack: Pack.WINE },
    { key: 'grape', label: 'Cépage', type: AttributeType.TEXT, pack: Pack.WINE },
    {
      key: 'wineType',
      label: 'Couleur ou type',
      type: AttributeType.SELECT,
      options: ['Rouge', 'Blanc', 'Rosé', 'Effervescent', 'Liquoreux', 'Spiritueux', 'Autre'],
      pack: Pack.WINE,
    },
    { key: 'abv', label: 'Degré (% vol.)', type: AttributeType.NUMBER, pack: Pack.WINE },
    { key: 'volumeCl', label: 'Contenance (cl)', type: AttributeType.NUMBER, pack: Pack.WINE },
  ],
  [Pack.SERVICES]: [
    { key: 'durationMinutes', label: 'Durée (min)', type: AttributeType.NUMBER, pack: Pack.SERVICES },
  ],
}

export const SECTOR_PRESETS: Record<Sector, SectorPreset> = {
  [Sector.GENERAL]: {
    label: 'Commerce',
    description: 'Boutique généraliste, concept store',
    packs: [],
    priceIncludesTax: true,
    taxRates: FR_RATES_STANDARD,
    paymentMethods: BASE_PAYMENTS,
    defaultTracking: TrackingMode.NONE,
    suggestedOptions: [],
  },
  [Sector.FOOD]: {
    label: 'Alimentaire',
    description: 'Chocolaterie, pâtisserie, épicerie fine, traiteur',
    packs: [Pack.FOOD],
    priceIncludesTax: true,
    taxRates: FR_RATES_FOOD,
    paymentMethods: [
      ...BASE_PAYMENTS,
      // Papier : sans rendu de monnaie ; carte (Swile, Edenred, Pluxee, Up) : sur le TPE
      { code: 'TICKET_RESTO', label: 'Titre-restaurant papier', kind: PaymentKind.VOUCHER, mealVoucher: true, maxAmount: MEAL_VOUCHER_CAP },
      { code: 'TICKET_RESTO_CARD', label: 'Carte titre-restaurant', kind: PaymentKind.OTHER, mealVoucher: true, maxAmount: MEAL_VOUCHER_CAP },
      { code: 'ANCV', label: 'Chèque-Vacances', kind: PaymentKind.VOUCHER },
    ],
    defaultTracking: TrackingMode.LOT_EXPIRY,
    suggestedOptions: [{ name: 'Format', values: ['100 g', '250 g', '500 g'] }],
  },
  [Sector.FASHION]: {
    label: 'Mode',
    description: 'Prêt-à-porter, maroquinerie, chaussures',
    packs: [Pack.FASHION],
    priceIncludesTax: true,
    taxRates: FR_RATES_STANDARD,
    paymentMethods: BASE_PAYMENTS,
    defaultTracking: TrackingMode.NONE,
    suggestedOptions: [
      { name: 'Taille', values: ['XS', 'S', 'M', 'L', 'XL'] },
      { name: 'Couleur', values: [] },
    ],
  },
  [Sector.BEAUTY]: {
    label: 'Beauté',
    description: 'Parfumerie, cosmétique, soin',
    packs: [Pack.BEAUTY],
    priceIncludesTax: true,
    taxRates: FR_RATES_STANDARD,
    paymentMethods: BASE_PAYMENTS,
    defaultTracking: TrackingMode.LOT_EXPIRY,
    suggestedOptions: [{ name: 'Contenance', values: ['30 ml', '50 ml', '100 ml'] }],
  },
  [Sector.JEWELRY]: {
    label: 'Joaillerie',
    description: 'Bijouterie, joaillerie, horlogerie',
    packs: [Pack.JEWELRY],
    priceIncludesTax: true,
    taxRates: FR_RATES_STANDARD,
    paymentMethods: [...BASE_PAYMENTS, { code: 'TRANSFER', label: 'Virement', kind: PaymentKind.TRANSFER }],
    defaultTracking: TrackingMode.SERIAL,
    suggestedOptions: [{ name: 'Taille de doigt', values: ['50', '52', '54', '56', '58'] }],
  },
  [Sector.WINE]: {
    label: 'Vins et spiritueux',
    description: 'Cave, bar à vin, spiritueux',
    packs: [Pack.WINE],
    priceIncludesTax: true,
    taxRates: FR_RATES_STANDARD,
    paymentMethods: BASE_PAYMENTS,
    defaultTracking: TrackingMode.NONE,
    suggestedOptions: [{ name: 'Format', values: ['37,5 cl', '75 cl', 'Magnum'] }],
  },
  [Sector.HOME]: {
    label: 'Maison et art de vivre',
    description: 'Décoration, linge, arts de la table',
    packs: [],
    priceIncludesTax: true,
    taxRates: FR_RATES_STANDARD,
    paymentMethods: BASE_PAYMENTS,
    defaultTracking: TrackingMode.NONE,
    suggestedOptions: [{ name: 'Couleur', values: [] }],
  },
  [Sector.SERVICES]: {
    label: 'Services',
    description: 'Ateliers, retouches, soins, prestations',
    packs: [Pack.SERVICES],
    priceIncludesTax: true,
    taxRates: FR_RATES_STANDARD,
    paymentMethods: BASE_PAYMENTS,
    defaultTracking: TrackingMode.NONE,
    suggestedOptions: [],
  },
}
