import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site/SiteHeader'
import { GesturesDemo } from '@/components/site/GesturesDemo'
import { Choices, Faq, FinalCall, Hero, Payment, Pricing, Sectors, SiteFooter, Start, Supply } from '@/components/site/Sections'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: { absolute: `${BRAND}, la caisse pour les commerces` },
  description:
    "Caisse sur tablette ou téléphone pour la mode, l'alimentaire, la beauté, les caves et les fleuristes. Hors ligne, reliée à votre TPE, sans engagement. 30 jours d'essai sans carte bancaire.",
}

// Site public : présenter la caisse et mener à l'essai gratuit
export default function HomePage() {
  return (
    <div className="min-h-[100dvh] bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-[var(--radius-md)] focus:bg-[var(--color-bg-surface)] focus:px-4 focus:py-2"
      >
        Aller au contenu
      </a>
      <SiteHeader />
      <main id="contenu">
        <Hero />
        <GesturesDemo />
        <Choices />
        <Payment />
        <Sectors />
        <Supply />
        <Start />
        <Pricing />
        <Faq />
        <FinalCall />
      </main>
      <SiteFooter />
    </div>
  )
}
