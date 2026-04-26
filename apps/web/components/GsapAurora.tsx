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

    const waves = gsap.utils.toArray<HTMLElement>('[data-aurora-wave]')
    const glows = gsap.utils.toArray<HTMLElement>('[data-aurora-glow]')
    const particles = gsap.utils.toArray<HTMLElement>('[data-aurora-particle]')

    gsap.set([...waves, ...glows, ...particles], { transformOrigin: '50% 50%' })

    waves.forEach((wave, index) => {
      gsap.to(wave, {
        duration: 18 + index * 4,
        ease: 'sine.inOut',
        opacity: index % 2 === 0 ? 0.92 : 0.78,
        repeat: -1,
        rotate: index % 2 === 0 ? 3 : -4,
        scaleX: index % 2 === 0 ? 1.08 : 1.12,
        scaleY: index % 2 === 0 ? 1.04 : 1.08,
        x: index % 2 === 0 ? 64 : -58,
        y: index % 2 === 0 ? -26 : 32,
        yoyo: true
      })
    })

    glows.forEach((glow, index) => {
      gsap.to(glow, {
        duration: 14 + index * 3,
        ease: 'sine.inOut',
        opacity: index % 2 === 0 ? 0.64 : 0.5,
        repeat: -1,
        scale: 1.16,
        x: index % 2 === 0 ? 36 : -42,
        y: index % 2 === 0 ? 28 : -22,
        yoyo: true
      })
    })

    particles.forEach((particle, index) => {
      gsap.to(particle, {
        duration: 8 + index,
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,oklch(0.2_0.08_255/0.22),transparent_28rem),linear-gradient(180deg,#030919_0%,#05132c_45%,#020617_100%)]" />
      <div
        className={cn(
          'absolute rounded-[100%] bg-[radial-gradient(ellipse_at_35%_50%,oklch(0.77_0.24_292/0.72),oklch(0.58_0.22_270/0.38)_34%,oklch(0.36_0.14_250/0.2)_58%,transparent_74%)] blur-2xl',
          density === 'hero'
            ? 'left-[-24vw] top-[23%] h-[27rem] w-[66vw] -rotate-[13deg] md:h-[32rem]'
            : 'left-[-24rem] top-[8%] h-72 w-[52rem] -rotate-[10deg]'
        )}
        data-aurora-wave=""
      />
      <div
        className={cn(
          'absolute rounded-[100%] bg-[radial-gradient(ellipse_at_45%_50%,oklch(0.74_0.18_225/0.62),oklch(0.52_0.18_245/0.34)_38%,oklch(0.34_0.15_265/0.18)_62%,transparent_78%)] blur-2xl',
          density === 'hero'
            ? 'right-[-22vw] top-[31%] h-[29rem] w-[68vw] rotate-[10deg] md:h-[34rem]'
            : 'right-[-18rem] top-[28%] h-80 w-[58rem] rotate-[10deg]'
        )}
        data-aurora-wave=""
      />
      <div
        className={cn(
          'absolute rounded-[100%] bg-[radial-gradient(ellipse_at_50%_50%,oklch(0.56_0.22_258/0.35),transparent_68%)] blur-3xl',
          density === 'hero'
            ? 'bottom-[-16rem] left-[12%] h-[28rem] w-[60vw] -rotate-[7deg]'
            : 'bottom-[-16rem] left-[20%] h-80 w-[42rem]'
        )}
        data-aurora-glow=""
      />
      <div
        className="absolute right-[12%] top-[18%] h-[24rem] w-[32rem] rounded-full bg-cyan-400/10 blur-3xl"
        data-aurora-glow=""
      />
      <span className="absolute left-[28%] top-[22%] size-2 rounded-full bg-cyan-200/70 shadow-[0_0_24px_oklch(0.82_0.15_220/0.85)]" data-aurora-particle="" />
      <span className="absolute right-[18%] top-[34%] size-1.5 rounded-full bg-violet-200/70 shadow-[0_0_22px_oklch(0.78_0.22_292/0.85)]" data-aurora-particle="" />
      <span className="absolute bottom-[28%] left-[47%] size-1 rounded-full bg-blue-100/70 shadow-[0_0_18px_oklch(0.72_0.2_255/0.8)]" data-aurora-particle="" />
    </div>
  )
}
