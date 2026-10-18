import { UseGuards } from '@nestjs/common'
import { SubscriptionGuard } from '../guards/subscription.guard'

// Réservé aux écritures non fiscales : jamais sur une vente, une clôture,
// un export, la conformité, l'authentification ou la facturation
export const RequireSubscription = () => UseGuards(SubscriptionGuard)
