import type { Metadata } from 'next'
import { ProfileSettings } from '@/components/settings/ProfileSettings'

export const metadata: Metadata = { title: 'Profil' }
export default function ProfilePage() { return <ProfileSettings /> }
