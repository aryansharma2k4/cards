import { Hand } from 'pokersolver'

/** Category index: 0 = High Card … 9 = Royal Flush. */
export const HAND_NAMES = [
  'High Card', 'One Pair', 'Two Pair', 'Three of a Kind', 'Straight',
  'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush',
] as const

export interface HandInfo {
  category: number
  name: string
  /** Human label, e.g. "Flush, Ace high". */
  label: string
  /** Card codes making up the best hand (up to five). */
  cards: string[]
}

const RANK_WORD: Record<string, [string, string]> = {
  A: ['Ace', 'Aces'], K: ['King', 'Kings'], Q: ['Queen', 'Queens'], J: ['Jack', 'Jacks'],
  T: ['Ten', 'Tens'], '9': ['Nine', 'Nines'], '8': ['Eight', 'Eights'], '7': ['Seven', 'Sevens'],
  '6': ['Six', 'Sixes'], '5': ['Five', 'Fives'], '4': ['Four', 'Fours'], '3': ['Three', 'Threes'],
  '2': ['Two', 'Twos'], '1': ['Ace', 'Aces'],
}

/** Best hand from 2–7 cards (pokersolver orders `cards` by significance). */
export function describeHand(cards: string[]): HandInfo {
  const h = Hand.solve(cards)
  const category = h.descr === 'Royal Flush' ? 9 : h.rank - 1
  const v = h.cards.map((c) => c.value)
  const one = (i: number) => RANK_WORD[v[i]][0]
  const many = (i: number) => RANK_WORD[v[i]][1]
  const label = [
    () => `${one(0)} high`,
    () => `Pair of ${many(0)}`,
    () => `Two pair, ${many(0)} and ${many(2)}`,
    () => `Three of a kind, ${many(0)}`,
    () => `Straight, ${one(0)} high`,
    () => `Flush, ${one(0)} high`,
    () => `Full house, ${many(0)} full of ${many(3)}`,
    () => `Four of a kind, ${many(0)}`,
    () => `Straight flush, ${one(0)} high`,
    () => 'Royal flush',
  ][category]()
  return {
    category,
    name: HAND_NAMES[category],
    label,
    cards: h.cards.map((c) => (c.value === '1' ? 'A' : c.value) + c.suit),
  }
}

/** Seats holding the best hand (several on a tie). */
export function bestHands(hands: Record<number, string[]>): number[] {
  const seats = Object.keys(hands).map(Number)
  const solved = seats.map((s) => Hand.solve(hands[s]))
  const win = new Set(Hand.winners(solved))
  return seats.filter((_, i) => win.has(solved[i]))
}
