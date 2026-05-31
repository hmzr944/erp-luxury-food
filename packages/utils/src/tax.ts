export interface TaxBreakdown {
  ht: number
  tax: number
  ttc: number
}

export const computeTax = (priceHT: number, taxRate: number): TaxBreakdown => ({
  ht: priceHT,
  tax: Number((priceHT * (taxRate / 100)).toFixed(2)),
  ttc: Number((priceHT * (1 + taxRate / 100)).toFixed(2)),
})

export const computeTaxFromTTC = (priceTTC: number, taxRate: number): TaxBreakdown => {
  const ht = Number((priceTTC / (1 + taxRate / 100)).toFixed(2))
  const tax = Number((priceTTC - ht).toFixed(2))
  return { ht, tax, ttc: priceTTC }
}

// French VAT rates for food
export const VAT_RATES = {
  FOOD_STANDARD: 5.5,     // produits alimentaires standard
  FOOD_PREPARED: 10,      // restauration / traiteur / consommation sur place
  STANDARD: 20,           // articles non-alimentaires
} as const
