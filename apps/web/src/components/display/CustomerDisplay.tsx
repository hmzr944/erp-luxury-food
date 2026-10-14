'use client'

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { ArrowsOut } from '@phosphor-icons/react'
import { formatPrice } from '@erp/utils'
import { FlowMark } from '@/components/brand/FlowLogo'
import { EASE_OUT } from '@/lib/motion'
import type { DisplayState } from '@/lib/display/state'

// Écran tourné vers le client : lisible à un mètre et demi, rien à toucher.
// La caisse publie l'état, cet écran ne fait que le montrer.
export function CustomerDisplay({ state, waiting }: { state: DisplayState | null; waiting?: string }) {
  return (
    <MotionConfig reducedMotion="user">
      <main className="relative flex h-[100dvh] cursor-none flex-col overflow-hidden bg-[var(--color-bg-base)] text-[var(--color-text-primary)] [overscroll-behavior:none]">
        <FullscreenButton />
        <header className="flex items-center justify-between gap-6 px-[clamp(1.25rem,4vw,3.5rem)] pt-[clamp(1rem,3vh,2.25rem)]">
          <h1 className="truncate font-display text-[clamp(1.25rem,2.2vw,1.9rem)] font-semibold tracking-[-0.02em]">{state?.shop || 'Écran client'}</h1>
          <FlowMark size={28} className="shrink-0 opacity-70" />
        </header>
        {state && 'training' in state && state.training && (
          <p role="status" className="mx-[clamp(1.25rem,4vw,3.5rem)] mt-4 rounded-[var(--radius-md)] bg-[var(--color-bg-inverse)] px-5 py-3 text-center text-lg font-semibold text-[var(--color-text-inverse)]">
            Mode formation : vente fictive, aucun paiement réel
          </p>
        )}
        <div className="min-h-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            {!state ? (
              <Center key="wait">
                <p className="font-display text-[clamp(2rem,5vw,4rem)] font-semibold tracking-[-0.03em]">Bonjour</p>
                {waiting && <p className="mt-4 text-[clamp(1rem,1.6vw,1.35rem)] text-[var(--color-text-secondary)]">{waiting}</p>}
              </Center>
            ) : state.kind === 'idle' ? (
              <Center key="idle">
                <p className="text-balance font-display text-[clamp(3rem,9vw,7.5rem)] font-semibold leading-none tracking-[-0.035em]">Bonjour</p>
                <p className="mt-6 text-[clamp(1.1rem,2vw,1.6rem)] text-[var(--color-text-secondary)]">Bienvenue chez {state.shop}</p>
              </Center>
            ) : state.kind === 'done' ? (
              <Done key="done" state={state} />
            ) : (
              <Sale key="sale" state={state} />
            )}
          </AnimatePresence>
        </div>
      </main>
    </MotionConfig>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
      className="flex h-full flex-col items-center justify-center px-8 text-center"
    >
      {children}
    </motion.section>
  )
}

type SaleState = Extract<DisplayState, { kind: 'sale' } | { kind: 'pay' }>

function Sale({ state }: { state: SaleState }) {
  // Les lignes restent visibles pendant le paiement par QR
  const [lines, setLines] = useState(state.kind === 'sale' ? state : null)
  useEffect(() => {
    if (state.kind === 'sale') setLines(state)
  }, [state])
  const list = useRef<HTMLOListElement>(null)
  const last = lines?.lastKey
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    list.current?.querySelector(`[data-key="${CSS.escape(last ?? '')}"]`)?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
  }, [last, lines])

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
      className="grid h-full grid-rows-[1fr_auto] gap-[clamp(1rem,3vh,2rem)] p-[clamp(1.25rem,4vw,3.5rem)] landscape:grid-cols-[minmax(0,1fr)_minmax(320px,38%)] landscape:grid-rows-1"
    >
      <ol ref={list} aria-label="Articles" className="min-h-0 overflow-y-auto [scrollbar-width:none]">
        <AnimatePresence initial={false}>
          {lines?.lines.map((l) => (
            <motion.li
              key={l.key}
              data-key={l.key}
              layout="position"
              initial={{ opacity: 0, transform: 'translateY(8px)' }}
              animate={{ opacity: 1, transform: 'translateY(0px)' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className={`flex items-baseline gap-5 rounded-[var(--radius-lg)] px-5 py-4 transition-colors duration-700 ${l.key === last ? 'bg-[var(--color-accent-muted)]' : ''}`}
            >
              <span className="tabular w-[2.5ch] shrink-0 text-right text-[clamp(1.2rem,2vw,1.6rem)] text-[var(--color-text-secondary)]">{l.quantity}</span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-[clamp(1.3rem,2.3vw,1.9rem)] font-semibold leading-tight">{l.name}</span>
                {l.detail && <span className="mt-1 block text-[clamp(1rem,1.5vw,1.25rem)] leading-snug text-[var(--color-text-secondary)]">{l.detail}</span>}
              </span>
              <span className="tabular shrink-0 text-[clamp(1.3rem,2.3vw,1.9rem)] font-medium">{formatPrice(l.total)}</span>
            </motion.li>
          ))}
        </AnimatePresence>
        {lines && lines.discount > 0 && (
          <li className="flex items-baseline justify-between gap-5 px-5 py-4 text-[clamp(1.2rem,2vw,1.6rem)]">
            <span>Remise</span>
            <span className="tabular">-{formatPrice(lines.discount)}</span>
          </li>
        )}
      </ol>

      <div role="group" aria-label={state.kind === 'pay' ? 'Paiement' : 'Total'} className="flex flex-col justify-end rounded-[var(--radius-xl)] bg-[var(--color-bg-inverse)] p-[clamp(1.5rem,3vw,2.75rem)] text-[var(--color-text-inverse)]">
        {state.kind === 'pay' ? (
          <PayByQr state={state} />
        ) : (
          <>
            <p className="text-[clamp(1.2rem,2vw,1.6rem)] opacity-80">Total</p>
            <motion.p
              key={state.total}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
              aria-live="polite"
              className="tabular font-display text-[clamp(3.5rem,8vw,7rem)] font-semibold leading-none tracking-[-0.03em]"
            >
              {formatPrice(state.total)}
            </motion.p>
            <p className="tabular mt-4 text-[clamp(1rem,1.5vw,1.25rem)] opacity-80">
              {state.priceIncludesTax ? 'dont TVA' : 'TVA'} {formatPrice(state.taxAmount)}
            </p>
          </>
        )}
      </div>
    </motion.section>
  )
}

function useQr(url: string | null, dark: string) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    if (!url) return setSvg('')
    QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark, light: '#00000000' } })
      .then(setSvg)
      .catch(() => setSvg(''))
  }, [url, dark])
  return svg
}

function PayByQr({ state }: { state: Extract<DisplayState, { kind: 'pay' }> }) {
  const svg = useQr(state.url, '#14141A')
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <p className="text-[clamp(1.2rem,2vw,1.6rem)] font-semibold">Scannez pour payer</p>
      <div role="img" aria-label="QR code de paiement" className="aspect-square w-full max-w-[min(340px,42vh)] rounded-[var(--radius-lg)] bg-white p-[6%]">
        {svg && <div className="size-full [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />}
      </div>
      <p className="tabular font-display text-[clamp(2.5rem,5vw,4.25rem)] font-semibold leading-none tracking-[-0.03em]">{formatPrice(state.amount)}</p>
      <p className="text-[clamp(0.95rem,1.4vw,1.15rem)] opacity-80">Paiement sécurisé sur votre téléphone</p>
    </div>
  )
}

function Done({ state }: { state: Extract<DisplayState, { kind: 'done' }> }) {
  const svg = useQr(state.receiptUrl, '#14141A')
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
      className="flex h-full flex-col items-center justify-center gap-[clamp(2rem,6vh,4rem)] px-8 text-center landscape:flex-row landscape:gap-[clamp(3rem,8vw,7rem)] landscape:text-left"
    >
      <div>
        <p className="font-display text-[clamp(3.5rem,9vw,7.5rem)] font-semibold leading-none tracking-[-0.035em]">Merci</p>
        <p className="tabular mt-5 text-[clamp(1.3rem,2.3vw,1.9rem)] text-[var(--color-text-secondary)]">Payé {formatPrice(state.total)}</p>
        {state.change ? (
          <p className="tabular mt-2 text-[clamp(1.6rem,3vw,2.4rem)] font-semibold">Rendu {formatPrice(state.change)}</p>
        ) : null}
      </div>
      {state.receiptUrl && (
        <div className="flex flex-col items-center gap-4 landscape:items-start">
          <div role="img" aria-label="QR code du ticket en ligne" className="aspect-square w-[min(260px,34vh)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4">
            {svg && <div className="size-full [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />}
          </div>
          <p className="max-w-[30ch] text-balance text-[clamp(1.05rem,1.6vw,1.35rem)] leading-snug text-[var(--color-text-secondary)]">
            Votre ticket sur votre téléphone, si vous le souhaitez
          </p>
        </div>
      )}
    </motion.section>
  )
}

// Second écran : plein écran en un geste, bouton visible quand la souris bouge
function FullscreenButton() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    let timer = 0
    const show = () => {
      setVisible(true)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setVisible(false), 2500)
    }
    window.addEventListener('pointermove', show)
    return () => {
      window.removeEventListener('pointermove', show)
      window.clearTimeout(timer)
    }
  }, [])
  if (typeof document !== 'undefined' && !document.fullscreenEnabled) return null
  return (
    <button
      type="button"
      onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})}
      onFocus={() => setVisible(true)}
      aria-label="Plein écran"
      className={`absolute bottom-4 right-4 z-10 grid size-12 cursor-pointer place-items-center rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] transition-opacity duration-300 ${visible ? 'opacity-100' : 'pointer-events-none opacity-0 focus-visible:pointer-events-auto focus-visible:opacity-100'}`}
    >
      <ArrowsOut size={20} aria-hidden />
    </button>
  )
}
