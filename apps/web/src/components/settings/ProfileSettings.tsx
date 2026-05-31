'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import { apiClient } from '@/lib/api/client'

const profileSchema = z.object({
  firstName: z.string().min(1, 'Requis'),
  lastName: z.string().min(1, 'Requis'),
  email: z.string().email('Email invalide'),
})

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Requis'),
  newPassword: z.string().min(8, 'Minimum 8 caractères'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
})

type ProfileForm = z.infer<typeof profileSchema>
type PasswordForm = z.infer<typeof passwordSchema>

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="font-body text-sm font-semibold text-[var(--color-text-primary)] mb-4">
        {title}
      </h2>
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-5 space-y-4">
        {children}
      </div>
    </div>
  )
}

function FormField({
  label, error, children,
}: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block font-body text-xs text-[var(--color-text-secondary)]">{label}</label>
      {children}
      {error && <p className="font-body text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  )
}

const inputCls = 'w-full h-9 px-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-[var(--radius-md)] font-body text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]/40 focus:ring-1 focus:ring-[var(--color-accent)]/20 transition-colors'

export function ProfileSettings() {
  const { user } = useAuthStore()
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      email: user?.email ?? '',
    },
  })

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const saveProfile = async (data: ProfileForm) => {
    setSavingProfile(true)
    try {
      await apiClient('/users/me', { method: 'PATCH', body: JSON.stringify(data) })
      toast.success('Profil mis à jour')
    } catch (err: any) {
      toast.error(err.message ?? 'Erreur lors de la mise à jour')
    } finally {
      setSavingProfile(false)
    }
  }

  const savePassword = async (data: PasswordForm) => {
    setSavingPassword(true)
    try {
      await apiClient('/users/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword: data.currentPassword, newPassword: data.newPassword }),
      })
      toast.success('Mot de passe mis à jour')
      passwordForm.reset()
    } catch (err: any) {
      toast.error(err.message ?? 'Erreur lors de la mise à jour')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="max-w-lg px-8 py-6">
      <h1 className="font-display text-xl text-[var(--color-text-primary)] mb-6">Mon profil</h1>

      <SettingsSection title="Informations personnelles">
        <form onSubmit={profileForm.handleSubmit(saveProfile)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Prénom" error={profileForm.formState.errors.firstName?.message}>
              <input {...profileForm.register('firstName')} className={inputCls} placeholder="Sophie" />
            </FormField>
            <FormField label="Nom" error={profileForm.formState.errors.lastName?.message}>
              <input {...profileForm.register('lastName')} className={inputCls} placeholder="Marchand" />
            </FormField>
          </div>
          <FormField label="Email" error={profileForm.formState.errors.email?.message}>
            <input {...profileForm.register('email')} type="email" className={inputCls} />
          </FormField>
          <div className="flex justify-end">
            <motion.button
              type="submit"
              disabled={savingProfile}
              whileTap={{ scale: 0.98 }}
              className="px-4 h-9 bg-[var(--color-accent)] text-black font-body text-sm font-medium rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-all"
            >
              {savingProfile ? 'Enregistrement...' : 'Enregistrer'}
            </motion.button>
          </div>
        </form>
      </SettingsSection>

      <SettingsSection title="Mot de passe">
        <form onSubmit={passwordForm.handleSubmit(savePassword)} className="space-y-4">
          <FormField label="Mot de passe actuel" error={passwordForm.formState.errors.currentPassword?.message}>
            <input {...passwordForm.register('currentPassword')} type="password" className={inputCls} placeholder="••••••••" />
          </FormField>
          <FormField label="Nouveau mot de passe" error={passwordForm.formState.errors.newPassword?.message}>
            <input {...passwordForm.register('newPassword')} type="password" className={inputCls} placeholder="8 caractères minimum" />
          </FormField>
          <FormField label="Confirmer" error={passwordForm.formState.errors.confirmPassword?.message}>
            <input {...passwordForm.register('confirmPassword')} type="password" className={inputCls} placeholder="••••••••" />
          </FormField>
          <div className="flex justify-end">
            <motion.button
              type="submit"
              disabled={savingPassword}
              whileTap={{ scale: 0.98 }}
              className="px-4 h-9 border border-[var(--color-border)] text-[var(--color-text-primary)] font-body text-sm rounded-[var(--radius-md)] hover:bg-[var(--color-bg-hover)] disabled:opacity-50 transition-all"
            >
              {savingPassword ? 'Enregistrement...' : 'Changer le mot de passe'}
            </motion.button>
          </div>
        </form>
      </SettingsSection>

      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-4">
        <p className="font-body text-xs text-[var(--color-text-muted)]">
          Rôle : <span className="text-[var(--color-text-secondary)]">{user?.role}</span>
        </p>
      </div>
    </div>
  )
}
