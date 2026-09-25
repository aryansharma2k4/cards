/**
 * Five-reel, three-row video slot with 10 fixed paylines. Each reel stops at a
 * uniformly random position on its strip (crypto RNG); wins pay left to right
 * on a line for 3+ matching symbols (cherries pay from 2). The return to player
 * is computed exactly by `rtp()` and pinned by the tests.
 */

export type Sym = 'seven' | 'bar3' | 'bar' | 'bell' | 'gem' | 'plum' | 'lemon' | 'cherry'
export const SYMBOLS: Sym[] = ['seven', 'bar3', 'bar', 'bell', 'gem', 'plum', 'lemon', 'cherry']
export const REELS = 5
export const ROWS = 3

/** How many of each symbol on a strip (20 stops), spread so equal symbols rarely sit together. */
const COUNTS: Record<Sym, number> = { seven: 1, bar3: 1, bar: 2, bell: 2, gem: 3, plum: 3, lemon: 4, cherry: 4 }

function buildStrip(shift: number): Sym[] {
  const bag = SYMBOLS.flatMap((s) => Array<Sym>(COUNTS[s]).fill(s))
  // deterministic interleave: take every 5th item round the bag (3 and 20 are coprime)
  const strip = bag.map((_, i) => bag[(i * 3 + shift) % bag.length])
  return strip
}
export const STRIPS: Sym[][] = Array.from({ length: REELS }, (_, r) => buildStrip(r * 7))

/** Row (0 = top) on each reel, left to right. */
export const LINES: number[][] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [1, 0, 1, 2, 1],
]

/** Pays per line, as a multiple of the line bet, for 2/3/4/5 in a row. */
export const PAYS: Record<Sym, [number, number, number, number]> = {
  seven: [0, 200, 1000, 5000],
  bar3: [0, 100, 400, 1500],
  bar: [0, 60, 200, 800],
  bell: [0, 40, 150, 500],
  gem: [0, 30, 100, 400],
  plum: [0, 20, 60, 250],
  lemon: [0, 20, 45, 150],
  cherry: [4, 10, 40, 120],
}

/** Visible symbols [reel][row] for reel stop positions (stop = strip index shown in the top row). */
export const windowAt = (stops: number[]) => stops.map((st, r) => Array.from({ length: ROWS }, (_, row) => STRIPS[r][(st + row) % STRIPS[r].length]))

export interface LineWin {
  line: number
  sym: Sym
  count: number
  /** Multiple of the line bet. */
  pays: number
}

export function evaluate(win: Sym[][]): LineWin[] {
  const out: LineWin[] = []
  LINES.forEach((rows, line) => {
    const sym = win[0][rows[0]]
    let count = 1
    while (count < REELS && win[count][rows[count]] === sym) count++
    const pays = count >= 2 ? PAYS[sym][count - 2] : 0
    if (pays) out.push({ line, sym, count, pays })
  })
  return out
}

const secureInt = (n: number) => {
  const b = new Uint32Array(1)
  const limit = Math.floor(2 ** 32 / n) * n
  do crypto.getRandomValues(b)
  while (b[0] >= limit)
  return b[0] % n
}

export function spin(rand: (n: number) => number = secureInt) {
  const stops = STRIPS.map((s) => rand(s.length))
  const win = windowAt(stops)
  const wins = evaluate(win)
  return { stops, window: win, wins, pays: wins.reduce((a, w) => a + w.pays, 0) }
}

/**
 * Exact return per unit bet. Every row of a reel lands on each strip stop equally often and
 * reels are independent, so each line's expected pay is the same; total bet = lines × line bet.
 */
export function rtp(): number {
  const p = STRIPS.map((strip) => Object.fromEntries(SYMBOLS.map((s) => [s, strip.filter((x) => x === s).length / strip.length])) as Record<Sym, number>)
  let ev = 0
  for (const s of SYMBOLS)
    for (let k = 2; k <= REELS; k++) {
      let prob = 1
      for (let r = 0; r < k; r++) prob *= p[r][s]
      if (k < REELS) prob *= 1 - p[k][s]
      ev += prob * PAYS[s][k - 2]
    }
  return ev
}
