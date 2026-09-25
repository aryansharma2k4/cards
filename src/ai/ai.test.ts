import { describe, expect, it } from 'vitest'
import { equity, equityVsRange } from './mc'
import { decide, makePersonality, niceAmount, shoveRange, type Situation, type Style } from './bot'
import type { Action } from '../engine/engine'
import { PokerEngine } from '../engine/engine'

describe('Monte Carlo equity', () => {
  it('matches known pre-flop numbers', () => {
    expect(equity(['As', 'Ah'], [], 1, 4000)).toBeCloseTo(0.85, 1)
    expect(equity(['7c', '2d'], [], 1, 4000)).toBeCloseTo(0.35, 1)
  })
  it('is certain with the nuts on the river', () => {
    expect(equity(['Ah', 'Kh'], ['Qh', 'Jh', 'Th', '2c', '3d'], 3, 300)).toBe(1)
  })
})

describe('bot', () => {
  const situation = (over: Partial<Situation>): Situation => ({
    legal: { seat: 1, actions: ['fold', 'call', 'raise'], toCall: 10, min: 20, max: 1000 },
    equity: 0.5, pot: 15, stack: 1000, bet: 0, bb: 10, unit: 5, street: 'preflop', opponents: 5, position: 0.5,
    ...over,
  })
  const noRand = () => 0.99

  it('plays sensible pre-flop hands', () => {
    const tag = makePersonality('TAG', noRand)
    expect(decide(tag, situation({ equity: 0.85 }), 'hard', noRand).type).toBe('raise') // AA opens
    expect(decide(tag, situation({ equity: 0.35 }), 'hard', noRand).type).toBe('fold') // 72o folds
    // facing a shove for the stack
    const shove = { legal: { seat: 1, actions: ['fold', 'call'] as Action['type'][], toCall: 990 }, pot: 1015 }
    expect(decide(tag, situation({ ...shove, equity: 0.62 }), 'hard', noRand).type).toBe('fold') // AJo
    expect(decide(tag, situation({ ...shove, equity: 0.82 }), 'hard', noRand).type).toBe('call') // KK
  })

  it('rounds bets to sensible chip amounts', () => {
    expect(niceAmount(237, 10)).toBe(240)
    expect(niceAmount(140, 25, 5)).toBe(140) // $10/$25: steps of $10
    expect(niceAmount(1234, 10)).toBe(1250)
  })

  it.each([1, 2, 3])('always picks legal actions and conserves chips over many hands (table %i)', () => {
    const styles: Style[] = ['TAG', 'LAG', 'ROCK', 'STATION', 'TAG', 'LAG']
    const engine = new PokerEngine({ smallBlind: 5, bigBlind: 10, numSeats: 6 })
    const bots = styles.map((s) => makePersonality(s))
    styles.forEach((_, i) => engine.sitDown(i, 1000))
    for (let h = 0; h < 150; h++) {
      if (engine.seats().filter(Boolean).length < 2) break
      let reported: Record<number, number> = {}
      const off = engine.on((e) => e.type === 'handEnd' && (reported = e.stacks))
      engine.startHand()
      while (engine.toAct !== null) {
        const seat = engine.toAct
        const legal = engine.getLegalActions(seat)!
        const me = engine.seats()[seat]!
        const action = decide(bots[seat], {
          legal,
          equity: equity(engine.holeCardsFor(seat)!, engine.board, engine.street === 'preflop' ? 1 : engine.activeSeats().length - 1, 60),
          pot: engine.potTotal(),
          stack: me.stack,
          bet: me.bet,
          bb: 10,
          unit: 5,
          street: engine.street,
          opponents: engine.activeSeats().length - 1,
          position: 0.5,
        })
        engine.act(seat, action)
      }
      off()
      const total = engine.seats().reduce((a, s) => a + (s?.stack ?? 0), 0)
      expect(total).toBe(6000)
      engine.seats().forEach((s, i) => expect(s?.stack ?? 0).toBe(reported[i] ?? 0))
    }
  })

  it('stops folding to a player who shoves every hand', () => {
    // Hero (seat 0) open-shoves 100bb every hand at a full table, the way the app's controller runs it.
    const styles: Style[] = ['TAG', 'LAG', 'ROCK', 'STATION', 'TAG']
    const bots = styles.map((s) => makePersonality(s))
    const read = { hands: 0, shoves: 0 }
    const folds: boolean[] = []
    for (let h = 0; h < 60; h++) {
      const engine = new PokerEngine({ smallBlind: 5, bigBlind: 10, numSeats: 6 })
      for (let i = 0; i < 6; i++) engine.sitDown(i, 1000)
      read.hands++
      engine.startHand()
      let called = false
      while (engine.toAct !== null) {
        const seat = engine.toAct
        const legal = engine.getLegalActions(seat)!
        if (seat === 0) {
          const shove = legal.actions.includes('raise') ? { type: 'raise' as const, amount: legal.max } : { type: 'call' as const }
          if (shove.type === 'raise') read.shoves++
          engine.act(0, shove)
          continue
        }
        const me = engine.seats()[seat]!
        const seats = engine.seats()
        const top = Math.max(...seats.map((p) => p?.bet ?? 0))
        const facingShove = engine.street === 'preflop' && (seats[0]?.stack ?? 1) === 0 && top >= 150
        const inPot = engine.activeSeats().filter((i) => i !== seat && (seats[i]?.bet ?? 0) === top).length
        const hole = engine.holeCardsFor(seat)!
        const eq = facingShove ? equityVsRange(hole, inPot, shoveRange(read.hands, read.shoves), 150) : equity(hole, engine.board, 1, 60)
        const a = decide(bots[seat - 1], { legal, equity: eq, pot: engine.potTotal(), stack: me.stack, bet: me.bet, bb: 10, unit: 5, street: engine.street, opponents: engine.activeSeats().length - 1, position: 0.5, facingShove }, 'hard')
        if (facingShove && a.type === 'call') called = true
        engine.act(seat, a)
      }
      folds.push(!called)
    }
    const rate = (xs: boolean[]) => xs.filter(Boolean).length / xs.length
    // First few shoves mostly get through; once it's a pattern the table calls it off.
    expect(rate(folds.slice(20))).toBeLessThan(0.35)
  })
})

