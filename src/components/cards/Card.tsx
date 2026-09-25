import { memo } from 'react'
import { AceOfSpades, Court, Pips, RANK_LABEL, Suit, suitColor } from './art'

const RANK_NAME: Record<string, string> = { A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack', T: '10' }
const SUIT_NAME: Record<string, string> = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' }
export const cardName = (code: string) => `${RANK_NAME[code[0]] ?? code[0]} of ${SUIT_NAME[code[1]]}`

/** Card face (250×350 viewBox). */
export const CardFace = memo(function CardFace({ code }: { code: string }) {
  const [rank, s] = code
  const label = RANK_LABEL[rank] ?? rank
  const col = suitColor(s)
  const index = (
    <g>
      <text x="30" y="60" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="800" fontSize={label.length > 1 ? 50 : 60} fill={col} letterSpacing={label.length > 1 ? -4 : 0}>
        {label}
      </text>
      <Suit s={s} x={30} y={90} size={32} />
    </g>
  )
  let body
  if (rank === 'A') body = s === 's' ? <AceOfSpades /> : <Suit s={s} x={125} y={175} size={88} />
  else if ('JQK'.includes(rank)) body = <Court rank={rank} s={s} />
  else body = <Pips rank={rank} s={s} />
  return (
    <svg viewBox="0 0 250 350" width="100%" height="100%" role="img" aria-label={cardName(code)}>
      <rect width="250" height="350" rx="15" fill="url(#card-stock)" />
      <rect width="250" height="350" rx="15" filter="url(#paper)" fill="#fff" />
      <rect x="1" y="1" width="248" height="348" rx="14" fill="none" stroke="#d9d0bd" strokeWidth="2" />
      {index}
      <g transform="rotate(180 125 175)">{index}</g>
      {body}
    </svg>
  )
})

export function CardBack() {
  return (
    <svg viewBox="0 0 250 350" width="100%" height="100%" aria-hidden>
      <use href="#card-back" width="250" height="350" />
    </svg>
  )
}

/**
 * A playing card. Opponent cards have no `code` at all, so their identity is
 * never in the DOM. `faceUp` flips with a real 3D Y rotation.
 */
export function Card({
  code,
  faceUp,
  width,
  highlight,
  dim,
}: {
  code?: string
  faceUp: boolean
  width: number
  highlight?: boolean
  dim?: boolean
}) {
  const height = width * 1.4
  return (
    <div
      className="card3d"
      style={{ width, height, filter: dim ? 'brightness(0.55) saturate(0.7)' : undefined, transition: 'filter 300ms' }}
    >
      <div className="card3d-inner" style={{ transform: `rotateY(${faceUp && code ? 0 : 180}deg)` }}>
        {code && (
          <div className="card3d-face" style={{ borderRadius: width * 0.06, boxShadow: '0 3px 8px rgba(0,0,0,.45)' }}>
            <CardFace code={code} />
          </div>
        )}
        <div className="card3d-face card3d-back" style={{ borderRadius: width * 0.06, boxShadow: '0 3px 8px rgba(0,0,0,.45)' }}>
          <CardBack />
        </div>
      </div>
      {highlight && (
        <div
          className="pointer-events-none absolute"
          style={{
            inset: -3,
            borderRadius: width * 0.08,
            boxShadow: '0 0 0 2px #f3dc9a, 0 0 14px 3px rgba(243,220,154,.7)',
            animation: 'glow-pulse 1.6s ease-in-out infinite',
          }}
        />
      )}
    </div>
  )
}
