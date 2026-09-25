import { useEffect, useState } from 'react'
import { set, useGame } from '../game/store'
import { formatMoney, chipLabel, greedy } from '../engine/chips'
import { Chip, ChipStack, TILT, stackHeight } from '../components/chips/Chip'
import { LeaveDialog } from '../components/Dialogs'
import { setBusy } from './casino'

/** Chip denominations offered at casino tables, filtered to what you can afford. */
export function chipChoices(stack: number, min: number) {
  const all = [1, 5, 10, 50, 100, 500, 1_000, 10_000, 100_000]
  const ok = all.filter((d) => d >= min && d <= Math.max(stack, min))
  return ok.slice(-7)
}

/** Row of chips to pick from; the selected one lifts with a gold ring. */
export function ChipBar({ stack, min, value, onPick }: { stack: number; min: number; value: number; onPick: (d: number) => void }) {
  return (
    <div className="flex items-end gap-2" role="radiogroup" aria-label="Chip value">
      {chipChoices(stack, min).map((d) => {
        const on = d === value
        return (
          <button
            key={d}
            role="radio"
            aria-checked={on}
            aria-label={`${formatMoney(d)} chip`}
            onClick={() => onPick(d)}
            disabled={d > stack}
            className={`rounded-full transition duration-150 disabled:opacity-35 ${on ? '-translate-y-2 drop-shadow-[0_0_10px_rgba(243,220,154,.9)]' : 'hover:-translate-y-1'}`}
          >
            <Chip denom={d} size={on ? 70 : 60} />
            <span className="sr-only">{chipLabel(d)}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Top-left menu (leave, settings) and the chips-in-front-of-you readout. */
export function CasinoHud({ canLeave, title }: { canLeave: boolean; title: string }) {
  const stack = useGame((s) => s.casino?.stack ?? 0)
  const bankroll = useGame((s) => s.bankroll)
  const [menu, setMenu] = useState(false)
  useEffect(() => {
    setBusy(!canLeave)
    return () => setBusy(false)
  }, [canLeave])
  const btn = 'grid h-11 w-11 place-items-center rounded-full bg-black/55 text-[#efe6cf] ring-1 ring-[#d4af5a]/40 active:scale-90'
  return (
    <>
      <div className="absolute left-3 top-3 z-30" style={{ paddingLeft: 'env(safe-area-inset-left)' }}>
        <button className={btn} onClick={() => setMenu(!menu)} aria-label="Menu" aria-expanded={menu}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        {menu && (
          <div className="mt-2 w-56 overflow-hidden rounded-xl bg-[#140e09]/97 py-1 shadow-2xl ring-1 ring-[#d4af5a]/40" role="menu">
            <div className="px-4 py-1.5 text-[12px] text-[#9d937c]">
              {title} · bankroll {formatMoney(bankroll)}
            </div>
            <button className="block w-full px-4 py-2.5 text-left text-[15px] text-[#efe6cf] active:bg-white/10" onClick={() => (setMenu(false), set({ dialog: 'settings' }))}>
              Settings
            </button>
            <button
              className="block w-full px-4 py-2.5 text-left text-[15px] text-[#ffb4a8] active:bg-white/10 disabled:opacity-40"
              disabled={!canLeave}
              onClick={() => (setMenu(false), set({ dialog: 'leave' }))}
            >
              {canLeave ? 'Leave table' : 'Leave (after this round)'}
            </button>
          </div>
        )}
      </div>
      <div className="absolute right-3 top-3 z-30 rounded-xl bg-black/55 px-4 py-2 text-right ring-1 ring-[#d4af5a]/30" style={{ marginRight: 'env(safe-area-inset-right)' }}>
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#d4af5a]/80">Your chips</div>
        <div className="font-display text-[26px] font-extrabold tabular-nums leading-tight text-[#f6e6b4]">{formatMoney(stack)}</div>
      </div>
      <LeaveDialog />
    </>
  )
}

/** A bet on the felt (SVG, centred on 0,0): a short stack of its top chip plus the amount. */
export function BetChips({ amount, width = 46 }: { amount: number; width?: number }) {
  const rack = greedy(amount)
  const top = Math.max(...Object.keys(rack).map(Number))
  const count = Math.min(6, Object.values(rack).reduce((a, n) => a + n, 0))
  const lw = 16 + formatMoney(amount).length * 8
  return (
    <g>
      {/* base of the stack sits on 0,0 */}
      <g transform={`translate(${-width / 2 - 2} ${-stackHeight(count, width) + (width / 2) * TILT + 2})`}>
        <ChipStack denom={top} count={count} width={width} />
      </g>
      <rect x={-lw / 2} y={width * 0.35} width={lw} height="18" rx="9" fill="rgba(0,0,0,.72)" />
      <text y={width * 0.35 + 13.5} textAnchor="middle" fontSize="13" fontFamily="var(--font-display)" fontWeight="800" fill="#f6e6b4">
        {formatMoney(amount)}
      </text>
    </g>
  )
}
