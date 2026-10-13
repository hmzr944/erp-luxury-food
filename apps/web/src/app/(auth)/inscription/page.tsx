import type { Metadata } from 'next'
import { SignupFlow } from '@/components/onboarding/SignupFlow'

export const metadata: Metadata = { title: 'Créer mon espace' }

export default function SignupPage() {
  return <SignupFlow />
}
