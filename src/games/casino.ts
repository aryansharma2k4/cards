import { get, set, type CasinoGame } from '../game/store'
import { endCasinoSession, recordRound, startCasinoSession } from '../game/history'

/** Table limits (per round for blackjack, per spot for roulette). */
export const LIMITS: Record<CasinoGame, { min: number; max: number }> = {
  blackjack: { min: 5, max: 5_000 },
  roulette: { min: 1, max: 5_000 },
}

let sessionId = ''

/** A round is in play (ball spinning, cards out): leaving waits until it settles. */
export let busy = false
export const setBusy = (b: boolean) => void (busy = b)

/** Buy in: move money from the bankroll to chips at the table. */
export function enterCasino(game: CasinoGame, buyIn: number) {
  if (buyIn <= 0 || buyIn > get().bankroll) return
  sessionId = startCasinoSession(game, buyIn)
  set((s) => ({ screen: game, casino: { game, stack: buyIn, buyIn }, bankroll: s.bankroll - buyIn, dialog: null }))
}

/** Stand up: whatever is in front of you goes back to the bankroll. */
export function leaveCasino() {
  const c = get().casino
  if (!c) return set({ screen: 'lobby' })
  endCasinoSession(sessionId, c.stack)
  set((s) => ({ screen: 'lobby', casino: null, bankroll: s.bankroll + c.stack, dialog: null }))
}

export const stack = () => get().casino?.stack ?? 0

/** Change the table stack (negative to take a bet, positive to pay out). */
export function moveChips(delta: number) {
  set((s) => (s.casino ? { casino: { ...s.casino, stack: s.casino.stack + delta } } : {}))
}

/** Log a finished round (feeds stats, history and cloud sync). */
export function logRound(game: CasinoGame, bet: number, net: number, detail: string) {
  const s = get()
  recordRound({ sessionId, game, bet, net, detail, worth: s.bankroll + (s.casino?.stack ?? 0) })
}
