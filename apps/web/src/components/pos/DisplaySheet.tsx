'use client'

import { Monitor } from '@phosphor-icons/react'
import { Sheet } from './Sheet'

// Écran client : second écran branché sur cet appareil, ou tablette posée
// sur le comptoir
export function DisplaySheet({ siteId, open, onClose }: { siteId: string; open: boolean; onClose: () => void }) {
  const openWindow = () => {
    window.open(`/display?site=${encodeURIComponent(siteId)}`, 'flow-display', 'popup,width=1280,height=800')
    onClose()
  }
  return (
    <Sheet open={open} title="Écran client" onClose={onClose}>
      <div className="space-y-4 pb-2">
        <p className="text-[15px] text-[var(--color-text-secondary)]">
          Le client voit les articles, le total, puis le QR code de son ticket en fin de vente.
        </p>
        <button
          type="button"
          onClick={openWindow}
          className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] p-4 text-left hover:border-[var(--color-accent)] press"
        >
          <Monitor size={24} aria-hidden className="shrink-0" />
          <span>
            <span className="block text-[15px] font-semibold">Ouvrir sur un second écran</span>
            <span className="block text-sm text-[var(--color-text-secondary)]">Glissez la fenêtre sur l’écran du client, puis passez-la en plein écran.</span>
          </span>
        </button>
      </div>
    </Sheet>
  )
}
