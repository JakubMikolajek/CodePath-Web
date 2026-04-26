'use client'

import { useGSAP } from '@gsap/react'
import { cn } from '@workspace/ui/lib/utils'
import gsap from 'gsap'
import { useRef } from 'react'

interface GsapAuroraProps {
  className?: string
  density?: 'default' | 'hero'
}

const buildWaveDots = (count: number, amplitude: number, phase: number) => {
  return Array.from({ length: count }, (_, index) => {
    const progress = index / Math.max(count - 1, 1)
    const wave = Math.sin(progress * Math.PI * 2.15 + phase)
    const ripple = Math.sin(progress * Math.PI * 7 + phase * 0.7)

    return {
      opacity: 0.22 + Math.abs(wave) * 0.56,
      radius: 1.4 + Math.abs(ripple) * 1.35,
      x: 20 + progress * 1040,
      y: 112 + wave * amplitude + ripple * 9
    }
  })
}

const leftWaveDots = buildWaveDots(82, 62, 0.15)
const rightWaveDots = buildWaveDots(88, 74, 1.85)
const lowerWaveDots = buildWaveDots(70, 44, 3.3)

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
    const dotWaves = gsap.utils.toArray<SVGGElement>('[data-aurora-dot-wave]')
    const dots = gsap.utils.toArray<SVGCircleElement>('[data-aurora-dot]')

    gsap.set([...waves, ...glows, ...particles], { transformOrigin: '50% 50%' })
    gsap.set(dotWaves, { transformOrigin: '50% 50%' })
    gsap.set(dots, { transformOrigin: '50% 50%' })

    waves.forEach((wave, index) => {
      gsap.to(wave, {
        duration: density === 'hero' ? 9 + index * 1.8 : 13 + index * 2.5,
        ease: 'sine.inOut',
        opacity: index % 2 === 0 ? 0.96 : 0.82,
        repeat: -1,
        rotate: index % 2 === 0 ? 4 : -5,
        scaleX: index % 2 === 0 ? 1.12 : 1.18,
        scaleY: index % 2 === 0 ? 1.08 : 1.12,
        x: index % 2 === 0 ? 92 : -84,
        y: index % 2 === 0 ? -38 : 44,
        yoyo: true
      })
    })

    glows.forEach((glow, index) => {
      gsap.to(glow, {
        duration: density === 'hero' ? 8 + index * 1.5 : 12 + index * 2,
        ease: 'sine.inOut',
        opacity: index % 2 === 0 ? 0.72 : 0.58,
        repeat: -1,
        scale: 1.22,
        x: index % 2 === 0 ? 54 : -58,
        y: index % 2 === 0 ? 34 : -30,
        yoyo: true
      })
    })

    dotWaves.forEach((wave, index) => {
      gsap.to(wave, {
        duration: density === 'hero' ? 6.5 + index * 1.3 : 10 + index * 1.8,
        ease: 'sine.inOut',
        opacity: index === 1 ? 0.92 : 0.76,
        repeat: -1,
        rotate: index % 2 === 0 ? 1.8 : -2.4,
        scale: index === 1 ? 1.06 : 1.04,
        x: index % 2 === 0 ? 78 : -68,
        y: index % 2 === 0 ? -18 : 24,
        yoyo: true
      })
    })

    gsap.to(dots, {
      duration: 2.8,
      ease: 'sine.inOut',
      opacity: '+=0.22',
      repeat: -1,
      scale: 1.45,
      yoyo: true,
      stagger: {
        amount: 2.2,
        from: 'random'
      }
    })

    particles.forEach((particle, index) => {
      gsap.to(particle, {
        duration: 4.2 + index * 0.7,
        ease: 'sine.inOut',
        opacity: 0.9,
        repeat: -1,
        scale: 1.45,
        x: index % 2 === 0 ? 34 : -34,
        y: index % 3 === 0 ? -38 : 32,
        yoyo: true
      })
    })
  }, { dependencies: [density], scope: rootRef })

  const isHero = density === 'hero'

  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} ref={rootRef}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,oklch(0.2_0.08_255/0.22),transparent_28rem),linear-gradient(180deg,#030919_0%,#05132c_45%,#020617_100%)]" />
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1200 675">
        <defs>
          <filter height="220%" id="dotWaveGlow" width="220%" x="-60%" y="-60%">
            <feGaussianBlur result="blur" stdDeviation="4" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g className={isHero ? 'opacity-90' : 'opacity-45'} data-aurora-dot-wave="" filter="url(#dotWaveGlow)" transform="translate(-250 210) rotate(-7)">
          {leftWaveDots.map(dot => (
            <circle className="fill-violet-300" cx={dot.x} cy={dot.y} data-aurora-dot="" key={`left-${dot.x}`} opacity={dot.opacity} r={dot.radius} />
          ))}
        </g>
        <g className={isHero ? 'opacity-95' : 'opacity-50'} data-aurora-dot-wave="" filter="url(#dotWaveGlow)" transform="translate(520 278) rotate(-5)">
          {rightWaveDots.map(dot => (
            <circle className="fill-cyan-300" cx={dot.x} cy={dot.y} data-aurora-dot="" key={`right-${dot.x}`} opacity={dot.opacity} r={dot.radius} />
          ))}
        </g>
        <g className={isHero ? 'opacity-55' : 'opacity-30'} data-aurora-dot-wave="" filter="url(#dotWaveGlow)" transform="translate(80 470) rotate(-10)">
          {lowerWaveDots.map(dot => (
            <circle className="fill-blue-300" cx={dot.x} cy={dot.y} data-aurora-dot="" key={`lower-${dot.x}`} opacity={dot.opacity} r={dot.radius} />
          ))}
        </g>
      </svg>
      <div
        className={cn(
          'absolute rounded-[100%] bg-[radial-gradient(ellipse_at_35%_50%,oklch(0.77_0.24_292/0.5),oklch(0.58_0.22_270/0.28)_34%,oklch(0.36_0.14_250/0.16)_58%,transparent_74%)] blur-2xl',
          isHero
            ? 'left-[-28vw] top-[25%] h-[29rem] w-[72vw] -rotate-[13deg] md:h-[35rem]'
            : 'left-[-24rem] top-[8%] h-72 w-[52rem] -rotate-[10deg]'
        )}
        data-aurora-wave=""
      />
      <div
        className={cn(
          'absolute rounded-[100%] bg-[radial-gradient(ellipse_at_45%_50%,oklch(0.74_0.18_225/0.52),oklch(0.52_0.18_245/0.3)_38%,oklch(0.34_0.15_265/0.16)_62%,transparent_78%)] blur-2xl',
          isHero
            ? 'right-[-26vw] top-[34%] h-[31rem] w-[74vw] rotate-[10deg] md:h-[37rem]'
            : 'right-[-18rem] top-[28%] h-80 w-[58rem] rotate-[10deg]'
        )}
        data-aurora-wave=""
      />
      <div
        className={cn(
          'absolute rounded-[100%] bg-[radial-gradient(ellipse_at_50%_50%,oklch(0.56_0.22_258/0.35),transparent_68%)] blur-3xl',
          isHero
            ? 'bottom-[-16rem] left-[12%] h-[28rem] w-[60vw] -rotate-[7deg]'
            : 'bottom-[-16rem] left-[20%] h-80 w-[42rem]'
        )}
        data-aurora-glow=""
      />
      <div
        className="absolute right-[12%] top-[18%] h-[24rem] w-[32rem] rounded-full bg-cyan-400/10 blur-3xl"
        data-aurora-glow=""
      />
      <span className="absolute left-[28%] top-[22%] size-2 rounded-full bg-cyan-200/80 shadow-[0_0_24px_oklch(0.82_0.15_220/0.9)]" data-aurora-particle="" />
      <span className="absolute right-[18%] top-[34%] size-1.5 rounded-full bg-violet-200/80 shadow-[0_0_22px_oklch(0.78_0.22_292/0.9)]" data-aurora-particle="" />
      <span className="absolute bottom-[28%] left-[47%] size-1 rounded-full bg-blue-100/80 shadow-[0_0_18px_oklch(0.72_0.2_255/0.85)]" data-aurora-particle="" />
    </div>
  )
}
