'use client'

import { FlowMark } from '@/components/brand/FlowLogo'

// Tablette pas encore reliée : un code à saisir sur la caisse
export function PairingCode({ code }: { code: string }) {
  return (
    <main className="flex h-[100dvh] flex-col items-center justify-center gap-10 bg-[var(--color-bg-base)] px-8 text-center text-[var(--color-text-primary)]">
      <FlowMark size={40} />
      <div className="space-y-4">
        <h1 className="text-balance font-display text-[clamp(1.6rem,3.2vw,2.6rem)] font-semibold tracking-[-0.02em]">Écran client à relier</h1>
        <p className="mx-auto max-w-[40ch] text-balance text-[clamp(1.05rem,1.7vw,1.35rem)] text-[var(--color-text-secondary)]">
          Sur la caisse, ouvrez le menu, puis Écran client, et saisissez ce code.
        </p>
      </div>
      <p aria-label={`Code ${code.split('').join(' ')}`} className="tabular font-display text-[clamp(4rem,12vw,9rem)] font-semibold leading-none tracking-[0.06em]">
        {code.slice(0, 3)}
        <span className="inline-block w-[0.35em]" aria-hidden />
        {code.slice(3)}
      </p>
      <p className="text-[clamp(0.95rem,1.4vw,1.15rem)] text-[var(--color-text-muted)]">Le code change toutes les dix minutes.</p>
    </main>
  )
}
