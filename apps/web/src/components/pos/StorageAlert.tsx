'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { buildBackup, backupFileName, importBackup, parseBackup, BackupError } from '@/lib/offline/backup'
import { pendingAlert } from '@/lib/offline/pending-alert'
import { isNearlyFull, readStorageEstimate, requestPersistentStorage, UNKNOWN_STORAGE, type StorageStatus } from '@/lib/offline/storage'
import { pendingOverview } from '@/lib/terminal/terminal'

interface StorageAlertProps {
  siteId: string
  online: boolean
  // Envoi immédiat des ventes en attente (file de la caisse)
  onFlush: () => void
  // Seuls les responsables réimportent une sauvegarde
  canRestore: boolean
}

const BUTTON =
  'h-10 shrink-0 rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] px-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:opacity-60'

// Bandeau discret : des ventes en attente sont fragiles (trop anciennes, trop
// nombreuses, stockage que le navigateur peut vider). Il dit quoi faire et
// propose la sauvegarde de secours. Invisible quand tout va bien.
export function StorageAlert({ siteId, online, onFlush, canRestore }: StorageAlertProps) {
  const [storage, setStorage] = useState<StorageStatus>(UNKNOWN_STORAGE)
  const [overview, setOverview] = useState({ count: 0, oldestAt: null as number | null })
  const [now, setNow] = useState(() => Date.now())
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  const refresh = useCallback(() => {
    setNow(Date.now())
    pendingOverview(siteId)
      .then((o) => setOverview({ count: o.count, oldestAt: o.oldestAt }))
      .catch(() => {})
    readStorageEstimate().then((e) => setStorage((s) => ({ ...s, ...e })))
  }, [siteId])

  useEffect(() => {
    requestPersistentStorage().then(setStorage)
    refresh()
    const id = window.setInterval(refresh, 5_000)
    return () => window.clearInterval(id)
  }, [refresh])

  const alert = pendingAlert({
    pending: overview.count,
    oldestPendingAt: overview.oldestAt,
    now,
    online,
    persisted: storage.persisted,
    nearlyFull: isNearlyFull(storage),
  })

  async function save() {
    setBusy(true)
    try {
      const backup = await buildBackup(siteId)
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = backupFileName(backup)
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
      setNotice(`${backup.sales.length} ${backup.sales.length > 1 ? 'ventes sauvegardées' : 'vente sauvegardée'}. Gardez le fichier hors de cet appareil.`)
    } catch {
      setNotice("La sauvegarde n'a pas pu être créée. Réessayez.")
    } finally {
      setBusy(false)
    }
  }

  async function restore(f: File | undefined) {
    if (!f) return
    setBusy(true)
    try {
      const r = await importBackup(siteId, await parseBackup(await f.text()))
      const parts = [`${r.added} ${r.added > 1 ? 'ventes remises' : 'vente remise'} en attente`]
      if (r.alreadyHere) parts.push(`${r.alreadyHere} déjà présente${r.alreadyHere > 1 ? 's' : ''}`)
      if (r.conflicts) parts.push(`${r.conflicts} à vérifier (même numéro de ticket)`)
      setNotice(`${parts.join(', ')}.`)
      refresh()
      if (r.added) onFlush()
    } catch (e) {
      setNotice(e instanceof BackupError ? e.message : "La sauvegarde n'a pas pu être lue.")
    } finally {
      setBusy(false)
      if (file.current) file.current.value = ''
    }
  }

  if (!alert && !notice) return null

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[var(--color-border)] bg-[var(--color-accent-muted)] px-4 py-2 text-sm text-[var(--color-text-primary)]"
    >
      <p className="min-w-0 flex-1 basis-64">{notice ?? alert?.message}</p>
      <div className="flex flex-wrap items-center gap-2">
        {online && overview.count > 0 && (
          <button type="button" onClick={onFlush} className={BUTTON}>
            Envoyer maintenant
          </button>
        )}
        {overview.count > 0 && (
          <button type="button" onClick={save} disabled={busy} className={BUTTON}>
            Sauvegarder les ventes
          </button>
        )}
        {canRestore && (
          <>
            <button type="button" onClick={() => file.current?.click()} disabled={busy} className={BUTTON}>
              Restaurer une sauvegarde
            </button>
            <input
              ref={file}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              aria-label="Fichier de sauvegarde des ventes"
              onChange={(e) => void restore(e.target.files?.[0])}
            />
          </>
        )}
        {notice && (
          <button type="button" onClick={() => setNotice(null)} className={BUTTON}>
            Fermer
          </button>
        )}
      </div>
    </div>
  )
}
