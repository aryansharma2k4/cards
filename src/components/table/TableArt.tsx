import { memo } from 'react'
import { SUIT_PATH } from '../cards/art'
import { CENTER, FELT, RAIL, SEATS, STAGE, boardSlot, CARD, HERO } from '../../ui/geometry'
import { SCHEMES } from '../chips/Chip'

const racetrack = (x: number, y: number, w: number, h: number) => {
  const r = h / 2
  return `M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} H${x + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`
}
const inset = (b: { x: number; y: number; w: number; h: number }, d: number) => ({ x: b.x + d, y: b.y + d, w: b.w - 2 * d, h: b.h - 2 * d })
const rt = (b: { x: number; y: number; w: number; h: number }) => racetrack(b.x, b.y, b.w, b.h)

const RAIL_MID = inset(RAIL, 37)
const TRIM = inset(FELT, -9)

/** Suit stamps: one near each seat plus a ring of decoration. */
const STAMPS = (() => {
  const out: { x: number; y: number; s: string; size: number }[] = []
  const suits = ['s', 'h', 'd', 'c']
  // decorative ring on the betting line
  const n = 28
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    const x = CENTER.x + Math.cos(t) * 530
    const y = CENTER.y + Math.sin(t) * 215
    if (Math.abs(x - CENTER.x) < 330 && Math.abs(y - CENTER.y) < 120) continue
    out.push({ x, y, s: suits[i % 4], size: 11 })
  }
  return out
})()

const CHAIR_W = 150
/** Dark leather chairs peeking out behind each seat. */
function Chairs() {
  return (
    <g opacity="0.95">
      {SEATS.map((p, i) => {
        const a = Math.atan2(p.y - CENTER.y, p.x - CENTER.x)
        const x = p.x + Math.cos(a) * 58
        const y = p.y + Math.sin(a) * 58
        const deg = (a * 180) / Math.PI + 90
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${deg})`} opacity={i === HERO ? 0.7 : 1}>
            <rect x={-CHAIR_W / 2} y={-40} width={CHAIR_W} height={92} rx="34" fill="url(#leather)" />
            <rect x={-CHAIR_W / 2 + 10} y={-30} width={CHAIR_W - 20} height={62} rx="26" fill="none" stroke="rgba(0,0,0,.45)" strokeWidth="2" />
            {[-40, -13, 13, 40].map((dx) => (
              <circle key={dx} cx={dx} cy={2} r="2.4" fill="rgba(0,0,0,.5)" />
            ))}
          </g>
        )
      })}
    </g>
  )
}

function DealerStation() {
  const tray = { x: 800 - 170, y: RAIL.y + 6, w: 340, h: 50 }
  const rows = [10000, 1000, 500, 100, 50, 20, 10, 5, 1]
  return (
    <g>
      {/* dealer figure behind the rail */}
      <g transform="translate(800 50) scale(0.9)">
        <ellipse cx="0" cy="74" rx="118" ry="40" fill="#07090c" opacity="0.6" filter="url(#soft-shadow)" />
        <path d="M-105 78 C-100 40 -60 26 -30 22 L30 22 C60 26 100 40 105 78 Z" fill="url(#suit-cloth)" />
        <path d="M-22 22 L0 60 L22 22 Z" fill="#f4f1ea" />
        <path d="M-12 30 L0 36 L12 30 L12 42 L0 36 L-12 42 Z" fill="#0c0c0f" />
        <path d="M-30 22 L-10 70 M30 22 L10 70" stroke="#0a0b0e" strokeWidth="3" />
        <rect x="-11" y="4" width="22" height="20" rx="6" fill="#c89878" />
        <ellipse cx="0" cy="-12" rx="25" ry="29" fill="url(#skin)" />
        <path d="M-25 -16 C-26 -42 26 -44 25 -16 C18 -30 -18 -32 -25 -16 Z" fill="#1e1510" />
        <rect x="46" y="44" width="38" height="12" rx="2" fill="url(#gold-foil)" />
      </g>
      {/* recessed chip tray */}
      <path d={racetrack(tray.x - 10, tray.y - 6, tray.w + 20, tray.h + 12)} fill="#2a140b" />
      <rect x={tray.x} y={tray.y} width={tray.w} height={tray.h} rx="8" fill="#140a05" stroke="#c9a24a" strokeWidth="1.5" />
      {rows.map((d, i) => {
        const w = (tray.w - 20) / rows.length
        const x = tray.x + 10 + i * w
        const col = SCHEMES[d].base
        const spot = SCHEMES[d].spots[0]
        return (
          <g key={i}>
            <rect x={x + 2} y={tray.y + 5} width={w - 4} height={tray.h - 10} rx="5" fill="#0a0503" />
            <rect x={x + 4} y={tray.y + 7} width={w - 8} height={tray.h - 14} rx="4" fill={col} />
            {Array.from({ length: 9 }, (_, k) => (
              <rect key={k} x={x + 4} y={tray.y + 8 + k * 4} width={w - 8} height="0.8" fill="rgba(0,0,0,.45)" />
            ))}
            <rect x={x + (w - 8) / 2 + 2} y={tray.y + 7} width="4" height={tray.h - 14} fill={spot} opacity="0.85" />
            <rect x={x + 4} y={tray.y + 7} width={w - 8} height={(tray.h - 14) / 2} rx="4" fill="#fff" opacity="0.12" />
          </g>
        )
      })}
    </g>
  )
}

function CupHolders() {
  const spots = [
    { x: 250, y: 760 }, { x: 600, y: 776 }, { x: 1000, y: 776 }, { x: 1350, y: 760 },
    { x: 132, y: 560 }, { x: 1468, y: 560 }, { x: 290, y: 132 }, { x: 1310, y: 132 },
  ]
  return (
    <g>
      {spots.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="17" fill="url(#cup-rim)" />
          <circle cx={p.x} cy={p.y} r="13" fill="url(#cup-hole)" />
        </g>
      ))}
    </g>
  )
}

/** The whole static table. Rendered once; nothing here re-renders during play. */
export const TableArt = memo(function TableArt() {
  const felt = rt(FELT)
  return (
    <svg className="absolute inset-0" width={STAGE.w} height={STAGE.h} viewBox={`0 0 ${STAGE.w} ${STAGE.h}`} aria-hidden>
      <defs>
        <radialGradient id="felt-light" cx="0.5" cy="0.45" r="0.62">
          <stop offset="0" stopColor="#23764d" />
          <stop offset="0.55" stopColor="#175c3a" />
          <stop offset="1" stopColor="#0a3521" />
        </radialGradient>
        <filter id="felt-noise" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7" result="n" />
          <feColorMatrix in="n" values="0 0 0 0 0  0 0 0 0 0.05  0 0 0 0 0.02  0 0 0 0.22 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <filter id="wood-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.003 0.09" numOctaves="4" seed="11" result="g" />
          <feColorMatrix in="g" values="0 0 0 0 0.1  0 0 0 0 0.04  0 0 0 0 0.01  0 0 0 0.55 -0.12" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <linearGradient id="rail-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.2" />
          <stop offset="0.25" stopColor="#fff" stopOpacity="0.04" />
          <stop offset="1" stopColor="#000" stopOpacity="0.25" />
        </linearGradient>
        <pattern id="gold-beads" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="6" cy="6" r="2.6" fill="#f3dc9a" />
          <circle cx="5.2" cy="5.2" r="1" fill="#fffbe8" />
        </pattern>
        <linearGradient id="gold-band" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6e2a0" />
          <stop offset="0.3" stopColor="#b38a37" />
          <stop offset="0.6" stopColor="#f3dc9a" />
          <stop offset="1" stopColor="#8c6a27" />
        </linearGradient>
        <radialGradient id="leather" cx="0.5" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#3a1f16" />
          <stop offset="1" stopColor="#140906" />
        </radialGradient>
        <radialGradient id="cup-hole" cx="0.45" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#050302" />
          <stop offset="1" stopColor="#1a0d06" />
        </radialGradient>
        <linearGradient id="cup-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e9d49a" />
          <stop offset="1" stopColor="#6b5020" />
        </linearGradient>
        <linearGradient id="suit-cloth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#23262e" />
          <stop offset="1" stopColor="#0c0d11" />
        </linearGradient>
        <radialGradient id="skin" cx="0.45" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#e2b594" />
          <stop offset="1" stopColor="#a8765a" />
        </radialGradient>
        <radialGradient id="stamp" cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#f6e2a0" />
          <stop offset="1" stopColor="#9c7429" />
        </radialGradient>
        <clipPath id="felt-clip">
          <path d={felt} />
        </clipPath>
      </defs>

      <Chairs />

      {/* table shadow on the floor */}
      <path d={rt(inset(RAIL, -14))} fill="#000" opacity="0.55" filter="url(#soft-shadow-lg)" transform="translate(0 16)" />

      {/* padded mahogany rail: layered strokes read as a rounded, padded bolster */}
      <path d={rt(RAIL)} fill="#1e0c05" />
      <path d={rt(RAIL_MID)} fill="none" stroke="#2f1308" strokeWidth="72" />
      <path d={rt(RAIL_MID)} fill="none" stroke="#43190b" strokeWidth="54" />
      <path d={rt(RAIL_MID)} fill="none" stroke="#57220f" strokeWidth="34" />
      <path d={rt(inset(RAIL_MID, -4))} fill="none" stroke="#8c4a26" strokeWidth="8" opacity="0.5" filter="url(#blur4)" />
      <path d={rt(RAIL)} fill="#000" filter="url(#wood-grain)" />
      <path d={rt(RAIL)} fill="url(#rail-sheen)" />
      <path d={rt(RAIL)} fill="none" stroke="#130603" strokeWidth="2" />

      <CupHolders />

      {/* gold beaded trim */}
      <path d={rt(TRIM)} fill="url(#gold-band)" />
      <path d={rt(inset(TRIM, 2))} fill="none" stroke="url(#gold-beads)" strokeWidth="7" />
      <path d={rt(TRIM)} fill="none" stroke="#5e4516" strokeWidth="1" />

      {/* felt */}
      <path d={felt} fill="url(#felt-light)" />
      <path d={felt} fill="#fff" filter="url(#felt-noise)" />
      <g clipPath="url(#felt-clip)">
        <path d={felt} fill="none" stroke="#000" strokeOpacity="0.55" strokeWidth="26" filter="url(#blur8)" />
      </g>
      {/* betting line */}
      <path d={rt(inset(FELT, 72))} fill="none" stroke="#d4af5a" strokeOpacity="0.35" strokeWidth="1.5" />
      <path d={rt(inset(FELT, 78))} fill="none" stroke="#d4af5a" strokeOpacity="0.18" strokeWidth="0.8" />

      {/* gold-foil suit stamps */}
      {STAMPS.map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y}) scale(${p.size / 100}) translate(-50 -50)`}>
          <path d={SUIT_PATH[p.s]} fill="#000" opacity="0.35" transform="translate(4 6)" />
          <path d={SUIT_PATH[p.s]} fill="url(#stamp)" opacity="0.55" />
        </g>
      ))}
      <g transform={`translate(${CENTER.x} ${CENTER.y + 150})`} opacity="0.5">
        <text textAnchor="middle" fontFamily="var(--font-display)" fontSize="22" letterSpacing="14" fill="url(#stamp)">
          ♠ ♥ ♦ ♣
        </text>
      </g>

      {/* community card placeholders */}
      {[0, 1, 2, 3, 4].map((i) => {
        const p = boardSlot(i)
        return (
          <rect
            key={i}
            x={p.x - CARD.w / 2}
            y={p.y - CARD.h / 2}
            width={CARD.w}
            height={CARD.h}
            rx="6"
            fill="rgba(0,0,0,.08)"
            stroke="#e9d9a8"
            strokeOpacity="0.28"
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
        )
      })}

      <DealerStation />
    </svg>
  )
})
