import type { Metadata } from 'next'
import { PaymentNotice } from '../Notice'

export const metadata: Metadata = { title: 'Paiement reçu' }

export default function PaymentDone() {
  return <PaymentNotice title="Paiement reçu" text="Merci. La caisse confirme votre achat dans un instant ; votre ticket s’affiche ensuite sur l’écran du comptoir." />
}
