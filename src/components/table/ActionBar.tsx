import { useEffect } from 'react'
import { get, set, useGame } from '../../game/store'
import { game } from '../../game/controller'
import { checkPile, quickTarget } from '../../game/betting'
import { formatMoney, pay, type Rack } from '../../engine/chips'
import { play } from '../../audio/sound'
import { Button, Slider } from '../ui/kit'
import { MOBILE } from '../../ui/device'

const expand = (r: Rack) =>
  Object.entries(r)
    .map(([d, n]) => [Number(d), n] as const)
    .sort((a, b) => b[0] - a[0])
    .flatMap(([d, n]) => Array<number>(n).fill(d))

/** Rebuild the bet pile so it totals exactly `p` (chips come out of the rack). */
function buildPile(p: number) {
  const { rack, pile } = get()
  const all: Rack = { ...rack }
  for (const d of pile) all[d] = (all[d] ?? 0) + 1
  const res = pay(all, p)
  if (!res) return
  set({ rack: res.left, pile: expand(res.paid) })
}

export function ActionBar() {
  const legal = useGame((s) => s.legal)
  const pile = useGame((s) => s.pile)
  const table = useGame((s) => s.table)
  const heroSeat = useGame((s) => s.seats[0])
  const total = pile.reduce((a, b) => a + b, 0)
  const ctx = legal ? game.heroContext() : null
  const check = legal && ctx ? checkPile(legal, total, ctx.bet, ctx.stack) : null
  const canSize = !!legal && legal.min !== undefined
  const unit = table?.unit ?? 1

  const act = {
    fold: () => legal?.actions.includes('fold') && game.heroAct({ type: 'fold' }),
    checkCall: () => {
      if (!legal) return
      game.heroAct(legal.actions.includes('check') ? { type: 'check' } : { type: 'call' })
    },
    allIn: () => {
      if (!legal) return
      if (legal.max !== undefined) game.heroAct({ type: legal.actions.includes('bet') ? 'bet' : 'raise', amount: legal.max })
      else game.heroAct({ type: 'call' })
    },
    confirm: () => check?.action && game.heroAct(check.action),
    clear: () => {
      if (get().pile.length) play('stack')
      game.returnPile()
    },
    quick: (k: Parameters<typeof quickTarget>[0]) => {
      if (!legal || !ctx) return
      buildPile(quickTarget(k, legal, ctx.pot, ctx.bet, unit) - ctx.bet)
      play('stack')
    },
  }

  // Keyboard: F fold, C check/call, R focus raise slider, Enter confirm, Esc clear.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return
      if (document.querySelector('dialog[open]')) return
      const k = e.key.toLowerCase()
      if (k === 'f') act.fold()
      else if (k === 'c') act.checkCall()
      else if (k === 'r') document.getElementById('raise-slider')?.focus()
      else if (k === 'enter') act.confirm()
      else if (k === 'escape') act.clear()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const waiting = !legal
  const canCheck = legal?.actions.includes('check')
  const raiseTo = (ctx?.bet ?? 0) + total
  const sliderVal = canSize ? Math.min(legal!.max!, Math.max(legal!.min!, raiseTo)) : 0

  return (
    <div
      className={
        MOBILE
          ? 'flex flex-col gap-1.5'
          : 'absolute flex flex-col gap-2 rounded-2xl border border-[#d4af5a]/35 bg-[linear-gradient(180deg,rgba(24,18,12,.92),rgba(10,8,6,.95))] p-3 shadow-[0_20px_50px_-15px_rgba(0,0,0,.95)]'
      }
      style={MOBILE ? undefined : { left: 1150, top: 824, width: 430, zIndex: 30 }}
      aria-label="Your actions"
    >
      <div className={`flex items-center justify-between ${MOBILE ? 'min-h-5 text-[12px] leading-tight' : 'h-6 text-[15px]'}`}>
        {waiting ? (
          <span className="text-[#bfb49a]">{heroSeat?.folded ? 'You folded, finishing the hand…' : 'Waiting for opponents…'}</span>
        ) : check?.hint ? (
          <span className="font-semibold text-[#ffcf8a]" role="alert">{MOBILE ? check.hint.replace('Click', 'Tap') : check.hint}</span>
        ) : (
          <span className="text-[#bfb49a]">
            {legal!.toCall > 0 ? `${formatMoney(legal!.toCall)} to call` : 'Your action'}
            {total > 0 && <> · pile <b className="text-[#f6e6b4]">{formatMoney(total)}</b></>}
          </span>
        )}
        {total > 0 && (
          <button onClick={act.clear} className="text-[12px] font-semibold uppercase tracking-wider text-[#d4af5a] hover:text-[#fff3c4]">
            Clear
          </button>
        )}
      </div>

      <div className={MOBILE ? 'grid grid-cols-5 gap-1' : 'grid grid-cols-5 gap-1.5'}>
        {(
          [
            ['min', 'Min'],
            ['half', '½ Pot'],
            ['threeq', '¾ Pot'],
            ['pot', 'Pot'],
            ['max', 'All-in'],
          ] as const
        ).map(([k, l]) => (
          <Button key={k} size="sm" variant="felt" disabled={!canSize} onClick={() => act.quick(k)} className={MOBILE ? 'h-9 px-0 text-[11px] tracking-normal' : 'px-0'}>
            {MOBILE && l.endsWith(' Pot') ? l.replace(' Pot', '') : l}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Slider
          id="raise-slider"
          label="Raise amount"
          min={legal?.min ?? 0}
          max={legal?.max ?? 1}
          step={unit}
          value={sliderVal}
          onChange={(v) => {
            if (!canSize || !ctx) return
            buildPile(v - ctx.bet)
            play('chip', { minGap: 70, volume: 0.6 })
          }}
        />
        <span className={`shrink-0 text-right font-display font-bold tabular-nums text-[#f6e6b4] ${MOBILE ? 'w-16 text-[14px]' : 'w-24 text-[19px]'}`}>
          {canSize ? formatMoney(sliderVal) : '—'}
        </span>
      </div>

      {MOBILE ? (
        <>
          {check?.action && total > 0 ? (
            <Button variant="gold" onClick={act.confirm} className="h-12 w-full text-[16px]">
              {check.label}
            </Button>
          ) : (
            <Button variant="gold" disabled={waiting} onClick={act.allIn} className="h-12 w-full text-[16px]">
              All-in
            </Button>
          )}
          <div className="grid grid-cols-2 gap-1.5">
            <Button variant="danger" disabled={waiting} onClick={act.fold} className="h-12 px-1 text-[15px]">
              Fold
            </Button>
            <Button variant="wood" disabled={waiting} onClick={act.checkCall} className="h-12 px-1 text-[14px]">
              {waiting ? 'Check' : canCheck ? 'Check' : legal!.toCall >= (ctx?.stack ?? 0) ? `All-in ${formatMoney(legal!.toCall)}` : `Call ${formatMoney(legal!.toCall)}`}
            </Button>
          </div>
        </>
      ) : (
      <div className="flex gap-2">
        <Button variant="danger" kbd="F" disabled={waiting} onClick={act.fold} className="px-4">
          Fold
        </Button>
        <Button variant="wood" kbd="C" disabled={waiting} onClick={act.checkCall} className="px-4">
          {waiting ? 'Check' : canCheck ? 'Check' : legal!.toCall >= (ctx?.stack ?? 0) ? `All-in ${formatMoney(legal!.toCall)}` : `Call ${formatMoney(legal!.toCall)}`}
        </Button>
        {check?.action && total > 0 ? (
          <Button variant="gold" kbd="↵" onClick={act.confirm} className="min-w-0 flex-1 px-3">
            {check.label}
          </Button>
        ) : (
          <Button variant="gold" disabled={waiting} onClick={act.allIn} className="min-w-0 flex-1 px-3">
            All-in
          </Button>
        )}
      </div>
      )}
    </div>
  )
}
