import { useEffect, useRef, useState } from 'react'
import { Stage } from '../../components/table/Stage'
import { useGame } from '../../game/store'
import { formatMoney } from '../../engine/chips'
import { play } from '../../audio/sound'
import { Button } from '../../components/ui/kit'
import { MOBILE } from '../../ui/device'
import { CasinoHud, ChipBar, chipChoices } from '../CasinoUi'
import { LIMITS, logRound, moveChips } from '../casino'
import { L, Layout } from './Layout'
import { Wheel, type WheelHandle } from './Wheel'
import { colorOf, settle, spinResult, type BetSpot, type Bets } from './rules'
import { R, planSpin } from './physics'

const STAGE_SIZE = { w: 1600, h: MOBILE ? 820 : 900 }
const WHEEL_SIZE = 560
const REST = { x: 360, y: STAGE_SIZE.h / 2 + 20, s: 1 }
const ZOOM = { x: 800, y: STAGE_SIZE.h / 2, s: MOBILE ? 1.42 : 1.5 }
const { min: MIN, max: MAX } = LIMITS.roulette

type Phase = 'betting' | 'spinning' | 'result'
const COLOR_BG = { red: '#c1121f', black: '#141416', green: '#0f7a3c' }

export function RouletteScreen() {
  const stack = useGame((s) => s.casino?.stack ?? 0)
  const [bets, setBets] = useState<Bets>({})
  const [placed, setPlaced] = useState<{ key: string; amount: number }[]>([])
  const [lastBets, setLastBets] = useState<Bets>({})
  const [chip, setChip] = useState(() => chipChoices(stack, MIN)[1] ?? MIN)
  const [phase, setPhase] = useState<Phase>('betting')
  const [winner, setWinner] = useState<number | null>(null)
  const [winning, setWinning] = useState<Set<string>>(new Set())
  const [history, setHistory] = useState<number[]>([])
  const [message, setMessage] = useState<{ title: string; detail: string } | null>(null)
  const [zoomed, setZoomed] = useState(false)
  const wheel = useRef<WheelHandle>(null)
  const angle = useRef(0) // rotor angle, persists between spins
  const ballAt = useRef<{ rel: number } | null>(null) // ball resting in a pocket (relative to rotor)

  const total = Object.values(bets).reduce((a, b) => a + b.amount, 0)
  const free = stack - total
  const lastTotal = Object.values(lastBets).reduce((a, b) => a + b.amount, 0)

  // idle: rotor turns slowly; last ball stays in its pocket
  useEffect(() => {
    if (phase === 'spinning') return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      angle.current += ((now - last) / 1000) * 0.35
      last = now
      const b = ballAt.current
      wheel.current?.set(angle.current, b ? angle.current + b.rel : 0, R.pocket, !!b)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  const place = (spot: BetSpot, amount = chip) => {
    const fresh = phase === 'result' // first chip after a result starts a new layout
    if (fresh) newRound()
    const cur = fresh ? 0 : (bets[spot.key]?.amount ?? 0)
    const add = Math.min(amount, MAX - cur, fresh ? stack : free)
    if (add <= 0) return
    play('chip', { minGap: 20 })
    setBets((b) => ({ ...b, [spot.key]: { spot, amount: cur + add } }))
    setPlaced((p) => [...p, { key: spot.key, amount: add }])
  }
  const undo = () => {
    const last = placed.at(-1)
    if (!last) return
    play('chip', { rate: 0.9 })
    setPlaced((p) => p.slice(0, -1))
    setBets((b) => {
      const n = { ...b }
      const left = n[last.key].amount - last.amount
      if (left > 0) n[last.key] = { ...n[last.key], amount: left }
      else delete n[last.key]
      return n
    })
  }
  const clear = () => {
    if (phase === 'result') return newRound()
    if (total) play('stack')
    setBets({})
    setPlaced([])
  }
  const rebet = (mult = 1) => {
    const src = mult === 2 ? bets : lastBets
    const need = Object.values(src).reduce((a, b) => a + b.amount * mult, 0)
    if (!need || need > stack || Object.values(src).some((b) => b.amount * mult > MAX)) return
    play('stack')
    setBets(Object.fromEntries(Object.entries(src).map(([k, b]) => [k, { ...b, amount: b.amount * mult }])))
    setPlaced(Object.entries(src).map(([k, b]) => ({ key: k, amount: b.amount * mult })))
  }
  const newRound = () => {
    setPhase('betting')
    setWinner(null)
    setWinning(new Set())
    setMessage(null)
    setBets({})
    setPlaced([])
  }

  const spin = async (round: Bets = bets) => {
    const staked = Object.values(round).reduce((a, b) => a + b.amount, 0)
    if (!staked || staked > stack || phase === 'spinning') return
    moveChips(-staked)
    setBets(round)
    setWinner(null)
    setWinning(new Set())
    setMessage(null)
    setLastBets(round)
    setPhase('spinning')
    setZoomed(true)
    ballAt.current = null
    const result = spinResult() // decided up front with the crypto RNG; the ball is steered to it
    const plan = planSpin(result, angle.current, Math.random() * Math.PI * 2)
    await new Promise((r) => setTimeout(r, 650)) // zoom in
    await new Promise<void>((done) => {
      const t0 = performance.now()
      let nextClick = 0
      const clicks = [...plan.clicks].sort((a, b) => a - b)
      const tick = (now: number) => {
        const t = (now - t0) / 1000
        const p = plan.at(Math.min(t, plan.duration))
        wheel.current?.set(p.wheel, p.ball, p.r, true)
        while (nextClick < clicks.length && t >= clicks[nextClick]) {
          play('chip', { rate: 1.5 + Math.random() * 0.3, volume: 0.55, minGap: 0 })
          nextClick++
        }
        if (t < plan.duration) requestAnimationFrame(tick)
        else {
          angle.current = p.wheel
          ballAt.current = { rel: p.ball - p.wheel }
          done()
        }
      }
      requestAnimationFrame(tick)
    })
    const { total: back, won } = settle(round, result)
    setWinner(result)
    setWinning(new Set(Object.keys(won)))
    setHistory((h) => [result, ...h].slice(0, 14))
    const net = back - staked
    const c = colorOf(result)
    setMessage({ title: `${result} ${c === 'green' ? 'green' : c}`, detail: net > 0 ? `You win ${formatMoney(net)}` : net === 0 ? 'Your bets come back' : back ? `${formatMoney(back)} back · ${formatMoney(-net)} down` : `${formatMoney(staked)} lost` })
    if (back) {
      moveChips(back)
      play('rake')
      if (net > 0) setTimeout(() => play('win'), 350)
    }
    logRound('roulette', staked, net, `${result} ${c}`)
    setPhase('result')
    await new Promise((r) => setTimeout(r, 1600))
    setZoomed(false)
  }

  const pos = zoomed ? ZOOM : REST
  const busy = phase === 'spinning'

  return (
    <div className="h-full" style={{ background: 'radial-gradient(ellipse at 50% 45%, #1d5a3a 0%, #0c2a1b 55%, #050806 100%)' }}>
      <Stage size={STAGE_SIZE}>
        {/* felt table */}
        <svg className="absolute inset-0" width={STAGE_SIZE.w} height={STAGE_SIZE.h} aria-hidden>
          <defs>
            <radialGradient id="rl-felt" cx="0.55" cy="0.45" r="0.75">
              <stop offset="0" stopColor="#1f7a4c" />
              <stop offset="1" stopColor="#0b3b24" />
            </radialGradient>
            <filter id="rl-noise" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="9" />
              <feColorMatrix values="0 0 0 0 0 0 0 0 0 0.05 0 0 0 0 0.02 0 0 0 0.2 0" />
              <feComposite in2="SourceGraphic" operator="in" />
            </filter>
          </defs>
          <rect x="30" y="80" width="1540" height={STAGE_SIZE.h - 110} rx="60" fill="#3a1b0c" />
          <rect x="44" y="94" width="1512" height={STAGE_SIZE.h - 138} rx="48" fill="url(#rl-felt)" stroke="#d4af5a" strokeWidth="3" />
          <rect x="44" y="94" width="1512" height={STAGE_SIZE.h - 138} rx="48" fill="#fff" filter="url(#rl-noise)" />
          {/* wooden wheel well */}
          <circle cx={REST.x} cy={REST.y} r="300" fill="#2a1208" />
          <svg x="0" y="0">
            <Layout bets={bets} onBet={place} disabled={busy} winner={winner} winning={winning} />
          </svg>
        </svg>

        {/* last results */}
        <div className="absolute flex gap-1.5" style={{ left: L.x, top: 128 }} aria-label="Last numbers">
          {history.map((n, i) => (
            <div
              key={i}
              className="grid h-10 w-10 place-items-center rounded-lg font-display text-[18px] font-extrabold text-white ring-1 ring-white/25"
              style={{ background: COLOR_BG[colorOf(n)], opacity: 1 - i * 0.05 }}
            >
              {n}
            </div>
          ))}
          {!history.length && <div className="text-[15px] text-[#d8ccb0]">Place your bets · min {formatMoney(MIN)}, max {formatMoney(MAX)} per spot</div>}
        </div>

        {/* dim the layout while the ball is spinning */}
        <div
          className="pointer-events-none absolute inset-0 bg-black transition-opacity duration-500"
          style={{ opacity: zoomed ? 0.55 : 0, zIndex: 20 }}
        />
        {/* the wheel: sits in its well, zooms to the middle for the spin */}
        <div
          className="absolute left-0 top-0"
          style={{
            transform: `translate(${pos.x - WHEEL_SIZE / 2}px, ${pos.y - WHEEL_SIZE / 2}px) scale(${pos.s})`,
            transition: 'transform 650ms cubic-bezier(.3,.8,.25,1)',
            zIndex: 25,
          }}
        >
          <div className="absolute rounded-full" style={{ inset: 8, top: 30, bottom: -14, background: 'rgba(0,0,0,.55)', filter: 'blur(18px)' }} />
          <Wheel ref={wheel} size={WHEEL_SIZE} />
        </div>

        {message && (
          <div
            className="absolute left-1/2 z-30 min-w-[300px] -translate-x-1/2 rounded-2xl border border-[#f3dc9a]/70 bg-[linear-gradient(180deg,rgba(40,28,10,.95),rgba(14,10,5,.95))] px-8 py-3 text-center shadow-2xl"
            style={{ top: 20, animation: 'pop-in .35s ease-out' }}
            role="status"
          >
            <div className="font-display text-[34px] font-extrabold capitalize leading-tight" style={{ color: winner !== null ? (colorOf(winner) === 'red' ? '#ff6b6b' : colorOf(winner) === 'green' ? '#4ade80' : '#f6e6b4') : undefined }}>
              {message.title}
            </div>
            <div className="text-[17px] font-semibold text-[#efe6cf]">{message.detail}</div>
          </div>
        )}

        {/* chips + controls */}
        <div className="absolute flex items-end justify-between" style={{ left: L.x, width: 884, top: STAGE_SIZE.h - 160, zIndex: 10 }}>
          <ChipBar stack={Math.max(free, MIN)} min={MIN} value={chip} onPick={setChip} />
          <div className="text-right">
            <div className="text-[13px] font-bold uppercase tracking-[0.16em] text-[#d4af5a]/80">Total bet</div>
            <div className="font-display text-[28px] font-extrabold tabular-nums text-[#f6e6b4]">{formatMoney(total)}</div>
          </div>
        </div>
        <div className="absolute flex gap-2" style={{ left: 60, top: STAGE_SIZE.h - 104, zIndex: 10 }}>
          <Button variant="wood" disabled={phase !== 'betting' || !placed.length} onClick={undo}>
            Undo
          </Button>
          <Button variant="wood" disabled={busy || !total} onClick={clear}>
            Clear
          </Button>
          <Button variant="felt" disabled={busy || !!total || !Object.keys(lastBets).length} onClick={() => (phase === 'result' && newRound(), rebet())}>
            Rebet
          </Button>
          <Button variant="felt" disabled={phase !== 'betting' || !total || total * 2 > stack} onClick={() => rebet(2)}>
            Double
          </Button>
          <Button variant="gold" size="lg" className="min-w-40 text-xl" disabled={busy || (phase === 'result' ? lastTotal > stack : !total)} onClick={() => void (phase === 'result' ? spin(lastBets) : spin())}>
            {busy ? 'No more bets' : phase === 'result' ? 'Spin again' : 'Spin'}
          </Button>
        </div>
      </Stage>
      <CasinoHud canLeave={!busy} title="Roulette" />
    </div>
  )
}
