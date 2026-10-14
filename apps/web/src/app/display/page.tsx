import type { Metadata } from 'next'
import { DisplayClient } from './DisplayClient'

export const metadata: Metadata = { title: 'Écran client' }

export default function DisplayPage() {
  return <DisplayClient />
}
