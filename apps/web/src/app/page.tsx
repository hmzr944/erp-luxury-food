import { redirect } from 'next/navigation'

// Racine → page login
export default function RootPage() {
  redirect('/login')
}
