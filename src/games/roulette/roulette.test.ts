import { describe, expect, it } from 'vitest'
import { OUTSIDE, WHEEL, corner, payoutFor, settle, sixLine, split, spinResult, straight, street, type Bets } from './rules'
import { POCKET, R, planSpin, pocketAngle } from './physics'

const TAU = Math.PI * 2
const angDiff = (a: number, b: number) => Math.abs((((a - b) % TAU) + TAU + Math.PI) % TAU - Math.PI)

describe('roulette rules', () => {
  it('pays the standard odds', () => {
    expect(payoutFor(straight(17))).toBe(35)
    expect(payoutFor(split(17, 20))).toBe(17)
    expect(payoutFor(street(5))).toBe(11)
    expect(payoutFor(corner(0, 0))).toBe(8)
    expect(payoutFor(sixLine(0))).toBe(5)
    expect(payoutFor(OUTSIDE.dozen2)).toBe(2)
    expect(payoutFor(OUTSIDE.red)).toBe(1)
  })
  it('settles winning bets only, zero beats outside bets', () => {
    const bets: Bets = {
      a: { spot: straight(17), amount: 10 },
      b: { spot: OUTSIDE.black, amount: 20 },
      c: { spot: OUTSIDE.odd, amount: 5 },
    }
    expect(settle(bets, 17)).toEqual({ total: 360 + 40 + 10, won: { a: 360, b: 40, c: 10 } })
    expect(settle(bets, 0).total).toBe(0)
  })
  it('layout geometry: columns and streets hold the right numbers', () => {
    expect(OUTSIDE.col1.numbers.slice(0, 3)).toEqual([1, 4, 7])
    expect(street(0).numbers.sort((a, b) => a - b)).toEqual([1, 2, 3])
    expect(corner(0, 0).numbers.sort((a, b) => a - b)).toEqual([2, 3, 5, 6])
  })
  it('the wheel has 37 distinct pockets and results are uniform-ish', () => {
    expect(new Set(WHEEL).size).toBe(37)
    const counts = new Array(37).fill(0)
    for (let i = 0; i < 37000; i++) counts[spinResult()]++
    expect(Math.min(...counts)).toBeGreaterThan(800)
    expect(Math.max(...counts)).toBeLessThan(1200)
  })
})

describe('ball physics', () => {
  it('always lands in the chosen pocket, with no jumps along the way', () => {
    let seed = 7
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let trial = 0; trial < 74; trial++) {
      const result = trial % 37
      const plan = planSpin(result, rand() * TAU, rand() * TAU, rand)
      const end = plan.at(plan.duration)
      expect(end.resting).toBe(true)
      expect(angDiff(end.ball - end.wheel, pocketAngle(result))).toBeLessThan(1e-6)
      expect(end.r).toBeCloseTo(R.pocket, 3)
      // continuity: sample densely, no step bigger than the ball could plausibly move in 1/120 s
      let prev = plan.at(0)
      let maxStep = 0
      let maxDr = 0
      for (let t = 1 / 120; t <= plan.duration; t += 1 / 120) {
        const p = plan.at(t)
        maxStep = Math.max(maxStep, angDiff(p.ball, prev.ball))
        maxDr = Math.max(maxDr, Math.abs(p.r - prev.r))
        prev = p
      }
      expect(maxStep).toBeLessThan(0.35)
      expect(maxDr).toBeLessThan(8)
      expect(plan.duration).toBeGreaterThan(8)
      expect(plan.duration).toBeLessThan(14)
    }
    expect(POCKET).toBeCloseTo(TAU / 37)
  })
})
