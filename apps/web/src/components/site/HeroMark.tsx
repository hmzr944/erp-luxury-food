'use client'

import { useRef } from 'react'
import Image from 'next/image'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import comptoir from '../../../public/site/comptoir.jpg'

gsap.registerPlugin(useGSAP, ScrollTrigger)

// Le moment fort du haut de page : la photo d'une boutique découpée dans le
// signe FLŌW. Au chargement, les deux moitiés du disque se rejoignent et le
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

  const half = (side: 'l' | 'r') => (
    <div data-half={side} className={`absolute bottom-0 h-[86%] w-[48.6%] ${side === 'l' ? 'left-0 top-[11%]' : 'right-0 top-[14%]'}`}>
      <div className={`hero-in-${side} relative h-full w-full overflow-hidden ${side === 'l' ? 'rounded-l-full' : 'rounded-r-full'}`}>
        <Image
          src={comptoir}
          alt={side === 'l' ? 'Deux commerçants souriants derrière le comptoir de leur boutique, une caisse posée sur le bois.' : ''}
          aria-hidden={side === 'r' ? true : undefined}
          priority
          placeholder="blur"
          sizes="(min-width: 1152px) 460px, (min-width: 1024px) 40vw, 100vw"
          className={`absolute top-0 h-full w-[205.8%] max-w-none object-cover object-[30%_50%] ${side === 'l' ? 'left-0' : 'right-0'}`}
        />
      </div>
    </div>
  )

  return (
    <div ref={root} className="relative mx-auto aspect-[1/1.02] w-full max-w-[460px]">
      <div data-bar className="absolute left-[22%] top-0 h-[5.5%] w-[56%] origin-left">
        <div className="hero-in-bar h-full w-full rounded-full bg-[var(--color-accent)]" />
      </div>
      {half('l')}
      {half('r')}
    </div>
  )
}
