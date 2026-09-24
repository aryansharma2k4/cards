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
