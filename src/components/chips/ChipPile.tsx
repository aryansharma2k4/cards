import { memo } from 'react'
import { greedy, formatMoney } from '../../engine/chips'
import { ChipStack } from './Chip'

/** Group a list of chip denominations into stacks, high → low. */
export function groupChips(chips: number[]): [number, number][] {
  const m = new Map<number, number>()
  for (const d of chips) m.set(d, (m.get(d) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[0] - a[0])
}

export const ChipCluster = memo(function ChipCluster({ chips, width = 34, max = 12 }: { chips: number[]; width?: number; max?: number }) {
  return (
    <div className="flex items-end" style={{ gap: 1 }}>
      {groupChips(chips).map(([d, n]) => (
        <ChipStack key={d} denom={d} count={Math.min(n, max)} width={width} />
      ))}
    </div>
  )
})

/** Chips for an amount (bet or pot) with a value label; anchored at its centre. */
export const ChipPile = memo(function ChipPile({ amount, width = 34, label = true }: { amount: number; width?: number; label?: boolean }) {
  if (amount <= 0) return null
  const stacks = Object.entries(greedy(amount))
    .map(([d, n]) => [Number(d), n] as const)
    .sort((a, b) => b[0] - a[0])
    .slice(0, 5)
  return (
    <div className="flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1" style={{ animation: 'pop-in .25s ease-out' }}>
      <div className="flex items-end" style={{ gap: 1 }}>
        {stacks.map(([d, n]) => (
          <ChipStack key={d} denom={d} count={Math.min(n, 10)} width={width} />
        ))}
      </div>
      {label && (
        <div className="rounded-full bg-black/60 px-2.5 py-0.5 font-sans text-[13px] font-bold tabular-nums text-[#f6e6b4] ring-1 ring-[#d4af5a]/40 backdrop-blur-sm">
          {formatMoney(amount)}
        </div>
      )}
    </div>
  )
})
