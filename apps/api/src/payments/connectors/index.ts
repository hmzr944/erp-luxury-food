import type { PaymentProvider } from '@prisma/client'
import type { PaymentConnector } from './types'
import { simulatorConnector } from './simulator'
import { stripeConnector } from './stripe'
import { sumupConnector } from './sumup'

export const CONNECTORS: Record<PaymentProvider, PaymentConnector> = {
  SIMULATOR: simulatorConnector,
  STRIPE: stripeConnector,
  SUMUP: sumupConnector,
}

export * from './types'
