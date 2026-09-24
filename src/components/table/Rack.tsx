import { useState } from 'react'
import { denomsDesc, formatMoney, chipLabel } from '../../engine/chips'
import { fly, get, set, useGame } from '../../game/store'
import { play } from '../../audio/sound'
import { T } from '../../game/director'
import { PILE, RACK, rackStack } from '../../ui/geometry'
import { ChipStack, stackHeight } from '../chips/Chip'
import { ChipCluster } from '../chips/ChipPile'

const MAX_VISIBLE = 20
const W = 50

/** Is the hero allowed to build a bet right now? */
export const canBuild = () => {
  const l = get().legal
  return !!l && (l.actions.includes('call') || l.actions.includes('bet') || l.actions.includes('raise'))
}

export function Rack() {
  const rack = useGame((s) => s.rack)
  const pile = useGame((s) => s.pile)
  const legal = useGame((s) => s.legal)
  const [inFlight, setInFlight] = useState(0)
  const denoms = denomsDesc(rack)
  const active = !!legal && canBuild()

  const add = (d: number, i: number) => {
    if (!canBuild() || !get().rack[d]) return
    set((s) => ({ rack: { ...s.rack, [d]: s.rack[d] - 1 }, pile: [...s.pile, d] }))
    play('chip', { minGap: 25 })
    setInFlight((n) => n + 1)
    const from = rackStack(i, denoms.length)
    const h = stackHeight(Math.min(rack[d], MAX_VISIBLE), W)
    fly({ kind: 'chips', from: { x: from.x, y: from.y - h + 12 }, to: PILE, duration: T(260), chips: [d] }).then(() => setInFlight((n) => n - 1))
  }

  const undo = () => {
    const { pile } = get()
    if (!pile.length) return
    const d = pile[pile.length - 1]
    set((s) => ({ pile: s.pile.slice(0, -1), rack: { ...s.rack, [d]: (s.rack[d] ?? 0) + 1 } }))
    play('chip', { rate: 0.9 })
  }

  const shown = pile.slice(0, Math.max(0, pile.length - inFlight))
  const total = pile.reduce((a, b) => a + b, 0)

  return (
    <>
      {/* wooden chip tray */}
      <div
        className="absolute rounded-[28px] border border-[#d4af5a]/40 shadow-[0_18px_40px_-12px_rgba(0,0,0,.95),inset_0_2px_0_rgba(255,255,255,.08)]"
        style={{
          left: RACK.x,
          top: RACK.y,
          width: RACK.w,
          height: RACK.h,
          background:
            'radial-gradient(ellipse at 50% 120%, rgba(0,0,0,.55), transparent 60%), repeating-linear-gradient(92deg, rgba(0,0,0,.08) 0 3px, rgba(255,255,255,.02) 3px 7px), linear-gradient(180deg,#4a2112,#2a1108)',
          zIndex: 5,
        }}
      >
        <div className="absolute inset-3 rounded-[20px] bg-[radial-gradient(ellipse_at_50%_30%,#1b4a32,#0b2618)] shadow-[inset_0_6px_18px_rgba(0,0,0,.75)]" />
        <div className="absolute left-4 top-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#d4af5a]/70">Your chips</div>
      </div>
      {denoms.map((d, i) => {
        const p = rackStack(i, denoms.length)
        const n = rack[d]
        return (
          <button
            key={d}
            onClick={() => add(d, i)}
            disabled={!active}
            aria-label={`Add a ${formatMoney(d)} chip to your bet (${n} in rack)`}
            title={active ? `Click to bet ${formatMoney(d)}` : `${n} × ${formatMoney(d)}`}
            className="group absolute flex flex-col items-center outline-none transition-transform duration-150 enabled:hover:-translate-y-1 enabled:active:translate-y-0 disabled:cursor-default"
            style={{ left: p.x, top: p.y, transform: 'translate(-50%, -100%)', zIndex: 6 }}
          >
            <div className="relative">
              <ChipStack denom={d} count={Math.min(n, MAX_VISIBLE)} width={W} />
              {n > MAX_VISIBLE && (
                <span className="absolute -right-3 -top-2 rounded-full bg-black/80 px-1.5 text-[11px] font-bold text-[#f6e6b4] ring-1 ring-[#d4af5a]/50">
                  ×{n}
                </span>
              )}
            </div>
            <span className="mt-1 rounded bg-black/40 px-1.5 text-[14px] font-bold tabular-nums text-[#efe6cf] group-enabled:group-hover:text-[#fff3c4]">
              {chipLabel(d)} <span className="opacity-60">×{n}</span>
            </span>
          </button>
        )
      })}
      {pile.length > 0 && (
        <button
          onClick={undo}
          aria-label={`Your bet in progress: ${formatMoney(total)}. Click to take back the last chip`}
          title="Click to take back the last chip"
          className="absolute flex flex-col items-center"
          style={{ left: PILE.x, top: PILE.y, transform: 'translate(-50%, -50%)', zIndex: 27 }}
        >
          <ChipCluster chips={shown} width={40} max={16} />
          <span className="mt-1 whitespace-nowrap rounded-full bg-[linear-gradient(180deg,#fbe7a6,#c9a24a)] px-3 py-0.5 text-[17px] font-bold tabular-nums text-[#241808] shadow-md">
            {formatMoney(total)}
          </span>
        </button>
      )}
    </>
  )
}
