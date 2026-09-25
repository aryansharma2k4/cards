import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Stage } from '../../components/table/Stage'
import { Card } from '../../components/cards/Card'
import { useGame } from '../../game/store'
import { formatMoney } from '../../engine/chips'
import { play } from '../../audio/sound'
import { Button } from '../../components/ui/kit'
import { MOBILE } from '../../ui/device'
import { BetChips, CasinoHud, ChipBar } from '../CasinoUi'
import { LIMITS, logRound, moveChips } from '../casino'
import { Blackjack, handValue, type Action, type BJEvent, type Result } from './engine'

const W = 1600
const H = MOBILE ? 820 : 900
const CW = 128
const CH = CW * 1.4
const SHOE = { x: 1220, y: 40 }
const DISCARD = { x: 230, y: 40 }
const { min: MIN, max: MAX } = LIMITS.blackjack

interface ViewCard {
  id: number
  code?: string // undefined while face down: the hole card is never in the DOM
}
interface ViewHand {
  cards: ViewCard[]
  bet: number
  result?: Result
  payout?: number
}
type Phase = 'betting' | 'dealing' | 'insurance' | 'player' | 'over'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
let nextId = 1

/** One card: flies in from the shoe when it mounts, slides when its hand moves, sweeps to the discard tray. */
function DealtCard({ x, y, code, collect }: { x: number; y: number; code?: string; collect: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    ref.current?.animate(
      [{ transform: `translate(${SHOE.x - x}px, ${SHOE.y - y}px) rotate(-70deg) scale(.75)` }, { transform: 'none' }],
      { duration: 340, easing: 'cubic-bezier(.2,.8,.3,1)' },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div
      ref={ref}
      className="absolute"
      style={{
        left: x,
        top: y,
        transition: 'left 300ms ease, top 300ms ease, transform 450ms ease-in, opacity 450ms ease-in',
        transform: collect ? `translate(${DISCARD.x - x}px, ${DISCARD.y - y}px) rotate(20deg) scale(.7)` : undefined,
        opacity: collect ? 0 : 1,
      }}
    >
      <Card code={code} faceUp={!!code} width={CW} />
    </div>
  )
}

const handX = (i: number, n: number) => W / 2 + (i - (n - 1) / 2) * 330
const BET_Y = H - 118
/** Top-left of card k in a player hand: fanned up and to the right, like a real layout. */
const playerCard = (hx: number, k: number, n: number) => ({ x: hx - CW / 2 + k * 38 - (n - 1) * 19, y: BET_Y - 80 - CH - k * 20 })
const dealerCard = (k: number, n: number) => ({ x: W / 2 - CW / 2 + (k - (n - 1) / 2) * 76, y: 70 })

const RESULT_TEXT: Record<Result, string> = { blackjack: 'Blackjack!', win: 'Win', push: 'Push', lose: 'Lose' }

function Total({ x, y, cards, result, payout, active }: { x: number; y: number; cards: ViewCard[]; result?: Result; payout?: number; active?: boolean }) {
  const known = cards.flatMap((c) => (c.code ? [c.code] : []))
  if (!known.length) return null
  const { total, soft } = handValue(known)
  const bust = total > 21
  const text = result ? (bust ? 'Bust' : result === 'lose' ? `${total} · Lose` : `${RESULT_TEXT[result]}${payout ? ` +${formatMoney(payout)}` : ''}`) : bust ? `${total} · Bust` : soft && total < 21 ? `${total - 10} / ${total}` : String(total)
  const tone = result === 'win' || result === 'blackjack' ? 'bg-[#1d6b45] text-white ring-[#f3dc9a]' : result === 'push' ? 'bg-[#3a3326] text-[#f6e6b4] ring-[#d4af5a]/60' : result === 'lose' || bust ? 'bg-[#5a1414] text-[#ffd9d2] ring-[#ff9c8c]/50' : active ? 'bg-[#f3dc9a] text-[#241808] ring-white' : 'bg-black/70 text-[#f6e6b4] ring-[#d4af5a]/50'
  return (
    <div className={`absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-3.5 py-1 font-display text-[20px] font-extrabold tabular-nums ring-2 shadow-lg ${tone}`} style={{ left: x, top: y, animation: 'pop-in .25s ease-out' }}>
      {text}
    </div>
  )
}

/** Printed felt: semicircle, rail, arcs of house rules, shoe and discard tray. */
function Felt() {
  const cx = W / 2
  const arc = (r: number) => `M${cx - r} 20 A${r} ${r} 0 0 0 ${cx + r} 20`
  return (
    <svg className="absolute inset-0" width={W} height={H} aria-hidden>
      <defs>
        <radialGradient id="bj-felt" cx="0.5" cy="0.2" r="0.85">
          <stop offset="0" stopColor="#1f7a4c" />
          <stop offset="1" stopColor="#0a3521" />
        </radialGradient>
        <linearGradient id="bj-rail" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6a3218" />
          <stop offset="0.5" stopColor="#3a190b" />
          <stop offset="1" stopColor="#1e0c05" />
        </linearGradient>
        <filter id="bj-noise" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="3" />
          <feColorMatrix values="0 0 0 0 0 0 0 0 0 0.05 0 0 0 0 0.02 0 0 0 0.2 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        {[300, 346, 410].map((r) => (
          <path key={r} id={`bj-arc-${r}`} d={arc(r)} />
        ))}
      </defs>
      {/* padded rail and felt: the table's curved edge faces the player */}
      <path d={`M0 0H${W}V${H - 330}Q${W} ${H + 40} ${cx} ${H + 40}Q0 ${H + 40} 0 ${H - 330}Z`} fill="url(#bj-rail)" />
      <path d={`M30 0H${W - 30}V${H - 340}Q${W - 30} ${H - 6} ${cx} ${H - 6}Q30 ${H - 6} 30 ${H - 340}Z`} fill="url(#bj-felt)" stroke="#d4af5a" strokeWidth="3" />
      <path d={`M30 0H${W - 30}V${H - 340}Q${W - 30} ${H - 6} ${cx} ${H - 6}Q30 ${H - 6} 30 ${H - 340}Z`} fill="#fff" filter="url(#bj-noise)" />
      {/* house rules printed on the felt */}
      <path d={arc(372)} fill="none" stroke="#e9d59a" strokeOpacity=".55" strokeWidth="2" />
      <path d={arc(382)} fill="none" stroke="#e9d59a" strokeOpacity=".55" strokeWidth="2" />
      <text fontFamily="var(--font-display)" fontWeight="800" fontSize="30" letterSpacing="6" fill="#e9d59a" fillOpacity=".9">
        <textPath href="#bj-arc-300" startOffset="50%" textAnchor="middle">
          BLACKJACK PAYS 3 TO 2
        </textPath>
      </text>
      <text fontFamily="var(--font-display)" fontWeight="600" fontSize="19" letterSpacing="2" fill="#f3ead0" fillOpacity=".7">
        <textPath href="#bj-arc-346" startOffset="50%" textAnchor="middle">
          Dealer must draw to 16 and stand on all 17s
        </textPath>
      </text>
      <text fontFamily="var(--font-display)" fontWeight="800" fontSize="20" letterSpacing="5" fill="#e9d59a" fillOpacity=".85">
        <textPath href="#bj-arc-410" startOffset="50%" textAnchor="middle">
          INSURANCE PAYS 2 TO 1
        </textPath>
      </text>
      {/* shoe */}
      <g transform={`translate(${SHOE.x - 30} ${SHOE.y - 18})`}>
        <path d="M0 18L28 0H200L200 200H0Z" fill="#101012" stroke="#3b3b40" strokeWidth="2" />
        <rect x="14" y="26" width="172" height="162" rx="6" fill="#1b2a52" stroke="#e8dcc0" strokeWidth="3" />
        <rect x="24" y="36" width="152" height="142" rx="4" fill="none" stroke="#e8dcc0" strokeOpacity=".5" strokeWidth="2" />
        <path d="M0 18L28 0H200L200 60H0Z" fill="rgba(160,190,230,.18)" stroke="rgba(255,255,255,.25)" />
      </g>
      {/* discard tray */}
      <g transform={`translate(${DISCARD.x - 20} ${DISCARD.y - 18})`}>
        <rect width="170" height="220" rx="10" fill="rgba(160,190,230,.12)" stroke="rgba(255,255,255,.25)" strokeWidth="2" />
      </g>
    </svg>
  )
}

export function BlackjackScreen() {
  const stack = useGame((s) => s.casino?.stack ?? 0)
  const bj = useRef<Blackjack>(null)
  if (!bj.current) bj.current = new Blackjack()
  const [bet, setBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [dealer, setDealer] = useState<ViewCard[]>([])
  const [hands, setHands] = useState<ViewHand[]>([])
  const [active, setActive] = useState(-1)
  const [phase, setPhase] = useState<Phase>('betting')
  const [insurance, setInsurance] = useState(0)
  const [collect, setCollect] = useState(false)
  const [banner, setBanner] = useState<{ title: string; detail: string } | null>(null)
  const stackRef = useRef(stack)
  const lastChip = useRef(10)
  stackRef.current = stack

  const addChip = (d: number) => {
    if (phase === 'over') void newRound()
    else if (phase !== 'betting') return
    setBet((b) => {
      const n = Math.min(b + d, MAX, stackRef.current)
      if (n > b) play('chip', { minGap: 20 })
      return n
    })
  }

  /** Sweep the last round's cards into the discard tray. */
  const newRound = async () => {
    if (!dealer.length) return setPhase('betting')
    setCollect(true)
    setBanner(null)
    setPhase('betting')
    await wait(460)
    setCollect(false)
    setDealer([])
    setHands([])
    setInsurance(0)
    setActive(-1)
  }

  /** Animate engine events in order, moving chips as they happen. */
  const run = async (events: BJEvent[]) => {
    for (const e of events) {
      if (e.type === 'shuffle') {
        setBanner({ title: 'Shuffling', detail: 'Fresh six-deck shoe' })
        play('shuffle')
        await wait(1300)
        setBanner(null)
      } else if (e.type === 'card') {
        const card = { id: nextId++, code: e.faceUp ? e.card : undefined }
        if (e.to === 'dealer') setDealer((d) => [...d, card])
        else {
          const i = e.to
          setHands((hs) => hs.map((h, k) => (k === i ? { ...h, cards: [...h.cards, card] } : h)))
        }
        play('deal')
        await wait(380)
      } else if (e.type === 'reveal') {
        setDealer((d) => d.map((c, k) => (k === 1 ? { ...c, code: e.card } : c)))
        play('flip')
        await wait(600)
      } else if (e.type === 'split' || e.type === 'double') {
        const i = e.hand
        const h0 = bj.current!.hands[i]
        moveChips(-(e.type === 'double' ? h0.bet / 2 : h0.bet))
        setHands((hs) => {
          const h = hs[i]
          if (e.type === 'double') return hs.map((x, k) => (k === i ? { ...x, bet: x.bet * 2 } : x))
          return [...hs.slice(0, i), { ...h, cards: h.cards.slice(0, 1) }, { cards: h.cards.slice(1), bet: h.bet }, ...hs.slice(i + 1)]
        })
        play('stack')
        await wait(420)
      } else if (e.type === 'turn') {
        setActive(e.hand)
      } else if (e.type === 'insurance') {
        if (e.won) {
          moveChips(e.payout)
          play('rake')
        }
        setBanner({ title: e.won ? 'Insurance pays' : 'Insurance lost', detail: e.won ? `+${formatMoney(e.payout)}` : 'Dealer has no blackjack' })
        await wait(1100)
        setBanner(null)
        setInsurance(0)
      } else if (e.type === 'result') {
        setHands((hs) => hs.map((h, k) => (k === e.hand ? { ...h, result: e.result, payout: e.payout } : h)))
        if (e.payout) {
          moveChips(e.payout)
          play('rake')
        }
        await wait(350)
      } else if (e.type === 'over') {
        setActive(-1)
        const g = bj.current!
        const staked = g.staked
        const paid = g.hands.reduce((a, h) => a + (h.payout ?? 0), 0) + (handValue(g.dealer).total === 21 && g.dealer.length === 2 ? g.insuranceBet * 3 : 0)
        const net = paid - staked
        const dealerTotal = handValue(g.dealer).total
        const detail = `${g.hands.map((h) => `${handValue(h.cards).total} ${h.result}`).join(', ')} vs ${dealerTotal > 21 ? 'bust' : dealerTotal}`
        logRound('blackjack', staked, net, detail)
        setBanner({ title: net > 0 ? `You win ${formatMoney(net)}` : net < 0 ? 'Dealer wins' : 'Push', detail: net < 0 ? `${formatMoney(-net)} lost` : g.hands.some((h) => h.result === 'blackjack') ? 'Blackjack pays 3 to 2' : 'Your bet comes back' })
        if (net > 0) setTimeout(() => play('win'), 250)
      }
    }
    setPhase(bj.current!.phase === 'betting' ? 'betting' : bj.current!.phase)
  }

  const deal = async () => {
    if (phase === 'over') await newRound()
    const amount = Math.min(bet || lastBet, stackRef.current)
    if (amount < MIN) return
    setBet(0)
    setLastBet(amount)
    moveChips(-amount)
    setHands([{ cards: [], bet: amount }])
    setPhase('dealing')
    await run(bj.current!.deal(amount))
  }

  const act = async (a: Action) => {
    if (phase !== 'player') return
    setPhase('dealing')
    await run(bj.current!.act(a))
  }

  const insure = async (take: boolean) => {
    const cost = Math.floor(bj.current!.hands[0].bet / 2)
    if (take) {
      moveChips(-cost)
      setInsurance(cost)
      play('chip')
    }
    setPhase('dealing')
    await run(bj.current!.insurance(take))
  }

  const g = bj.current
  const legal = phase === 'player' ? g.legal() : []
  const extra = phase === 'player' ? g.hands[g.active].bet : 0
  const can = (a: Action) => legal.includes(a) && (a === 'hit' || a === 'stand' || stack >= extra)
  const insuranceCost = phase === 'insurance' ? Math.floor(g.hands[0].bet / 2) : 0
  const idle = phase === 'betting' || phase === 'over'

  // keyboard: H S D P, Enter/Space deals
  const keys = useRef<(e: KeyboardEvent) => void>(null)
  keys.current = (e) => {
    if (e.target instanceof HTMLInputElement || useGame.getState().dialog) return
    const k = e.key.toLowerCase()
    const map: Record<string, Action> = { h: 'hit', s: 'stand', d: 'double', p: 'split' }
    if (map[k] && can(map[k])) void act(map[k])
    else if ((k === 'enter' || k === ' ') && idle && (bet || lastBet)) {
      e.preventDefault()
      void deal()
    }
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => keys.current?.(e)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const dealerKnown = dealer.filter((c) => c.code)
  return (
    <div className="h-full bg-[#0b0806]">
      <Stage size={{ w: W, h: H }}>
        <Felt />

        {/* dealer */}
        {dealer.map((c, k) => (
          <DealtCard key={c.id} {...dealerCard(k, dealer.length)} code={c.code} collect={collect} />
        ))}
        {dealerKnown.length > 0 && !collect && <Total x={W / 2} y={70 + CH + 14} cards={dealer} />}

        {/* player hands */}
        {hands.map((h, i) => {
          const hx = handX(i, hands.length)
          const top = playerCard(hx, h.cards.length - 1, h.cards.length).y
          return (
            <div key={i}>
              {h.cards.map((c, k) => (
                <DealtCard key={c.id} {...playerCard(hx, k, h.cards.length)} code={c.code} collect={collect} />
              ))}
              {!collect && <Total x={hx} y={top - 46} cards={h.cards} result={h.result} payout={h.payout} active={i === active && hands.length > 1} />}
            </div>
          )
        })}

        {/* betting circles */}
        <svg className="absolute inset-0" width={W} height={H} style={{ pointerEvents: 'none' }}>
          {(hands.length && !collect ? hands.map((h) => (h.result === 'lose' ? 0 : (h.payout ?? h.bet))) : [bet]).map((b, i, all) => {
            const hx = handX(i, all.length)
            return (
              <g key={i} transform={`translate(${hx} ${BET_Y})`}>
                <ellipse rx="66" ry="40" fill="rgba(0,0,0,.12)" stroke={i === active && all.length > 1 ? '#f3dc9a' : '#e9d59a'} strokeOpacity={i === active ? 1 : 0.7} strokeWidth={i === active ? 4 : 2.5} />
                {!b && (
                  <text y="6" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="700" fontSize="15" fill="#e9d59a" fillOpacity=".7">
                    {formatMoney(MIN)}–{formatMoney(MAX)}
                  </text>
                )}
                {b > 0 && <BetChips amount={b} width={48} />}
              </g>
            )
          })}
          {insurance > 0 && (
            <g transform={`translate(${W / 2 + 190} ${420})`}>
              <BetChips amount={insurance} width={36} />
            </g>
          )}
        </svg>
        <button
          className="absolute rounded-full"
          style={{ left: W / 2 - 70, top: BET_Y - 44, width: 140, height: 88 }}
          aria-label="Add chip to bet"
          disabled={!idle}
          onClick={() => lastChip.current && addChip(lastChip.current)}
        />

        {banner && (
          <div
            className="absolute z-30 min-w-[280px] -translate-x-1/2 rounded-2xl border border-[#f3dc9a]/70 bg-[linear-gradient(180deg,rgba(40,28,10,.95),rgba(14,10,5,.95))] px-8 py-3 text-center shadow-2xl"
            style={{ left: hands.length > 1 ? W / 2 : W / 2 + 400, top: hands.length > 1 ? 250 : BET_Y - 250, animation: 'pop-in .3s ease-out' }}
            role="status"
          >
            <div className="font-display text-[32px] font-extrabold leading-tight text-[#f6e6b4]">{banner.title}</div>
            <div className="text-[17px] font-semibold text-[#efe6cf]">{banner.detail}</div>
          </div>
        )}

        {/* controls */}
        <div className="absolute z-20 flex items-end gap-4" style={{ left: 50, top: H - 120 }}>
          {idle && <ChipBar stack={stack - bet} min={MIN} value={-1} onPick={(d) => ((lastChip.current = d), addChip(d))} />}
        </div>
        <div className="absolute z-20 flex items-center justify-end gap-2" style={{ right: 50, top: H - 94 }}>
          {idle && (
            <>
              <Button variant="wood" disabled={!bet} onClick={() => (play('stack'), setBet(0))}>
                Clear
              </Button>
              <Button variant="gold" size="lg" className="min-w-40 text-xl" disabled={(bet || lastBet) < MIN || (!bet && lastBet > stack)} onClick={() => void deal()} kbd={MOBILE ? undefined : '↵'}>
                {bet ? 'Deal' : lastBet ? `Rebet ${formatMoney(Math.min(lastBet, stack))}` : 'Place a bet'}
              </Button>
            </>
          )}
          {phase === 'insurance' && (
            <>
              <span className="mr-2 text-[17px] font-semibold text-[#f6e6b4]">Dealer shows an ace. Insurance?</span>
              <Button variant="wood" onClick={() => void insure(false)}>
                No thanks
              </Button>
              <Button variant="gold" disabled={!insuranceCost || insuranceCost > stack} onClick={() => void insure(true)}>
                Insure {formatMoney(insuranceCost)}
              </Button>
            </>
          )}
          {(phase === 'player' || phase === 'dealing') && (
            <>
              <Button variant="felt" size="lg" disabled={!can('split')} onClick={() => void act('split')} kbd={MOBILE ? undefined : 'P'}>
                Split
              </Button>
              <Button variant="felt" size="lg" disabled={!can('double')} onClick={() => void act('double')} kbd={MOBILE ? undefined : 'D'}>
                Double
              </Button>
              <Button variant="wood" size="lg" disabled={!can('stand')} onClick={() => void act('stand')} kbd={MOBILE ? undefined : 'S'}>
                Stand
              </Button>
              <Button variant="gold" size="lg" className="min-w-32" disabled={!can('hit')} onClick={() => void act('hit')} kbd={MOBILE ? undefined : 'H'}>
                Hit
              </Button>
            </>
          )}
        </div>
      </Stage>
      <CasinoHud canLeave={idle} title="Blackjack" />
    </div>
  )
}
