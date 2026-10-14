'use client'

import { useRef } from 'react'
import Image from 'next/image'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import chocolats from '../../../public/site/chocolats.jpg'

gsap.registerPlugin(useGSAP, ScrollTrigger)

// Le moment fort du haut de page : la vitrine d'une chocolaterie découpée dans
// le signe FLŌW, aux proportions exactes du logo (grille de 28 × 39,5). Au chargement, les deux moitiés du disque se rejoignent et le
// trait Klein se tire ; au défilement, elles glissent en sens contraire,
// comme deux flux. Deux niveaux : l'enveloppe suit le défilement (GSAP),
// l'intérieur porte l'entrée (CSS), pour que les deux ne se marchent pas dessus.
export function HeroMark() {
  const root = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const scroll = { trigger: root.current, start: 'top 20%', end: 'bottom top', scrub: 0.5 }
        gsap.to('[data-half="l"]', { yPercent: -9, ease: 'none', scrollTrigger: scroll })
        gsap.to('[data-half="r"]', { yPercent: 9, ease: 'none', scrollTrigger: scroll })
        gsap.to('[data-bar]', { scaleX: 0.55, ease: 'none', scrollTrigger: scroll })
      })
      return () => mm.revert()
    },
    { scope: root },
  )

  // Proportions du signe : moitiés de 13 sur 26, écart de 2, décalage de 3,
  // trait affiné au-dessus (8 % au lieu de 15 : plein, il passait pour un
  // bouton sur téléphone), même écart que dans le signe (en % de 28 × 39,5)
  const half = (side: 'l' | 'r') => (
    <div data-half={side} className={`absolute h-[65.8%] w-[46.4%] ${side === 'l' ? 'left-0 top-[26.6%]' : 'right-0 top-[34.2%]'}`}>
      <div className={`hero-in-${side} relative h-full w-full overflow-hidden ${side === 'l' ? 'rounded-l-full' : 'rounded-r-full'}`}>
        <Image
          src={chocolats}
          alt={side === 'l' ? 'Vitrine d’une chocolaterie : pralinés, ganaches et truffes alignés derrière le verre.' : ''}
          aria-hidden={side === 'r' ? true : undefined}
          priority
          placeholder="blur"
          sizes="(min-width: 1152px) 420px, (min-width: 1024px) 36vw, 90vw"
          className={`absolute top-0 h-full w-[215.4%] max-w-none object-cover object-[60%_50%] ${side === 'l' ? 'left-0' : 'right-0'}`}
        />
      </div>
    </div>
  )

  return (
    <div ref={root} className="relative mx-auto aspect-[28/39.5] w-full max-w-[300px] sm:max-w-[360px] lg:max-w-[400px]">
      <div data-bar aria-hidden className="absolute left-[3.6%] top-[7.2%] h-[8%] w-[92.9%] origin-left">
        <div className="hero-in-bar h-full w-full rounded-full bg-[var(--color-accent)]" />
      </div>
      {half('l')}
      {half('r')}
    </div>
  )
}
