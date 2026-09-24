import { Table } from 'poker-ts'
import { describeHand, bestHands, type HandInfo } from './evaluate'

/** Card code like "As", "Td", "7c". */
export type Card = string
export type Street = 'preflop' | 'flop' | 'turn' | 'river'
export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise'
/** For bet/raise, `amount` is the total bet this street ("raise to"). */
export interface Action {
  type: ActionType
  amount?: number
}

export interface LegalActions {
  seat: number
  actions: ActionType[]
  toCall: number
  /** Min/max "raise to" totals, present when bet or raise is legal. */
  min?: number
  max?: number
}

export interface SeatState {
  stack: number
  bet: number
}

export interface PotResult {
  amount: number
  /** Players who could win this pot. */
  eligible: number[]
  winners: number[]
  /** Chips each winner receives from this pot. */
  shares: Record<number, number>
}

export type EngineEvent =
  | { type: 'handStart'; button: number; seats: number[]; stacks: Record<number, number> }
  | { type: 'blind'; seat: number; amount: number; kind: 'small' | 'big' }
  | { type: 'deal'; seats: number[]; hero: Card[] | null }
  | { type: 'action'; seat: number; action: ActionType; amount: number; bet: number; stack: number; allIn: boolean }
  | { type: 'collect'; pot: number }
  | { type: 'street'; street: Exclude<Street, 'preflop'>; cards: Card[]; board: Card[] }
  | { type: 'showdown'; reveals: { seat: number; cards: Card[]; hand: HandInfo }[] }
  | { type: 'handEnd'; pots: PotResult[]; stacks: Record<number, number>; board: Card[]; uncontested: boolean }

type Listener = (e: EngineEvent) => void

const SUIT = { clubs: 'c', diamonds: 'd', hearts: 'h', spades: 's' } as const
const toCode = (c: { rank: string; suit: keyof typeof SUIT }): Card => c.rank + SUIT[c.suit]

/**
 * Typed wrapper over poker-ts. poker-ts deals, enforces betting order and legal
 * bet sizes; this class drives hand progression and turns it into a flat event
 * stream, enforcing card visibility (only the hero's hole cards leave before
 * showdown; folded hands never do).
 *
 * Pots and payouts are computed here from each player's contributions rather
 * than taken from poker-ts: its pot code (1.5.0) mishandles players who go
 * all-in before the river (drops them from pot eligibility and pays them into
 * a null reference). Final stacks are written back through its public API.
 */
export class PokerEngine {
  private table: InstanceType<typeof Table>
  private listeners: Listener[] = []
  private hole: (Card[] | null)[] = []
  private folded = new Set<number>()
  /** Stack of each dealt-in seat when the hand began (before blinds). */
  private start: Record<number, number> = {}
  /** Stack a player had left when they folded. */
  private foldStack: Record<number, number> = {}
  private lastAggressor: number | null = null
  private boardSeen = 0
  private btn = 0
  private readonly numSeats: number
  readonly heroSeat: number

  constructor(opts: { smallBlind: number; bigBlind: number; numSeats: number; heroSeat?: number }) {
    this.numSeats = opts.numSeats
    this.heroSeat = opts.heroSeat ?? 0
    this.table = new Table({ smallBlind: opts.smallBlind, bigBlind: opts.bigBlind }, opts.numSeats)
  }

  on(fn: Listener): () => void {
    this.listeners.push(fn)
    return () => (this.listeners = this.listeners.filter((l) => l !== fn))
  }
  private emit(e: EngineEvent) {
    for (const l of this.listeners) l(e)
  }

  sitDown(seat: number, chips: number) {
    this.table.sitDown(seat, chips)
  }
  standUp(seat: number) {
    this.table.standUp(seat)
  }

  get inProgress(): boolean {
    return this.table.isHandInProgress()
  }
  /** Button of the current (or last) hand. */
  get button(): number {
    return this.btn
  }
  get toAct(): number | null {
    return this.inProgress && this.table.isBettingRoundInProgress() ? this.table.playerToAct() : null
  }
  get street(): Street {
    return this.table.roundOfBetting()
  }
  get board(): Card[] {
    return this.inProgress ? this.table.communityCards().map(toCode) : []
  }

  /** Stack and current-street bet for every occupied seat. */
  seats(): (SeatState | null)[] {
    return this.table.seats().map((s, i) => {
      if (!s) return null
      if (this.inProgress && this.folded.has(i)) return { stack: this.foldStack[i], bet: 0 }
      return { stack: s.stack, bet: this.inProgress ? s.betSize : 0 }
    })
  }
  private contributed(seat: number): number {
    const s = this.seats()[seat]
    return (this.start[seat] ?? 0) - (s?.stack ?? 0)
  }
  /** Chips in the middle, including bets on the current street. */
  potTotal(): number {
    if (!this.inProgress) return 0
    return Object.keys(this.start).reduce((a, s) => a + this.contributed(Number(s)), 0)
  }
  /** Seats still holding cards this hand. */
  activeSeats(): number[] {
    const out: number[] = []
    this.hole.forEach((c, i) => c && !this.folded.has(i) && out.push(i))
    return out
  }
  /** Private: lets the AI controller see a bot's own cards. Never feed this to the UI. */
  holeCardsFor(seat: number): Card[] | null {
    return this.folded.has(seat) ? null : this.hole[seat]
  }

  getLegalActions(seat: number): LegalActions | null {
    if (this.toAct !== seat) return null
    const { actions, chipRange } = this.table.legalActions()
    const seats = this.seats()
    const me = seats[seat]!
    const biggest = Math.max(...seats.map((p) => p?.bet ?? 0))
    const toCall = Math.min(biggest - me.bet, me.stack)
    const canSize = actions.includes('bet') || actions.includes('raise')
    return {
      seat,
      actions,
      toCall,
      ...(canSize && chipRange ? { min: chipRange.min, max: chipRange.max } : {}),
    }
  }

  startHand() {
    this.folded.clear()
    this.foldStack = {}
    this.lastAggressor = null
    this.boardSeen = 0
    this.start = {}
    const seats: number[] = []
    this.table.seats().forEach((s, i) => {
      if (s) {
        seats.push(i)
        this.start[i] = s.stack
      }
    })
    this.table.startHand()
    this.btn = this.table.button()
    this.hole = this.table.holeCards().map((h) => (h ? h.map(toCode) : null))
    this.emit({ type: 'handStart', button: this.btn, seats, stacks: { ...this.start } })

    // Blinds: poker-ts has already posted them; report SB before BB.
    const now = this.seats()
    const posted = seats.filter((i) => (now[i]?.bet ?? 0) > 0)
    const order = this.clockwiseFrom(this.btn, posted, seats.length === 2)
    order.forEach((seat, k) =>
      this.emit({ type: 'blind', seat, amount: now[seat]!.bet, kind: k === 0 && order.length > 1 ? 'small' : 'big' }),
    )

    this.emit({ type: 'deal', seats: this.clockwiseFrom(this.btn, seats, false), hero: this.hole[this.heroSeat] ?? null })
    this.advance()
  }

  act(seat: number, action: Action) {
    const legal = this.getLegalActions(seat)
    if (!legal) throw new Error(`Seat ${seat} is not to act`)
    if (!legal.actions.includes(action.type)) throw new Error(`Illegal action ${action.type}`)
    const sized = action.type === 'bet' || action.type === 'raise'
    if (sized) {
      const amt = action.amount
      if (amt === undefined || amt < legal.min! || amt > legal.max!) throw new Error(`Bet ${amt} outside ${legal.min}–${legal.max}`)
    }
    const beforeStack = this.seats()[seat]!.stack
    if (action.type === 'fold') {
      this.foldStack[seat] = beforeStack
      this.folded.add(seat)
    }
    this.table.actionTaken(action.type, sized ? action.amount : undefined)
    if (sized) this.lastAggressor = seat

    const after = this.seats()[seat]!
    this.emit({
      type: 'action',
      seat,
      action: action.type,
      amount: beforeStack - after.stack,
      bet: after.bet,
      stack: after.stack,
      allIn: action.type !== 'fold' && after.stack === 0,
    })
    this.advance()
  }

  /** Move the hand forward until someone must act or the hand is over. */
  private advance() {
    while (this.table.isHandInProgress() && !this.table.isBettingRoundInProgress()) {
      if (!this.table.areBettingRoundsCompleted()) {
        const streetBefore = this.table.roundOfBetting()
        this.table.endBettingRound()
        this.emit({ type: 'collect', pot: this.potTotal() })
        this.emitNewStreets()
        if (this.table.roundOfBetting() !== streetBefore) this.lastAggressor = null
      }
      if (this.table.isHandInProgress() && this.table.areBettingRoundsCompleted()) {
        this.finish()
        return
      }
    }
  }

  /** poker-ts may deal several streets at once on an all-in runout; split them. */
  private emitNewStreets() {
    const board = this.table.communityCards().map(toCode)
    const cuts: [Exclude<Street, 'preflop'>, number][] = [['flop', 3], ['turn', 4], ['river', 5]]
    for (const [street, n] of cuts) {
      if (board.length >= n && this.boardSeen < n) {
        this.emit({ type: 'street', street, cards: board.slice(this.boardSeen, n), board: board.slice(0, n) })
        this.boardSeen = n
      }
    }
  }

  private finish() {
    const board = this.table.communityCards().map(toCode)
    const dealt = Object.keys(this.start).map(Number)
    const contrib: Record<number, number> = {}
    const stacks: Record<number, number> = {}
    for (const s of dealt) {
      contrib[s] = this.contributed(s)
      stacks[s] = this.start[s] - contrib[s]
    }
    const live = this.activeSeats()
    const uncontested = live.length === 1

    if (!uncontested) {
      this.emit({
        type: 'showdown',
        reveals: this.showdownOrder(live).map((seat) => ({
          seat,
          cards: this.hole[seat]!,
          hand: describeHand([...this.hole[seat]!, ...board]),
        })),
      })
    }

    const pots = buildPots(contrib, live).map((pot) => {
      const winners =
        pot.eligible.length === 1 ? pot.eligible : bestHands(Object.fromEntries(pot.eligible.map((s) => [s, [...this.hole[s]!, ...board]])))
      return { ...pot, winners, shares: splitPot(pot.amount, winners, this.btn, this.numSeats) }
    })
    for (const p of pots) for (const [s, amt] of Object.entries(p.shares)) stacks[Number(s)] += amt

    // Let poker-ts close the hand, then make its stacks match ours.
    try {
      this.table.showdown()
    } catch {
      // Its payout can assert in the all-in case described above; the hand is over either way.
    }
    for (const s of dealt) {
      const cur = this.table.seats()[s]
      if (cur?.stack === stacks[s]) continue
      if (cur) this.table.standUp(s)
      if (stacks[s] > 0) this.table.sitDown(s, stacks[s])
    }
    this.emit({ type: 'handEnd', pots, stacks, board, uncontested })
  }

  /** Last aggressor on the final street shows first, else first seat left of the button. */
  private showdownOrder(seats: number[]): number[] {
    const order = this.clockwiseFrom(this.btn, seats, false)
    const k = this.lastAggressor === null ? -1 : order.indexOf(this.lastAggressor)
    return k < 0 ? order : [...order.slice(k), ...order.slice(0, k)]
  }

  /** `seats` ordered clockwise starting after `from` (or at it when `inclusive`). */
  private clockwiseFrom(from: number, seats: number[], inclusive: boolean): number[] {
    const key = (s: number) => (s - from - (inclusive ? 0 : 1) + this.numSeats * 2) % this.numSeats
    return [...seats].sort((a, b) => key(a) - key(b))
  }
}

/**
 * Main pot + side pots from total contributions. Each live player's total is a
 * level; the pot up to a level is shared by live players who reached it.
 * Folded players' chips stay in whichever pots they reached.
 */
export function buildPots(contrib: Record<number, number>, live: number[]): { amount: number; eligible: number[] }[] {
  const levels = [...new Set(live.map((s) => contrib[s]))].sort((a, b) => a - b)
  const all = Object.keys(contrib).map(Number)
  const pots: { amount: number; eligible: number[] }[] = []
  let prev = 0
  for (const level of levels) {
    const amount = all.reduce((a, s) => a + Math.min(contrib[s], level) - Math.min(contrib[s], prev), 0)
    if (amount > 0) pots.push({ amount, eligible: live.filter((s) => contrib[s] >= level) })
    prev = level
  }
  // A folded player can't out-contribute every live player, but never drop chips if they did.
  const extra = all.reduce((a, s) => a + Math.max(0, contrib[s] - prev), 0)
  if (extra && pots.length) pots[pots.length - 1].amount += extra
  return pots
}

/** Equal shares, odd chips clockwise from the button (standard rule). */
export function splitPot(amount: number, winners: number[], button: number, numSeats: number) {
  const shares: Record<number, number> = {}
  if (!winners.length) return shares
  const base = Math.floor(amount / winners.length)
  let odd = amount - base * winners.length
  const order = [...winners].sort((a, b) => ((a - button - 1 + numSeats) % numSeats) - ((b - button - 1 + numSeats) % numSeats))
  for (const w of order) shares[w] = base + (odd-- > 0 ? 1 : 0)
  return shares
}
