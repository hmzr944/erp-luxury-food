import type { Metadata } from 'next'
import { HardwarePage } from '@/components/hardware/HardwarePage'

export const metadata: Metadata = { title: 'Matériel' }
export default function MaterielPage() { return <HardwarePage /> }
