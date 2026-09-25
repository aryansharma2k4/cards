/** European single-zero roulette: wheel order, colours, bets and payouts. */

export const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])
export const colorOf = (n: number) => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black')

/**
 * A bet is the set of numbers it covers. Payout (winnings, stake not included)
 * is 36 / count − 1: straight 35, split 17, street 11, corner 8, six-line 5,
 * dozen/column 2, even-money 1. Zero only wins bets that name it.
 */
export interface BetSpot {
  key: string
  label: string
  numbers: number[]
}
export const payoutFor = (spot: BetSpot) => 36 / spot.numbers.length - 1

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
const spot = (label: string, numbers: number[]): BetSpot => ({ key: [...numbers].sort((x, y) => x - y).join('-'), label, numbers })

/** Number at column c (0..11) and row r (0 = top: 3,6,…; 2 = bottom: 1,4,…) of the layout. */
export const cellNumber = (c: number, r: number) => 3 * c + (3 - r)

export const OUTSIDE = {
  low: spot('1 to 18', range(1, 18)),
  high: spot('19 to 36', range(19, 36)),
  even: spot('Even', range(1, 36).filter((n) => n % 2 === 0)),
  odd: spot('Odd', range(1, 36).filter((n) => n % 2 === 1)),
  red: spot('Red', [...RED]),
  black: spot('Black', range(1, 36).filter((n) => !RED.has(n))),
  dozen1: spot('1st 12', range(1, 12)),
  dozen2: spot('2nd 12', range(13, 24)),
  dozen3: spot('3rd 12', range(25, 36)),
  // "2 to 1" columns, top row (3,6,…) to bottom row (1,4,…)
  col3: spot('Column 3', range(0, 11).map((c) => cellNumber(c, 0))),
  col2: spot('Column 2', range(0, 11).map((c) => cellNumber(c, 1))),
  col1: spot('Column 1', range(0, 11).map((c) => cellNumber(c, 2))),
}

export const straight = (n: number) => spot(String(n), [n])
export const split = (a: number, b: number) => spot(`${Math.min(a, b)}/${Math.max(a, b)}`, [a, b])
export const street = (c: number) => spot(`Street ${cellNumber(c, 2)}–${cellNumber(c, 0)}`, [cellNumber(c, 2), cellNumber(c, 1), cellNumber(c, 0)])
export const corner = (c: number, r: number) =>
  spot(`Corner ${[cellNumber(c, r), cellNumber(c, r + 1), cellNumber(c + 1, r), cellNumber(c + 1, r + 1)].sort((a, b) => a - b).join('/')}`, [
    cellNumber(c, r),
    cellNumber(c, r + 1),
    cellNumber(c + 1, r),
    cellNumber(c + 1, r + 1),
  ])
export const sixLine = (c: number) => spot(`Six line ${cellNumber(c, 2)}–${cellNumber(c + 1, 0)}`, [...street(c).numbers, ...street(c + 1).numbers])

export type Bets = Record<string, { spot: BetSpot; amount: number }>

/** Chips returned per bet (stake + winnings) for a result; losing bets are absent. */
export function settle(bets: Bets, result: number): { total: number; won: Record<string, number> } {
  const won: Record<string, number> = {}
  let total = 0
  for (const [key, { spot, amount }] of Object.entries(bets)) {
    if (!spot.numbers.includes(result)) continue
    const back = amount * (payoutFor(spot) + 1)
    won[key] = back
    total += back
  }
  return { total, won }
}

/** Uniform 0–36 from the platform's cryptographic RNG (rejection sampling, no modulo bias). */
export function spinResult(): number {
  const b = new Uint32Array(1)
  const limit = Math.floor(2 ** 32 / 37) * 37
  do crypto.getRandomValues(b)
  while (b[0] >= limit)
  return b[0] % 37
}
