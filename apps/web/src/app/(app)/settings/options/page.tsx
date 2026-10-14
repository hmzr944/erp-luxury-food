import type { Metadata } from 'next'
import { ModifierSettings } from '@/components/settings/ModifierSettings'

export const metadata: Metadata = { title: 'Options et balance' }
export default function OptionsPage() { return <ModifierSettings /> }
