'use client'

import { useRef } from 'react'
import Image from 'next/image'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import chocolats from '../../../public/site/chocolats.jpg'

gsap.registerPlugin(useGSAP, ScrollTrigger)

// Le moment fort du haut de page : la vitrine d'une chocolaterie découpée dans
// le signe FLŌW, aux proportions exactes du logo (deux demi-disques de 17 sur
// 34, écart de 3, décalage de 4 : boîte de 37 × 38). Au chargement, les deux
// moitiés se rejoignent ; au défilement, elles glissent en sens contraire,
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
      })
      return () => mm.revert()
    },
    { scope: root },
  )

  // Proportions du signe, en % de la boîte de 37 × 38
  const half = (side: 'l' | 'r') => (
    <div data-half={side} className={`absolute h-[89.5%] w-[45.9%] ${side === 'l' ? 'left-0 top-0' : 'right-0 top-[10.5%]'}`}>
      <div className={`hero-in-${side} relative h-full w-full overflow-hidden ${side === 'l' ? 'rounded-l-full' : 'rounded-r-full'}`}>
        <Image
          src={chocolats}
          alt={side === 'l' ? 'Vitrine d’une chocolaterie : pralinés, ganaches et truffes alignés derrière le verre.' : ''}
          aria-hidden={side === 'r' ? true : undefined}
          priority
          placeholder="blur"
          sizes="(min-width: 1152px) 420px, (min-width: 1024px) 36vw, 90vw"
          className={`absolute top-0 h-full w-[217.6%] max-w-none object-cover object-[60%_50%] ${side === 'l' ? 'left-0' : 'right-0'}`}
        />
      </div>
    </div>
  )

  return (
    <div ref={root} className="relative mx-auto aspect-[37/38] w-full max-w-[300px] sm:max-w-[360px] lg:max-w-[400px]">
      {half('l')}
      {half('r')}
    </div>
  )
}
