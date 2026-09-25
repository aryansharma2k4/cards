import { memo } from 'react'
import { DENOMS, chipLabel } from '../../engine/chips'

interface Scheme {
  base: string
  /** Optional gradient stops for metallic / holographic bases. */
  metal?: string[]
  spots: [string, string]
  lux?: boolean
}

export const SCHEMES: Record<number, Scheme> = {
  1: { base: '#f1eee6', spots: ['#1f4fa8', '#1f4fa8'] },
  2: { base: '#f0bf2c', spots: ['#1d2a44', '#ffffff'] },
  5: { base: '#c21f2c', spots: ['#f6cf45', '#ffffff'] },
  10: { base: '#1d5dc0', spots: ['#ffffff', '#f2c230'] },
  20: { base: '#8a9098', spots: ['#ffffff', '#2b2f36'] },
  50: { base: '#1b8a4b', spots: ['#ffffff', '#f2c230'] },
  100: { base: '#17171b', spots: ['#ffffff', '#c21f2c'] },
  500: { base: '#6a2da3', spots: ['#ffffff', '#f2c230'] },
  1000: { base: '#e39a2e', spots: ['#7a1030', '#ffffff'] },
  10000: { base: '#d6398a', spots: ['#ffffff', '#2b1030'] },
  100000: { base: '#11888a', spots: ['#ffffff', '#f0d58c'] },
  500000: { base: '#df5a14', spots: ['#ffffff', '#1b2a4a'] },
  1000000: { base: '#c9a24a', metal: ['#fff0b8', '#d8b150', '#9a7224', '#e9cc7a'], spots: ['#1a1a1a', '#ffffff'], lux: true },
  10000000: { base: '#c7ccd4', metal: ['#ffffff', '#c9ced6', '#8b929c', '#e4e7ec'], spots: ['#1b2a4a', '#d4af5a'], lux: true },
  50000000: { base: '#d59a86', metal: ['#fde2d6', '#e0a58f', '#a9644f', '#f0c3b0'], spots: ['#ffffff', '#5a2a20'], lux: true },
  100000000: { base: '#0b0b10', metal: ['#3a3a48', '#101016', '#050507', '#24242e'], spots: ['#d4af5a', '#f3dc9a'], lux: true },
  1000000000: {
    base: '#b8a6e8',
    metal: ['#ffd6f0', '#b5e8ff', '#c6ffd9', '#fff3b0', '#e3c6ff'],
    spots: ['#d4af5a', '#fff3c4'],
    lux: true,
  },
}

const id = (d: number) => `chip-${d}`
const fill = (d: number) => (SCHEMES[d].metal ? `url(#${id(d)}-metal)` : SCHEMES[d].base)
export const spotColor = (d: number, i: number) => SCHEMES[d].spots[i % 2]
export const edgeFill = fill

/** One <symbol> per denomination, top view, 100×100. Rendered once in a hidden SVG. */
export function ChipDefs() {
  return (
    <>
      <radialGradient id="chip-gloss" cx="0.35" cy="0.28" r="0.75">
        <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
        <stop offset="0.35" stopColor="#fff" stopOpacity="0.08" />
        <stop offset="1" stopColor="#000" stopOpacity="0.28" />
      </radialGradient>
      <linearGradient id="chip-ring" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fbe7a6" />
        <stop offset="0.5" stopColor="#b8913e" />
        <stop offset="1" stopColor="#f3dc9a" />
      </linearGradient>
      <radialGradient id="chip-inlay" cx="0.4" cy="0.35" r="0.8">
        <stop offset="0" stopColor="#fffdf6" />
        <stop offset="1" stopColor="#ece2c8" />
      </radialGradient>
      <path id="chip-text-arc" d="M50 50 m-21 0 a21 21 0 1 1 42 0 a21 21 0 1 1 -42 0" />
      {DENOMS.map((d) => {
        const s = SCHEMES[d]
        const label = chipLabel(d)
        return (
          <g key={d}>
            {s.metal && (
              <linearGradient id={`${id(d)}-metal`} x1="0" y1="0" x2="1" y2="1">
                {s.metal.map((c, i) => (
                  <stop key={i} offset={i / (s.metal!.length - 1)} stopColor={c} />
                ))}
              </linearGradient>
            )}
            <symbol id={id(d)} viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="49" fill={fill(d)} />
              {/* edge inserts */}
              {Array.from({ length: 8 }, (_, i) => (
                <rect
                  key={i}
                  x="44"
                  y="1.5"
                  width="12"
                  height="13"
                  rx="1.2"
                  fill={spotColor(d, i)}
                  transform={`rotate(${i * 45} 50 50)`}
                />
              ))}
              <circle cx="50" cy="50" r="48.5" fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="1" />
              <circle cx="50" cy="50" r="35.5" fill={fill(d)} />
              <circle cx="50" cy="50" r="35.5" fill="none" stroke="url(#chip-ring)" strokeWidth={s.lux ? 2.4 : 1.4} />
              {s.lux && <circle cx="50" cy="50" r="46" fill="none" stroke="url(#chip-ring)" strokeWidth="1" />}
              <circle cx="50" cy="50" r="28" fill="url(#chip-inlay)" />
              <circle cx="50" cy="50" r="26.2" fill="none" stroke={s.metal ? '#b8913e' : s.base} strokeWidth="0.7" />
              <text fontSize="4.1" fontFamily="var(--font-sans)" fontWeight="700" letterSpacing="0.9" fill="#6b5a3a">
                <textPath href="#chip-text-arc" startOffset="0">
                  HIGH ROLLER ✦ HIGH ROLLER ✦ HIGH ROLLER ✦
                </textPath>
              </text>
              <path d="M50 35.5 l1.6 3.4 3.6.4-2.7 2.4.8 3.6-3.3-1.9-3.3 1.9.8-3.6-2.7-2.4 3.6-.4z" fill="#b8913e" />
              <text
                x="50"
                y={label.length > 3 ? 60 : 61.5}
                textAnchor="middle"
                fontFamily="var(--font-display)"
                fontWeight="800"
                fontSize={label.length > 3 ? 13 : label.length > 2 ? 15 : 18}
                fill="#14100b"
              >
                {label}
              </text>
              <circle cx="50" cy="50" r="49" fill="url(#chip-gloss)" />
            </symbol>
          </g>
        )
      })}
    </>
  )
}

/** Flat top-view chip. */
export const Chip = memo(function Chip({ denom, size = 48 }: { denom: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden style={{ display: 'block', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.45))' }}>
      <use href={`#${id(denom)}`} width="100" height="100" />
    </svg>
  )
})

const THICK = 5.2 // stage px per chip edge
export const TILT = 0.46 // vertical squash of the top face (slight 3/4 view)

/** Deterministic 0–1px jitter so stacks look hand-placed. */
const jitter = (d: number, i: number) => ((Math.sin(d * 12.9898 + i * 78.233) * 43758.5453) % 1) * 1.1

/**
 * Side-on stack of identical chips: coloured edge stripes where the inserts
 * are, with the top chip's face visible. Anchored at its base centre.
 */
export const ChipStack = memo(function ChipStack({ denom, count, width = 46 }: { denom: number; count: number; width?: number }) {
  const r = width / 2
  const ry = r * TILT
  const h = count * THICK
  const W = width + 4
  const H = h + ry * 2 + 4
  const cx = W / 2
  const base = H - ry - 2
  const f = fill(denom)
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }} aria-hidden>
      <ellipse cx={cx} cy={base + 2} rx={r + 1.5} ry={ry + 1.5} fill="rgba(0,0,0,.45)" filter="url(#soft-shadow)" />
      {Array.from({ length: count }, (_, i) => {
        const y = base - i * THICK
        const x = cx + jitter(denom, i) - 0.5
        return (
          <g key={i}>
            <path
              d={`M${x - r} ${y - THICK} v${THICK} a${r} ${ry} 0 0 0 ${2 * r} 0 v${-THICK} Z`}
              fill={f}
              stroke="rgba(0,0,0,.35)"
              strokeWidth="0.6"
            />
            {/* visible edge inserts: front-facing stripes */}
            {[-0.72, -0.24, 0.24, 0.72].map((t, k) => {
              const sx = x + t * r
              const sw = r * 0.2 * Math.sqrt(1 - t * t)
              return (
                <rect
                  key={k}
                  x={sx - sw / 2}
                  y={y - THICK + 0.8 + ry * Math.sqrt(1 - t * t)}
                  width={sw}
                  height={THICK - 1.6}
                  fill={spotColor(denom, k + i)}
                />
              )
            })}
            <path d={`M${x - r} ${y} a${r} ${ry} 0 0 0 ${2 * r} 0`} fill="none" stroke="rgba(0,0,0,.4)" strokeWidth="0.6" />
          </g>
        )
      })}
      {/* top face */}
      <g transform={`translate(${cx + jitter(denom, count - 1) - 0.5 - r} ${base - h - ry})`}>
        <use href={`#${id(denom)}`} width={width} height={width} transform={`scale(1 ${TILT})`} />
      </g>
      <path
        d={`M${cx - r} ${base - h + 0.3} a${r} ${ry} 0 0 0 ${2 * r} 0`}
        fill="none"
        stroke="rgba(255,255,255,.18)"
        strokeWidth="0.8"
      />
    </svg>
  )
})

export const stackHeight = (count: number, width = 46) => count * THICK + width * TILT + 4
