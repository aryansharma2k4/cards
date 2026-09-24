import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Action, ActionType, EngineEvent, LegalActions, Street } from '../engine/engine'
import type { Difficulty } from '../ai/bot'

/** One of your decisions, with what you knew when you made it. */
export interface Decision {
  street: Street
  action: ActionType
  /** "Raise to" for bets/raises, chips added for calls. */
  amount: number
  toCall: number
  /** Pot before you acted (including bets on this street). */
  pot: number
  /** Your equity vs the live opponents when you acted, if it had been computed. */
  equity: number | null
}

export interface HandRecord {
  id: string
  sessionId: string
  ts: number
  handNo: number
  sb: number
  bb: number
  players: number
  position: string
  hole: string[]
  board: string[]
  /** Every public action at the table, in order. */
  actions: { street: Street; name: string; action: ActionType | 'small blind' | 'big blind'; amount: number; bet: number }[]
  decisions: Decision[]
  /** Hands shown at showdown (never folded ones). */
  shown: { name: string; cards: string[]; label: string }[]
  winners: { name: string; amount: number }[]
  pot: number
  net: number
  folded: boolean
  showdown: boolean
  heroLabel: string | null
  /** Bankroll + chips on the table after the hand. */
  worth: number
}

export interface SessionRecord {
  id: string
  start: number
  end: number | null
  buyIn: number
  sb: number
  bb: number
  opponents: number
  difficulty: Difficulty
  /** Total bought in (first buy-in + rebuys). */
  invested: number
  cashOut: number | null
  hands: number
}

interface HistoryState {
  sessions: SessionRecord[]
  hands: HandRecord[]
  /** Hand/session ids already pushed to the cloud. */
  synced: string[]
}

// ponytail: localStorage caps around 5MB; keep the newest 3000 hands locally (~1KB each). The cloud keeps everything.
const MAX_HANDS = 3000

export const useHistory = create<HistoryState>()(
  persist((): HistoryState => ({ sessions: [], hands: [], synced: [] }), { name: 'cards:history:v1' }),
)

const POSITIONS: Record<number, string[]> = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'UTG'],
  5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
}

export function positionName(seat: number, button: number, seats: number[], numSeats: number): string {
  const order = [...seats].sort((a, b) => ((a - button + numSeats) % numSeats) - ((b - button + numSeats) % numSeats))
  return POSITIONS[order.length]?.[order.indexOf(seat)] ?? '?'
}

function upsertSession(s: SessionRecord) {
  useHistory.setState((h) => ({ sessions: [...h.sessions.filter((x) => x.id !== s.id), s] }))
}

/**
 * Builds a HandRecord from the engine's event stream. Only public information
 * plus the hero's own cards goes in: opponents' cards only if shown down.
 */
export class Recorder {
  private session: SessionRecord | null = null
  private hand: HandRecord | null = null
  private start = 0
  private street: Street = 'preflop'

  private hero: number
  private numSeats: number
  private nameOf: (seat: number) => string
  private worth: () => number

  constructor(o: { hero: number; numSeats: number; nameOf: (seat: number) => string; worth: () => number }) {
    this.hero = o.hero
    this.numSeats = o.numSeats
    this.nameOf = o.nameOf
    this.worth = o.worth
  }

  startSession(cfg: { buyIn: number; sb: number; bb: number; opponents: number; difficulty: Difficulty }) {
    this.session = { id: crypto.randomUUID(), start: Date.now(), end: null, invested: cfg.buyIn, cashOut: null, hands: 0, ...cfg }
    upsertSession(this.session)
  }
  rebuy(amount: number) {
    if (!this.session) return
    this.session = { ...this.session, invested: this.session.invested + amount }
    upsertSession(this.session)
  }
  endSession(cashOut: number) {
    if (!this.session) return
    upsertSession({ ...this.session, end: Date.now(), cashOut })
    this.session = null
    this.hand = null
  }

  decision(legal: LegalActions, pot: number, equity: number | null, a: Action) {
    if (!this.hand) return
    const amount = a.type === 'call' ? legal.toCall : a.type === 'bet' || a.type === 'raise' ? a.amount! : 0
    this.hand.decisions.push({ street: this.street, action: a.type, amount, toCall: legal.toCall, pot, equity })
  }

  onEvent(e: EngineEvent) {
    if (!this.session) return
    const h = this.hand
    switch (e.type) {
      case 'handStart':
        this.street = 'preflop'
        this.start = e.stacks[this.hero] ?? 0
        this.hand = {
          id: crypto.randomUUID(),
          sessionId: this.session.id,
          ts: Date.now(),
          handNo: this.session.hands + 1,
          sb: this.session.sb,
          bb: this.session.bb,
          players: e.seats.length,
          position: positionName(this.hero, e.button, e.seats, this.numSeats),
          hole: [],
          board: [],
          actions: [],
          decisions: [],
          shown: [],
          winners: [],
          pot: 0,
          net: 0,
          folded: false,
          showdown: false,
          heroLabel: null,
          worth: 0,
        }
        return
      case 'blind':
        h?.actions.push({ street: 'preflop', name: this.nameOf(e.seat), action: e.kind === 'small' ? 'small blind' : 'big blind', amount: e.amount, bet: e.amount })
        return
      case 'deal':
        if (h) h.hole = e.hero ?? []
        return
      case 'action':
        if (!h) return
        h.actions.push({ street: this.street, name: this.nameOf(e.seat), action: e.action, amount: e.amount, bet: e.bet })
        if (e.seat === this.hero && e.action === 'fold') h.folded = true
        return
      case 'street':
        this.street = e.street
        if (h) h.board = e.board
        return
      case 'showdown':
        if (!h) return
        h.showdown = true
        for (const r of e.reveals) {
          if (r.seat === this.hero) h.heroLabel = r.hand.label
          else h.shown.push({ name: this.nameOf(r.seat), cards: r.cards, label: r.hand.label })
        }
        return
      case 'handEnd': {
        if (!h) return
        const won: Record<number, number> = {}
        for (const p of e.pots) for (const [s, amt] of Object.entries(p.shares)) won[+s] = (won[+s] ?? 0) + amt
        h.board = e.board
        h.pot = e.pots.reduce((a, p) => a + p.amount, 0)
        h.winners = Object.entries(won).map(([s, amount]) => ({ name: this.nameOf(+s), amount }))
        h.net = (e.stacks[this.hero] ?? 0) - this.start
        h.worth = this.worth()
        this.session = { ...this.session, hands: this.session.hands + 1 }
        upsertSession(this.session)
        const done = h
        useHistory.setState((s) => ({ hands: [...s.hands, done].slice(-MAX_HANDS) }))
        this.hand = null
        return
      }
    }
  }
}
