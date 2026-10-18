import type { Metadata } from 'next'
import { ResetPasswordForm } from './reset-form'

export const metadata: Metadata = { title: 'Nouveau mot de passe' }

interface Props { searchParams: Promise<{ token?: string }> }

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams
  return <ResetPasswordForm token={token ?? ''} />
}
