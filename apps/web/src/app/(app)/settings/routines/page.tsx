import type { Metadata } from 'next'
import { RoutineSettings } from '@/components/settings/RoutineSettings'

export const metadata: Metadata = { title: 'Routines et rappels' }
export default function RoutinesPage() { return <RoutineSettings /> }
