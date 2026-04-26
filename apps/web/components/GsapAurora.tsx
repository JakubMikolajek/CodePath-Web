'use client'

import { useGSAP } from '@gsap/react'
import type { Nullable } from '@workspace/codepath-common/globals'
import { cn } from '@workspace/ui/lib/utils'
import gsap from 'gsap'
import { useEffect, useMemo, useRef } from 'react'

export enum GsapAuroraDensity {
  DEFAULT = 'default',
  HERO = 'hero'
}

interface GsapAuroraProps {
  className?: string
  density?: GsapAuroraDensity
}

interface Particle {
  baseOpacity: number
  baseY: number
  color: [number, number, number]
  jitterAmplitude: number
  jitterPhase: number
  jitterSpeed: number
  opacityTarget: number
  radius: number
  waveIndex: number
  xFraction: number
  yOffset: number
}

interface GsapWavePhase {
  y: number
}

const HERO_WAVE_COUNTS = [5500, 4200]
const DEFAULT_WAVE_COUNTS = [2600, 2100]
const TWO_PI = Math.PI * 2

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const noise = (x: number, y: number): number => {
  const raw = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return raw - Math.floor(raw)
}

const createRng = (seed: number) => {
  let state = seed >>> 0

  return () => {
    state += 0x6D2B79F5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const waveBaseY = (xFraction: number, waveIndex: number): number => {
  if (waveIndex === 0) {
    return 0.4 + Math.sin(xFraction * Math.PI * 1.05) * -0.14 + Math.sin(xFraction * Math.PI * 2.2 + 0.3) * 0.02
  }

  return 0.64 + Math.sin(xFraction * Math.PI * 0.95 + 0.5) * -0.11 + Math.sin(xFraction * Math.PI * 2 + 1.4) * 0.018
}

const waveSpread = (xFraction: number): number => 0.13 + Math.sin(clamp(xFraction, 0, 1) * Math.PI) * 0.045

const particleColor = (xFraction: number, waveIndex: number): [number, number, number] => {
  const t = clamp(xFraction, 0, 1)

  if (waveIndex === 0) {
    return [Math.round(178 + (45 - 178) * t), Math.round(80 + (210 - 80) * t), 255]
  }

  return [Math.round(35 + (150 - 35) * t), Math.round(90 + (65 - 90) * t), 255]
}

const buildParticles = (isHero: boolean): Particle[] => {
  const counts = isHero ? HERO_WAVE_COUNTS : DEFAULT_WAVE_COUNTS
  const random = createRng(isHero ? 42690 : 42691)
  const particles: Particle[] = []

  for (let waveIndex = 0; waveIndex < counts.length; waveIndex += 1) {
    for (let index = 0; index < counts[waveIndex]; index += 1) {
      const xFraction = random()
      const baseY = waveBaseY(xFraction, waveIndex)
      const spread = waveSpread(xFraction)
      const u1 = random()
      const u2 = random()
      const gaussian = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-6))) * Math.cos(TWO_PI * u2)
      const yFraction = baseY + gaussian * spread * 0.44
      const distanceFromCrest = Math.abs(yFraction - baseY) / Math.max(spread, 0.001)
      const crestProximity = Math.max(0, 1 - distanceFromCrest * 1.3)
      const edgeFade = Math.sin(clamp(xFraction, 0, 1) * Math.PI)
      const n = noise(xFraction * 17.3 + waveIndex * 5, yFraction * 11.7)
      const isCrest = crestProximity > 0.7
      const baseOpacity = clamp((0.035 + crestProximity * 0.55 + n * 0.08) * edgeFade, 0.006, 0.84)

      particles.push({
        baseOpacity,
        baseY,
        color: particleColor(xFraction, waveIndex),
        jitterAmplitude: isCrest ? 0.6 + n : 0.9 + n * 1.8,
        jitterPhase: random() * TWO_PI,
        jitterSpeed: 0.28 + random() * 0.48,
        opacityTarget: baseOpacity,
        radius: isCrest ? 0.7 + n * 0.9 : 0.4 + n * 0.65,
        waveIndex,
        xFraction,
        yOffset: yFraction - baseY
      })
    }
  }

  return particles
}

export function GsapAurora({ className, density = GsapAuroraDensity.DEFAULT }: GsapAuroraProps) {
  const isHero = density === GsapAuroraDensity.HERO

  const particles = useMemo(() => buildParticles(isHero), [isHero])

  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number>(0)
  const startTimeRef = useRef<Nullable<number>>(null)
  const wavePhaseRef = useRef<GsapWavePhase[]>([{ y: 0 }, { y: 0 }])
  const particlesRef = useRef<Particle[]>(particles)

  particlesRef.current = particles

  useGSAP(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduceMotion) {
      return
    }

    const particleTargets = particlesRef.current

    gsap.to(wavePhaseRef.current[0], {
      duration: isHero ? 12 : 18,
      ease: 'sine.inOut',
      repeat: -1,
      y: isHero ? 0.07 : 0.04,
      yoyo: true
    })

    gsap.to(wavePhaseRef.current[1], {
      delay: 1.2,
      duration: isHero ? 15 : 21,
      ease: 'sine.inOut',
      repeat: -1,
      y: isHero ? -0.08 : -0.045,
      yoyo: true
    })

    gsap.to(particleTargets, {
      duration: 3.2,
      ease: 'sine.inOut',
      repeat: -1,
      stagger: { amount: 5.5, from: 'random' },
      yoyo: true,
      opacityTarget: (index: number) => {
        const particle = particleTargets[index]
        const boost = particle.baseOpacity > 0.3 ? 0.18 : 0.1
        return Math.min(0.9, particle.baseOpacity + boost)
      }
    })
  }, { dependencies: [isHero, particles], scope: rootRef })

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current

    if (!root || !canvas) {
      return
    }

    const context = canvas.getContext('2d')

    if (!context) {
      return
    }

    let width = 0
    let height = 0
    let dpr = 1

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = root.offsetWidth
      height = root.offsetHeight

      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      context.setTransform(dpr, 0, 0, dpr, 0, 0)

      startTimeRef.current = null
    }

    const draw = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp
      }

      const elapsed = (timestamp - startTimeRef.current) * 0.001
      const wavePhase = wavePhaseRef.current

      context.clearRect(0, 0, width, height)
      context.globalCompositeOperation = 'lighter'

      for (const particle of particlesRef.current) {
        const jitterX = Math.sin(elapsed * particle.jitterSpeed + particle.jitterPhase) * particle.jitterAmplitude
        const jitterY = Math.cos(elapsed * particle.jitterSpeed * 0.65 + particle.jitterPhase + 1.1) * particle.jitterAmplitude * 0.5
        const x = particle.xFraction * width + jitterX
        const y = (particle.baseY + particle.yOffset + wavePhase[particle.waveIndex].y) * height + jitterY
        const [red, green, blue] = particle.color

        context.beginPath()
        context.arc(x, y, particle.radius, 0, TWO_PI)
        context.fillStyle = `rgba(${red},${green},${blue},${particle.opacityTarget})`
        context.fill()
      }

      context.globalCompositeOperation = 'source-over'
      frameRef.current = requestAnimationFrame(draw)
    }

    const resizeObserver = new ResizeObserver(resize)

    resizeObserver.observe(root)

    resize()

    frameRef.current = requestAnimationFrame(draw)

    return () => {
      resizeObserver.disconnect()
      cancelAnimationFrame(frameRef.current)
    }
  }, [])

  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} ref={rootRef}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_42%,oklch(0.18_0.075_252/0.15),transparent_31rem),linear-gradient(180deg,#030819_0%,#05132b_48%,#020617_100%)]" />
      <div className="absolute left-[-4%] top-[12%] h-[55%] w-[52%] rounded-full bg-[radial-gradient(ellipse,rgba(148,80,255,0.22)_0%,rgba(100,40,220,0.10)_40%,transparent_70%)] blur-[28px]" />
      <div className="absolute right-[-6%] top-[28%] h-[50%] w-[58%] rounded-full bg-[radial-gradient(ellipse,rgba(40,180,255,0.20)_0%,rgba(20,120,255,0.09)_40%,transparent_70%)] blur-[32px]" />
      <div className="absolute bottom-[-8%] left-[28%] h-[40%] w-[36%] rounded-full bg-[radial-gradient(ellipse,rgba(60,100,255,0.14)_0%,transparent_70%)] blur-xl" />
      <canvas className="absolute inset-0 size-full" ref={canvasRef} />
    </div>
  )
}
