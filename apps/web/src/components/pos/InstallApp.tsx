'use client'

import { useEffect, useState } from 'react'
import { DownloadSimple } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// La caisse s'installe comme une application (icône sur l'écran d'accueil,
// plein écran, hors ligne) : invite du navigateur sur Android et ordinateur,
// marche à suivre sur iPad et iPhone où Safari n'en propose pas
export function InstallApp({ className = '' }: { className?: string }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [ios, setIos] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
    setInstalled(standalone)
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPrompt(e as InstallPromptEvent)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed || (!prompt && !ios)) return null
  return (
    <button
      type="button"
      onClick={async () => {
        if (prompt) {
          await prompt.prompt()
          const { outcome } = await prompt.userChoice
          if (outcome === 'accepted') setInstalled(true)
          setPrompt(null)
        } else {
          toast('Installer FLŌW sur cet appareil', { description: 'Dans Safari : bouton Partager, puis « Sur l’écran d’accueil ».', duration: 10_000 })
        }
      }}
      className={`inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] px-3 text-sm font-medium press ${className}`}
    >
      <DownloadSimple size={16} aria-hidden /> Installer l’application
    </button>
  )
}
