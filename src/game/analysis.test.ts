import { describe, expect, it } from 'vitest'
import { summarize, verdict } from './analysis'
import type { HandRecord } from './history'

const hand = (over: Partial<HandRecord>): HandRecord => ({
  id: 'x', sessionId: 's', ts: 0, handNo: 1, sb: 5, bb: 10, players: 6, position: 'BTN', hole: [], board: [],
  actions: [], decisions: [], shown: [], winners: [], pot: 0, net: 0, folded: false, showdown: false, heroLabel: null, worth: 0,
  ...over,
})

describe('analysis', () => {
  it('summarises win rate and pre-flop stats', () => {
    const s = summarize([
      hand({ net: 100, decisions: [{ street: 'preflop', action: 'raise', amount: 30, toCall: 10, pot: 15, equity: 0.6 }], showdown: true }),
      hand({ net: -10, decisions: [{ street: 'preflop', action: 'fold', amount: 0, toCall: 10, pot: 15, equity: 0.3 }], folded: true }),
    ])
    expect(s).toMatchObject({ hands: 2, net: 90, bbPer100: 450, vpip: 0.5, pfr: 0.5, wtsd: 0.5, wsd: 1 })
  })
  it('judges calls against pot odds', () => {
    // 50 to call into 100: need 33%
    expect(verdict({ street: 'river', action: 'call', amount: 50, toCall: 50, pot: 100, equity: 0.5 }).tone).toBe('good')
    expect(verdict({ street: 'river', action: 'call', amount: 50, toCall: 50, pot: 100, equity: 0.15 }).tone).toBe('warn')
    expect(verdict({ street: 'river', action: 'fold', amount: 0, toCall: 50, pot: 100, equity: 0.6 }).tone).toBe('warn')
  })
})
