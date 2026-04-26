'use client'

import { useGSAP } from '@gsap/react'
import { cn } from '@workspace/ui/lib/utils'
import gsap from 'gsap'
import { useRef } from 'react'

interface GsapAuroraProps {
  className?: string
  density?: 'default' | 'hero'
}

const heroOpacity = {
  base: 'opacity-100',
  ribbon: 'opacity-95',
  texture: 'opacity-55'
}

const appOpacity = {
  base: 'opacity-70',
  ribbon: 'opacity-70',
  texture: 'opacity-32'
}

export function GsapAurora({ className, density = 'default' }: GsapAuroraProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const isHero = density === 'hero'
  const opacity = isHero ? heroOpacity : appOpacity

  useGSAP(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      return
    }

    const ribbons = gsap.utils.toArray<SVGGElement>('[data-aurora-ribbon]')
    const crests = gsap.utils.toArray<SVGPathElement>('[data-aurora-crest]')
    const textures = gsap.utils.toArray<SVGGElement>('[data-aurora-texture]')
    const glows = gsap.utils.toArray<HTMLElement>('[data-aurora-glow]')
    const particles = gsap.utils.toArray<HTMLElement>('[data-aurora-particle]')

    gsap.set([...ribbons, ...textures], { transformOrigin: '50% 50%' })
    gsap.set(crests, { strokeDasharray: '14 28', strokeDashoffset: 0, transformOrigin: '50% 50%' })
    gsap.set([...glows, ...particles], { transformOrigin: '50% 50%' })

    ribbons.forEach((ribbon, index) => {
      gsap.to(ribbon, {
        duration: isHero ? 10 + index * 1.8 : 15 + index * 2.5,
        ease: 'sine.inOut',
        repeat: -1,
        rotate: index % 2 === 0 ? 1.8 : -1.5,
        scaleX: 1.03 + index * 0.012,
        scaleY: 1.035,
        x: index % 2 === 0 ? 28 : -34,
        y: index % 2 === 0 ? -18 : 22,
        yoyo: true
      })
    })

    crests.forEach((crest, index) => {
      gsap.to(crest, {
        duration: isHero ? 5.8 + index * 0.7 : 8.8 + index,
        ease: 'none',
        repeat: -1,
        strokeDashoffset: index % 2 === 0 ? -90 : 90
      })
    })

    textures.forEach((texture, index) => {
      gsap.to(texture, {
        duration: isHero ? 7.5 + index : 11 + index * 1.4,
        ease: 'sine.inOut',
        opacity: index === 1 ? 0.72 : 0.58,
        repeat: -1,
        x: index % 2 === 0 ? 22 : -24,
        y: index % 2 === 0 ? -10 : 12,
        yoyo: true
      })
    })

    glows.forEach((glow, index) => {
      gsap.to(glow, {
        duration: isHero ? 8 + index * 1.4 : 13 + index * 1.8,
        ease: 'sine.inOut',
        opacity: index % 2 === 0 ? 0.72 : 0.54,
        repeat: -1,
        scale: 1.14,
        x: index % 2 === 0 ? 34 : -38,
        y: index % 2 === 0 ? 22 : -26,
        yoyo: true
      })
    })

    particles.forEach((particle, index) => {
      gsap.to(particle, {
        duration: 4.5 + index * 0.8,
        ease: 'sine.inOut',
        opacity: 0.88,
        repeat: -1,
        scale: 1.35,
        x: index % 2 === 0 ? 24 : -26,
        y: index % 3 === 0 ? -30 : 24,
        yoyo: true
      })
    })
  }, { dependencies: [isHero], scope: rootRef })

  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} ref={rootRef}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_42%,oklch(0.18_0.075_252/0.2),transparent_31rem),linear-gradient(180deg,#030819_0%,#05132b_48%,#020617_100%)]" />
      <div className="absolute left-[-8%] top-[24%] h-[24rem] w-[46rem] rounded-full bg-violet-500/12 blur-[76px]" data-aurora-glow="" />
      <div className="absolute right-[-4%] top-[32%] h-[28rem] w-[52rem] rounded-full bg-cyan-400/13 blur-[84px]" data-aurora-glow="" />
      <div className="absolute bottom-[-16%] left-[18%] h-[24rem] w-[44rem] rounded-full bg-blue-500/9 blur-[90px]" data-aurora-glow="" />

      <svg className={cn('absolute inset-0 h-full w-full', opacity.base)} preserveAspectRatio="none" viewBox="0 0 1600 900">
        <defs>
          <linearGradient id="leftRibbonFill" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#b06cff" stopOpacity="0.52" />
            <stop offset="0.42" stopColor="#4b6dff" stopOpacity="0.26" />
            <stop offset="1" stopColor="#0b2a65" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rightRibbonFill" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#0c2f7a" stopOpacity="0" />
            <stop offset="0.42" stopColor="#0aa7e5" stopOpacity="0.36" />
            <stop offset="0.72" stopColor="#6267ff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#8a4fff" stopOpacity="0.22" />
          </linearGradient>
          <linearGradient id="lowerRibbonFill" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#113a91" stopOpacity="0" />
            <stop offset="0.38" stopColor="#1457ce" stopOpacity="0.18" />
            <stop offset="0.86" stopColor="#0aa7e5" stopOpacity="0.13" />
          </linearGradient>
          <linearGradient id="leftCrest" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#b987ff" stopOpacity="0.08" />
            <stop offset="0.28" stopColor="#bf8cff" stopOpacity="0.72" />
            <stop offset="0.62" stopColor="#6d7cff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#3ba4ff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rightCrest" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#21d9ff" stopOpacity="0" />
            <stop offset="0.28" stopColor="#36ddff" stopOpacity="0.72" />
            <stop offset="0.62" stopColor="#7d73ff" stopOpacity="0.4" />
            <stop offset="1" stopColor="#a177ff" stopOpacity="0.05" />
          </linearGradient>
          <filter height="220%" id="softRibbonGlow" width="220%" x="-60%" y="-60%">
            <feGaussianBlur result="blur" stdDeviation="18" />
            <feColorMatrix in="blur" result="tint" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1.3 0 0  0 0 0 0.62 0" />
            <feMerge>
              <feMergeNode in="tint" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter height="180%" id="crestGlow" width="180%" x="-40%" y="-40%">
            <feGaussianBlur result="blur" stdDeviation="6" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern height="16" id="violetDotMesh" patternUnits="userSpaceOnUse" width="16">
            <circle cx="4" cy="4" fill="#d8c2ff" opacity="0.35" r="1.15" />
          </pattern>
          <pattern height="15" id="cyanDotMesh" patternUnits="userSpaceOnUse" width="15">
            <circle cx="5" cy="5" fill="#92efff" opacity="0.36" r="1.05" />
          </pattern>
          <pattern height="18" id="blueDotMesh" patternUnits="userSpaceOnUse" width="18">
            <circle cx="6" cy="6" fill="#8ab7ff" opacity="0.24" r="0.95" />
          </pattern>
        </defs>

        <g className={opacity.ribbon} data-aurora-ribbon="">
          <path
            d="M-140 565 C70 430 230 354 430 382 C594 405 658 492 824 500 C650 552 496 631 304 702 C128 768 -24 812 -170 838 Z"
            fill="url(#leftRibbonFill)"
            filter="url(#softRibbonGlow)"
          />
          <g className={opacity.texture} data-aurora-texture="">
            <path
              d="M-132 540 C82 420 240 370 430 393 C555 410 642 466 782 488 C620 526 458 584 286 648 C120 710 -36 760 -160 790 Z"
              fill="url(#violetDotMesh)"
            />
          </g>
          <path
            d="M-118 535 C86 418 246 365 432 388 C560 404 650 468 810 492"
            data-aurora-crest=""
            fill="none"
            filter="url(#crestGlow)"
            stroke="url(#leftCrest)"
            strokeLinecap="round"
            strokeWidth="7"
          />
        </g>

        <g className={opacity.ribbon} data-aurora-ribbon="">
          <path
            d="M682 610 C852 506 958 385 1140 368 C1305 352 1436 407 1644 490 L1644 666 C1415 590 1280 552 1116 590 C934 632 824 744 658 734 Z"
            fill="url(#rightRibbonFill)"
            filter="url(#softRibbonGlow)"
          />
          <g className={opacity.texture} data-aurora-texture="">
            <path
              d="M734 594 C888 512 982 418 1148 396 C1308 375 1428 424 1624 502 L1624 625 C1398 556 1270 524 1128 560 C962 602 842 704 704 710 Z"
              fill="url(#cyanDotMesh)"
            />
          </g>
          <path
            d="M712 602 C866 512 978 404 1148 386 C1308 370 1436 424 1628 500"
            data-aurora-crest=""
            fill="none"
            filter="url(#crestGlow)"
            stroke="url(#rightCrest)"
            strokeLinecap="round"
            strokeWidth="8"
          />
        </g>

        <g className={isHero ? 'opacity-70' : 'opacity-45'} data-aurora-ribbon="">
          <path
            d="M180 704 C348 616 504 604 660 642 C806 678 928 760 1100 748 C1266 736 1402 646 1608 674 L1608 812 C1364 780 1244 856 1068 862 C874 868 744 772 574 742 C430 716 304 744 168 832 Z"
            fill="url(#lowerRibbonFill)"
            filter="url(#softRibbonGlow)"
          />
          <g className={opacity.texture} data-aurora-texture="">
            <path
              d="M220 706 C372 636 506 626 654 660 C808 696 928 774 1090 768 C1254 760 1378 700 1588 710 L1588 790 C1366 770 1246 836 1070 840 C874 844 752 754 582 728 C444 706 320 740 198 802 Z"
              fill="url(#blueDotMesh)"
            />
          </g>
        </g>
      </svg>

      <span className="absolute left-[30%] top-[22%] size-1.5 rounded-full bg-cyan-200/80 shadow-[0_0_24px_oklch(0.82_0.15_220/0.9)]" data-aurora-particle="" />
      <span className="absolute right-[18%] top-[35%] size-1 rounded-full bg-violet-100/75 shadow-[0_0_22px_oklch(0.78_0.22_292/0.9)]" data-aurora-particle="" />
    </div>
  )
}
