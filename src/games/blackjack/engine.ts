/**
 * Blackjack rules engine (no UI). 6-deck shoe, dealer peeks for blackjack,
 * dealer stands on all 17s, blackjack pays 3:2, insurance pays 2:1, double on
 * any first two cards (also after a split), split up to 4 hands, split aces
 * get one card each. Actions emit events the table animates in order.
 */

export type Card = string // "As", "Td", …
export type Result = 'win' | 'lose' | 'push' | 'blackjack'

export interface Hand {
  cards: Card[]
  bet: number
  doubled: boolean
  done: boolean
  splitAces: boolean
  fromSplit: boolean
  result?: Result
  /** Chips returned to the player for this hand (stake included). */
  payout?: number
}

export type BJEvent =
  | { type: 'shuffle' }
  | { type: 'card'; to: 'dealer' | number; card: Card; faceUp: boolean }
  | { type: 'reveal'; card: Card }
  | { type: 'split'; hand: number }
  | { type: 'double'; hand: number }
  | { type: 'turn'; hand: number }
  | { type: 'insurance'; bet: number; won: boolean; payout: number }
  | { type: 'result'; hand: number; result: Result; payout: number; total: number; dealer: number }
  | { type: 'over' }

export type Phase = 'betting' | 'insurance' | 'player' | 'over'
export type Action = 'hit' | 'stand' | 'double' | 'split'

const RANK_VALUE: Record<string, number> = { A: 11, K: 10, Q: 10, J: 10, T: 10 }
export const cardValue = (c: Card) => RANK_VALUE[c[0]] ?? Number(c[0])

/** Best total and whether an ace is still counted as 11. */
export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0
  let aces = 0
  for (const c of cards) {
    total += cardValue(c)
    if (c[0] === 'A') aces++
  }
  while (total > 21 && aces) {
    total -= 10
    aces--
  }
  return { total, soft: aces > 0 }
}
export const isBlackjack = (cards: Card[]) => cards.length === 2 && handValue(cards).total === 21

const secureRandom = () => {
  const b = new Uint32Array(1)
  crypto.getRandomValues(b)
  return b[0] / 2 ** 32
}

export class Shoe {
  private cards: Card[] = []
  private dealt = 0
  private decks: number
  private rand: () => number
  constructor(decks = 6, rand: () => number = secureRandom) {
    this.decks = decks
    this.rand = rand
    this.shuffle()
  }
  shuffle() {
    const deck = [...'23456789TJQKA'].flatMap((r) => [...'shdc'].map((s) => r + s))
    this.cards = Array.from({ length: this.decks }, () => deck).flat()
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1))
      ;[this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]]
    }
    this.dealt = 0
  }
  /** Cut card at 75% penetration. */
  get needsShuffle() {
    return this.dealt > this.cards.length * 0.75
  }
  draw(): Card {
    return this.cards[this.dealt++]
  }
  /** Tests only: put these cards on top of the shoe. */
  stack(cards: Card[]) {
    this.cards.splice(this.dealt, 0, ...cards)
  }
}

export class Blackjack {
  shoe: Shoe
  dealer: Card[] = []
  hands: Hand[] = []
  active = 0
  phase: Phase = 'betting'
  insuranceBet = 0
  private out: BJEvent[] = []

  constructor(shoe = new Shoe()) {
    this.shoe = shoe
  }

  private emit(e: BJEvent) {
    this.out.push(e)
  }
  private flush() {
    const e = this.out
    this.out = []
    return e
  }
  private give(to: 'dealer' | number, faceUp = true) {
    const card = this.shoe.draw()
    if (to === 'dealer') this.dealer.push(card)
    else this.hands[to].cards.push(card)
    this.emit({ type: 'card', to, card, faceUp })
    return card
  }

  get upcard() {
    return this.dealer[0]
  }
  /** Total chips staked this round (hands + insurance). */
  get staked() {
    return this.hands.reduce((a, h) => a + h.bet, 0) + this.insuranceBet
  }

  /** Start a round with one hand of `bet`. */
  deal(bet: number): BJEvent[] {
    if (this.phase !== 'betting' && this.phase !== 'over') throw new Error('round in progress')
    if (this.shoe.needsShuffle) {
      this.shoe.shuffle()
      this.emit({ type: 'shuffle' })
    }
    this.dealer = []
    this.hands = [{ cards: [], bet, doubled: false, done: false, splitAces: false, fromSplit: false }]
    this.active = 0
    this.insuranceBet = 0
    this.give(0)
    this.give('dealer')
    this.give(0)
    this.give('dealer', false)
    if (this.upcard[0] === 'A') {
      this.phase = 'insurance'
      return this.flush()
    }
    this.afterPeek()
    return this.flush()
  }

  /** Answer the insurance offer (only when the dealer shows an ace). Insurance costs half the bet. */
  insurance(take: boolean): BJEvent[] {
    if (this.phase !== 'insurance') throw new Error('no insurance offered')
    // half the bet, in whole dollars (no 50¢ chips)
    if (take) this.insuranceBet = Math.floor(this.hands[0].bet / 2)
    this.afterPeek()
    return this.flush()
  }

  /** Dealer checks for blackjack, then either settles or hands the turn to the player. */
  private afterPeek() {
    const dealerBJ = isBlackjack(this.dealer)
    if (this.insuranceBet) {
      const payout = dealerBJ ? this.insuranceBet * 3 : 0
      this.emit({ type: 'insurance', bet: this.insuranceBet, won: dealerBJ, payout })
    }
    const playerBJ = isBlackjack(this.hands[0].cards)
    if (dealerBJ || playerBJ) {
      this.emit({ type: 'reveal', card: this.dealer[1] })
      this.hands[0].done = true
      this.settle()
      return
    }
    this.phase = 'player'
    this.emit({ type: 'turn', hand: 0 })
  }

  legal(): Action[] {
    if (this.phase !== 'player') return []
    const h = this.hands[this.active]
    const a: Action[] = ['hit', 'stand']
    if (h.cards.length === 2 && !h.splitAces) a.push('double')
    if (h.cards.length === 2 && cardValue(h.cards[0]) === cardValue(h.cards[1]) && this.hands.length < 4 && !h.splitAces) a.push('split')
    return a
  }

  act(action: Action): BJEvent[] {
    if (!this.legal().includes(action)) throw new Error(`illegal ${action}`)
    const i = this.active
    const h = this.hands[i]
    if (action === 'hit') {
      this.give(i)
      if (handValue(h.cards).total >= 21) h.done = true
    } else if (action === 'stand') {
      h.done = true
    } else if (action === 'double') {
      h.bet *= 2
      h.doubled = true
      this.emit({ type: 'double', hand: i })
      this.give(i)
      h.done = true
    } else {
      const aces = h.cards[0][0] === 'A'
      const moved = h.cards.pop()!
      const twin: Hand = { cards: [moved], bet: h.bet, doubled: false, done: false, splitAces: aces, fromSplit: true }
      h.fromSplit = true
      h.splitAces = aces
      this.hands.splice(i + 1, 0, twin)
      this.emit({ type: 'split', hand: i })
      this.give(i)
      if (aces) {
        h.done = true
        this.give(i + 1)
        twin.done = true
      } else if (handValue(h.cards).total === 21) h.done = true
    }
    this.advance()
    return this.flush()
  }

  /** Move to the next unfinished hand, or let the dealer play. */
  private advance() {
    while (this.active < this.hands.length) {
      const h = this.hands[this.active]
      if (!h.done && h.cards.length === 1) {
        // second card for a split hand when its turn comes
        this.give(this.active)
        if (handValue(h.cards).total === 21) h.done = true
      }
      if (!h.done) {
        this.emit({ type: 'turn', hand: this.active })
        return
      }
      this.active++
    }
    this.dealerPlays()
  }

  private dealerPlays() {
    this.emit({ type: 'reveal', card: this.dealer[1] })
    const live = this.hands.some((h) => handValue(h.cards).total <= 21)
    if (live) while (handValue(this.dealer).total < 17) this.give('dealer')
    this.settle()
  }

  private settle() {
    const d = handValue(this.dealer).total
    const dealerBJ = isBlackjack(this.dealer)
    this.hands.forEach((h, i) => {
      const p = handValue(h.cards).total
      const natural = isBlackjack(h.cards) && !h.fromSplit
      let result: Result
      if (p > 21) result = 'lose'
      else if (natural && !dealerBJ) result = 'blackjack'
      else if (dealerBJ) result = natural ? 'push' : 'lose'
      else if (d > 21 || p > d) result = 'win'
      else if (p === d) result = 'push'
      else result = 'lose'
      // 3:2, rounded down to whole dollars on odd bets
      const payout = result === 'blackjack' ? h.bet + Math.floor(h.bet * 1.5) : result === 'win' ? h.bet * 2 : result === 'push' ? h.bet : 0
      h.result = result
      h.payout = payout
      this.emit({ type: 'result', hand: i, result, payout, total: p, dealer: d })
    })
    this.phase = 'over'
    this.emit({ type: 'over' })
  }
}
