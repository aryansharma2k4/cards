import { useMemo, useState } from 'react'
import { set, useGame } from '../game/store'
import { useHistory, type HandRecord, type SessionRecord } from '../game/history'
import { groupNet, summarize, verdict, type Tone } from '../game/analysis'
import { formatMoney } from '../engine/chips'
import { BarChart, LineChart, LOSS, PROFIT } from '../components/stats/charts'
import { Button, Dialog, Segmented } from '../components/ui/kit'
import { Card } from '../components/cards/Card'

const SUIT: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }
const date = (ts: number) => new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + formatMoney(Math.abs(n))
const pct = (x: number) => `${Math.round(x * 100)}%`
const verb = (a: string, you: boolean) =>
  a.endsWith('blind') ? `${you ? 'post' : 'posts'} the ${a}` : you ? a : a === 'check' ? 'checks' : `${a}s`

function Net({ n, className = '' }: { n: number; className?: string }) {
  // colour follows the sign, and the sign is always in the text too
  return (
    <span className={`font-semibold tabular-nums ${className}`} style={{ color: n > 0 ? '#7fb2f0' : n < 0 ? '#ef8f8f' : '#bfb49a' }}>
      {signed(n)}
    </span>
  )
}

function Mini({ code }: { code: string }) {
  const red = code[1] === 'h' || code[1] === 'd'
  return (
    <span
      className={`inline-flex h-[26px] w-[21px] items-center justify-center rounded-[3px] bg-[#f8f4ea] font-display text-[12px] font-bold leading-none ${red ? 'text-[#c8102e]' : 'text-[#15110e]'}`}
    >
      {code[0] === 'T' ? '10' : code[0]}
      {SUIT[code[1]]}
    </span>
  )
}
const Cards = ({ cards }: { cards: string[] }) => (
  <span className="inline-flex gap-[3px]">
    {cards.map((c) => (
      <Mini key={c} code={c} />
    ))}
  </span>
)

function Tile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl border border-[#d4af5a]/20 bg-black/25 px-4 py-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#d4af5a]/75">{label}</div>
      <div className="mt-1 font-display text-[26px] font-bold leading-tight text-[#f6e6b4]">{value}</div>
      {sub && <div className="text-[12px] text-[#9d937c]">{sub}</div>}
    </div>
  )
}

function Panel({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="rounded-2xl border border-[#d4af5a]/20 bg-[#15100b] p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-display text-[19px] font-bold text-[#f6e6b4]">{title}</h2>
        {note && <span className="text-[12px] text-[#9d937c]">{note}</span>}
      </div>
      {children}
    </section>
  )
}

const TONE: Record<Tone, string> = {
  good: 'border-[#3987e5]/50 bg-[#3987e5]/10',
  ok: 'border-[#d4af5a]/40 bg-[#d4af5a]/5',
  warn: 'border-[#e66767]/50 bg-[#e66767]/10',
}
const TONE_LABEL: Record<Tone, string> = { good: 'Good', ok: 'Close', warn: 'Leak' }

function HandDetail({ hand, onClose }: { hand: HandRecord | null; onClose: () => void }) {
  const streets = ['preflop', 'flop', 'turn', 'river'] as const
  const boardAt = { preflop: 0, flop: 3, turn: 4, river: 5 }
  return (
    <Dialog open={!!hand} onClose={onClose} title={hand ? `Hand #${hand.handNo}` : ''} className="w-[min(94vw,760px)]">
      {hand && (
        <div className="max-h-[72vh] space-y-4 overflow-y-auto pr-1">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex gap-2">
              {hand.hole.map((c) => (
                <Card key={c} code={c} faceUp width={62} />
              ))}
            </div>
            <div className="flex gap-1.5">
              {hand.board.map((c) => (
                <Card key={c} code={c} faceUp width={48} />
              ))}
            </div>
            <div className="ml-auto text-right">
              <Net n={hand.net} className="font-display text-[26px]" />
              <div className="text-[12px] text-[#bfb49a]">
                {hand.position} · {hand.players} players · ${hand.sb}/${hand.bb} · {date(hand.ts)}
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-black/25 p-3 text-[14px] text-[#efe6cf]">
            {hand.folded
              ? 'You folded.'
              : hand.showdown
                ? `Showdown: you had ${hand.heroLabel ?? '—'}.`
                : 'Everyone else folded to you.'}{' '}
            Pot {formatMoney(hand.pot)}. {hand.winners.map((w) => `${w.name} won ${formatMoney(w.amount)}`).join(', ')}.
            {hand.shown.length > 0 && (
              <ul className="mt-2 space-y-1">
                {hand.shown.map((s) => (
                  <li key={s.name} className="flex items-center gap-2">
                    <span className="w-24 text-[#bfb49a]">{s.name}</span> <Cards cards={s.cards} /> <span>{s.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {streets.map((st) => {
            const acts = hand.actions.filter((a) => a.street === st)
            const mine = hand.decisions.filter((d) => d.street === st)
            if (!acts.length && !mine.length) return null
            return (
              <div key={st}>
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#d4af5a]">{st}</h3>
                  {boardAt[st] > 0 && <Cards cards={hand.board.slice(0, boardAt[st])} />}
                </div>
                <ol className="space-y-0.5 text-[13.5px] text-[#d8ccb0]">
                  {acts.map((a, i) => (
                    <li key={i} className={a.name === 'You' ? 'font-semibold text-[#f6e6b4]' : ''}>
                      {a.name} {verb(a.action, a.name === 'You')}
                      {a.action === 'raise' || a.action === 'bet' ? ` ${a.action === 'raise' ? 'to ' : ''}${formatMoney(a.bet)}` : a.amount ? ` ${formatMoney(a.amount)}` : ''}
                    </li>
                  ))}
                </ol>
                {mine.map((d, i) => {
                  const v = verdict(d)
                  return (
                    <div key={i} className={`mt-2 rounded-lg border px-3 py-2 text-[13.5px] ${TONE[v.tone]}`}>
                      <b className="mr-2 text-[11px] uppercase tracking-wider">{TONE_LABEL[v.tone]}</b>
                      <span className="text-[#efe6cf]">
                        You {d.action}
                        {d.amount ? ` ${formatMoney(d.amount)}` : ''}: {v.text}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
          <p className="text-[12px] text-[#9d937c]">
            Equity is your chance to win against random hands for the players still in, computed when you acted. It's a guide, not a solver.
          </p>
        </div>
      )}
    </Dialog>
  )
}

export function Stats() {
  const bankroll = useGame((s) => s.bankroll)
  const allHands = useHistory((s) => s.hands)
  const sessions = useHistory((s) => s.sessions)
  const [sessionId, setSessionId] = useState<string>('all')
  const [range, setRange] = useState<'100' | 'all'>('all')
  const [open, setOpen] = useState<HandRecord | null>(null)

  const hands = useMemo(() => {
    const h = sessionId === 'all' ? allHands : allHands.filter((x) => x.sessionId === sessionId)
    return range === '100' ? h.slice(-100) : h
  }, [allHands, sessionId, range])
  const s = summarize(hands)
  const sortedSessions = [...sessions].sort((a, b) => a.start - b.start)
  const sessionNet = (x: SessionRecord) => (x.cashOut ?? 0) - x.invested
  const finished = sortedSessions.filter((x) => x.end)
  const positions = groupNet(hands, (h) => h.position)
  const ORDER = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']
  positions.sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key))

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'radial-gradient(ellipse at 30% 0%, #1d4a33 0%, #0c2419 30%, #070504 70%)' }}>
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <header className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="ghost" onClick={() => set({ screen: 'lobby' })}>
            ← Lobby
          </Button>
          <h1 className="gold-text font-display text-[40px] font-bold leading-none">Your stats</h1>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select
              aria-label="Session"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="h-9 rounded-xl bg-black/40 px-3 text-[14px] text-[#efe6cf] ring-1 ring-[#d4af5a]/30"
            >
              <option value="all">All sessions</option>
              {[...sortedSessions].reverse().map((x) => (
                <option key={x.id} value={x.id}>
                  {date(x.start)} · ${x.sb}/${x.bb} · {x.hands} hands
                </option>
              ))}
            </select>
            <Segmented
              label="Range"
              value={range}
              onChange={setRange}
              options={[
                { value: '100', label: 'Last 100' },
                { value: 'all', label: 'All hands' },
              ]}
            />
          </div>
        </header>

        {allHands.length === 0 ? (
          <Panel title="No hands yet">
            <p className="text-[15px] text-[#d8ccb0]">Play a few hands and your results, graphs and a breakdown of every decision will show up here.</p>
          </Panel>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile label="Bankroll" value={formatMoney(bankroll)} sub="saved on this device" />
              <Tile label="Net result" value={<Net n={s.net} />} sub={`${s.hands} hands`} />
              <Tile label="Win rate" value={`${s.bbPer100 >= 0 ? '+' : ''}${s.bbPer100.toFixed(1)}`} sub="big blinds / 100 hands" />
              <Tile label="Showdowns won" value={pct(s.wsd)} sub={`went to showdown ${pct(s.wtsd)}`} />
              <Tile label="VPIP" value={pct(s.vpip)} sub="hands you played" />
              <Tile label="PFR" value={pct(s.pfr)} sub="hands you raised pre-flop" />
              <Tile label="Biggest win" value={<Net n={s.biggestWin} />} />
              <Tile label="Biggest loss" value={<Net n={s.biggestLoss} />} />
            </div>

            <Panel title="Net worth" note="bankroll + chips on the table, after each hand">
              <LineChart
                label="Net worth after each hand"
                points={hands.map((h) => ({
                  y: h.worth,
                  tip: (
                    <>
                      <div className="font-semibold">{formatMoney(h.worth)}</div>
                      <div className="text-[#bfb49a]">
                        Hand #{h.handNo} · {date(h.ts)}
                      </div>
                      <div>
                        This hand <Net n={h.net} />
                      </div>
                    </>
                  ),
                }))}
              />
            </Panel>

            <div className="grid gap-5 md:grid-cols-2">
              <Panel title="Profit by session" note={`${finished.length} finished`}>
                {finished.length ? (
                  <BarChart
                    label="Profit per session"
                    bars={finished.slice(-24).map((x) => ({
                      label: new Date(x.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                      value: sessionNet(x),
                      tip: (
                        <>
                          <div>
                            <Net n={sessionNet(x)} />
                          </div>
                          <div className="text-[#bfb49a]">
                            {date(x.start)} · ${x.sb}/${x.bb}
                          </div>
                          <div>
                            {x.hands} hands · in {formatMoney(x.invested)} · out {formatMoney(x.cashOut ?? 0)}
                          </div>
                        </>
                      ),
                    }))}
                    onSelect={(i) => setSessionId(finished.slice(-24)[i].id)}
                  />
                ) : (
                  <p className="text-[14px] text-[#9d937c]">Leave a table to finish a session.</p>
                )}
              </Panel>
              <Panel title="Profit by position">
                <BarChart
                  label="Profit by table position"
                  bars={positions.map((p) => ({
                    label: p.key,
                    value: p.net,
                    tip: (
                      <>
                        <div className="font-semibold">{p.key}</div>
                        <div>
                          <Net n={p.net} /> over {p.hands} hands
                        </div>
                      </>
                    ),
                  }))}
                />
              </Panel>
            </div>

            <Panel title="Hands" note="click a hand for the full breakdown">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[13.5px]">
                  <thead className="text-[11px] uppercase tracking-[0.14em] text-[#9d937c]">
                    <tr>
                      <th className="py-2 font-semibold">When</th>
                      <th className="font-semibold">Pos</th>
                      <th className="font-semibold">Cards</th>
                      <th className="font-semibold">Board</th>
                      <th className="font-semibold">Outcome</th>
                      <th className="text-right font-semibold">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...hands]
                      .reverse()
                      .slice(0, 200)
                      .map((h) => (
                        <tr
                          key={h.id}
                          tabIndex={0}
                          onClick={() => setOpen(h)}
                          onKeyDown={(e) => e.key === 'Enter' && setOpen(h)}
                          className="cursor-pointer border-t border-white/5 text-[#d8ccb0] hover:bg-white/[.04] focus-visible:bg-white/[.06]"
                        >
                          <td className="py-1.5 whitespace-nowrap">{date(h.ts)}</td>
                          <td>{h.position}</td>
                          <td>
                            <Cards cards={h.hole} />
                          </td>
                          <td>
                            <Cards cards={h.board} />
                          </td>
                          <td className="whitespace-nowrap">
                            {h.folded ? 'Folded' : h.showdown ? (h.heroLabel ?? 'Showdown') : 'Won uncontested'}
                          </td>
                          <td className="text-right">
                            <Net n={h.net} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Panel>
            <p className="pb-4 text-center text-[12px] text-[#9d937c]">
              <span style={{ color: PROFIT }}>■</span> profit · <span style={{ color: LOSS }}>■</span> loss
            </p>
          </>
        )}
      </div>
      <HandDetail hand={open} onClose={() => setOpen(null)} />
    </div>
  )
}
