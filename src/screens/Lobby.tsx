import { useState } from 'react'
import { BUY_INS, set, useGame } from '../game/store'
import { game, blindsFor } from '../game/controller'
import { formatMoney } from '../engine/chips'
import type { Difficulty } from '../ai/bot'
import { Button, Segmented } from '../components/ui/kit'
import { Card } from '../components/cards/Card'
import { Chip } from '../components/chips/Chip'
import { initAudio, play } from '../audio/sound'
import { CloudBadge } from '../components/CloudSync'

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

export function Lobby() {
  const bankroll = useGame((s) => s.bankroll)
  const [buyIn, setBuyIn] = useState(() => [...BUY_INS].reverse().find((b) => b <= bankroll / 4) ?? BUY_INS[0])
  const [opponents, setOpponents] = useState(5)
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const affordable = buyIn <= bankroll
  const { sb, bb } = blindsFor(buyIn)
  const broke = bankroll < BUY_INS[0]

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'radial-gradient(ellipse at 30% 30%, #1d4a33 0%, #0c2419 38%, #070504 80%)' }}>
      <div className="pointer-events-none fixed inset-0 opacity-50" style={{ background: 'radial-gradient(ellipse at 70% 110%, rgba(90,40,20,.45), transparent 60%)' }} aria-hidden />
      <div className="relative mx-auto flex min-h-full max-w-6xl flex-col items-center justify-center gap-10 px-4 py-10 lg:flex-row lg:gap-16">
        <section className="flex-1 text-center lg:text-left">
          <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.35em] text-[#d4af5a]/80">No-Limit Texas Hold'em</p>
          <h1 className="gold-text font-serif text-[88px] font-bold leading-[0.9] sm:text-[120px]">cards</h1>
          <p className="mx-auto mt-4 max-w-md text-[17px] leading-relaxed text-[#d8ccb0] lg:mx-0">
            A private high-stakes table, a dealer who never misses, and five opponents who each play their own game.
          </p>
          <div className="mt-8">
            <Flourish />
          </div>
        </section>

        <section
          aria-label="Choose your table"
          className="relative w-full max-w-[460px] rounded-3xl border border-[#d4af5a]/40 bg-[linear-gradient(180deg,rgba(24,18,12,.9),rgba(10,8,6,.94))] p-7 shadow-[0_40px_90px_-30px_rgba(0,0,0,.95),inset_0_1px_0_rgba(255,255,255,.06)]"
        >
          <div className="pointer-events-none absolute inset-2 rounded-[20px] border border-[#d4af5a]/15" />
          <div className="relative">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#d4af5a]/80">Bankroll</div>
                <div className="font-serif text-[40px] font-bold tabular-nums leading-tight text-[#f6e6b4]">{formatMoney(bankroll)}</div>
                <CloudBadge />
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

            <fieldset className="mt-6">
              <legend className="mb-2 text-[13px] font-semibold text-[#e9dcb8]">Buy-in</legend>
              <Segmented
                label="Buy-in"
                value={buyIn}
                onChange={setBuyIn}
                disabled={(v) => v > bankroll}
                options={BUY_INS.map((b) => ({ value: b, label: formatMoney(b) }))}
              />
              <p className="mt-2 text-[13px] text-[#bfb49a]">
                Blinds <b className="text-[#f6e6b4]">{formatMoney(sb)} / {formatMoney(bb)}</b> · 100 big blinds for everyone at the table
              </p>
            </fieldset>

            <fieldset className="mt-5">
              <legend className="mb-2 text-[13px] font-semibold text-[#e9dcb8]">Opponents</legend>
              <Segmented label="Opponents" value={opponents} onChange={setOpponents} options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: n }))} />
            </fieldset>

            <fieldset className="mt-5">
              <legend className="mb-2 text-[13px] font-semibold text-[#e9dcb8]">Opponent skill</legend>
              <Segmented
                label="Opponent skill"
                value={difficulty}
                onChange={setDifficulty}
                options={[
                  { value: 'easy', label: 'Relaxed' },
                  { value: 'normal', label: 'Sharp' },
                  { value: 'hard', label: 'Ruthless' },
                ]}
              />
            </fieldset>

            <Button
              variant="gold"
              size="lg"
              className="mt-7 w-full font-serif text-xl"
              disabled={!affordable}
              onClick={() => {
                initAudio()
                play('stack')
                game.start({ buyIn, opponents, difficulty })
              }}
            >
              Take a seat · {formatMoney(buyIn)}
            </Button>
            {broke && (
              <p className="mt-3 text-center text-[13px] text-[#ffcf8a]">
                Your bankroll is empty — reset it in Settings to play again.
              </p>
            )}
            <p className="mt-5 text-center text-[12px] text-[#9d937c]">
              Shortcuts at the table: <kbd className="text-[#d4af5a]">F</kbd> fold · <kbd className="text-[#d4af5a]">C</kbd> check/call ·{' '}
              <kbd className="text-[#d4af5a]">R</kbd> raise · <kbd className="text-[#d4af5a]">Enter</kbd> confirm
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
