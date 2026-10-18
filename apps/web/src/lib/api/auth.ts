import { ApiError, apiClient } from './client'

export const PASSWORD_MIN = 10

// Même règle que l'API, vérifiée avant l'envoi
export function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < PASSWORD_MIN) return `Mot de passe : ${PASSWORD_MIN} caractères minimum`
  if (password !== confirm) return 'Les deux mots de passe ne sont pas identiques'
  return null
}

// Trop de demandes : le message du limiteur est en anglais
function french(e: unknown): never {
  if (e instanceof ApiError && e.status === 429) throw new Error('Trop de demandes : réessayez dans une minute')
  throw e
}

// Réponse identique que le compte existe ou non
export async function forgotPassword(email: string) {
  await apiClient<null>('/auth/password/forgot', { method: 'POST', body: JSON.stringify({ email }), skipAuth: true }).catch(french)
}

export async function resetPassword(token: string, password: string) {
  await apiClient<null>('/auth/password/reset', { method: 'POST', body: JSON.stringify({ token, password }), skipAuth: true }).catch(french)
}
