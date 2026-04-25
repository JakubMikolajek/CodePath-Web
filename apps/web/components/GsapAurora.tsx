'use client'

import { useGSAP } from '@gsap/react'
import { cn } from '@workspace/ui/lib/utils'
import gsap from 'gsap'
import { useRef } from 'react'

interface GsapAuroraProps {
  className?: string
  density?: 'default' | 'hero'
}

export function GsapAurora({ className, density = 'default' }: GsapAuroraProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      return
    }

    const blobs = gsap.utils.toArray<HTMLElement>('[data-aurora-blob]')
    const particles = gsap.utils.toArray<HTMLElement>('[data-aurora-particle]')

    gsap.set(blobs, { transformOrigin: '50% 50%' })
    gsap.set(particles, { transformOrigin: '50% 50%' })

    blobs.forEach((blob, index) => {
      gsap.to(blob, {
        duration: 13 + index * 3,
        ease: 'sine.inOut',
        opacity: index % 2 === 0 ? 0.9 : 0.72,
        repeat: -1,
        rotate: index % 2 === 0 ? 8 : -10,
        scale: index % 2 === 0 ? 1.12 : 1.18,
        x: index % 2 === 0 ? 52 : -44,
        y: index % 2 === 0 ? -28 : 34,
        yoyo: true
      })
    })

    particles.forEach((particle, index) => {
      gsap.to(particle, {
        duration: 9 + index,
        ease: 'sine.inOut',
        opacity: 0.85,
        repeat: -1,
        scale: 1.35,
        x: index % 2 === 0 ? 18 : -18,
        y: index % 3 === 0 ? -26 : 22,
        yoyo: true
      })
    })
  }, { scope: rootRef })

  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} ref={rootRef}>
      <div
        className={cn(
          'absolute rounded-full bg-violet-500/20 blur-3xl',
          density === 'hero'
            ? 'left-[-18rem] top-[18%] h-80 w-[68rem] rotate-[-12deg]'
            : 'left-[-14rem] top-[8%] h-72 w-[52rem] rotate-[-10deg]'
        )}
        data-aurora-blob=""
      />
      <div
        className={cn(
          'absolute rounded-full bg-cyan-400/16 blur-3xl',
          density === 'hero'
            ? 'right-[-22rem] top-[46%] h-96 w-[76rem] rotate-[-8deg]'
            : 'right-[-18rem] top-[28%] h-80 w-[58rem] rotate-[10deg]'
        )}
        data-aurora-blob=""
      />
      <div
        className="absolute bottom-[-16rem] left-[20%] h-80 w-[42rem] rounded-full bg-blue-500/12 blur-3xl"
        data-aurora-blob=""
      />
      <span className="absolute left-[17%] top-[22%] size-2 rounded-full bg-cyan-200/70 shadow-[0_0_24px_oklch(0.82_0.15_220/0.85)]" data-aurora-particle="" />
      <span className="absolute right-[19%] top-[33%] size-1.5 rounded-full bg-violet-200/70 shadow-[0_0_22px_oklch(0.78_0.22_292/0.85)]" data-aurora-particle="" />
      <span className="absolute bottom-[24%] left-[42%] size-1 rounded-full bg-blue-100/70 shadow-[0_0_18px_oklch(0.72_0.2_255/0.8)]" data-aurora-particle="" />
    </div>
  )
}
