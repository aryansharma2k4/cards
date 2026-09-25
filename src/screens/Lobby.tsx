import { MOBILE } from '../ui/device'
import { useRef, useState } from 'react'
import { BUY_INS, set, useGame } from '../game/store'
import { game, blindsFor } from '../game/controller'
import { formatMoney } from '../engine/chips'
import { Button, Segmented, Slider } from '../components/ui/kit'
import { Card } from '../components/cards/Card'
import { Chip } from '../components/chips/Chip'
import { initAudio, play } from '../audio/sound'
import { CloudBadge, SyncPrompt } from '../components/CloudSync'
import { Wheel } from '../games/roulette/Wheel'
import { LIMITS, enterCasino } from '../games/casino'
import type { CasinoGame } from '../game/store'

const HERO_CARDS = ['Ts', 'Js', 'Qs', 'Ks', 'As']

function Flourish() {
  return (
    <div className="relative mx-auto h-[250px] w-[340px] sm:h-[300px] sm:w-[420px]" aria-hidden>
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(243,220,154,.18),transparent_65%)]" />
      {HERO_CARDS.map((c, i) => (
        <div
          key={c}
          className="absolute left-1/2 top-[40px] origin-[50%_120%]"
          style={{ transform: `translateX(-50%) rotate(${(i - 2) * 11}deg)`, animation: `fan-sway 6s ease-in-out ${i * 0.15}s infinite` }}
        >
          <Card code={c} faceUp width={104} />
        </div>
      ))}
      {[
        { d: 1_000_000, x: 8, y: 170, s: 64, t: 0 },
        { d: 100_000, x: 300, y: 190, s: 56, t: 1.2 },
        { d: 10_000, x: 40, y: 40, s: 48, t: 2.1 },
        { d: 1_000_000_000, x: 330, y: 30, s: 60, t: 0.6 },
      ].map((c) => (
        <div key={c.d} className="absolute" style={{ left: c.x, top: c.y, animation: `chip-float 5s ease-in-out ${c.t}s infinite` }}>
          <Chip denom={c.d} size={c.s} />
        </div>
      ))}
    </div>
  )
}

type GameId = 'poker' | CasinoGame

const GAMES: { id: GameId; name: string; kicker: string; blurb: string }[] = [
  { id: 'poker', name: "Texas Hold'em", kicker: 'No-limit poker', blurb: 'Five sharp opponents, 100 big blinds each.' },
  { id: 'blackjack', name: 'Blackjack', kicker: 'Six-deck shoe', blurb: 'Pays 3 to 2 · dealer stands on all 17s.' },
  { id: 'roulette', name: 'Roulette', kicker: 'European single zero', blurb: 'Every bet on the layout, a real ball on the wheel.' },
]

/** Round to two significant figures so slider amounts read like chip counts. */
const nice = (n: number) => {
  if (n < 10) return Math.round(n)
  const m = 10 ** (Math.floor(Math.log10(n)) - 1)
  return Math.round(n / m) * m
}
/** Log-scale slider position (0–1000) ⇄ amount between lo and hi. */
const fromPos = (p: number, lo: number, hi: number) => (p >= 1000 ? hi : Math.min(hi, Math.max(lo, nice(lo * (hi / lo) ** (p / 1000)))))
const toPos = (v: number, lo: number, hi: number) => (hi > lo ? Math.round((1000 * Math.log(v / lo)) / Math.log(hi / lo)) : 1000)

function Art({ id }: { id: GameId }) {
  const box = MOBILE ? 'h-[92px] w-[120px]' : 'h-[150px] w-[190px]'
  const cw = MOBILE ? 52 : 82
  if (id === 'roulette')
    return (
      <div className={`${box} grid shrink-0 place-items-center`}>
        <div className="animate-[spin_24s_linear_infinite] drop-shadow-[0_10px_16px_rgba(0,0,0,.6)]">
          <Wheel size={MOBILE ? 96 : 150} />
        </div>
      </div>
    )
  const cards = id === 'poker' ? ['As', 'Ah'] : ['Ks', 'Ah']
  return (
    <div className={`${box} relative shrink-0`} aria-hidden>
      {cards.map((c, i) => (
        <div key={c} className="absolute left-1/2 top-1/2" style={{ transform: `translate(-50%,-50%) translate(${(i - 0.5) * cw * 0.45}px, 0) rotate(${(i - 0.5) * 16}deg)` }}>
          <Card code={c} faceUp width={cw} />
        </div>
      ))}
      <div className="absolute bottom-0 right-1">
        <Chip denom={id === 'poker' ? 1_000 : 100} size={MOBILE ? 34 : 50} />
      </div>
    </div>
  )
}

export function Lobby() {
  const bankroll = useGame((s) => s.bankroll)
  const [gi, setGi] = useState(0)
  const strip = useRef<HTMLDivElement>(null)
  const [tier, setBuyIn] = useState(() => [...BUY_INS].reverse().find((b) => b <= bankroll / 4) ?? BUY_INS[0])
  const [amount, setAmount] = useState(() => nice(Math.max(100, bankroll / 10)))
  const [opponents, setOpponents] = useState(5)
  const g = GAMES[gi]
  const poker = g.id === 'poker'
  const tiers = BUY_INS.filter((b) => b <= bankroll)
  const buyIn = tiers.includes(tier) ? tier : (tiers.at(-1) ?? BUY_INS[0])
  const { sb, bb } = blindsFor(buyIn)
  const min = poker ? BUY_INS[0] : LIMITS[g.id as CasinoGame].min
  const broke = bankroll < min
  const chips = Math.min(Math.max(amount, min), bankroll)
  const stake = poker ? buyIn : chips

  const go = (i: number) => {
    const n = (i + GAMES.length) % GAMES.length
    const el = strip.current
    el?.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' })
    setGi(n)
  }
  const enter = () => {
    initAudio()
    play('stack')
    if (poker) game.start({ buyIn, opponents, difficulty: 'hard' }) // casino-strength opponents, always
    else enterCasino(g.id as CasinoGame, chips)
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'radial-gradient(ellipse at 30% 30%, #1d4a33 0%, #0c2419 38%, #070504 80%)' }}>
      <div className="pointer-events-none fixed inset-0 opacity-50" style={{ background: 'radial-gradient(ellipse at 70% 110%, rgba(90,40,20,.45), transparent 60%)' }} aria-hidden />
      <div className={MOBILE ? 'relative flex min-h-full items-center gap-6 px-6 py-3' : 'relative mx-auto flex min-h-full max-w-6xl flex-col items-center justify-center gap-10 px-4 py-10 lg:flex-row lg:gap-16'} style={MOBILE ? { paddingLeft: 'max(1.5rem, env(safe-area-inset-left))', paddingRight: 'max(1.5rem, env(safe-area-inset-right))' } : undefined}>
        <section className={MOBILE ? 'w-[34%] shrink-0 text-left' : 'flex-1 text-center lg:text-left'}>
          <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.35em] text-[#d4af5a]/80">Private casino</p>
          <h1 className={`gold-text font-display font-bold leading-[0.9] ${MOBILE ? 'text-[72px]' : 'text-[88px] sm:text-[120px]'}`}>cards</h1>
          <p className={MOBILE ? 'mt-2 text-[13px] leading-snug text-[#d8ccb0]' : 'mx-auto mt-4 max-w-md text-[17px] leading-relaxed text-[#d8ccb0] lg:mx-0'}>
            Hold'em against ruthless opponents, blackjack from a six-deck shoe and a real roulette wheel. One bankroll for all of it.
          </p>
          {!MOBILE && (
            <div className="mt-8">
              <Flourish />
            </div>
          )}
        </section>

        <section
          aria-label="Choose your table"
          className={`relative w-full max-w-[480px] rounded-3xl border border-[#d4af5a]/40 bg-[linear-gradient(180deg,rgba(24,18,12,.9),rgba(10,8,6,.94))] ${MOBILE ? 'p-4' : 'p-7'} shadow-[0_40px_90px_-30px_rgba(0,0,0,.95),inset_0_1px_0_rgba(255,255,255,.06)]`}
        >
          <div className="pointer-events-none absolute inset-2 rounded-[20px] border border-[#d4af5a]/15" />
          <div className="relative">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#d4af5a]/80">Bankroll</div>
                <div className={`font-display ${MOBILE ? 'text-[26px]' : 'text-[40px]'} font-bold tabular-nums leading-tight text-[#f6e6b4]`}>{formatMoney(bankroll)}</div>
                <CloudBadge />
                <SyncPrompt onOpen={() => set({ dialog: 'settings' })} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => set({ screen: 'stats' })}>
                  Stats
                </Button>
                <Button size="sm" variant="ghost" onClick={() => set({ dialog: 'settings' })}>
                  Settings
                </Button>
              </div>
            </div>

            {/* table carousel: swipe, arrows or dots */}
            <div className={`relative ${MOBILE ? 'mt-2' : 'mt-5'} rounded-2xl bg-black/30 ring-1 ring-[#d4af5a]/25`}>
              <div
                ref={strip}
                className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
                aria-roledescription="carousel"
                onScroll={(e) => {
                  const el = e.currentTarget
                  const n = Math.round(el.scrollLeft / el.clientWidth)
                  if (n !== gi) setGi(n)
                }}
              >
                {GAMES.map((t) => (
                  <div key={t.id} className={`flex w-full shrink-0 snap-center items-center ${MOBILE ? 'gap-2 pl-9 pr-11 pt-1.5' : 'gap-3 pl-11 pr-14 pt-3'}`} aria-roledescription="slide" aria-label={t.name}>
                    <Art id={t.id} />
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d4af5a]/80">{t.kicker}</div>
                      <div className={`font-display font-extrabold leading-tight text-[#f6e6b4] ${MOBILE ? 'text-[21px]' : 'text-[28px]'}`}>{t.name}</div>
                      <div className={`${MOBILE ? 'text-[11px]' : 'text-[13px]'} leading-snug text-[#bfb49a]`}>{t.blurb}</div>
                    </div>
                  </div>
                ))}
              </div>
              {[-1, 1].map((d) => (
                <button
                  key={d}
                  onClick={() => go(gi + d)}
                  aria-label={d < 0 ? 'Previous table' : 'Next table'}
                  className={`absolute top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-[#f3dc9a] ring-1 ring-[#d4af5a]/40 active:scale-90 ${d < 0 ? 'left-1' : 'right-1'}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                    <path d={d < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
                  </svg>
                </button>
              ))}
              <div className="flex justify-center gap-1.5 pb-2">
                {GAMES.map((t, i) => (
                  <button key={t.id} onClick={() => go(i)} aria-label={`Show ${t.name}`} aria-current={i === gi} className={`h-1.5 rounded-full transition-all ${i === gi ? 'w-5 bg-[#f3dc9a]' : 'w-1.5 bg-white/30'}`} />
                ))}
              </div>
            </div>

            <div className={MOBILE ? 'mt-2' : 'mt-5'}>
              <div className="flex items-baseline justify-between">
                <label htmlFor="buyin" className={`${MOBILE ? 'text-[12px]' : 'text-[13px]'} font-semibold text-[#e9dcb8]`}>
                  Buy-in
                </label>
                <span className={`font-display font-extrabold tabular-nums text-[#f6e6b4] ${MOBILE ? 'text-[20px]' : 'text-[26px]'}`}>{formatMoney(broke ? 0 : stake)}</span>
              </div>
              {poker ? (
                <Slider id="buyin" label="Buy-in" min={0} max={Math.max(0, tiers.length - 1)} value={Math.max(0, tiers.indexOf(buyIn))} onChange={(i) => setBuyIn(tiers[i] ?? BUY_INS[0])} />
              ) : (
                <Slider id="buyin" label="Buy-in" min={0} max={1000} value={toPos(chips, min, Math.max(min, bankroll))} onChange={(p) => setAmount(fromPos(p, min, bankroll))} />
              )}
              <p className={`${MOBILE ? 'text-[11px]' : 'text-[13px]'} text-[#bfb49a]`}>
                {poker ? (
                  <>
                    Blinds <b className="text-[#f6e6b4]">{formatMoney(sb)} / {formatMoney(bb)}</b> · 100 big blinds for everyone
                  </>
                ) : (
                  <>
                    Table limits <b className="text-[#f6e6b4]">{formatMoney(LIMITS[g.id as CasinoGame].min)} – {formatMoney(LIMITS[g.id as CasinoGame].max)}</b>
                    {g.id === 'roulette' ? ' per spot' : ' per hand'}
                  </>
                )}
              </p>
            </div>

            {poker && (
              <fieldset className={MOBILE ? 'mt-1.5' : 'mt-4'}>
                <legend className={`${MOBILE ? 'mb-1 text-[12px]' : 'mb-2 text-[13px]'} font-semibold text-[#e9dcb8]`}>Opponents</legend>
                <Segmented label="Opponents" value={opponents} onChange={setOpponents} options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: n }))} />
              </fieldset>
            )}

            <Button variant="gold" size={MOBILE ? 'md' : 'lg'} className={`${MOBILE ? 'mt-2.5' : 'mt-6'} w-full font-display text-xl`} disabled={broke || stake > bankroll} onClick={enter}>
              Enter the {g.name} table · {formatMoney(stake)}
            </Button>
            {broke && <p className="mt-3 text-center text-[13px] text-[#ffcf8a]">Your bankroll is empty — reset it in Settings to play again.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
