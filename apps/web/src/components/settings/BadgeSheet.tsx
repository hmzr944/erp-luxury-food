'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { IdentificationBadge, Printer, QrCode } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api/client'
import { listenNfc, nfcSupported, useWedgeScanner, writeNfc } from '@/lib/badge'
import { BRAND } from '@/lib/brand'
import { Sheet } from '@/components/pos/Sheet'

interface Member {
  id: string
  firstName: string
  lastName: string
  badgeKind: string | null
  badgeSetAt: string | null
}

// Badge d'un membre de l'équipe : carte QR à imprimer (et à inscrire sur une
// puce NFC si on veut), ou badge NFC existant associé en le présentant
export function BadgeSheet({ member, onClose, onChanged }: { member: Member | null; onClose: () => void; onChanged: () => void }) {
  const [mode, setMode] = useState<'menu' | 'qr' | 'nfc'>('menu')
  const [svg, setSvg] = useState<string | null>(null)
  const [payload, setPayload] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setMode('menu')
    setSvg(null)
    setPayload(null)
  }, [member?.id])

  const createQr = async () => {
    if (!member) return
    setBusy(true)
    try {
      const r = await apiClient<{ payload: string }>(`/users/${member.id}/badge`, { method: 'PUT', body: JSON.stringify({ kind: 'QR' }) })
      setPayload(r.payload)
      setSvg(await QRCode.toString(r.payload, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }))
      setMode('qr')
      onChanged()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const pairNfc = async (uid: string) => {
    if (!member || busy) return
    setBusy(true)
    try {
      await apiClient(`/users/${member.id}/badge`, { method: 'PUT', body: JSON.stringify({ kind: 'NFC', uid }) })
      toast.success(`Badge associé à ${member.firstName}`)
      onChanged()
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={!!member} title={member ? `Badge de ${member.firstName}` : 'Badge'} onClose={onClose}>
      {member && mode === 'menu' && (
        <div className="space-y-4 pb-2">
          <p className="text-[15px] text-[var(--color-text-secondary)]">
            {member.badgeKind
              ? `${member.badgeKind === 'QR' ? 'Carte QR' : 'Badge NFC'} actif depuis le ${new Date(member.badgeSetAt!).toLocaleDateString('fr-FR')}. En créer un nouveau désactive l'ancien.`
              : 'Le badge connecte à la caisse sans taper de code. Il ne marche que sur les caisses de votre commerce.'}
          </p>
          <button type="button" disabled={busy} onClick={createQr} className="flex h-16 w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-left hover:border-[var(--color-accent)]">
            <QrCode size={28} aria-hidden className="text-[var(--color-accent)]" />
            <span>
              <span className="block text-[16px] font-semibold">Carte QR à imprimer</span>
              <span className="block text-sm text-[var(--color-text-secondary)]">Lue par la caméra de la tablette ou un lecteur</span>
            </span>
          </button>
          <button type="button" onClick={() => setMode('nfc')} className="flex h-16 w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-left hover:border-[var(--color-accent)]">
            <IdentificationBadge size={28} aria-hidden className="text-[var(--color-accent)]" />
            <span>
              <span className="block text-[16px] font-semibold">Badge NFC existant</span>
              <span className="block text-sm text-[var(--color-text-secondary)]">Carte, porte-clés ou bracelet sans contact</span>
            </span>
          </button>
          {member.badgeKind && (
            <button
              type="button"
              onClick={async () => {
                await apiClient(`/users/${member.id}/badge`, { method: 'DELETE' }).catch((e) => toast.error((e as Error).message))
                toast.success('Badge désactivé')
                onChanged()
                onClose()
              }}
              className="h-11 w-full text-[15px] font-medium text-[var(--color-text-secondary)]"
            >
              Désactiver le badge actuel
            </button>
          )}
        </div>
      )}
      {member && mode === 'qr' && svg && payload && <QrCard member={member} svg={svg} payload={payload} />}
      {member && mode === 'nfc' && <NfcPairing busy={busy} onUid={pairNfc} />}
    </Sheet>
  )
}

function QrCard({ member, svg, payload }: { member: Member; svg: string; payload: string }) {
  const [writing, setWriting] = useState(false)
  const card = `<div style="width:54mm;height:86mm;border:1px solid #ccc;border-radius:3mm;padding:5mm;box-sizing:border-box;font-family:system-ui,sans-serif;display:flex;flex-direction:column;justify-content:space-between">
    <div style="font-weight:700;font-size:12pt">${BRAND}</div>
    <div style="width:42mm;height:42mm;margin:0 auto">${svg}</div>
    <div><div style="font-weight:600;font-size:12pt">${escapeHtml(member.firstName)} ${escapeHtml(member.lastName)}</div><div style="font-size:8pt;color:#555">Badge caisse, personnel</div></div></div>`
  return (
    <div className="space-y-4 pb-2">
      <div className="mx-auto w-56 rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-white p-4 text-[#16171A]">
        <p className="text-sm font-bold">{BRAND}</p>
        <div className="mx-auto my-3 w-44" dangerouslySetInnerHTML={{ __html: svg }} aria-label={`QR code du badge de ${member.firstName}`} role="img" />
        <p className="text-[15px] font-semibold">
          {member.firstName} {member.lastName}
        </p>
      </div>
      <p className="text-sm text-[var(--color-text-secondary)]">Ce QR ne sera plus affiché : imprimez-le maintenant. Il ne fonctionne que sur vos caisses.</p>
      <button
        type="button"
        onClick={() => {
          const w = window.open('', '_blank', 'width=420,height=600')
          if (!w) return toast.error('Autorisez les fenêtres pour imprimer')
          w.document.write(`<!doctype html><title>Badge ${escapeHtml(member.firstName)}</title><body style="margin:10mm">${card}<script>window.onload=()=>{window.print()}</script></body>`)
          w.document.close()
        }}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)]"
      >
        <Printer size={22} aria-hidden /> Imprimer la carte
      </button>
      {nfcSupported() && (
        <button
          type="button"
          disabled={writing}
          onClick={async () => {
            setWriting(true)
            const ctrl = new AbortController()
            const timer = window.setTimeout(() => ctrl.abort(), 20_000)
            try {
              toast('Approchez une puce NFC vierge du téléphone')
              await writeNfc(payload, ctrl.signal)
              toast.success('Puce NFC prête : elle sert de badge')
            } catch {
              toast.error("Puce non écrite : réessayez en la tenant contre l'appareil")
            } finally {
              window.clearTimeout(timer)
              setWriting(false)
            }
          }}
          className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-[15px] font-semibold"
        >
          {writing ? 'Approchez la puce...' : 'Inscrire aussi sur une puce NFC'}
        </button>
      )}
    </div>
  )
}

function NfcPairing({ busy, onUid }: { busy: boolean; onUid: (uid: string) => void }) {
  const [manual, setManual] = useState('')
  useWedgeScanner(onUid)
  useEffect(() => {
    if (!nfcSupported()) return
    const ctrl = new AbortController()
    listenNfc(onUid, ctrl.signal).catch(() => {})
    return () => ctrl.abort()
  }, [onUid])
  return (
    <div className="space-y-4 pb-2">
      <p className="text-[17px] font-semibold">Présentez le badge</p>
      <p className="text-[15px] text-[var(--color-text-secondary)]">
        {nfcSupported() ? 'Contre le dos de cet appareil, ou sur le lecteur branché.' : 'Sur le lecteur de badge branché à cet appareil.'}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (manual.trim()) onUid(manual.trim())
        }}
        className="flex gap-2"
      >
        <label htmlFor="badge-uid" className="sr-only">
          Identifiant du badge
        </label>
        <input
          id="badge-uid"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="ou saisissez son identifiant"
          className="h-12 min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 font-data text-[15px]"
        />
        <button type="submit" disabled={busy || !manual.trim()} className="h-12 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 text-[15px] font-semibold text-[var(--color-on-accent)] disabled:opacity-50">
          Associer
        </button>
      </form>
    </div>
  )
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
