import { describe, expect, it } from 'vitest'
import { breakdown, colorUp, greedy, pay, rackCount, rackTotal } from './chips'

describe('chips', () => {
  it('greedy uses the fewest chips', () => {
    expect(greedy(1_537)).toEqual({ 1000: 1, 500: 1, 20: 1, 10: 1, 5: 1, 2: 1 })
  })

  it('breakdown keeps a playable mix and sums exactly', () => {
    for (const amt of [1_000, 10_000, 2_537, 250_000, 7]) {
      const r = breakdown(amt, 5)
      expect(rackTotal(r)).toBe(amt)
      if (amt >= 1000) expect(Object.keys(r).length).toBeGreaterThanOrEqual(4)
    }
    expect(breakdown(1_000, 5)).toEqual({ 100: 8, 50: 2, 20: 3, 10: 2, 5: 4 })
  })

  it('pay takes exact amounts, making change when needed', () => {
    const res = pay({ 100: 1 }, 35)!
    expect(rackTotal(res.paid)).toBe(35)
    expect(rackTotal(res.left)).toBe(65)
    expect(pay({ 5: 1 }, 10)).toBeNull()
  })

  it('colorUp swaps small chips for bigger ones', () => {
    const r = colorUp({ 100: 23, 5: 1 }, 100)
    expect(r).toEqual({ 100: 3, 500: 4, 5: 1 })
    expect(rackTotal(r)).toBe(2305)
    expect(rackCount(colorUp({ 20: 7 }, 20))).toBe(3) // 5×20 → 1×100
    expect(colorUp({ 5: 25 }, 5, 100)).toEqual({ 5: 5, 100: 1 })
  })
})
