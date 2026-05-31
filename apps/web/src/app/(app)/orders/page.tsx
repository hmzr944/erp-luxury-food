import type { Metadata } from 'next'
import { OrdersHubWithSite } from '@/components/orders/OrdersHubWithSite'

export const metadata: Metadata = { title: 'Commandes' }

export default function OrdersPage() {
  return <OrdersHubWithSite />
}
