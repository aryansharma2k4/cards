/** Suit glyphs drawn in a 100×100 box. */
export const SUIT_PATH: Record<string, string> = {
  // spade: pointed top, full rounded lobes, flared stem
  s: 'M50 3C56 15 70 26 82 37C92 46 96 55 96 63C96 76 86 85 73 85C64 85 57 80 53.5 73C54 83 58 91 67 96H33C42 91 46 83 46.5 73C43 80 36 85 27 85C14 85 4 76 4 63C4 55 8 46 18 37C30 26 44 15 50 3Z',
  // heart: two round lobes meeting in a clean point
  h: 'M50 93C46 88 30 76 18 62C9 52 4 42 4 31C4 17 15 6 29 6C38 6 46 11 50 20C54 11 62 6 71 6C85 6 96 17 96 31C96 42 91 52 82 62C70 76 54 88 50 93Z',
  // diamond: slightly pinched sides
  d: 'M50 2C58 16 72 34 90 50C72 66 58 84 50 98C42 84 28 66 10 50C28 34 42 16 50 2Z',
  // club: three round leaves on a flared stem
  c: 'M50 7A20 20 0 1 1 50 47A20 20 0 1 1 50 7ZM27 36A20 20 0 1 1 27 76A20 20 0 1 1 27 36ZM73 36A20 20 0 1 1 73 76A20 20 0 1 1 73 36ZM41 44H59L63 60L37 60ZM47 56C46.5 74 42 87 32 96H68C58 87 53.5 74 53 56Z',
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
const COLS = [84, 125, 166]
const TOP = 78
const SPAN = 194

export function Pips({ rank, s }: { rank: string; s: string }) {
  return (
    <>
      {PIPS[rank].map(([c, r], i) => (
        <Suit key={i} s={s} x={COLS[c]} y={TOP + r * SPAN} size={rank === 'T' || rank === '9' ? 36 : 40} flip={r > 0.5} />
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
      <text x="125" y="162" textAnchor="middle" fontFamily="var(--font-card)" fontWeight="700" fontSize="54" fill={col}>
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

/** Scroll ornament (right half); mirrored for the left. Coordinates in the 100×100 spade box. */
const ACE_SCROLL =
  'M50 24C55 30 62 36 66 44C70 52 67 60 60 60C55 60 53 55 56 52C58 50 61 51 61 53' +
  'M50 42C57 45 66 52 70 61C73 69 69 76 63 76C58 76 56 72 58 69C60 67 63 68 63 70' +
  'M50 60C54 63 57 67 57 72C57 76 54 78 52 77'

/** Ace of spades: large spade with a stippled centre and white filigree scrollwork. */
export function AceOfSpades() {
  return (
    <g transform="translate(125 176) scale(1.72) translate(-50 -50)">
      <path d={SUIT_PATH.s} fill={INK} />
      {/* stippled inner field */}
      <path d={SUIT_PATH.s} fill="url(#ace-stipple)" transform="translate(50 56) scale(0.7) translate(-50 -56)" />
      <path d={SUIT_PATH.s} fill="none" stroke="#fff" strokeWidth="1.1" transform="translate(50 56) scale(0.7) translate(-50 -56)" />
      <g fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round">
        <path d={ACE_SCROLL} />
        <path d={ACE_SCROLL} transform="translate(100 0) scale(-1 1)" />
      </g>
      {/* centre fleur */}
      <path d="M50 30C46 38 45 46 50 55C55 46 54 38 50 30Z" fill="#fff" />
      <path d="M50 58C47 62 47 66 50 70C53 66 53 62 50 58Z" fill="#fff" />
      <circle cx="50" cy="74" r="1.8" fill="#fff" />
      <path d="M44 81H56" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
    </g>
  )
}

const NAVY = '#1b2d5c'
const CREAM = '#eadcae'

/** One vine scroll (curl + leaves), drawn to the right of the origin; mirror it for symmetry. */
const VINE =
  'M0 0C8 -2 16 -8 22 -16C27 -23 34 -26 40 -22C45 -18 43 -11 37 -11C33 -11 32 -15 35 -17' +
  'M10 -4C14 -12 20 -14 24 -10C20 -9 15 -7 10 -4Z' +
  'M22 -16C24 -8 30 -2 38 0C33 -5 28 -10 22 -16Z' +
  'M44 -20C50 -24 56 -22 58 -16C54 -18 49 -19 44 -20Z'

/** 16-petal flower medallion, centred on 0,0. */
function Medallion() {
  const petal = 'M0 -9C7 -20 7 -36 0 -50C-7 -36 -7 -20 0 -9Z'
  const small = 'M0 -9C5 -16 5 -26 0 -34C-5 -26 -5 -16 0 -9Z'
  return (
    <g>
      <circle r="56" fill={NAVY} stroke={CREAM} strokeWidth="1" />
      <circle r="52" fill="none" stroke={CREAM} strokeWidth="0.5" strokeDasharray="1.5 2.5" />
      {Array.from({ length: 16 }, (_, i) => (
        <g key={i} transform={`rotate(${i * 22.5})`}>
          <path d={petal} fill={NAVY} stroke={CREAM} strokeWidth="1.1" />
          <path d="M0 -12V-44" stroke={CREAM} strokeWidth="0.6" />
        </g>
      ))}
      {Array.from({ length: 16 }, (_, i) => (
        <path key={i} d={small} transform={`rotate(${i * 22.5 + 11.25})`} fill={CREAM} opacity="0.9" />
      ))}
      <circle r="10" fill={NAVY} stroke={CREAM} strokeWidth="1.2" />
      {Array.from({ length: 8 }, (_, i) => (
        <circle key={i} cx={6 * Math.cos((i * Math.PI) / 4)} cy={6 * Math.sin((i * Math.PI) / 4)} r="1.3" fill={CREAM} />
      ))}
      <circle r="2.2" fill={CREAM} />
    </g>
  )
}

/** Mirrored vine pair, centred on 0,0 (grows left and right). */
const VinePair = () => (
  <g fill="none" stroke={CREAM} strokeWidth="1.3" strokeLinecap="round">
    <path d={VINE} />
    <path d={VINE} transform="scale(-1 1)" />
    <circle r="2.4" fill={CREAM} stroke="none" />
  </g>
)

/** Shared SVG definitions for cards (rendered once). */
export function CardDefs() {
  return (
    <>
      <filter id="paper" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
        <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.4  0 0 0 0 0.3  0 0 0 0.05 0" />
        <feComposite in2="SourceGraphic" operator="in" />
      </filter>
      {/* linen finish, like casino card stock */}
      <pattern id="linen" width="3" height="3" patternUnits="userSpaceOnUse">
        <path d="M0 0.5H3M0.5 0V3" stroke="#5a4a30" strokeWidth="0.35" opacity="0.07" />
      </pattern>
      <pattern id="ace-stipple" width="3.2" height="3.2" patternUnits="userSpaceOnUse">
        <rect width="3.2" height="3.2" fill={INK} />
        <circle cx="1.6" cy="1.6" r="0.55" fill="#fff" />
      </pattern>
      <linearGradient id="card-stock" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#f4f1ea" />
      </linearGradient>
      <linearGradient id="gold-foil" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fbe7a6" />
        <stop offset="0.5" stopColor="#d4ac52" />
        <stop offset="1" stopColor="#8f6b26" />
      </linearGradient>
      <clipPath id="court-top">
        <rect x="0" y="0" width="250" height="175" />
      </clipPath>
      {/* damask field: tiny four-petal flowers on a faint diagonal lattice */}
      <pattern id="back-field" width="16" height="16" patternUnits="userSpaceOnUse">
        <rect width="16" height="16" fill={NAVY} />
        <path d="M0 0L16 16M16 0L0 16" stroke={CREAM} strokeWidth="0.35" opacity="0.35" />
        <g transform="translate(8 8)" fill={CREAM} opacity="0.85">
          {[0, 90, 180, 270].map((r) => (
            <path key={r} d="M0 -1C1.2 -2 1.2 -3.4 0 -4.2C-1.2 -3.4 -1.2 -2 0 -1Z" transform={`rotate(${r})`} />
          ))}
          <circle r="0.8" />
        </g>
      </pattern>
      <symbol id="card-back" viewBox="0 0 250 350">
        {/* white card edge */}
        <rect width="250" height="350" rx="15" fill="#f6f3ec" />
        <rect x="10" y="10" width="230" height="330" rx="8" fill="url(#back-field)" />
        <rect x="10" y="10" width="230" height="330" rx="8" fill="none" stroke={NAVY} strokeWidth="2" />
        <rect x="16" y="16" width="218" height="318" rx="5" fill="none" stroke={CREAM} strokeWidth="1.3" />
        <rect x="20" y="20" width="210" height="310" rx="4" fill="none" stroke={CREAM} strokeWidth="0.5" />
        {/* scrolls above and below the medallion, and in the corners */}
        {[
          [125, 96, 0],
          [125, 254, 180],
        ].map(([x, y, r]) => (
          <g key={y} transform={`translate(${x} ${y}) rotate(${r})`}>
            <rect x="-84" y="-40" width="168" height="44" fill={NAVY} opacity="0.92" rx="6" />
            <g transform="scale(1.35)">
              <VinePair />
            </g>
          </g>
        ))}
        {[
          [46, 48, 45],
          [204, 48, 135],
          [204, 302, 225],
          [46, 302, 315],
        ].map(([x, y, r]) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${r}) scale(0.6)`} fill="none" stroke={CREAM} strokeWidth="2" strokeLinecap="round">
            <path d={VINE} />
            <path d={VINE} transform="scale(-1 1)" />
          </g>
        ))}
        <g transform="translate(125 175)">
          <Medallion />
        </g>
      </symbol>
    </>
  )
}
