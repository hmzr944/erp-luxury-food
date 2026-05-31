import type { Metadata } from 'next'
import { AllergensWithSite } from '@/components/allergens/AllergensWithSite'

export const metadata: Metadata = { title: 'Allergènes' }

export default function AllergensPage() {
  return <AllergensWithSite />
}
