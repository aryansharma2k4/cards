import type { Action, LegalActions, Street } from '../engine/engine'

export type Style = 'TAG' | 'LAG' | 'ROCK' | 'STATION'
export type Difficulty = 'easy' | 'normal' | 'hard'

export interface Personality {
  style: Style
  label: string
  /** 0..1: how selective about which hands to play. */
  tight: number
  /** 0..1: preference for betting/raising over calling. */
  aggr: number
  /** 0..1: base bluff frequency (randomised per bot). */
  bluff: number
  /** 0..1: willingness to call down light. */
  sticky: number
}

export const STYLES: Record<Style, Omit<Personality, 'bluff'> & { bluff: [number, number] }> = {
  TAG: { style: 'TAG', label: 'Tight-aggressive', tight: 0.7, aggr: 0.75, bluff: [0.05, 0.12], sticky: 0.3 },
  LAG: { style: 'LAG', label: 'Loose-aggressive', tight: 0.3, aggr: 0.85, bluff: [0.12, 0.24], sticky: 0.4 },
  ROCK: { style: 'ROCK', label: 'Tight-passive', tight: 0.82, aggr: 0.25, bluff: [0.01, 0.05], sticky: 0.35 },
  STATION: { style: 'STATION', label: 'Calling station', tight: 0.25, aggr: 0.15, bluff: [0.02, 0.06], sticky: 0.9 },
}

export function makePersonality(style: Style, rand = Math.random): Personality {
  const s = STYLES[style]
  return { ...s, bluff: s.bluff[0] + rand() * (s.bluff[1] - s.bluff[0]) }
}

export interface Situation {
  legal: LegalActions
  /** Pre-flop: heads-up equity vs a random hand. After the flop: equity vs all live opponents. */
  equity: number
  /** Everything in the middle, including this street's bets. */
  pot: number
  stack: number
  /** This bot's chips already in front of it this street. */
  bet: number
  bb: number
  /** Smallest chip in play; bets are multiples of it. */
  unit: number
  street: Street
  opponents: number
  /** 0 = first to act, 1 = on the button. */
  position: number
  /** Facing a pre-flop all-in; `equity` is then against the shover's estimated range. */
  facingShove?: boolean
}

/**
 * Share of starting hands a player shoves with, estimated from how often they've open-shoved at
 * this table. Starts tight (a 100bb shove from a stranger is usually a big hand) and widens as
 * they keep doing it, so someone who shoves every hand gets called light.
 */
export function shoveRange(hands: number, shoves: number) {
  const PRIOR = 0.07
  const WEIGHT = 8 // hands of evidence the prior is worth
  return Math.min(1, Math.max(0.03, (PRIOR * WEIGHT + shoves) / (WEIGHT + hands)))
}

const NOISE: Record<Difficulty, number> = { easy: 0.14, normal: 0.06, hard: 0.02 }

/** Round a bet to a chip amount a human would pick. */
export function niceAmount(x: number, bb: number, unit = 1): number {
  const step = x < 10 * bb ? Math.max(unit, Math.floor(bb / 2 / unit) * unit) : x < 50 * bb ? bb : 5 * bb
  return Math.max(step, Math.round(x / step) * step)
}

export function decide(p: Personality, s: Situation, difficulty: Difficulty = 'normal', rand = Math.random): Action {
  const { legal } = s
  const can = (t: Action['type']) => legal.actions.includes(t)
  const eq = Math.min(1, Math.max(0, s.equity + (rand() - 0.5) * 2 * NOISE[difficulty]))
  // Strength relative to an average hand in this many-way pot (1 = average).
  const rel = eq * (s.opponents + 1)
  const toCall = legal.toCall
  const potOdds = toCall / (s.pot + toCall)
  const spr = s.stack / Math.max(s.pot, 1)
  const late = s.position
  const pre = s.street === 'preflop'

  const sized = (to: number): Action => {
    const type = can('bet') ? 'bet' : 'raise'
    let amt = niceAmount(to, s.bb, s.unit)
    amt = Math.min(Math.max(amt, legal.min!), legal.max!)
    if (amt > 0.75 * legal.max!) amt = legal.max! // commit rather than leave a sliver behind
    return { type, amount: amt }
  }
  const passive = (): Action => (can('check') ? { type: 'check' } : { type: 'fold' })
  const call = (): Action => (can('call') ? { type: 'call' } : { type: 'check' })
  const canSize = legal.min !== undefined && (can('bet') || can('raise'))
  const biggest = s.bet + toCall

  if (pre && s.facingShove) {
    // Priced against the shover's range: call when the pot odds say so (stations a bit lighter).
    return eq > potOdds + 0.03 - p.sticky * 0.05 ? call() : passive()
  }

  if (pre) {
    // Pre-flop `equity` is heads-up equity vs a random hand: a count-independent hand
    // strength (AA .85, AKo .65, 22 .50, 72o .35). Bars rise as the price rises.
    const hs = eq
    const price = Math.log2(Math.max(1, biggest / s.bb)) // 0 unraised, ~1.3 at 2.5bb, ~3.3 at 10bb
    const crowd = Math.max(0, s.opponents - 2) * 0.01
    const openBar = 0.6 + p.tight * 0.06 + (0.5 - p.aggr) * 0.12 - late * 0.06 + crowd
    const callBar = Math.min(0.72, 0.52 + p.tight * 0.1 - p.sticky * 0.08 - late * 0.04 + price * 0.03 + crowd)
    const reraiseBar = Math.min(0.8, 0.64 + p.tight * 0.03 - p.aggr * 0.05 + price * 0.025)
    const committing = toCall > 0.4 * (s.stack + s.bet)

    // Short-stacked: shove or fold.
    if (s.stack + s.bet <= 12 * s.bb && canSize && hs > openBar - 0.04) return { type: can('bet') ? 'bet' : 'raise', amount: legal.max! }
    if (canSize) {
      const unraised = biggest <= s.bb
      const bluff = unraised && rand() < p.bluff * late * 0.6 && hs > 0.42
      if (unraised ? hs > openBar || bluff : hs > reraiseBar) {
        const to = unraised ? s.bb * (2.2 + p.aggr * 0.8) + Math.max(0, s.pot - 1.5 * s.bb) : biggest * (2.7 + p.aggr * 0.5)
        return sized(to)
      }
    }
    if (toCall === 0) return passive()
    if (committing) return hs > 0.66 - p.sticky * 0.05 ? call() : passive()
    const limp = biggest <= s.bb // aggressive players raise or fold rather than limp
    if (hs > callBar + (limp ? p.aggr * 0.08 : 0) || (toCall <= s.bb / 2 && hs > callBar - 0.06)) return call()
    return passive()
  }

  // Post-flop.
  const valueBar = 1.15 - p.aggr * 0.2 - late * 0.05
  const strong = rel > valueBar && eq > 0.45
  const monster = eq > 0.8

  if (toCall === 0) {
    const bluff = rand() < p.bluff * (0.6 + late * 0.8)
    if (canSize && (strong || bluff)) {
      let frac = monster ? [0.75, 1, 1.25][Math.floor(rand() * 3)] : strong ? [0.5, 0.66, 0.75][Math.floor(rand() * 3)] : 0.5
      if (monster && spr < 1.5) frac = 3 // overbet shove territory
      return sized(s.pot * frac)
    }
    return passive()
  }

  const raiseBar = 0.74 - p.aggr * 0.12
  if (canSize && (eq > raiseBar || (rand() < p.bluff * 0.35 && s.street !== 'river'))) {
    const potAfterCall = s.pot + toCall
    return sized(biggest + potAfterCall * (monster ? 1 : 0.75))
  }
  const need = potOdds * (1.3 - p.sticky * 0.4)
  if (eq > need) return call()
  return passive()
}
