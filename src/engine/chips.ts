/** Chip denominations, ascending. */
export const DENOMS = [
  1, 2, 5, 10, 20, 50, 100, 500, 1_000, 10_000, 100_000, 500_000, 1_000_000, 10_000_000, 50_000_000,
  100_000_000, 1_000_000_000,
] as const

/** denomination → count */
export type Rack = Record<number, number>

export const rackTotal = (r: Rack) => Object.entries(r).reduce((a, [d, n]) => a + Number(d) * n, 0)
export const rackCount = (r: Rack) => Object.values(r).reduce((a, n) => a + n, 0)

function add(r: Rack, d: number, n: number) {
  if (n) r[d] = (r[d] ?? 0) + n
  if (r[d] === 0) delete r[d]
}

/** Fewest chips for an amount (used for bets and pots). */
export function greedy(amount: number): Rack {
  const r: Rack = {}
  for (let i = DENOMS.length - 1; i >= 0 && amount > 0; i--) {
    const n = Math.floor(amount / DENOMS[i])
    add(r, DENOMS[i], n)
    amount -= n * DENOMS[i]
  }
  return r
}

/**
 * A playable stack: each denomination leaves roughly two of itself in
 * smaller change, so there's always a spread of chips to bet with.
 * `minDenom` (usually the small blind) is the smallest chip we aim for.
 */
export function breakdown(amount: number, minDenom = 1): Rack {
  const r: Rack = {}
  let rem = amount
  for (let i = DENOMS.length - 1; i >= 0; i--) {
    const d = DENOMS[i]
    if (d < minDenom) break
    const reserve = d === minDenom ? 0 : Math.min(rem, 2 * d)
    const n = Math.floor((rem - reserve) / d)
    add(r, d, n)
    rem -= n * d
  }
  for (const [d, n] of Object.entries(greedy(rem))) add(r, Number(d), n) // odd change below minDenom
  return r
}

/**
 * Take exactly `amount` out of `rack`. Uses the biggest chips that fit, and
 * breaks a larger chip into change when needed. Returns the chips paid and the
 * rack left over, or null if the rack can't cover it.
 */
export function pay(rack: Rack, amount: number): { paid: Rack; left: Rack } | null {
  if (rackTotal(rack) < amount) return null
  const left = { ...rack }
  const paid: Rack = {}
  let rem = amount
  while (rem > 0) {
    const fit = DENOMS.filter((d) => d <= rem && left[d]).at(-1)
    if (fit) {
      const n = Math.min(left[fit], Math.floor(rem / fit))
      add(left, fit, -n)
      add(paid, fit, n)
      rem -= n * fit
      continue
    }
    // nothing small enough: break the smallest larger chip into change
    const big = DENOMS.find((d) => d > rem && left[d])!
    add(left, big, -1)
    for (const [d, n] of Object.entries(breakdown(big, 1))) add(left, Number(d), n)
  }
  return { paid, left }
}

/** Smallest bigger denomination that `d` chips add up to exactly. */
export function colorUpTarget(d: number): number | undefined {
  return DENOMS.find((t) => t > d && t % d === 0)
}

/** Swap `ratio` chips of `from` for one chip of its color-up target, as many times as possible (or `times`). */
export function colorUp(rack: Rack, from: number, times = Infinity): Rack {
  const to = colorUpTarget(from)
  if (!to) return rack
  const ratio = to / from
  const n = Math.min(times, Math.floor((rack[from] ?? 0) / ratio))
  const r = { ...rack }
  add(r, from, -n * ratio)
  add(r, to, n)
  return r
}

/** Rack is "cluttered" when it has too many chips to read at a glance. */
export const isCluttered = (r: Rack) => rackCount(r) > 60 || Object.values(r).some((n) => n > 30)

/** Denominations present, high → low. */
export const denomsDesc = (r: Rack) =>
  Object.keys(r)
    .map(Number)
    .filter((d) => r[d] > 0)
    .sort((a, b) => b - a)

export function formatMoney(n: number): string {
  return '$' + n.toLocaleString('en-US')
}

/** Short chip label: 1, 500, 1K, 10K, 1M, 1B. */
export function chipLabel(d: number): string {
  if (d >= 1e9) return `${d / 1e9}B`
  if (d >= 1e6) return `${d / 1e6}M`
  if (d >= 1e3) return `${d / 1e3}K`
  return String(d)
}
