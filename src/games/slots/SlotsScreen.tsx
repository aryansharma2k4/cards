import { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Stage } from '../../components/table/Stage'
import { useGame } from '../../game/store'
import { formatMoney } from '../../engine/chips'
import { play } from '../../audio/sound'
import { MOBILE } from '../../ui/device'
import { CasinoHud } from '../CasinoUi'
import { LIMITS, logRound, moveChips } from '../casino'
import { LINES, PAYS, REELS, ROWS, STRIPS, SYMBOLS, spin, type LineWin, type Sym } from './machine'
import { SymbolIcon, symHref } from './Symbols'

// ---- geometry (stage units) ----
const W = 1600
const H = MOBILE ? 820 : 900
const CX = W / 2
const CAB = { x: 440, w: 720 }
const MARQ = { y: MOBILE ? 22 : 34, h: MOBILE ? 92 : 112 }
const BODY_Y = MARQ.y + MARQ.h + 8
const TOP = { y: BODY_Y + 16, h: MOBILE ? 62 : 80 }
const CW = 118 // reel width
const CH = MOBILE ? 98 : 110 // symbol height
const GAP = 16
const REEL_W = REELS * CW + (REELS - 1) * GAP
const RX = CX - REEL_W / 2
const RY = TOP.y + TOP.h + (MOBILE ? 38 : 42)
const METER_Y = RY + ROWS * CH + (MOBILE ? 22 : 30)
const DECK_Y = METER_Y + (MOBILE ? 60 : 68)
const reelX = (r: number) => RX + r * (CW + GAP)
/** Bounds of the separately-painted layers (reel window with line tabs; marquee bulbs). */
const REEL_BOX = { x: RX - 26, y: RY - 8, w: REEL_W + 52, h: ROWS * CH + 16 }
const MARQ_BOX = { x: CAB.x + 40, y: MARQ.y, w: CAB.w - 80, h: MARQ.h }

const LINE_BETS = [1, 2, 5, 10, 25, 50, 100, 250, 500]
const LINE_COLORS = ['#ffd84a', '#ff5a5a', '#4ade80', '#5ab4ff', '#ff8af0', '#ffa94a', '#a78bfa', '#2ee6d6', '#f472b6', '#c3f25a']
const L = STRIPS[0].length
const mod = (a: number, m: number) => ((a % m) + m) % m

// ---- reels: each reel only ever draws four cells; a rAF loop scrolls them ----

interface ReelHandle {
  pos: number[]
  cols: (HTMLDivElement | null)[]
}

/** Slide a reel's strip so row 0 shows strip index `pos` (the strip repeats its first rows at the end). */
function drawReel(h: ReelHandle, r: number) {
  const el = h.cols[r]
  if (!el) return
  // no blur filter on purpose: filters on these tall layers are costly for phone GPUs
  el.style.transform = `translate3d(0, ${(-mod(h.pos[r], L) * CH).toFixed(1)}px, 0)`
}

/** Plan of one reel's spin: a small kick up, a fast roll down, a stop with a little bounce. */
function reelMotion(p0: number, stop: number, reel: number) {
  const loops = 2 + reel
  // roll down (index decreases) to land with `stop` in the top row
  const d = loops * L + mod(p0 - stop, L)
  const p1 = p0 - d
  const kick = 0.14
  const T = 1.05 + reel * 0.32 // seconds of rolling; reels stop left to right
  const bounce = 0.28
  return {
    end: kick + T + bounce,
    landAt: kick + T,
    at(t: number) {
      if (t < kick) return p0 + 0.18 * Math.sin((Math.PI * t) / kick)
      const u = Math.min(1, (t - kick) / T)
      if (u < 1) return p0 - d * (1 - (1 - u) ** 2.2)
      const b = Math.min(1, (t - kick - T) / bounce)
      return p1 - 0.22 * Math.sin(Math.PI * b) * (1 - b)
    },
    p1,
  }
}

// ---- static artwork ----

/** Marquee bulbs, one parity at a time; each parity is its own layer and the two layers flash in turn. */
const Bulbs = memo(function Bulbs({ parity }: { parity: 0 | 1 }) {
  const [x, y, w, h, gap] = [CAB.x + 48, MARQ.y + 5, CAB.w - 96, MARQ.h - 10, 22]
  const pts: [number, number][] = []
  for (let i = 0; i <= w / gap; i++) pts.push([x + i * gap, y], [x + i * gap, y + h])
  for (let j = 1; j < h / gap; j++) pts.push([x, y + j * gap], [x + w, y + j * gap])
  return (
    <svg
      className={`absolute ${parity ? 'bulbs-a' : 'bulbs-b'}`}
      style={{ left: MARQ_BOX.x, top: MARQ_BOX.y }}
      width={MARQ_BOX.w}
      height={MARQ_BOX.h}
      viewBox={`${MARQ_BOX.x} ${MARQ_BOX.y} ${MARQ_BOX.w} ${MARQ_BOX.h}`}
      aria-hidden
    >
      {pts.map(([bx, by], i) => i % 2 === parity && <circle key={i} cx={bx} cy={by} r="5" fill="#fff6c8" stroke="#b88a2a" strokeWidth="1.5" />)}
    </svg>
  )
})

function Cabinet() {
  const bodyH = H - BODY_Y - 6
  return (
    <svg className="absolute inset-0" width={W} height={H} aria-hidden>
      <defs>
        <linearGradient id="cab-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3a0c73" />
          <stop offset="0.5" stopColor="#6420b8" />
          <stop offset="1" stopColor="#3a0c73" />
        </linearGradient>
        <linearGradient id="cab-marq" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8b3ee6" />
          <stop offset="1" stopColor="#4a1290" />
        </linearGradient>
        <linearGradient id="cab-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1b0" />
          <stop offset="0.5" stopColor="#d9a53c" />
          <stop offset="1" stopColor="#8a5a12" />
        </linearGradient>
        <linearGradient id="cab-gold-h" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8a5a12" />
          <stop offset="0.5" stopColor="#ffe9a0" />
          <stop offset="1" stopColor="#8a5a12" />
        </linearGradient>
        <linearGradient id="cab-enamel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0d2a8a" />
          <stop offset="0.5" stopColor="#2f63e0" />
          <stop offset="1" stopColor="#0d2a8a" />
        </linearGradient>
        <linearGradient id="cab-enamel-v" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d2a8a" />
          <stop offset="0.5" stopColor="#3a6ff0" />
          <stop offset="1" stopColor="#0d2a8a" />
        </linearGradient>
        <linearGradient id="cab-deck" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a0a52" />
          <stop offset="1" stopColor="#12042a" />
        </linearGradient>
        <pattern id="bulb-dots" width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="4.5" cy="4.5" r="2.3" fill="#fffbe0" />
        </pattern>
      </defs>

      {/* candle */}
      <g transform={`translate(${CX - 16} ${MARQ.y - 34})`}>
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} y={8 + i * 7} width="32" height="7" fill={i % 2 ? '#fff' : '#d8141f'} />
        ))}
        <path d="M0 8Q16 -6 32 8Z" fill="#ff4d4d" className="candle-glow" />
        <rect y="36" width="32" height="4" fill="url(#cab-gold)" />
      </g>

      {/* marquee */}
      <rect x={CAB.x + 30} y={MARQ.y} width={CAB.w - 60} height={MARQ.h} rx="22" fill="url(#cab-gold)" />
      <rect x={CAB.x + 40} y={MARQ.y + 10} width={CAB.w - 80} height={MARQ.h - 20} rx="16" fill="url(#cab-marq)" />
      <g fontFamily="var(--font-display)" fontWeight="900" fontSize={MOBILE ? 62 : 76} textAnchor="middle" letterSpacing="4">
        <text x={CX} y={MARQ.y + MARQ.h / 2 + (MOBILE ? 22 : 27)} fill="#5a3408" transform="translate(3 4)">
          JACKPOT
        </text>
        <text x={CX} y={MARQ.y + MARQ.h / 2 + (MOBILE ? 22 : 27)} fill="url(#cab-gold)" stroke="#7a4a0a" strokeWidth="2">
          JACKPOT
        </text>
        <text x={CX} y={MARQ.y + MARQ.h / 2 + (MOBILE ? 22 : 27)} fill="url(#bulb-dots)" opacity="0.85">
          JACKPOT
        </text>
      </g>

      {/* body with neon edge */}
      <rect x={CAB.x} y={BODY_Y} width={CAB.w} height={bodyH} rx="30" fill="url(#cab-body)" stroke="#e6c2ff" strokeWidth="4" />
      <rect x={CAB.x + 14} y={BODY_Y + 8} width={CAB.w - 28} height={bodyH - 16} rx="22" fill="none" stroke="#9a5cf0" strokeOpacity=".5" strokeWidth="2" />

      {/* top screen */}
      <rect x={CAB.x + 34} y={TOP.y} width={CAB.w - 68} height={TOP.h} rx="12" fill="#0b0624" stroke="url(#cab-gold)" strokeWidth="3" />
      <path d={`M${CAB.x + 60} ${TOP.y + TOP.h / 2}h40M${CAB.x + CAB.w - 100} ${TOP.y + TOP.h / 2}h40`} stroke="url(#cab-gold-h)" strokeWidth="3" />

      {/* reel bezel: gold frame, blue enamel bands with gold chevrons (like the drum reel) */}
      <rect x={RX - 34} y={RY - 30} width={REEL_W + 68} height={ROWS * CH + 60} rx="18" fill="url(#cab-gold)" />
      <rect x={RX - 26} y={RY - 22} width={REEL_W + 52} height={ROWS * CH + 44} rx="12" fill="url(#cab-enamel-v)" />
      {[RY - 22, RY + ROWS * CH + 6].map((y) => (
        <g key={y}>
          <rect x={RX - 26} y={y} width={REEL_W + 52} height="16" fill="url(#cab-enamel)" />
          {Array.from({ length: Math.floor((REEL_W + 40) / 28) }, (_, i) => (
            <path key={i} d={`M${RX - 20 + i * 28} ${y + 13}l14 -10l14 10`} fill="none" stroke="url(#cab-gold)" strokeWidth="2.5" />
          ))}
          <path d={`M${RX - 26} ${y}h${REEL_W + 52}M${RX - 26} ${y + 16}h${REEL_W + 52}`} stroke="url(#cab-gold-h)" strokeWidth="2" />
        </g>
      ))}
      {/* dividers between reels, with a gold arrow ornament */}
      {Array.from({ length: REELS + 1 }, (_, i) => {
        const x = i === 0 ? RX - 26 : i === REELS ? RX + REEL_W : reelX(i) - GAP
        const w = i === 0 || i === REELS ? 26 : GAP
        const cy = RY + (ROWS * CH) / 2
        return (
          <g key={i}>
            <rect x={x} y={RY - 6} width={w} height={ROWS * CH + 12} fill="url(#cab-enamel)" />
            <path d={`M${x} ${RY - 6}v${ROWS * CH + 12}M${x + w} ${RY - 6}v${ROWS * CH + 12}`} stroke="url(#cab-gold)" strokeWidth="2.5" />
            <path d={`M${x + w / 2} ${cy - 22}l${w / 2 - 2} 22l${-(w / 2 - 2)} 22l${-(w / 2 - 2)} -22z`} fill="url(#cab-gold)" />
            <path d={`M${x + w / 2} ${RY + 8}v20M${x + w / 2} ${RY + ROWS * CH - 28}v20`} stroke="url(#cab-gold)" strokeWidth="2" />
          </g>
        )
      })}

      {/* meter strip */}
      <rect x={CAB.x + 34} y={METER_Y - 8} width={CAB.w - 68} height="56" rx="10" fill="#0b0624" stroke="url(#cab-gold)" strokeWidth="2" />

      {/* button deck */}
      <path
        d={`M${CAB.x + 10} ${DECK_Y}H${CAB.x + CAB.w - 10}L${CAB.x + CAB.w + 14} ${DECK_Y + 84}H${CAB.x - 14}Z`}
        fill="url(#cab-deck)"
        stroke="url(#cab-gold-h)"
        strokeWidth="3"
      />

      {/* belly panel + coin tray */}
      <rect x={CAB.x + 110} y={DECK_Y + 100} width={CAB.w - 220} height={Math.max(20, H - DECK_Y - 130)} rx="14" fill="#2a0a52" stroke="url(#cab-gold)" strokeWidth="3" />
      <text
        x={CX}
        y={DECK_Y + 100 + Math.max(20, H - DECK_Y - 130) / 2 + 9}
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontWeight="900"
        fontSize="26"
        letterSpacing="8"
        fill="url(#cab-gold)"
      >
        LUCKY 7s
      </text>
    </svg>
  )
}

/** Every reel's full strip, rendered once; spins only move them (see drawReel). */
const ReelColumns = memo(function ReelColumns({ handle }: { handle: ReelHandle }) {
  return (
    <>
      {/* each reel is its whole strip (plus a repeat of the first rows) sliding under a window: GPU transform only */}
      {STRIPS.map((strip, r) => (
        <div key={r} className="pointer-events-none absolute overflow-hidden" style={{ left: reelX(r), top: RY, width: CW, height: ROWS * CH }}>
          <div
            ref={(el) => {
              handle.cols[r] = el
            }}
            style={{ willChange: 'transform' }}
          >
            <svg width={CW} height={(L + ROWS) * CH} aria-hidden>
              {[...strip, ...strip.slice(0, ROWS)].map((sym, k) => (
                <use key={k} href={symHref(sym)} x={(CW - (CH - 14)) / 2} y={k * CH + 7} width={CH - 14} height={CH - 14} />
              ))}
            </svg>
          </div>
        </div>
      ))}
    </>
  )
})

const LEVER_H = ROWS * CH + 40
const PIVOT = LEVER_H * 0.55 + 35
/** The side lever. Pulling is a one-off CSS animation, so it never re-renders the machine. */
const Lever = memo(
  forwardRef<{ pull(): void }, { disabled: boolean; onPull: () => void }>(function Lever({ disabled, onPull }, ref) {
    const rod = useRef<SVGGElement>(null)
    const knob = useRef<SVGGElement>(null)
    useImperativeHandle(ref, () => ({
      pull() {
        const timing = { duration: 700, easing: 'ease-in-out' }
        rod.current?.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(-0.55)', offset: 0.35 }, { transform: 'scaleY(1)' }], timing)
        knob.current?.animate(
          [
            { transform: 'none' },
            {
              transform: `translateY(${LEVER_H * 0.55 * 1.55 - 20}px)`,
              offset: 0.35,
            },
            { transform: 'none' },
          ],
          timing,
        )
      },
    }))
    return (
      <button
        className="absolute"
        style={{
          left: CAB.x + CAB.w - 4,
          top: RY - 70,
          width: 70,
          height: ROWS * CH + 40,
        }}
        aria-label="Pull the lever"
        disabled={disabled}
        onClick={onPull}
      >
        <svg width="70" height={ROWS * CH + 40} overflow="visible" aria-hidden>
          <defs>
            <radialGradient id="knob" cx="0.35" cy="0.3" r="0.75">
              <stop offset="0" stopColor="#ffb0a8" />
              <stop offset="0.45" stopColor="#e3121f" />
              <stop offset="1" stopColor="#6a0008" />
            </radialGradient>
          </defs>
          {/* housing */}
          <rect x="4" y={(ROWS * CH + 40) * 0.55} width="26" height="70" rx="10" fill="url(#cab-gold)" stroke="#7a4a0a" />
          <g ref={rod} style={{ transformOrigin: `22px ${PIVOT}px` }}>
            <rect x="18" y="22" width="9" height={(ROWS * CH + 40) * 0.55 + 14} rx="4" fill="url(#cab-gold-h)" stroke="#7a4a0a" strokeWidth="1" />
          </g>
          <g ref={knob}>
            <circle cx="22" cy="20" r="18" fill="url(#knob)" stroke="#5a0008" strokeWidth="1.5" />
            <ellipse cx="15" cy="12" rx="6" ry="4" fill="#fff" opacity=".6" />
          </g>
        </svg>
      </button>
    )
  }),
)

const LinesGuide = memo(function LinesGuide() {
  return (
    <div className="absolute rounded-2xl border border-[#c77dff]/40 bg-black/40 p-4" style={{ left: 60, top: BODY_Y + 10, width: 330 }}>
      <div className="mb-2 font-display text-[16px] font-extrabold uppercase tracking-[0.25em] text-[#e2b44a]">10 lines</div>
      <div className="grid grid-cols-2 gap-2">
        {LINES.map((rows, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 text-right font-display text-[13px] font-extrabold" style={{ color: LINE_COLORS[i] }}>
              {i + 1}
            </span>
            <svg width="110" height="34" viewBox="0 0 110 34" aria-label={`Line ${i + 1}`}>
              {rows.map((_, r) =>
                [0, 1, 2].map((row) => (
                  <rect key={`${r}${row}`} x={r * 22 + 1} y={row * 11 + 1} width="20" height="9" rx="2" fill={rows[r] === row ? LINE_COLORS[i] : 'rgba(255,255,255,.1)'} />
                )),
              )}
            </svg>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[13px] leading-snug text-[#d8ccf0]">Wins pay left to right from the first reel. Every line pays; all 10 are always on.</p>
    </div>
  )
})

const PayTable = memo(function PayTable({ lineBet }: { lineBet: number }) {
  return (
    <div className="absolute rounded-2xl border border-[#c77dff]/40 bg-black/40 px-4 py-3" style={{ left: W - 372, top: BODY_Y + 60, width: 330 }}>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-display text-[16px] font-extrabold uppercase tracking-[0.25em] text-[#e2b44a]">Pays</span>
        <span className="text-[12px] text-[#bfb0dc]">×3 · ×4 · ×5 at {formatMoney(lineBet)}/line</span>
      </div>
      {SYMBOLS.map((s: Sym) => (
        <div key={s} className="flex items-center gap-2 border-t border-white/5 py-[3px]">
          <SymbolIcon sym={s} size={MOBILE ? 34 : 40} />
          <div className="grid flex-1 grid-cols-3 text-right font-display text-[15px] font-bold tabular-nums text-[#f6e6b4]">
            {PAYS[s].slice(1).map((p, k) => (
              <span key={k}>{formatMoney(p * lineBet)}</span>
            ))}
          </div>
        </div>
      ))}
      <div className="mt-1 text-[12px] text-[#bfb0dc]">Two cherries pay {formatMoney(PAYS.cherry[0] * lineBet)}</div>
    </div>
  )
})

// ---- screen ----

type Phase = 'idle' | 'spinning' | 'won'

export function SlotsScreen() {
  const stack = useGame((s) => s.casino?.stack ?? 0)
  const [lineBet, setLineBet] = useState(() => LINE_BETS.filter((b) => b * LINES.length <= Math.max(10, stack / 20)).at(-1) ?? 1)
  const [phase, setPhase] = useState<Phase>('idle')
  const [wins, setWins] = useState<LineWin[]>([])
  const [win, setWin] = useState(0)
  const [shownWin, setShownWin] = useState(0)
  const lever = useRef<{ pull(): void }>(null)
  const [big, setBig] = useState(false)
  const reels = useRef<ReelHandle>({
    pos: STRIPS.map((_, r) => (r * 7) % L),
    cols: [],
  })
  const total = lineBet * LINES.length
  const affordable = LINE_BETS.filter((b) => b * LINES.length <= Math.min(stack, LIMITS.slots.max))
  const spinning = phase === 'spinning'

  useEffect(() => {
    STRIPS.forEach((_, r) => drawReel(reels.current, r))
  }, [])

  // count the win meter up
  useEffect(() => {
    if (shownWin >= win) return
    const t0 = performance.now()
    const from = shownWin
    let raf = 0
    const tick = (now: number) => {
      const u = Math.min(1, (now - t0) / Math.min(2200, 500 + win * 0.4))
      setShownWin(Math.round(from + (win - from) * u))
      if (u < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win])

  const doSpin = async () => {
    if (spinning || total > stack || total < LIMITS.slots.min) return
    const bet = total
    const lb = lineBet
    moveChips(-bet)
    setPhase('spinning')
    setWins([])
    setWin(0)
    setShownWin(0)
    setBig(false)
    lever.current?.pull()
    play('toss')
    const result = spin() // decided up front with the crypto RNG; the reels are steered to it
    const h = reels.current
    const plans = result.stops.map((stop, r) => reelMotion(h.pos[r], stop, r))
    const landed = plans.map(() => false)
    await new Promise<void>((done) => {
      const t0 = performance.now()
      const tick = (now: number) => {
        const t = (now - t0) / 1000
        plans.forEach((p, r) => {
          h.pos[r] = p.at(Math.min(t, p.end))
          drawReel(h, r)
          if (!landed[r] && t >= p.landAt) {
            landed[r] = true
            play('check', { volume: 0.8, rate: 0.9 + r * 0.04 })
          }
        })
        if (t < plans.at(-1)!.end) requestAnimationFrame(tick)
        else {
          plans.forEach((p, r) => {
            h.pos[r] = mod(p.p1, L)
            drawReel(h, r)
          })
          done()
        }
      }
      requestAnimationFrame(tick)
    })
    const paid = result.pays * lb
    setWins(result.wins)
    if (paid) {
      moveChips(paid)
      setWin(paid)
      setPhase('won')
      setBig(paid >= bet * 15)
      play('rake')
      setTimeout(() => play('win'), 250)
    } else setPhase('idle')
    const detail = result.wins.length ? result.wins.map((w) => `${w.count}× ${w.sym}`).join(', ') : 'no win'
    logRound('slots', bet, paid - bet, detail)
  }

  // Space / Enter spins; arrows change the bet
  const keys = useRef<(e: KeyboardEvent) => void>(null)
  keys.current = (e) => {
    if (useGame.getState().dialog) return
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      void doSpin()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      step(e.key === 'ArrowUp' ? 1 : -1)
    }
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => keys.current?.(e)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])
  const step = (d: number) => {
    if (spinning) return
    const i = LINE_BETS.indexOf(lineBet) + d
    const next = LINE_BETS[i]
    if (next && next * LINES.length <= Math.min(stack, LIMITS.slots.max)) {
      setLineBet(next)
      play('chip')
    }
  }

  const winCells = new Set(wins.flatMap((w) => Array.from({ length: w.count }, (_, r) => `${r}:${LINES[w.line][r]}`)))
  const cellCenter = (r: number, row: number) => [reelX(r) + CW / 2, RY + row * CH + CH / 2] as const
  // line number tabs either side of the reels, stacked where lines share a row
  const tabs = (side: 0 | 1) =>
    LINES.map((rows, i) => {
      const row = side ? rows[REELS - 1] : rows[0]
      const same = LINES.map((l, k) => [side ? l[REELS - 1] : l[0], k] as const).filter(([rr]) => rr === row)
      const idx = same.findIndex(([, k]) => k === i)
      return {
        i,
        y: RY + row * CH + CH / 2 + (idx - (same.length - 1) / 2) * 17,
      }
    })

  const meter = (label: string, value: string, glow?: boolean) => (
    <div className="flex-1 text-center">
      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e2b44a]/80">{label}</div>
      <div
        className={`font-display text-[24px] font-extrabold tabular-nums leading-tight ${glow ? 'text-[#ffe066] [text-shadow:0_0_8px_rgba(255,224,102,.8)]' : 'text-[#ff5a4a]'}`}
      >
        {value}
      </div>
    </div>
  )
  const deckBtn = 'grid place-items-center rounded-xl font-display font-extrabold uppercase tracking-wide transition active:translate-y-0.5 disabled:opacity-40'

  return (
    <div
      className="h-full"
      style={{
        background: 'radial-gradient(ellipse at 50% 40%, #2a0f4a 0%, #120622 55%, #050208 100%)',
      }}
    >
      <Stage size={{ w: W, h: H }}>
        {/* neon glow round the cabinet: a plain box-shadow, painted once */}
        <div className="absolute rounded-[30px]" style={{ left: CAB.x, top: BODY_Y, width: CAB.w, height: H - BODY_Y - 6, boxShadow: '0 0 22px 6px rgba(199,125,255,.55)' }} />
        <Cabinet />
        {/* Animated parts sit in their own small layers so a frame never repaints the whole cabinet. */}
        <div className={spinning || phase === 'won' ? 'slots-fast' : ''}>
          <Bulbs parity={0} />
          <Bulbs parity={1} />
        </div>

        {/* jackpot display */}
        <div
          className="absolute flex items-center justify-center gap-4 text-center"
          style={{
            left: CAB.x + 34,
            top: TOP.y,
            width: CAB.w - 68,
            height: TOP.h,
          }}
        >
          <div>
            <div className="font-display text-[14px] font-extrabold uppercase tracking-[0.35em] text-[#e2b44a]">Five 7s on a line</div>
            <div className="font-display font-black tabular-nums leading-none text-[#ffe066] [text-shadow:0_0_10px_rgba(255,200,60,.7)]" style={{ fontSize: MOBILE ? 30 : 38 }}>
              {formatMoney(PAYS.seven[3] * lineBet)}
            </div>
          </div>
        </div>

        {/* reels: chrome drums */}
        <svg
          className="absolute"
          width={REEL_BOX.w}
          height={REEL_BOX.h}
          viewBox={`${REEL_BOX.x} ${REEL_BOX.y} ${REEL_BOX.w} ${REEL_BOX.h}`}
          style={{ left: REEL_BOX.x, top: REEL_BOX.y, pointerEvents: 'none' }}
          aria-label="Reels"
          role="img"
        >
          <defs>
            <linearGradient id="drum" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8d949c" />
              <stop offset="0.18" stopColor="#e9edf1" />
              <stop offset="0.5" stopColor="#ffffff" />
              <stop offset="0.82" stopColor="#e9edf1" />
              <stop offset="1" stopColor="#8d949c" />
            </linearGradient>
            <linearGradient id="drum-shade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#000" stopOpacity=".55" />
              <stop offset="0.16" stopColor="#000" stopOpacity="0" />
              <stop offset="0.84" stopColor="#000" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity=".55" />
            </linearGradient>
            <linearGradient id="drum-side" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#000" stopOpacity=".25" />
              <stop offset="0.12" stopColor="#000" stopOpacity="0" />
              <stop offset="0.88" stopColor="#000" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity=".25" />
            </linearGradient>
          </defs>
          {STRIPS.map((_, r) => (
            <rect key={r} x={reelX(r)} y={RY} width={CW} height={ROWS * CH} fill="url(#drum)" />
          ))}
        </svg>
        <ReelColumns handle={reels.current} />
        <svg
          className="absolute"
          width={REEL_BOX.w}
          height={REEL_BOX.h}
          viewBox={`${REEL_BOX.x} ${REEL_BOX.y} ${REEL_BOX.w} ${REEL_BOX.h}`}
          style={{ left: REEL_BOX.x, top: REEL_BOX.y, pointerEvents: 'none' }}
          aria-hidden
        >
          {STRIPS.map((_, r) => (
            <g key={r}>
              <rect x={reelX(r)} y={RY} width={CW} height={ROWS * CH} fill="url(#drum-shade)" />
              <rect x={reelX(r)} y={RY} width={CW} height={ROWS * CH} fill="url(#drum-side)" />
            </g>
          ))}
          {/* winning symbols and lines */}
          {phase !== 'spinning' &&
            [...winCells].map((k) => {
              const [r, row] = k.split(':').map(Number)
              return (
                <rect key={k} x={reelX(r) + 3} y={RY + row * CH + 3} width={CW - 6} height={CH - 6} rx="10" fill="none" stroke="#ffe066" strokeWidth="4" className="win-cell" />
              )
            })}
          {phase !== 'spinning' &&
            wins.map((w) => (
              <polyline
                key={`glow-${w.line}`}
                points={LINES[w.line].map((row, r) => cellCenter(r, row).join(',')).join(' ')}
                fill="none"
                stroke={LINE_COLORS[w.line]}
                strokeWidth="13"
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity=".3"
              />
            ))}
          {phase !== 'spinning' &&
            wins.map((w) => (
              <polyline
                key={w.line}
                points={LINES[w.line].map((row, r) => cellCenter(r, row).join(',')).join(' ')}
                fill="none"
                stroke={LINE_COLORS[w.line]}
                strokeWidth="5"
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity=".9"
              />
            ))}
          {/* line number tabs */}
          {([0, 1] as const).map((side) =>
            tabs(side).map(({ i, y }) => {
              const lit = wins.some((w) => w.line === i)
              return (
                <g key={`${side}-${i}`} transform={`translate(${side ? RX + REEL_W + 13 : RX - 13} ${y})`}>
                  <rect x="-10" y="-8" width="20" height="16" rx="4" fill={lit ? LINE_COLORS[i] : '#1b0f3a'} stroke={LINE_COLORS[i]} strokeWidth="1.5" />
                  <text y="4.5" textAnchor="middle" fontSize="11" fontWeight="800" fontFamily="var(--font-display)" fill={lit ? '#120622' : LINE_COLORS[i]}>
                    {i + 1}
                  </text>
                </g>
              )
            }),
          )}
        </svg>

        {/* meters */}
        <div
          className="absolute flex items-center"
          style={{
            left: CAB.x + 34,
            top: METER_Y - 8,
            width: CAB.w - 68,
            height: 56,
          }}
        >
          {meter('Credit', formatMoney(stack))}
          {meter('Bet', `${formatMoney(total)}`)}
          {meter('Win', formatMoney(shownWin), shownWin > 0)}
        </div>

        {/* button deck */}
        <div
          className="absolute flex items-center justify-center gap-3"
          style={{
            left: CAB.x + 20,
            top: DECK_Y + 14,
            width: CAB.w - 40,
            height: 58,
          }}
        >
          <button
            className={`${deckBtn} h-12 w-16 bg-[linear-gradient(180deg,#5b5be0,#23237a)] text-[22px] text-white ring-2 ring-[#aab4ff]/60`}
            disabled={spinning || LINE_BETS.indexOf(lineBet) === 0}
            onClick={() => step(-1)}
            aria-label="Lower bet"
          >
            −
          </button>
          <div className="w-24 text-center">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#e2b44a]/80">Per line</div>
            <div className="font-display text-[20px] font-extrabold tabular-nums text-white">{formatMoney(lineBet)}</div>
          </div>
          <button
            className={`${deckBtn} h-12 w-16 bg-[linear-gradient(180deg,#5b5be0,#23237a)] text-[22px] text-white ring-2 ring-[#aab4ff]/60`}
            disabled={spinning || lineBet === affordable.at(-1)}
            onClick={() => step(1)}
            aria-label="Raise bet"
          >
            +
          </button>
          <button
            className={`${deckBtn} h-12 px-4 bg-[linear-gradient(180deg,#ffb84a,#b35f00)] text-[15px] text-[#2a1200] ring-2 ring-[#ffe0a0]/70`}
            disabled={spinning || !affordable.length}
            onClick={() => (setLineBet(affordable.at(-1)!), play('stack'))}
          >
            Max bet
          </button>
          <button
            className={`${deckBtn} h-14 w-40 bg-[radial-gradient(circle_at_50%_30%,#ff7a6e,#c4101c_60%,#6a0008)] text-[24px] text-white ring-4 ring-[#ffd0c8]/70 relative shadow-[0_0_24px_rgba(255,60,60,.6)]`}
            disabled={spinning || total > stack}
            onClick={() => void doSpin()}
          >
            {!spinning && (
              <span className="pointer-events-none absolute -inset-1 rounded-2xl shadow-[0_0_22px_6px_rgba(255,90,80,.75)] animate-[glow-pulse_1.6s_ease-in-out_infinite]" />
            )}
            {spinning ? '…' : 'Spin'}
          </button>
        </div>

        <Lever ref={lever} disabled={spinning || total > stack} onPull={() => void doSpin()} />

        <LinesGuide />

        <PayTable lineBet={lineBet} />

        {big && (
          <div
            className="pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 text-center"
            style={{
              top: RY + (ROWS * CH) / 2 - 60,
              animation: 'banner-in .5s ease-out',
            }}
            role="status"
          >
            <div className="gold-text font-display text-[88px] font-black leading-none [filter:drop-shadow(0_6px_20px_rgba(0,0,0,.8))]">BIG WIN</div>
            <div className="font-display text-[40px] font-extrabold text-white [text-shadow:0_4px_12px_rgba(0,0,0,.9)]">{formatMoney(win)}</div>
          </div>
        )}
      </Stage>
      <CasinoHud canLeave={!spinning} title="Slots" />
    </div>
  )
}
