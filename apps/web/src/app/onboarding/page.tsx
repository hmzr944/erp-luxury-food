import { Suspense } from 'react'
import type { Metadata } from 'next'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'

export const metadata: Metadata = { title: 'Bienvenue' }

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingWizard />
    </Suspense>
  )
}
