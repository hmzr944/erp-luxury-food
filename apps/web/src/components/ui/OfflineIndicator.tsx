'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiSlash, WifiHigh } from '@phosphor-icons/react'

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false)
  const [showOnline, setShowOnline] = useState(false)

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

  return (
    <AnimatePresence>
      {(isOffline || showOnline) && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className={[
            'fixed top-3 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-2 rounded-full shadow-lg',
            isOffline
              ? 'bg-[var(--color-warning)]/20 border border-[var(--color-warning)]/30 text-[var(--color-warning)]'
              : 'bg-[var(--color-success)]/20 border border-[var(--color-success)]/30 text-[var(--color-success)]',
          ].join(' ')}
        >
          {isOffline ? (
            <WifiSlash size={13} weight="fill" />
          ) : (
            <WifiHigh size={13} weight="fill" />
          )}
          <span className="font-data text-xs">
            {isOffline ? 'Mode hors ligne — commandes mises en file' : 'Connexion rétablie'}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
