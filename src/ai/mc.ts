import { cardCodes, evaluateCardCodes } from 'phe'

const DECK = [...'23456789TJQKA'].flatMap((r) => [...'shdc'].map((s) => r + s))

/**
 * Monte Carlo equity of `hole` against `opponents` random hands, sharing
 * pot on ties. phe scores are "lower is better".
 */
export function equity(hole: string[], board: string[], opponents: number, iterations: number, rand = Math.random): number {
  if (opponents < 1) return 1
  const dead = new Set([...hole, ...board])
  const deck = cardCodes(DECK.filter((c) => !dead.has(c)))
  const mine = cardCodes(hole)
  const known = cardCodes(board)
  const need = 5 - known.length
  const draw = need + 2 * opponents
  const n = deck.length
  const seven = new Array<number>(7)
  let score = 0
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < draw; i++) {
      const j = i + Math.floor(rand() * (n - i))
      const t = deck[i]
      deck[i] = deck[j]
      deck[j] = t
    }
    for (let i = 0; i < known.length; i++) seven[i + 2] = known[i]
    for (let i = 0; i < need; i++) seven[known.length + i + 2] = deck[i]
    seven[0] = mine[0]
    seven[1] = mine[1]
    const me = evaluateCardCodes(seven)
    let ties = 1
    let lost = false
    for (let o = 0; o < opponents && !lost; o++) {
      seven[0] = deck[need + 2 * o]
      seven[1] = deck[need + 2 * o + 1]
      const v = evaluateCardCodes(seven)
      if (v < me) lost = true
      else if (v === me) ties++
    }
    if (!lost) score += 1 / ties
  }
  return score / iterations
}

const RANKS = '23456789TJQKA'
/** Starting-hand class: "AKs", "AKo", "77". */
const handClass = (a: string, b: string) => {
  const [hi, lo] = RANKS.indexOf(a[0]) >= RANKS.indexOf(b[0]) ? [a, b] : [b, a]
  return hi[0] + lo[0] + (hi[0] === lo[0] ? '' : hi[1] === lo[1] ? 's' : 'o')
}

let percentile: Map<string, number> | null = null
/** Each starting-hand class → share of all 1326 combos that are at least as strong (AA ≈ 0.005, 72o = 1). */
function strengthPercentile() {
  if (percentile) return percentile
  const classes: { key: string; hand: string[]; combos: number; eq: number }[] = []
  for (let i = 0; i < 13; i++)
    for (let j = 0; j <= i; j++) {
      const [h, l] = [RANKS[i], RANKS[j]]
      if (i === j) classes.push({ key: h + l, hand: [h + 's', l + 'h'], combos: 6, eq: 0 })
      else {
        classes.push({ key: h + l + 's', hand: [h + 's', l + 's'], combos: 4, eq: 0 })
        classes.push({ key: h + l + 'o', hand: [h + 's', l + 'h'], combos: 12, eq: 0 })
      }
    }
  // fixed seed: the ranking is the same on every device
  let seed = 7
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
  for (const c of classes) c.eq = equity(c.hand, [], 1, 800, rnd)
  classes.sort((a, b) => b.eq - a.eq)
  percentile = new Map()
  let acc = 0
  for (const c of classes) percentile.set(c.key, (acc += c.combos) / 1326)
  return percentile
}

/**
 * Pre-flop equity of `hole` against `opponents` hands drawn from the top `range`
 * share of starting hands (0.1 = the best 10%), e.g. an estimate of what a player shoves.
 */
export function equityVsRange(hole: string[], opponents: number, range: number, iterations: number, rand = Math.random): number {
  if (opponents < 1) return 1
  const pct = strengthPercentile()
  const cards = DECK.filter((c) => !hole.includes(c))
  const mine = cardCodes(hole)
  const codes = cardCodes(cards)
  const seven = new Array<number>(7)
  const used = new Uint8Array(cards.length)
  let score = 0
  for (let it = 0; it < iterations; it++) {
    used.fill(0)
    const pick = () => {
      let k
      do k = Math.floor(rand() * cards.length)
      while (used[k])
      used[k] = 1
      return k
    }
    const opp: number[][] = []
    for (let o = 0; o < opponents; o++) {
      let a = 0
      let b = 0
      for (let tries = 0; ; tries++) {
        a = pick()
        b = pick()
        if (tries > 300 || pct.get(handClass(cards[a], cards[b]))! <= range + 1e-9) break
        used[a] = used[b] = 0
      }
      opp.push([codes[a], codes[b]])
    }
    for (let i = 2; i < 7; i++) seven[i] = codes[pick()]
    seven[0] = mine[0]
    seven[1] = mine[1]
    const me = evaluateCardCodes(seven)
    let ties = 1
    let lost = false
    for (const [a, b] of opp) {
      seven[0] = a
      seven[1] = b
      const v = evaluateCardCodes(seven)
      if (v < me) lost = true
      else if (v === me) ties++
      if (lost) break
    }
    if (!lost) score += 1 / ties
  }
  return score / iterations
}
