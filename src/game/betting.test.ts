import { describe, expect, it } from 'vitest'
import { checkPile, quickTarget } from './betting'

const facing = { seat: 0, actions: ['fold', 'call', 'raise'] as const, toCall: 20, min: 40, max: 500 }
const legal = { ...facing, actions: [...facing.actions] }

describe('checkPile', () => {
  it('classifies calls, raises and short piles', () => {
    expect(checkPile(legal, 10, 0, 500).hint).toMatch(/Add \$10 more to call/)
    expect(checkPile(legal, 20, 0, 500).action).toEqual({ type: 'call' })
    expect(checkPile(legal, 30, 0, 500).hint).toMatch(/Min raise is to \$40/)
    expect(checkPile(legal, 60, 0, 500).action).toEqual({ type: 'raise', amount: 60 })
    expect(checkPile(legal, 500, 0, 500)).toMatchObject({ action: { type: 'raise', amount: 500 }, label: 'All-in $500' })
  })
  it('an all-in for less than the call is a call', () => {
    expect(checkPile({ ...legal, min: undefined, max: undefined }, 15, 0, 15).action).toEqual({ type: 'call' })
  })
})

describe('quickTarget', () => {
  it('sizes pot-relative raises', () => {
    // pot 100 (incl. bets), facing 20: pot raise = 20 + (100 + 20) = 140
    expect(quickTarget('pot', legal, 100, 0, 5)).toBe(140)
    expect(quickTarget('half', legal, 100, 0, 5)).toBe(80)
    expect(quickTarget('min', legal, 100, 0, 5)).toBe(40)
    expect(quickTarget('max', legal, 100, 0, 5)).toBe(500)
  })
})

import { blindsFor } from './controller'
describe('blindsFor', () => {
  it('uses standard blind structures that chips can make', () => {
    expect(blindsFor(100)).toEqual({ sb: 1, bb: 1, unit: 1 })
    expect(blindsFor(500)).toEqual({ sb: 2, bb: 5, unit: 1 })
    expect(blindsFor(1000)).toEqual({ sb: 5, bb: 10, unit: 5 })
    expect(blindsFor(2500)).toEqual({ sb: 10, bb: 25, unit: 5 })
    expect(blindsFor(10000)).toEqual({ sb: 50, bb: 100, unit: 50 })
  })
})
