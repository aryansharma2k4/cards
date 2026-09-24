import { describe, expect, it } from 'vitest'
import { equity } from './mc'
import { decide, makePersonality, niceAmount, type Situation, type Style } from './bot'
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
})
