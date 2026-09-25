import { forwardRef, memo, useImperativeHandle, useRef } from 'react'
import { WHEEL, colorOf } from './rules'
import { POCKET, R } from './physics'

/** Point at radius r, angle a (clockwise from top), around (0,0). */
const P = (r: number, a: number) => [r * Math.sin(a), -r * Math.cos(a)] as const
const fx = (n: number) => n.toFixed(2)

/** Annular sector from angle a0 to a1 between radii r0 < r1. */
function sector(r0: number, r1: number, a0: number, a1: number) {
  const [x0, y0] = P(r1, a0)
  const [x1, y1] = P(r1, a1)
  const [x2, y2] = P(r0, a1)
  const [x3, y3] = P(r0, a0)
  return `M${fx(x0)} ${fx(y0)}A${r1} ${r1} 0 0 1 ${fx(x1)} ${fx(y1)}L${fx(x2)} ${fx(y2)}A${r0} ${r0} 0 0 0 ${fx(x3)} ${fx(y3)}Z`
}

const FILL = { red: '#b3141f', black: '#16161a', green: '#0f7a3c' }
const POCKET_FILL = { red: '#6f0a12', black: '#070709', green: '#07471f' }

/** The rotating part: number ring, pockets with frets, wooden cone and brass turret. */
const Rotor = memo(function Rotor() {
  return (
    <g>
      {/* number ring */}
      {WHEEL.map((n, i) => {
        const a0 = (i - 0.5) * POCKET
        const a1 = (i + 0.5) * POCKET
        const c = colorOf(n)
        const [tx, ty] = P(207, i * POCKET)
        return (
          <g key={n}>
            <path d={sector(192, 224, a0, a1)} fill={FILL[c]} />
            <path d={sector(150, 192, a0, a1)} fill={`url(#pocket-${c})`} />
            <text
              x={fx(tx)}
              y={fx(ty)}
              transform={`rotate(${(i * POCKET * 180) / Math.PI} ${fx(tx)} ${fx(ty)})`}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="var(--font-display)"
              fontWeight="800"
              fontSize="17"
              fill="#fff"
            >
              {n}
            </text>
          </g>
        )
      })}
      {/* gold separators in the number ring and metal frets between pockets */}
      {WHEEL.map((_, i) => {
        const a = (i - 0.5) * POCKET
        const [x0, y0] = P(150, a)
        const [x1, y1] = P(224, a)
        return <line key={i} x1={fx(x0)} y1={fx(y0)} x2={fx(x1)} y2={fx(y1)} stroke="url(#fret)" strokeWidth="2.2" />
      })}
      <circle r="224" fill="none" stroke="url(#brass)" strokeWidth="3" />
      <circle r="192" fill="none" stroke="url(#brass)" strokeWidth="2.5" />
      <circle r="150" fill="none" stroke="url(#brass)" strokeWidth="3" />
      {/* pocket depth shading */}
      <circle r="171" fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="42" />
      {/* cone */}
      <circle r="148" fill="url(#cone)" />
      {Array.from({ length: 16 }, (_, i) => {
        const [x, y] = P(148, (i * Math.PI) / 8)
        return <line key={i} x1="0" y1="0" x2={fx(x)} y2={fx(y)} stroke="rgba(0,0,0,.18)" strokeWidth="1" />
      })}
      <circle r="104" fill="none" stroke="url(#brass)" strokeWidth="2" opacity="0.8" />
      {/* turret: four arms with ball ends */}
      {[0, 90, 180, 270].map((r) => (
        <g key={r} transform={`rotate(${r})`}>
          <path d="M-7 -8L-4 -92L4 -92L7 -8Z" fill="url(#brass)" stroke="#6b4e18" strokeWidth="1" />
          <circle cy="-96" r="9" fill="url(#brass-ball)" stroke="#6b4e18" strokeWidth="1" />
        </g>
      ))}
      <circle r="30" fill="url(#brass-ball)" stroke="#6b4e18" strokeWidth="1.5" />
      <circle r="12" fill="url(#brass)" />
      <circle cx="-6" cy="-8" r="5" fill="#fff" opacity="0.45" />
    </g>
  )
})

/** Static bowl: wooden rim, polished ball track, brass deflector diamonds. */
const Bowl = memo(function Bowl() {
  return (
    <g>
      <circle r="300" fill="url(#bowl-wood)" />
      <circle r="300" fill="#000" filter="url(#wheel-grain)" opacity="0.5" />
      <circle r="296" fill="none" stroke="url(#brass)" strokeWidth="4" />
      <circle r="280" fill="none" stroke="rgba(0,0,0,.4)" strokeWidth="2" />
      {/* ball track */}
      <circle r="258" fill="none" stroke="url(#track)" strokeWidth="34" />
      <circle r="241" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="1" />
      <circle r="229" fill="#1b0d06" />
      {/* deflectors */}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4 + Math.PI / 8
        const [x, y] = P(R.diamonds + 8, a)
        return (
          <g key={i} transform={`translate(${fx(x)} ${fx(y)}) rotate(${(a * 180) / Math.PI + (i % 2 ? 90 : 0)})`}>
            <path d="M0 -11L6 0L0 11L-6 0Z" fill="url(#brass)" stroke="#6b4e18" strokeWidth="0.8" />
          </g>
        )
      })}
    </g>
  )
})

export interface WheelHandle {
  /** Position rotor and ball (angles in radians; r in wheel units; ballVisible hides the ball). */
  set(wheel: number, ball: number, r: number, ballVisible?: boolean): void
}

const VIEW = '-310 -310 620 620'
const layer = 'absolute inset-0'

/**
 * Roulette wheel, 620×620 units centred on (0,0). Three layers so a spin never repaints the artwork:
 * the static bowl, the rotor (turned with a GPU transform) and the ball (moved with a GPU transform).
 */
export const Wheel = forwardRef<WheelHandle, { size: number }>(function Wheel({ size }, ref) {
  const rotor = useRef<HTMLDivElement>(null)
  const ball = useRef<HTMLDivElement>(null)
  const k = size / 620 // wheel units → px
  useImperativeHandle(ref, () => ({
    set(w, b, r, visible = true) {
      if (rotor.current) rotor.current.style.transform = `rotate(${(w * 180) / Math.PI}deg)`
      const [x, y] = P(r * k, b)
      if (ball.current) {
        ball.current.style.transform = `translate(${fx(x)}px, ${fx(y)}px)`
        ball.current.style.opacity = visible ? '1' : '0'
      }
    },
  }))
  const ballPx = 22 * k
  return (
    <div className="relative" style={{ width: size, height: size }} aria-label="Roulette wheel" role="img">
      <svg className={layer} width={size} height={size} viewBox={VIEW} aria-hidden>
      <defs>
        <radialGradient id="bowl-wood" cx="0.45" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#7a3a1a" />
          <stop offset="0.7" stopColor="#4a1f0d" />
          <stop offset="1" stopColor="#2a1007" />
        </radialGradient>
        <filter id="wheel-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.004 0.08" numOctaves="3" seed="4" />
          <feColorMatrix values="0 0 0 0 0.1 0 0 0 0 0.04 0 0 0 0 0.01 0 0 0 0.6 -0.15" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <radialGradient id="track" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.8" stopColor="#3b1a0b" />
          <stop offset="0.9" stopColor="#8a4b25" />
          <stop offset="1" stopColor="#2b1208" />
        </radialGradient>
        <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff1b8" />
          <stop offset="0.45" stopColor="#d4a84a" />
          <stop offset="1" stopColor="#7a5717" />
        </linearGradient>
        <radialGradient id="brass-ball" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff6cf" />
          <stop offset="0.5" stopColor="#d4a84a" />
          <stop offset="1" stopColor="#6b4a12" />
        </radialGradient>
        <linearGradient id="fret" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8f96a0" />
          <stop offset="0.5" stopColor="#f2f4f7" />
          <stop offset="1" stopColor="#8f96a0" />
        </linearGradient>
        <radialGradient id="cone" cx="0.42" cy="0.38" r="0.7">
          <stop offset="0" stopColor="#a4592c" />
          <stop offset="0.6" stopColor="#6b3113" />
          <stop offset="1" stopColor="#3d190a" />
        </radialGradient>
        {(['red', 'black', 'green'] as const).map((c) => (
          <radialGradient key={c} id={`pocket-${c}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.5" stopColor={POCKET_FILL[c]} />
            <stop offset="1" stopColor={FILL[c]} />
          </radialGradient>
        ))}
        <radialGradient id="ball-shade" cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#e9ebee" />
          <stop offset="1" stopColor="#8a8f97" />
        </radialGradient>
        <radialGradient id="wheel-light" cx="0.4" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity="0.14" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.25" />
        </radialGradient>
      </defs>
        <Bowl />
      </svg>
      <div ref={rotor} className={layer} style={{ willChange: 'transform' }}>
        <svg width={size} height={size} viewBox={VIEW} aria-hidden>
          <Rotor />
        </svg>
      </div>
      {/* soft light from above */}
      <svg className={`${layer} pointer-events-none`} width={size} height={size} viewBox={VIEW} aria-hidden>
        <circle r="300" fill="url(#wheel-light)" />
      </svg>
      <div className="absolute" style={{ left: size / 2 - ballPx / 2, top: size / 2 - ballPx / 2, width: ballPx, height: ballPx, opacity: 0, willChange: 'transform' }} ref={ball}>
        <svg width={ballPx} height={ballPx} viewBox="-11 -11 22 22" style={{ overflow: 'visible' }} aria-hidden>
          <ellipse cx="3" cy="4" rx="9" ry="8" fill="rgba(0,0,0,.45)" />
          <circle r="8.5" fill="url(#ball-shade)" />
          <circle cx="-3" cy="-3.2" r="2.6" fill="#fff" opacity="0.9" />
        </svg>
      </div>
    </div>
  )
})
