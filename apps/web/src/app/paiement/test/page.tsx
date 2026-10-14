import type { Metadata } from 'next'
import { PaymentNotice } from '../Notice'

export const metadata: Metadata = { title: 'Paiement de test' }

export default function PaymentTest() {
  return <PaymentNotice title="Paiement de test" text="Aucun argent n’est débité. Le vendeur valide ou refuse ce paiement depuis la caisse." />
}
