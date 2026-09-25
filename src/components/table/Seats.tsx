import { MOBILE } from '../../ui/device'
import { memo } from 'react'
import { useGame, type SeatView } from '../../game/store'
import { formatMoney } from '../../engine/chips'
import { BURN, CARD, DECK, HERO, HERO_CARD, MUCK, OPP_CARD, POT, SEATS, betSpot, boardSlot, buttonSpot, holeCardPos } from '../../ui/geometry'
import { Card, CardBack } from '../cards/Card'
import { SUIT_PATH } from '../cards/art'
import { ChipPile } from '../chips/ChipPile'

const at = (x: number, y: number) => ({ left: x, top: y }) as const

const STATUS_STYLE: Record<string, string> = {
  Fold: 'bg-[#2b2b2e]/90 text-[#b9b4a8] ring-white/10',
  Check: 'bg-[#1f3b5e]/90 text-[#dbe8ff] ring-[#9fc0ff]/30',
  Call: 'bg-[#1b5a37]/90 text-[#dcffe9] ring-[#8fe0b0]/30',
  'All-in': 'bg-[linear-gradient(180deg,#b3172d,#6e0b18)] text-white ring-[#ff9aa8]/50',
  Winner: 'bg-[linear-gradient(180deg,#fbe7a6,#c9a24a)] text-[#241808] ring-[#fff3c4]/70',
}
const statusStyle = (s: string) =>
  STATUS_STYLE[s] ??
  (s.startsWith('Bet') || s.startsWith('Raise')
    ? 'bg-[linear-gradient(180deg,#e39a2e,#9a5a12)] text-[#fff6e6] ring-[#ffd89a]/40'
    : 'bg-black/70 text-[#e9dcb8] ring-[#d4af5a]/30')

function Avatar({ seat, v }: { seat: number; v: SeatView }) {
  const r = 38
  const len = 2 * Math.PI * (r + 4)
  const { hue, initials, motif } = v.avatar
  return (
    <div className="relative" style={{ width: 2 * r, height: 2 * r }}>
      <svg width={2 * r} height={2 * r} viewBox={`0 0 ${2 * r} ${2 * r}`} className="overflow-visible" aria-hidden>
        <defs>
          <radialGradient id={`av-${seat}`} cx="0.4" cy="0.3" r="0.9">
            <stop offset="0" stopColor={`hsl(${hue} 42% 38%)`} />
            <stop offset="1" stopColor={`hsl(${hue} 45% 12%)`} />
          </radialGradient>
        </defs>
        {v.winner && <circle cx={r} cy={r} r={r + 10} fill="rgba(243,220,154,.35)" filter="url(#blur8)" />}
        <circle cx={r} cy={r} r={r} fill={`url(#av-${seat})`} />
        <path
          d={SUIT_PATH[motif]}
          transform={`translate(${r + 6} ${r - 30}) scale(0.34)`}
          fill="#fff"
          opacity="0.07"
        />
        <circle cx={r} cy={r} r={r - 1.5} fill="none" stroke="url(#gold-foil)" strokeWidth="3" />
        <circle cx={r} cy={r} r={r - 5} fill="none" stroke="#d4af5a" strokeOpacity="0.35" strokeWidth="1" />
        <text
          x={r}
          y={r + 9}
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontWeight="700"
          fontSize="26"
          fill="#f6e6b4"
        >
          {initials}
        </text>
        {v.thinking && (
          <g key={v.thinking.key} transform={`rotate(-90 ${r} ${r})`}>
            <circle cx={r} cy={r} r={r + 4} fill="none" stroke="rgba(0,0,0,.45)" strokeWidth="4" />
            <circle
              cx={r}
              cy={r}
              r={r + 4}
              fill="none"
              stroke="#f3dc9a"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={len}
              style={{
                ['--ring-len' as string]: `${len}`,
                animation: `ring-drain ${v.thinking.ms}ms linear forwards`,
                filter: 'drop-shadow(0 0 4px rgba(243,220,154,.8))',
              }}
            />
          </g>
        )}
      </svg>
    </div>
  )
}

const Seat = memo(function Seat({ seat, v, isHero }: { seat: number; v: SeatView; isHero: boolean }) {
  const p = SEATS[seat]
  const dim = v.folded || v.sittingOut
  return (
    <div
      className="absolute transition-opacity duration-500"
      style={{ ...at(p.x, p.y), opacity: v.sittingOut ? 0 : 1, zIndex: 20 }}
      aria-label={`${v.name}, ${formatMoney(v.stack)}${v.status ? `, ${v.status}` : ''}`}
      title={v.personality ? `${v.name} · ${v.personality.label}` : undefined}
    >
      <div className="flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
        {!isHero && (
          <div className={`transition duration-300 ${dim ? 'opacity-45 saturate-50' : ''}`}>
            <Avatar seat={seat} v={v} />
          </div>
        )}
        <div
          className={`relative z-10 ${MOBILE ? 'min-w-[190px]' : 'min-w-[140px]'} rounded-xl border px-3 py-1 text-center shadow-[0_8px_20px_-6px_rgba(0,0,0,.9)] ${
            isHero ? '' : '-mt-3'
          } ${v.winner ? 'border-[#f3dc9a] bg-[linear-gradient(180deg,#3a2a10,#1a1206)]' : 'border-[#d4af5a]/45 bg-[linear-gradient(180deg,#1b1511,#0c0907)]'} ${dim ? 'opacity-60' : ''}`}
        >
          <div className={`truncate ${MOBILE ? 'text-[22px]' : 'text-[15px]'} font-semibold tracking-wide text-[#e9dcb8]`}>{v.name}</div>
          <div className={`font-display ${MOBILE ? 'text-[32px]' : 'text-[22px]'} font-bold tabular-nums leading-tight text-[#f6e6b4]`}>
            {v.allIn && v.stack === 0 ? 'ALL-IN' : formatMoney(v.stack)}
          </div>
        </div>
      </div>
      {v.status && (
        <div
          key={v.status}
          className={`absolute left-0 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-0.5 ${MOBILE ? 'text-[19px]' : 'text-[13px]'} font-bold uppercase tracking-wider ring-1 ${statusStyle(v.status)}`}
          style={{ top: isHero ? -64 : -96, animation: 'pop-in .22s ease-out', zIndex: 30 }}
        >
          {v.status}
        </div>
      )}
    </div>
  )
})

function HoleCards({ seat, v, isHero }: { seat: number; v: SeatView; isHero: boolean }) {
  const w = isHero ? HERO_CARD.w : OPP_CARD.w
  return (
    <>
      {v.cards.map((c, i) => {
        const p = holeCardPos(seat, i)
        return (
          <div
            key={c.id}
            className={`group absolute ${isHero ? 'pointer-events-auto' : ''}`}
            style={{ ...at(p.x - w / 2, p.y - (w * 1.4) / 2), zIndex: isHero ? 25 : 15 }}
          >
            <div
              className={isHero ? 'transition-transform duration-200 ease-out group-hover:-translate-y-4' : ''}
              style={{ transform: `rotate(${p.rot}deg)` }}
            >
              <Card code={c.code} faceUp={c.faceUp} width={w} highlight={c.highlight} />
            </div>
          </div>
        )
      })}
      {v.handLabel && v.cards.length > 0 && (
        <div
          className={`absolute -translate-x-1/2 whitespace-nowrap rounded-md bg-black/75 px-2 py-0.5 ${MOBILE ? 'text-[20px]' : 'text-[14px]'} font-semibold text-[#f6e6b4] ring-1 ring-[#d4af5a]/40`}
          style={{ ...at((holeCardPos(seat, 0).x + holeCardPos(seat, 1).x) / 2, holeCardPos(seat, 0).y + (w * 1.4) / 2 + 4), zIndex: 26, animation: 'pop-in .25s ease-out' }}
        >
          {v.handLabel}
        </div>
      )}
    </>
  )
}

export function Seats() {
  const seats = useGame((s) => s.seats)
  return (
    <>
      {seats.map((v, i) =>
        v ? (
          <div key={i}>
            <HoleCards seat={i} v={v} isHero={i === HERO} />
            <div className="absolute" style={{ ...at(betSpot(i).x, betSpot(i).y), zIndex: 18 }}>
              <ChipPile amount={v.bet} />
            </div>
            <Seat seat={i} v={v} isHero={i === HERO} />
          </div>
        ) : null,
      )}
    </>
  )
}

export function DealerButton() {
  const button = useGame((s) => s.button)
  const handNo = useGame((s) => s.handNo)
  if (!handNo) return null
  const p = buttonSpot(button)
  return (
    <div
      className="absolute left-0 top-0"
      style={{ transform: `translate(${p.x - 20}px, ${p.y - 20}px)`, transition: 'transform 700ms cubic-bezier(.3,.8,.25,1)', zIndex: 19 }}
      aria-label="Dealer button"
    >
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="22" r="18" fill="rgba(0,0,0,.45)" filter="url(#soft-shadow)" />
        <circle cx="20" cy="20" r="18" fill="#f8f4ea" />
        <circle cx="20" cy="20" r="18" fill="url(#chip-gloss)" />
        <circle cx="20" cy="20" r="14.5" fill="none" stroke="#c9a24a" strokeWidth="1.4" />
        <text x="20" y="26.5" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="800" fontSize="18" fill="#15110e">
          D
        </text>
      </svg>
    </div>
  )
}

export function Board() {
  const board = useGame((s) => s.board)
  const burned = useGame((s) => s.burned)
  const pot = useGame((s) => s.pot)
  const mucked = useGame((s) => s.seats.reduce((a, v) => a + (v?.folded ? 2 : 0), 0))
  return (
    <>
      {/* deck by the dealer */}
      <div className="absolute" style={{ ...at(DECK.x - 26, DECK.y - 30), zIndex: 12 }}>
        {[0, 1, 2].map((k) => (
          <div key={k} className="absolute" style={{ left: k * 0.8, top: -k * 1.2, width: 52, height: 72 }}>
            <CardBack />
          </div>
        ))}
      </div>
      {/* burn & muck piles */}
      {[
        { n: burned, p: BURN, seed: 3 },
        { n: Math.min(mucked, 8), p: MUCK, seed: 7 },
      ].map(({ n, p, seed }, j) => (
        <div key={j} className="absolute" style={{ ...at(p.x, p.y), zIndex: 12 }} aria-hidden>
          {Array.from({ length: n }, (_, k) => (
            <div
              key={k}
              className="absolute"
              style={{
                width: CARD.w * 0.62,
                height: CARD.w * 0.62 * 1.4,
                transform: `translate(-50%,-50%) rotate(${((k * 37 + seed * 11) % 40) - 20}deg) translate(${((k * 13) % 7) - 3}px, ${-k}px)`,
              }}
            >
              <CardBack />
            </div>
          ))}
        </div>
      ))}
      {board.map((c, i) => {
        const p = boardSlot(i)
        return (
          <div key={c.id} className="absolute" style={{ ...at(p.x - CARD.w / 2, p.y - CARD.h / 2), zIndex: 14 }}>
            <Card code={c.code} faceUp={c.faceUp} width={CARD.w} highlight={c.highlight} />
          </div>
        )
      })}
      <div className="absolute" style={{ ...at(POT.x, POT.y), zIndex: 16 }} aria-live="polite">
        {pot > 0 && <ChipPile amount={pot} width={38} />}
      </div>
    </>
  )
}

export function Banner() {
  const banner = useGame((s) => s.banner)
  if (!banner) return null
  return (
    <div
      className="absolute left-1/2 top-[228px] z-[45] min-w-[340px] rounded-2xl border border-[#f3dc9a]/70 bg-[linear-gradient(180deg,rgba(40,28,10,.95),rgba(14,10,5,.95))] px-8 py-3 text-center shadow-[0_20px_60px_-10px_rgba(0,0,0,.9),0_0_40px_-10px_rgba(243,220,154,.5)]"
      style={{ animation: 'banner-in .45s cubic-bezier(.2,.9,.3,1.2) forwards' }}
      role="status"
    >
      <div className={`gold-text font-display ${MOBILE ? 'text-[40px]' : 'text-[28px]'} font-bold leading-tight`}>{banner.title}</div>
      {banner.detail && <div className={`mt-0.5 ${MOBILE ? 'text-[22px]' : 'text-[15px]'} font-semibold text-[#efe6cf]`}>{banner.detail}</div>}
    </div>
  )
}
