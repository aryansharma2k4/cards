/** Suit glyphs drawn in a 100×100 box. */
export const SUIT_PATH: Record<string, string> = {
  s: 'M50 4C58 20 96 38 96 62c0 14-11 22-23 22-9 0-16-5-19-11 1 10 5 18 13 23H33c8-5 12-13 13-23-3 6-10 11-19 11C15 84 4 76 4 62 4 38 42 20 50 4z',
  h: 'M50 92C20 68 4 50 4 30 4 15 16 4 30 4c9 0 16 5 20 13C54 9 61 4 70 4c14 0 26 11 26 26 0 20-16 38-46 62z',
  d: 'M50 2C62 20 76 36 92 50 76 64 62 80 50 98 38 80 24 64 8 50 24 36 38 20 50 2z',
  c: 'M50 6a21 21 0 0 1 17 33 21 21 0 1 1-12 37c2 9 6 15 13 20H32c7-5 11-11 13-20a21 21 0 1 1-12-37A21 21 0 0 1 50 6z',
}
export const RED = '#c8102e'
export const INK = '#15110e'
export const suitColor = (s: string) => (s === 'h' || s === 'd' ? RED : INK)
export const RANK_LABEL: Record<string, string> = { T: '10' }

export function Suit({ s, x, y, size, flip = false }: { s: string; x: number; y: number; size: number; flip?: boolean }) {
  const k = size / 100
  return (
    <path
      d={SUIT_PATH[s]}
      fill={suitColor(s)}
      transform={`translate(${x} ${y}) ${flip ? 'rotate(180)' : ''} scale(${k}) translate(-50 -50)`}
    />
  )
}

// Pip centres as [column, row]; columns 0..2, rows 0..1.
const L = 0, M = 1, R = 2
const PIPS: Record<string, [number, number][]> = {
  '2': [[M, 0], [M, 1]],
  '3': [[M, 0], [M, 0.5], [M, 1]],
  '4': [[L, 0], [R, 0], [L, 1], [R, 1]],
  '5': [[L, 0], [R, 0], [M, 0.5], [L, 1], [R, 1]],
  '6': [[L, 0], [R, 0], [L, 0.5], [R, 0.5], [L, 1], [R, 1]],
  '7': [[L, 0], [R, 0], [M, 0.25], [L, 0.5], [R, 0.5], [L, 1], [R, 1]],
  '8': [[L, 0], [R, 0], [M, 0.25], [L, 0.5], [R, 0.5], [M, 0.75], [L, 1], [R, 1]],
  '9': [[L, 0], [R, 0], [L, 1 / 3], [R, 1 / 3], [M, 0.5], [L, 2 / 3], [R, 2 / 3], [L, 1], [R, 1]],
  T: [[L, 0], [R, 0], [M, 1 / 6], [L, 1 / 3], [R, 1 / 3], [L, 2 / 3], [R, 2 / 3], [M, 5 / 6], [L, 1], [R, 1]],
}
const COLS = [78, 125, 172]
const TOP = 72
const SPAN = 206

export function Pips({ rank, s }: { rank: string; s: string }) {
  return (
    <>
      {PIPS[rank].map(([c, r], i) => (
        <Suit key={i} s={s} x={COLS[c]} y={TOP + r * SPAN} size={rank === 'T' || rank === '9' ? 40 : 44} flip={r > 0.5} />
      ))}
    </>
  )
}

/** Stylised court card: framed panel, mirrored crest, serif monogram. */
export function Court({ rank, s }: { rank: string; s: string }) {
  const col = suitColor(s)
  const crest = rank === 'K' ? CROWN : rank === 'Q' ? TIARA : PLUME
  const half = (
    <g>
      <path d={crest} fill="url(#gold-foil)" stroke="#6d5320" strokeWidth="1.2" transform="translate(125 94) scale(0.8)" />
      <text x="125" y="162" textAnchor="middle" fontFamily="var(--font-serif)" fontWeight="700" fontSize="54" fill={col}>
        {rank}
      </text>
      <Suit s={s} x={90} y={126} size={20} />
      <Suit s={s} x={160} y={126} size={20} />
    </g>
  )
  return (
    <g>
      <rect x="62" y="58" width="126" height="234" rx="8" fill="#fbf6e9" stroke={col} strokeWidth="2.2" />
      <rect x="68" y="64" width="114" height="222" rx="6" fill="none" stroke="#c9a24a" strokeWidth="1.2" />
      <path d="M68 175 L182 175" stroke="#c9a24a" strokeWidth="1" strokeDasharray="2 3" />
      <g clipPath="url(#court-top)">{half}</g>
      <g transform="rotate(180 125 175)">
        <g clipPath="url(#court-top)">{half}</g>
      </g>
      <circle cx="125" cy="175" r="9" fill="#fbf6e9" stroke="#c9a24a" strokeWidth="1.2" />
      <Suit s={s} x={125} y={175} size={11} />
    </g>
  )
}
const CROWN = 'M-34 20 L-38 -14 L-20 4 L0 -24 L20 4 L38 -14 L34 20 Z M-34 24 H34 V30 H-34 Z'
const TIARA = 'M-36 22 C-30 0 -16 -14 0 -26 C16 -14 30 0 36 22 C22 12 12 10 0 10 C-12 10 -22 12 -36 22 Z M-4 -34 h8 v8 h-8z'
const PLUME = 'M-30 22 C-26 -6 -6 -24 16 -30 C6 -18 4 -8 10 2 C18 -6 26 -8 34 -6 C22 4 14 14 12 22 Z'

/** Ornate ace of spades with filigree inside the pip. */
export function AceOfSpades() {
  return (
    <g>
      <circle cx="125" cy="175" r="92" fill="none" stroke="#c9a24a" strokeWidth="1.2" />
      <circle cx="125" cy="175" r="86" fill="none" stroke="#c9a24a" strokeWidth="0.6" strokeDasharray="1.5 3" />
      {Array.from({ length: 16 }, (_, i) => (
        <circle key={i} cx={125 + 92 * Math.cos((i * Math.PI) / 8)} cy={175 + 92 * Math.sin((i * Math.PI) / 8)} r="2.4" fill="#c9a24a" />
      ))}
      <g transform="translate(125 172) scale(1.45) translate(-50 -50)">
        <path d={SUIT_PATH.s} fill={INK} />
        <path d={SUIT_PATH.s} fill="none" stroke="#e8d6a0" strokeWidth="1.2" transform="translate(50 52) scale(0.8) translate(-50 -50)" />
        <path
          d="M50 30 C42 42 28 50 30 62 C32 70 42 70 46 64 M50 30 C58 42 72 50 70 62 C68 70 58 70 54 64 M50 44 L50 80"
          fill="none"
          stroke="#e8d6a0"
          strokeWidth="1"
        />
        <circle cx="50" cy="58" r="5" fill="none" stroke="#e8d6a0" strokeWidth="1" />
        <circle cx="50" cy="58" r="1.8" fill="#e8d6a0" />
        {[-1, 1].map((k) => (
          <path key={k} d={`M50 46 q${k * 10} 4 ${k * 8} 14 q${k * -4} 4 ${k * -8} 0`} fill="none" stroke="#e8d6a0" strokeWidth="0.8" />
        ))}
      </g>
    </g>
  )
}

/** Hypotrochoid "spirograph" path, centred on 0,0. */
function rosettePath(R: number, r: number, d: number, steps = 720): string {
  const k = (R - r) / r
  const turns = r / gcd(R, r)
  let out = ''
  for (let i = 0; i <= steps * turns; i++) {
    const t = (i / steps) * Math.PI * 2
    const x = (R - r) * Math.cos(t) + d * Math.cos(k * t)
    const y = (R - r) * Math.sin(t) - d * Math.sin(k * t)
    out += `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`
  }
  return out
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
const ROSETTE_A = rosettePath(50, 15, 22, 240)
const ROSETTE_B = rosettePath(40, 12, 14, 240)

/** Shared SVG definitions for cards (rendered once). */
export function CardDefs() {
  return (
    <>
      <filter id="paper" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
        <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.4  0 0 0 0 0.3  0 0 0 0.06 0" />
        <feComposite in2="SourceGraphic" operator="in" />
      </filter>
      <linearGradient id="card-stock" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stopColor="#fffdf8" />
        <stop offset="1" stopColor="#f1ebdc" />
      </linearGradient>
      <linearGradient id="gold-foil" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fbe7a6" />
        <stop offset="0.5" stopColor="#d4ac52" />
        <stop offset="1" stopColor="#8f6b26" />
      </linearGradient>
      <clipPath id="court-top">
        <rect x="0" y="0" width="250" height="175" />
      </clipPath>
      <pattern id="back-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="#dfe6f5" strokeWidth="0.9" opacity="0.55" />
      </pattern>
      <pattern id="back-lattice" width="14" height="14" patternUnits="userSpaceOnUse">
        <path d="M0 7 L7 0 L14 7 L7 14 Z" fill="none" stroke="#c7d2ea" strokeWidth="0.5" opacity="0.28" />
      </pattern>
      <symbol id="rosette" viewBox="-70 -70 140 140" overflow="visible">
        <circle r="64" fill="none" stroke="#e6ecf8" strokeWidth="0.8" />
        <circle r="60" fill="none" stroke="#e6ecf8" strokeWidth="0.4" />
        <path d={ROSETTE_A} fill="none" stroke="#f2f5fb" strokeWidth="0.55" />
        <path d={ROSETTE_B} fill="none" stroke="#b9c6e2" strokeWidth="0.45" transform="rotate(9)" />
        <circle r="7" fill="none" stroke="#f2f5fb" strokeWidth="0.8" />
      </symbol>
      <symbol id="card-back" viewBox="0 0 250 350">
        <rect width="250" height="350" rx="15" fill="#1b2a4a" />
        <rect x="10" y="10" width="230" height="330" rx="9" fill="none" stroke="#eef2fa" strokeWidth="2" />
        <rect x="15" y="15" width="220" height="320" rx="6" fill="url(#back-hatch)" />
        <rect x="30" y="30" width="190" height="290" rx="4" fill="#1b2a4a" stroke="#eef2fa" strokeWidth="1.2" />
        <rect x="34" y="34" width="182" height="282" rx="3" fill="url(#back-lattice)" stroke="#eef2fa" strokeWidth="0.5" />
        {[88, 175, 262].map((y) => (
          <use key={y} href="#rosette" x={125 - 50} y={y - 50} width="100" height="100" />
        ))}
        {[131, 219].map((y) => (
          <g key={y} transform={`translate(125 ${y})`}>
            <path d="M-6 0 L0 -4 L6 0 L0 4 Z" fill="#eef2fa" opacity="0.8" />
          </g>
        ))}
      </symbol>
    </>
  )
}
