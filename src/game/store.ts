import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LegalActions } from '../engine/engine'
import type { HandInfo } from '../engine/evaluate'
import type { Rack } from '../engine/chips'
import type { Difficulty, Personality } from '../ai/bot'
import type { Pt } from '../ui/geometry'

export const START_BANKROLL = 10_000
export const BUY_INS = [100, 500, 1_000, 2_500, 5_000, 10_000]

export interface CardView {
  id: string
  /** Only set for cards the hero is allowed to see. */
  code?: string
  faceUp: boolean
  highlight?: boolean
}

export interface Avatar {
  initials: string
  hue: number
  motif: 's' | 'h' | 'd' | 'c'
}

export interface SeatView {
  name: string
  avatar: Avatar
  personality?: Personality
  stack: number
  bet: number
  cards: CardView[]
  status: string | null
  folded: boolean
  allIn: boolean
  /** Bot thinking: total ms for the timer ring (restarts when this object changes). */
  thinking: { ms: number; key: number } | null
  handLabel: string | null
  winner: boolean
  sittingOut: boolean
}

export interface Flyer {
  id: number
  kind: 'card' | 'chips'
  from: Pt
  to: Pt
  duration: number
  delay?: number
  /** chips: denominations to show (one entry per chip, high → low) */
  chips?: number[]
  card?: { code?: string; faceUp: boolean; width: number; spin?: number; endRotate?: number }
  resolve?: () => void
}

export interface TableConfig {
  buyIn: number
  sb: number
  bb: number
  /** Smallest chip in play (divides both blinds). */
  unit: number
  opponents: number
  difficulty: Difficulty
}

export interface Settings {
  volume: number
  muted: boolean
  ambient: boolean
  speed: 'normal' | 'fast'
  skipWhenFolded: boolean
  showEquity: boolean
  panelOpen: boolean
}

interface State {
  screen: 'lobby' | 'table' | 'stats'
  bankroll: number
  /** Chips on the table right now (returned to the bankroll if the page closes). */
  seated: number
  settings: Settings
  table: TableConfig | null

  seats: (SeatView | null)[]
  board: CardView[]
  burned: number
  pot: number
  button: number
  handNo: number
  flyers: Flyer[]

  legal: LegalActions | null
  rack: Rack
  /** Bet being built by clicking chips (denominations in click order). */
  pile: number[]
  heroHand: HandInfo | null
  equity: number | null
  banner: { title: string; detail: string; hero: boolean } | null
  log: { id: number; text: string }[]
  dialog: null | 'settings' | 'bust' | 'colorup' | 'log'
  paused: boolean
  colorUpHint: boolean
  /** Full-screen mode: only the table and hand rankings. */
  focus: boolean
}

const defaults: Settings = {
  volume: 0.8,
  muted: false,
  ambient: false,
  speed: 'normal',
  skipWhenFolded: true,
  showEquity: true,
  panelOpen: typeof window === 'undefined' || window.innerWidth >= 1400,
}

export const useGame = create<State>()(
  persist(
    (): State => ({
        screen: 'lobby',
        bankroll: START_BANKROLL,
        seated: 0,
        settings: defaults,
        table: null,
        seats: [],
        board: [],
        burned: 0,
        pot: 0,
        button: 0,
        handNo: 0,
        flyers: [],
        legal: null,
        rack: {},
        pile: [],
        heroHand: null,
        equity: null,
        banner: null,
        log: [],
        dialog: null,
        paused: false,
        colorUpHint: false,
        focus: false,
    }),
    {
      name: 'cards:v1',
      partialize: (s) => ({ bankroll: s.bankroll, seated: s.seated, settings: s.settings }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>
        // Chips left on a table when the page closed go back to the bankroll.
        const bankroll = (p.bankroll ?? current.bankroll) + (p.seated ?? 0)
        return { ...current, bankroll, seated: 0, settings: { ...defaults, ...p.settings } }
      },
    },
  ),
)

export const set = useGame.setState
export const get = useGame.getState

export function patchSeat(i: number, patch: Partial<SeatView>) {
  set((s) => {
    const seats = s.seats.slice()
    if (seats[i]) seats[i] = { ...seats[i]!, ...patch }
    return { seats }
  })
}

let logId = 0
export function log(text: string) {
  set((s) => ({ log: [...s.log.slice(-199), { id: logId++, text }] }))
}

let flyerId = 0
/** Launch an animated sprite; resolves when it lands. */
export function fly(f: Omit<Flyer, 'id' | 'resolve'>): Promise<void> {
  return new Promise((resolve) => {
    set((s) => ({ flyers: [...s.flyers, { ...f, id: flyerId++, resolve }] }))
  })
}
export function removeFlyer(id: number) {
  set((s) => ({ flyers: s.flyers.filter((f) => f.id !== id) }))
}

// Chips in front of you are saved continuously; if the page closes they return to the bankroll on next load.
useGame.subscribe((s, prev) => {
  if (s.seats === prev.seats && s.screen === prev.screen) return
  const seated = s.screen === 'table' ? (s.seats[0]?.stack ?? 0) : 0
  if (seated !== s.seated) set({ seated })
})
