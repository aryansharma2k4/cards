import { Table } from 'poker-ts'
import { describeHand, type HandInfo } from './evaluate'

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
 * Thin typed wrapper over poker-ts. It owns hand progression (ending betting
 * rounds, running out boards, showdown) and turns it into a flat event stream,
 * enforcing card visibility: only the hero's hole cards ever leave this class
 * before showdown, and folded hands never do.
 */
export class PokerEngine {
  private table: InstanceType<typeof Table>
  private listeners: Listener[] = []
  private hole: (Card[] | null)[] = []
  private folded = new Set<number>()
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
  setBlinds(smallBlind: number, bigBlind: number) {
    this.table.setForcedBets({ smallBlind, bigBlind })
  }

  get blinds() {
    const f = this.table.forcedBets()
    return { small: f.smallBlind, big: f.bigBlind }
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
  /** Seats with chips at the table (stack + current bet), or null when empty. */
  seats(): (SeatState | null)[] {
    const src = this.inProgress ? this.table.handPlayers() : this.table.seats()
    const table = this.table.seats()
    return table.map((s, i) => {
      if (!s) return null
      const h = src[i]
      return h ? { stack: h.stack, bet: h.betSize } : { stack: s.stack, bet: 0 }
    })
  }
  /** Chips in the middle, including bets on the current street. */
  potTotal(): number {
    if (!this.inProgress) return 0
    const pots = this.table.pots().reduce((a, p) => a + p.size, 0)
    const bets = this.table.handPlayers().reduce((a, p) => a + (p?.betSize ?? 0), 0)
    return pots + bets
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
    const me = this.table.handPlayers()[seat]!
    const biggest = Math.max(...this.table.handPlayers().map((p) => p?.betSize ?? 0))
    const toCall = Math.min(biggest - me.betSize, me.stack)
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
    this.lastAggressor = null
    this.boardSeen = 0
    const before = this.table.seats()
    this.table.startHand()
    this.btn = this.table.button()
    const seats: number[] = []
    const stacks: Record<number, number> = {}
    before.forEach((s, i) => {
      if (s) {
        seats.push(i)
        stacks[i] = s.stack
      }
    })
    this.hole = this.table.holeCards().map((h) => (h ? h.map(toCode) : null))
    this.emit({ type: 'handStart', button: this.button, seats, stacks })

    // Blinds: poker-ts has already posted them; report SB before BB.
    const players = this.table.handPlayers()
    const posted = seats.filter((i) => (players[i]?.betSize ?? 0) > 0)
    const order = this.clockwiseFrom(this.button, posted, seats.length === 2)
    order.forEach((seat, k) =>
      this.emit({ type: 'blind', seat, amount: players[seat]!.betSize, kind: k === 0 && order.length > 1 ? 'small' : 'big' }),
    )

    this.emit({
      type: 'deal',
      seats: this.clockwiseFrom(this.button, seats, false),
      hero: this.hole[this.heroSeat] ?? null,
    })
    this.advance()
  }

  act(seat: number, action: Action) {
    const legal = this.getLegalActions(seat)
    if (!legal) throw new Error(`Seat ${seat} is not to act`)
    if (!legal.actions.includes(action.type)) throw new Error(`Illegal action ${action.type}`)
    const sized = action.type === 'bet' || action.type === 'raise'
    if (sized) {
      const amt = action.amount
      if (amt === undefined || amt < legal.min! || amt > legal.max!)
        throw new Error(`Bet ${amt} outside ${legal.min}–${legal.max}`)
    }
    const beforeStack = this.table.handPlayers()[seat]!.stack
    this.table.actionTaken(action.type, sized ? action.amount : undefined)
    if (action.type === 'fold') this.folded.add(seat)
    if (sized) this.lastAggressor = seat

    const p = this.table.handPlayers()[seat]
    const stack = p?.stack ?? beforeStack
    this.emit({
      type: 'action',
      seat,
      action: action.type,
      amount: action.type === 'fold' ? 0 : beforeStack - stack,
      bet: p?.betSize ?? 0,
      stack,
      allIn: action.type !== 'fold' && stack === 0,
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
    const pots = this.table.pots().map((p) => ({ size: p.size, eligible: [...p.eligiblePlayers] }))
    const board = this.table.communityCards().map(toCode)
    const contenders = this.activeSeats()
    const uncontested = contenders.length === 1
    this.table.showdown()

    if (!uncontested) {
      this.emit({
        type: 'showdown',
        reveals: this.showdownOrder(contenders).map((seat) => ({
          seat,
          cards: this.hole[seat]!,
          hand: describeHand([...this.hole[seat]!, ...board]),
        })),
      })
    }

    const winners = this.table.winners()
    const results: PotResult[] = pots.map((pot, i) => {
      const ws = pot.eligible.length === 1 ? pot.eligible : (winners[i] ?? []).map((w) => w[0])
      return { amount: pot.size, winners: ws, shares: splitPot(pot.size, ws, this.button, this.numSeats) }
    })
    const after = this.table.seats()
    const stacks: Record<number, number> = {}
    after.forEach((s, i) => {
      if (s || this.hole[i]) stacks[i] = s?.stack ?? 0 // busted players are stood up by poker-ts
    })
    this.emit({ type: 'handEnd', pots: results, stacks, board, uncontested })
  }

  /** Last aggressor on the final street shows first, else first seat left of the button. */
  private showdownOrder(seats: number[]): number[] {
    const start = this.lastAggressor !== null && seats.includes(this.lastAggressor) ? this.lastAggressor : null
    const order = this.clockwiseFrom(this.button, seats, false)
    if (start === null) return order
    const k = order.indexOf(start)
    return [...order.slice(k), ...order.slice(0, k)]
  }

  /** `seats` ordered clockwise starting after `from` (or at it when `inclusive`). */
  private clockwiseFrom(from: number, seats: number[], inclusive: boolean): number[] {
    const key = (s: number) => (s - from - (inclusive ? 0 : 1) + this.numSeats * 2) % this.numSeats
    return [...seats].sort((a, b) => key(a) - key(b))
  }
}

/** Mirror poker-ts's split: equal shares, odd chips clockwise from the button. */
export function splitPot(amount: number, winners: number[], button: number, numSeats: number) {
  const shares: Record<number, number> = {}
  if (!winners.length) return shares
  const base = Math.floor(amount / winners.length)
  let odd = amount - base * winners.length
  const order = [...winners].sort((a, b) => ((a - button - 1 + numSeats) % numSeats) - ((b - button - 1 + numSeats) % numSeats))
  for (const w of order) shares[w] = base + (odd-- > 0 ? 1 : 0)
  return shares
}
