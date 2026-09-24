import { useEffect, useRef, useState } from 'react'
import { get, set, useGame, START_BANKROLL } from '../game/store'
import { game } from '../game/controller'
import { breakdown, chipLabel, colorUp, colorUpOptions, denomsDesc, formatMoney, rackCount, rackTotal } from '../engine/chips'
import { play, setAmbient } from '../audio/sound'
import { Button, Dialog, Segmented, Slider, Toggle } from './ui/kit'
import { Chip } from './chips/Chip'

const close = () => set({ dialog: null })

export function SettingsDialog() {
  const open = useGame((s) => s.dialog === 'settings')
  const st = useGame((s) => s.settings)
  const bankroll = useGame((s) => s.bankroll)
  const [confirmReset, setConfirmReset] = useState(false)
  const upd = (patch: Partial<typeof st>) => set((s) => ({ settings: { ...s.settings, ...patch } }))
  return (
    <Dialog open={open} onClose={close} title="Settings">
      <div className="space-y-1">
        <div className="py-2">
          <div className="mb-1 flex justify-between text-[15px] text-[#efe6cf]">
            <span>Master volume</span>
            <span className="tabular-nums text-[#d4af5a]">{Math.round(st.volume * 100)}%</span>
          </div>
          <Slider label="Master volume" min={0} max={1} step={0.05} value={st.volume} onChange={(v) => upd({ volume: v })} />
        </div>
        <Toggle label="Mute all sound" checked={st.muted} onChange={(v) => upd({ muted: v })} />
        <Toggle
          label="Casino ambience"
          checked={st.ambient}
          onChange={(v) => {
            upd({ ambient: v })
            if (get().screen === 'table') setAmbient(v)
          }}
        />
        <div className="flex items-center justify-between gap-4 py-2">
          <span className="text-[15px] text-[#efe6cf]">Animation speed</span>
          <Segmented
            label="Animation speed"
            value={st.speed}
            onChange={(v) => upd({ speed: v })}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'fast', label: 'Fast' },
            ]}
          />
        </div>
        <Toggle label="Finish the hand instantly after I fold" checked={st.skipWhenFolded} onChange={(v) => upd({ skipWhenFolded: v })} />
        <Toggle label="Show my win equity" checked={st.showEquity} onChange={(v) => upd({ showEquity: v })} />
        <div className="mt-3 flex items-center justify-between border-t border-[#d4af5a]/20 pt-4">
          <span className="text-[14px] text-[#bfb49a]">Bankroll: {formatMoney(bankroll)}</span>
          <Button
            size="sm"
            variant={confirmReset ? 'danger' : 'ghost'}
            onClick={() => {
              if (!confirmReset) return setConfirmReset(true)
              set({ bankroll: START_BANKROLL })
              setConfirmReset(false)
            }}
            onBlur={() => setConfirmReset(false)}
          >
            {confirmReset ? `Reset to ${formatMoney(START_BANKROLL)}?` : 'Reset bankroll'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

export function BustDialog() {
  const open = useGame((s) => s.dialog === 'bust')
  const bankroll = useGame((s) => s.bankroll)
  const buyIn = useGame((s) => s.table?.buyIn ?? 0)
  const can = bankroll >= buyIn
  return (
    <Dialog open={open} onClose={() => {}} title="Out of chips" dismissable={false}>
      <p className="mb-5 text-[15px] leading-relaxed text-[#efe6cf]">
        That one didn't go your way. {can ? `Buy back in for ${formatMoney(buyIn)}?` : `Your bankroll (${formatMoney(bankroll)}) doesn't cover another ${formatMoney(buyIn)} buy-in.`}
      </p>
      <div className="flex justify-end gap-3">
        <Button variant="wood" onClick={() => game.answerBust(false)}>
          Back to lobby
        </Button>
        {can && (
          <Button variant="gold" autoFocus onClick={() => game.answerBust(true)}>
            Rebuy {formatMoney(buyIn)}
          </Button>
        )}
      </div>
    </Dialog>
  )
}

/** Riffle sound a few times, like chips being stacked and swapped. */
function riffle() {
  play('stack')
  setTimeout(() => play('stack', { minGap: 0 }), 140)
  setTimeout(() => play('chip', { minGap: 0 }), 260)
}

export function ColorUpDialog() {
  const open = useGame((s) => s.dialog === 'colorup')
  const rack = useGame((s) => s.rack)
  const unit = useGame((s) => s.table?.unit ?? 1)
  const tidy = breakdown(rackTotal(rack), unit)
  const rows = denomsDesc(rack)
    .reverse()
    .map((d) => ({ d, n: rack[d], targets: colorUpOptions(rack, d).slice(0, 3) }))
    .filter((r) => r.targets.length)
  const apply = (next: typeof rack) => {
    set({ rack: next, colorUpHint: false })
    riffle()
  }
  return (
    <Dialog open={open} onClose={close} title="Color up">
      <p className="mb-4 text-[14px] text-[#bfb49a]">
        Exchange small chips for larger ones. {rackCount(rack)} chips · {formatMoney(rackTotal(rack))}
      </p>
      <Button
        variant="gold"
        className="mb-4 w-full"
        disabled={rackCount(tidy) >= rackCount(rack)}
        onClick={() => apply(tidy)}
      >
        {rackCount(tidy) < rackCount(rack) ? `Color up all (${rackCount(rack)} → ${rackCount(tidy)} chips)` : 'Your rack is already tidy'}
      </Button>
      <ul className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
        {rows.length === 0 && <li className="text-[14px] text-[#bfb49a]">Your rack is already neat.</li>}
        {rows.map(({ d, n, targets }) => (
          <li key={d} className="flex items-center gap-3 rounded-xl bg-black/25 px-3 py-2 ring-1 ring-inset ring-[#d4af5a]/15">
            <Chip denom={d} size={34} />
            <span className="w-20 text-[14px] font-semibold tabular-nums text-[#efe6cf]">
              {chipLabel(d)} <span className="text-[#bfb49a]">×{n}</span>
            </span>
            <div className="ml-auto flex gap-1.5">
              {targets.map((t) => (
                <button
                  key={t}
                  onClick={() => apply(colorUp(rack, d, t))}
                  aria-label={`Exchange ${formatMoney(d)} chips for ${formatMoney(t)} chips`}
                  className="flex items-center gap-1 rounded-lg bg-[#1b4a32] px-2 py-1 text-[12px] font-bold text-[#f6e6b4] ring-1 ring-inset ring-[#d4af5a]/30 transition hover:ring-[#f3dc9a]"
                >
                  {Math.floor(n / (t / d)) * (t / d)} → {Math.floor(n / (t / d))}
                  <Chip denom={t} size={20} />
                  {chipLabel(t)}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}

export function LogDrawer() {
  const open = useGame((s) => s.dialog === 'log')
  const log = useGame((s) => s.log)
  const end = useRef<HTMLLIElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [log, open])
  return (
    <aside
      aria-label="Action log"
      aria-hidden={!open}
      className={`fixed right-0 top-0 z-40 flex h-full w-[340px] max-w-[88vw] flex-col border-l border-[#d4af5a]/30 bg-[linear-gradient(180deg,rgba(18,13,9,.97),rgba(8,6,4,.98))] shadow-[-20px_0_50px_-20px_rgba(0,0,0,.9)] transition-transform duration-300 ease-out ${
        open ? '' : 'pointer-events-none translate-x-full'
      }`}
    >
      <div className="flex h-14 items-center justify-between border-b border-[#d4af5a]/20 px-4">
        <h2 className="gold-text font-serif text-xl font-bold">Hand history</h2>
        <button onClick={close} aria-label="Close log" className="rounded-lg p-1.5 text-[#e9dcb8] hover:bg-white/10">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <ol className="flex-1 space-y-0.5 overflow-y-auto px-4 py-3 text-[13.5px] leading-snug" aria-live="polite">
        {log.map((l) => (
          <li
            key={l.id}
            className={l.text.startsWith('—') ? 'pt-3 font-semibold text-[#d4af5a]' : / wins? /.test(l.text) ? 'text-[#f6e6b4]' : 'text-[#d8ccb0]'}
          >
            {l.text}
          </li>
        ))}
        <li ref={end} />
      </ol>
    </aside>
  )
}
