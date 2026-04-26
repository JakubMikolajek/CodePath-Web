'use client'

import { useGSAP } from '@gsap/react'
import { cn } from '@workspace/ui/lib/utils'
import gsap from 'gsap'
import { useRef } from 'react'

interface GsapAuroraProps {
  className?: string
  density?: 'default' | 'hero'
}

type Ribbon = {
  bottom: (t: number) => number
  dotEveryX: number
  dotEveryY: number
  endX: number
  id: string
  startX: number
  top: (t: number) => number
}

type MeshDot = {
  id: string
  opacity: number
  radius: number
  x: number
  y: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const noise = (x: number, y: number) => {
  const raw = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return raw - Math.floor(raw)
}

const buildRibbonPath = (ribbon: Ribbon) => {
  const samples = 68
  const topPoints: string[] = []
  const bottomPoints: string[] = []

  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples
    const x = ribbon.startX + (ribbon.endX - ribbon.startX) * t
    topPoints.push(`${x.toFixed(1)} ${ribbon.top(t).toFixed(1)}`)
    bottomPoints.unshift(`${x.toFixed(1)} ${ribbon.bottom(t).toFixed(1)}`)
  }

  return `M ${topPoints.join(' L ')} L ${bottomPoints.join(' L ')} Z`
}

const buildCrestPath = (ribbon: Ribbon) => {
  const samples = 72
  const points: string[] = []

  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples
    const x = ribbon.startX + (ribbon.endX - ribbon.startX) * t
    points.push(`${x.toFixed(1)} ${ribbon.top(t).toFixed(1)}`)
  }

  return `M ${points.join(' L ')}`
}

const buildMeshDots = (ribbon: Ribbon, bias: 'left' | 'lower' | 'right') => {
  const dots: MeshDot[] = []
  let column = 0

  for (let x = ribbon.startX; x <= ribbon.endX; x += ribbon.dotEveryX) {
    const t = (x - ribbon.startX) / (ribbon.endX - ribbon.startX)
    const top = ribbon.top(t)
    const bottom = ribbon.bottom(t)
    let row = 0

    for (let y = top + 18; y <= bottom - 16; y += ribbon.dotEveryY) {
      const vertical = (y - top) / Math.max(bottom - top, 1)
      const fadeEdge = Math.sin(clamp(vertical, 0, 1) * Math.PI)
      const horizontalFade = Math.sin(clamp(t, 0, 1) * Math.PI)
      const n = noise(x * 0.011, y * 0.013)
      const crestBoost = Math.max(0, 1 - vertical * 2.2)
      const sideWeight = bias === 'left'
        ? 1 - t * 0.22
        : bias === 'right'
          ? 0.75 + t * 0.25
          : 0.82

      dots.push({
        id: `${ribbon.id}-${column}-${row}`,
        opacity: clamp((0.08 + fadeEdge * 0.18 + crestBoost * 0.2 + n * 0.1) * horizontalFade * sideWeight, 0.03, 0.5),
        radius: 0.72 + n * 0.55,
        x,
        y: y + Math.sin(column * 0.55 + row * 0.38) * 1.8
      })
      row += 1
    }
    column += 1
  }

  return dots
}

const leftRibbon: Ribbon = {
  dotEveryX: 15,
  dotEveryY: 15,
  endX: 845,
  id: 'left',
  startX: -130,
  bottom: t => 760 + Math.sin(t * Math.PI * 1.2 + 0.4) * 34 - t * 52,
  top: t => 472 - Math.sin(t * Math.PI * 0.95) * 132 + Math.sin(t * Math.PI * 2.1 + 0.2) * 14
}

const rightRibbon: Ribbon = {
  dotEveryX: 15,
  dotEveryY: 15,
  endX: 1720,
  id: 'right',
  startX: 735,
  bottom: t => 672 + Math.sin(t * Math.PI * 1.45 + 0.3) * 32 + t * 20,
  top: t => 520 - Math.sin(t * Math.PI * 0.98) * 92 + Math.sin(t * Math.PI * 2.3 + 1.1) * 12
}

const lowerRibbon: Ribbon = {
  dotEveryX: 18,
  dotEveryY: 18,
  endX: 1680,
  id: 'lower',
  startX: 520,
  bottom: t => 846 + Math.sin(t * Math.PI * 1.1 + 0.6) * 30,
  top: t => 668 + Math.sin(t * Math.PI * 1.35 + 0.8) * 42
}

const leftPath = buildRibbonPath(leftRibbon)
const rightPath = buildRibbonPath(rightRibbon)
const lowerPath = buildRibbonPath(lowerRibbon)
const leftCrest = buildCrestPath(leftRibbon)
const rightCrest = buildCrestPath(rightRibbon)
const lowerCrest = buildCrestPath(lowerRibbon)
const leftDots = buildMeshDots(leftRibbon, 'left')
const rightDots = buildMeshDots(rightRibbon, 'right')
const lowerDots = buildMeshDots(lowerRibbon, 'lower')

export function GsapAurora({ className, density = 'default' }: GsapAuroraProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const isHero = density === 'hero'

  useGSAP(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      return
    }

    const ribbons = gsap.utils.toArray<SVGGElement>('[data-aurora-ribbon]')
    const meshes = gsap.utils.toArray<SVGGElement>('[data-aurora-mesh]')
    const crests = gsap.utils.toArray<SVGPathElement>('[data-aurora-crest]')
    const meshDots = gsap.utils.toArray<SVGCircleElement>('[data-aurora-dot]')
    const glows = gsap.utils.toArray<HTMLElement>('[data-aurora-glow]')
    const particles = gsap.utils.toArray<HTMLElement>('[data-aurora-particle]')

    gsap.set([...ribbons, ...meshes], { transformOrigin: '50% 50%' })
    gsap.set(crests, { transformOrigin: '50% 50%' })
    gsap.set([...glows, ...particles], { transformOrigin: '50% 50%' })

    ribbons.forEach((ribbon, index) => {
      gsap.to(ribbon, {
        duration: isHero ? 13 + index * 2 : 18 + index * 2.5,
        ease: 'sine.inOut',
        repeat: -1,
        rotate: index % 2 === 0 ? 0.8 : -0.9,
        scaleX: 1.02,
        scaleY: 1.025,
        x: index % 2 === 0 ? 22 : -26,
        y: index % 2 === 0 ? -12 : 14,
        yoyo: true
      })
    })

    meshes.forEach((mesh, index) => {
      gsap.to(mesh, {
        duration: isHero ? 8 + index * 1.2 : 12 + index * 1.6,
        ease: 'sine.inOut',
        repeat: -1,
        x: index % 2 === 0 ? 12 : -14,
        y: index % 2 === 0 ? -7 : 8,
        yoyo: true
      })
    })

    crests.forEach((crest, index) => {
      gsap.to(crest, {
        duration: isHero ? 9 + index : 13 + index * 1.4,
        ease: 'sine.inOut',
        opacity: index === 1 ? 0.82 : 0.7,
        repeat: -1,
        x: index % 2 === 0 ? 10 : -12,
        y: index % 2 === 0 ? -5 : 6,
        yoyo: true
      })
    })

    gsap.to(meshDots, {
      duration: 3.8,
      ease: 'sine.inOut',
      opacity: '+=0.12',
      repeat: -1,
      scale: 1.22,
      yoyo: true,
      stagger: {
        amount: 4.2,
        from: 'random'
      }
    })

    glows.forEach((glow, index) => {
      gsap.to(glow, {
        duration: isHero ? 10 + index * 1.4 : 16 + index * 1.8,
        ease: 'sine.inOut',
        opacity: index % 2 === 0 ? 0.62 : 0.48,
        repeat: -1,
        scale: 1.12,
        x: index % 2 === 0 ? 26 : -28,
        y: index % 2 === 0 ? 18 : -20,
        yoyo: true
      })
    })

    particles.forEach((particle, index) => {
      gsap.to(particle, {
        duration: 5 + index * 0.8,
        ease: 'sine.inOut',
        opacity: 0.82,
        repeat: -1,
        scale: 1.28,
        x: index % 2 === 0 ? 20 : -20,
        y: index % 3 === 0 ? -24 : 20,
        yoyo: true
      })
    })
  }, { dependencies: [isHero], scope: rootRef })

  const ribbonOpacity = isHero ? 'opacity-90' : 'opacity-55'
  const meshOpacity = isHero ? 'opacity-100' : 'opacity-70'

  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} ref={rootRef}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_42%,oklch(0.18_0.075_252/0.18),transparent_31rem),linear-gradient(180deg,#030819_0%,#05132b_48%,#020617_100%)]" />
      <div className="absolute left-[-10%] top-[28%] h-[22rem] w-[46rem] rounded-full bg-violet-500/10 blur-[92px]" data-aurora-glow="" />
      <div className="absolute right-[-8%] top-[34%] h-[25rem] w-[56rem] rounded-full bg-cyan-400/11 blur-[96px]" data-aurora-glow="" />
      <div className="absolute bottom-[-14%] left-[20%] h-[20rem] w-[48rem] rounded-full bg-blue-500/8 blur-[104px]" data-aurora-glow="" />

      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1600 900">
        <defs>
          <linearGradient id="leftMeshFill" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#a46cff" stopOpacity="0.4" />
            <stop offset="0.4" stopColor="#455fff" stopOpacity="0.2" />
            <stop offset="1" stopColor="#0d2a65" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rightMeshFill" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#0f52ba" stopOpacity="0" />
            <stop offset="0.36" stopColor="#09b8d8" stopOpacity="0.22" />
            <stop offset="0.68" stopColor="#4168ff" stopOpacity="0.22" />
            <stop offset="1" stopColor="#8f5cff" stopOpacity="0.24" />
          </linearGradient>
          <linearGradient id="lowerMeshFill" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#0a2c72" stopOpacity="0" />
            <stop offset="0.48" stopColor="#1261c8" stopOpacity="0.12" />
            <stop offset="1" stopColor="#09a6d8" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="leftMeshCrest" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#b984ff" stopOpacity="0" />
            <stop offset="0.32" stopColor="#c296ff" stopOpacity="0.7" />
            <stop offset="0.68" stopColor="#6178ff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#3ba4ff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rightMeshCrest" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#27dcff" stopOpacity="0" />
            <stop offset="0.36" stopColor="#42eaff" stopOpacity="0.68" />
            <stop offset="0.7" stopColor="#7c73ff" stopOpacity="0.38" />
            <stop offset="1" stopColor="#9c6dff" stopOpacity="0.02" />
          </linearGradient>
          <filter height="220%" id="meshGlow" width="220%" x="-60%" y="-60%">
            <feGaussianBlur result="blur" stdDeviation="18" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter height="190%" id="crestSoftGlow" width="190%" x="-45%" y="-45%">
            <feGaussianBlur result="blur" stdDeviation="5" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g data-aurora-ribbon="">
          <path className={ribbonOpacity} d={leftPath} fill="url(#leftMeshFill)" filter="url(#meshGlow)" />
          <g className={meshOpacity} data-aurora-mesh="">
            {leftDots.map(dot => (
              <circle cx={dot.x} cy={dot.y} data-aurora-dot="" fill="#bfa3ff" key={dot.id} opacity={dot.opacity} r={dot.radius} />
            ))}
          </g>
          <path d={leftCrest} data-aurora-crest="" fill="none" filter="url(#crestSoftGlow)" opacity="0.68" stroke="url(#leftMeshCrest)" strokeLinecap="round" strokeWidth="5" />
        </g>

        <g data-aurora-ribbon="">
          <path className={ribbonOpacity} d={rightPath} fill="url(#rightMeshFill)" filter="url(#meshGlow)" />
          <g className={meshOpacity} data-aurora-mesh="">
            {rightDots.map(dot => (
              <circle cx={dot.x} cy={dot.y} data-aurora-dot="" fill="#75e7ff" key={dot.id} opacity={dot.opacity} r={dot.radius} />
            ))}
          </g>
          <path d={rightCrest} data-aurora-crest="" fill="none" filter="url(#crestSoftGlow)" opacity="0.72" stroke="url(#rightMeshCrest)" strokeLinecap="round" strokeWidth="5" />
        </g>

        <g data-aurora-ribbon="">
          <path className={isHero ? 'opacity-55' : 'opacity-35'} d={lowerPath} fill="url(#lowerMeshFill)" filter="url(#meshGlow)" />
          <g className={isHero ? 'opacity-45' : 'opacity-28'} data-aurora-mesh="">
            {lowerDots.map(dot => (
              <circle cx={dot.x} cy={dot.y} data-aurora-dot="" fill="#7fb7ff" key={dot.id} opacity={dot.opacity} r={dot.radius} />
            ))}
          </g>
          <path d={lowerCrest} data-aurora-crest="" fill="none" opacity="0.18" stroke="#5a8cff" strokeLinecap="round" strokeWidth="3" />
        </g>
      </svg>

      <span className="absolute left-[34%] top-[22%] size-1.5 rounded-full bg-cyan-200/80 shadow-[0_0_24px_oklch(0.82_0.15_220/0.9)]" data-aurora-particle="" />
      <span className="absolute right-[18%] top-[35%] size-1 rounded-full bg-violet-100/75 shadow-[0_0_22px_oklch(0.78_0.22_292/0.9)]" data-aurora-particle="" />
    </div>
  )
}
