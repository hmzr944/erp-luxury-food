'use client'

import { useRef } from 'react'
import Image, { type StaticImageData } from 'next/image'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import geste1 from '../../../public/site/geste-1.webp'
import geste2 from '../../../public/site/geste-2.webp'
import geste3 from '../../../public/site/geste-3.webp'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const STEPS: Array<{ title: string; text: string; image: StaticImageData; alt: string }> = [
  {
    title: 'Touchez le produit',
    text: "Il s'ajoute à la vente. Une taille, une couleur ou un numéro de série ? La caisse le demande à ce moment-là, pas avant.",
    image: geste1,
    alt: "Écran de caisse : le catalogue de la boutique à gauche, la vente en cours à droite avec une écharpe à 120 euros.",
  },
  {
    title: 'Touchez Encaisser',
    text: 'Les moyens de paiement de votre commerce apparaissent. Diviser la note ou payer avec plusieurs moyens reste à un geste.',
    image: geste2,
    alt: 'Fenêtre Encaisser 120 euros avec les boutons Carte, Espèces, Carte cadeau et Avoir.',
  },
  {
    title: 'Touchez le moyen de paiement',
    text: "Avec un TPE relié, le montant part sur le terminal et la vente se ferme seule. Le ticket est signé sur l'appareil, réseau ou pas.",
    image: geste3,
    alt: "Ticket de la vente enregistrée : une écharpe, 120 euros payés en espèces, numéro de caisse et signature.",
  },
]

// Le moment fort du site : la vente en trois gestes, sur de vraies captures de
// la caisse. Sur grand écran, la section reste en place et le défilement fait
// avancer la vente. Sinon (téléphone, mouvement réduit), les étapes se suivent.
export function GesturesDemo() {
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
        const shots = gsap.utils.toArray<HTMLElement>('[data-shot]')
        const steps = gsap.utils.toArray<HTMLElement>('[data-step]')
        gsap.set(shots.slice(1), { autoAlpha: 0, y: 24 })
        gsap.set(steps.slice(1), { opacity: 0.32 })

        const tl = gsap.timeline({
          defaults: { ease: 'power2.out', duration: 0.5 },
          scrollTrigger: {
            trigger: root.current,
            start: 'top top',
            end: '+=180%',
            pin: true,
            scrub: 0.6,
            snap: { snapTo: [0, 0.5, 1], duration: 0.35, ease: 'power1.inOut' },
          },
        })
        tl.to('[data-progress]', { scaleY: 1, ease: 'none', duration: 2 }, 0)
        for (let i = 1; i < shots.length; i++) {
          const at = i - 0.5
          tl.to(shots[i], { autoAlpha: 1, y: 0 }, at)
            .to(steps[i - 1], { opacity: 0.32 }, at)
            .to(steps[i], { opacity: 1 }, at)
        }
      })
      return () => mm.revert()
    },
    { scope: root },
  )

  return (
    <section ref={root} id="fonctions" aria-labelledby="gestes-title" className="bg-[var(--color-bg-surface)] motion-safe:lg:flex motion-safe:lg:h-[100dvh] motion-safe:lg:items-center">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 md:px-6 motion-safe:lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-14 motion-safe:lg:py-0">
        <div>
          <h2 id="gestes-title" className="font-display text-[clamp(2rem,4vw,3.4rem)] font-bold leading-[1.02] tracking-[-0.035em]">
            Une vente, trois gestes.
          </h2>
          <p className="mt-4 max-w-md text-[17px] leading-relaxed text-[var(--color-text-secondary)]">
            Pas de menu à apprendre : ce qui sert à vendre est à l&apos;écran, le reste attend qu&apos;on en ait besoin.
          </p>

          <div className="relative mt-10 lg:pl-6">
            <span aria-hidden className="absolute left-0 top-1 hidden h-[calc(100%-0.5rem)] w-px bg-[var(--color-border)] lg:block" />
            <span
              aria-hidden
              data-progress
              className="absolute left-0 top-1 hidden h-[calc(100%-0.5rem)] w-px origin-top scale-y-0 bg-[var(--color-accent)] lg:block"
            />
            <ol className="space-y-10 lg:space-y-8">
              {STEPS.map((s, i) => (
                <li key={s.title} data-step>
                  <h3 className="flex items-center gap-3 font-display text-2xl font-bold tracking-tight">
                    <span aria-hidden className="tabular grid size-8 shrink-0 place-items-center rounded-full border-2 border-[var(--color-text-primary)] text-[15px]">
                      {i + 1}
                    </span>
                    {s.title}
                  </h3>
                  <p className="mt-1.5 max-w-md text-[16px] leading-relaxed text-[var(--color-text-secondary)]">{s.text}</p>
                  {/* Téléphone et mouvement réduit : la capture suit son étape */}
                  <Image
                    src={s.image}
                    alt={s.alt}
                    sizes="(min-width: 1024px) 40vw, 100vw"
                    placeholder="blur"
                    className="mt-5 w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] motion-safe:lg:hidden"
                  />
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="relative hidden aspect-[1180/760] motion-safe:lg:block">
          {STEPS.map((s, i) => (
            <Image
              key={s.title}
              data-shot
              src={s.image}
              alt={i === 0 ? s.alt : ''}
              aria-hidden={i === 0 ? undefined : true}
              sizes="(min-width: 1152px) 640px, 58vw"
              priority={i === 0}
              placeholder="blur"
              className="absolute inset-0 h-full w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-[0_30px_80px_-40px_color-mix(in_srgb,var(--base-ink)_45%,transparent)]"
            />
          ))}
        </div>
      </div>
    </section>
  )
}
