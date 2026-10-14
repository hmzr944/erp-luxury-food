'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { WifiSlash, WifiHigh } from '@phosphor-icons/react'

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false)
  const [showOnline, setShowOnline] = useState(false)
  // La caisse affiche son propre état de connexion dans son en-tête
  const onPOS = usePathname()?.startsWith('/pos/')

  useEffect(() => {
    setIsOffline(!navigator.onLine)

    const goOffline = () => setIsOffline(true)
    const goOnline = () => {
      setIsOffline(false)
      setShowOnline(true)
      setTimeout(() => setShowOnline(false), 3000)
    }

    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (onPOS) return null

  return (
    <AnimatePresence>
      {(isOffline || showOnline) && (
        <motion.div
          initial={{ transform: 'translateY(-40px)', opacity: 0 }}
          animate={{ transform: 'translateY(0px)', opacity: 1 }}
          exit={{ transform: 'translateY(-40px)', opacity: 0 }}
          transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
          className={[
            'fixed top-3 inset-x-0 mx-auto w-fit max-w-[calc(100%-2rem)] z-[100] flex items-center gap-2 px-4 py-2 rounded-full shadow-lg',
            isOffline
              ? 'bg-[var(--color-bg-inverse)] text-[var(--color-text-inverse)]'
              : 'bg-[var(--color-accent)] text-[var(--color-on-accent)]',
          ].join(' ')}
        >
          {isOffline ? (
            <WifiSlash size={16} weight="fill" aria-hidden />
          ) : (
            <WifiHigh size={16} weight="fill" aria-hidden />
          )}
          <span role="status" className="font-body text-sm font-medium">
            {isOffline ? 'Hors ligne. Les ventes restent enregistrées sur cet appareil.' : 'Connexion rétablie'}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
