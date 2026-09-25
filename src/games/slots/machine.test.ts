import { describe, expect, it } from 'vitest'
import { LINES, PAYS, REELS, ROWS, STRIPS, evaluate, rtp, spin, windowAt, type Sym } from './machine'

describe('slot machine', () => {
  it('returns about 96% of what is bet', () => {
    expect(rtp()).toBeGreaterThan(0.94)
    expect(rtp()).toBeLessThan(0.97)
  })

  it('matches the exact return in simulation', () => {
    let seed = 1
    const rand = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31) * n | 0
    let paid = 0
    const N = 100_000
    for (let i = 0; i < N; i++) paid += spin(rand).pays
    expect(paid / N / LINES.length).toBeCloseTo(rtp(), 1)
  })

  it('pays left to right on lines only', () => {
    const fill = (s: Sym) => Array.from({ length: REELS }, () => Array<Sym>(ROWS).fill(s))
    // five sevens everywhere: every line pays the jackpot
    expect(evaluate(fill('seven')).map((w) => w.pays)).toEqual(LINES.map(() => PAYS.seven[3]))
    // three bells on the middle line from the left
    const w = fill('plum')
    for (let r = 0; r < REELS; r++) w[r] = ['lemon', r < 3 ? 'bell' : 'gem', 'lemon']
    w[0][0] = 'gem' // break the top line
    w[0][2] = 'gem' // and the bottom line
    const wins = evaluate(w)
    expect(wins.find((x) => x.line === 0)).toMatchObject({ sym: 'bell', count: 3, pays: PAYS.bell[1] })
    // the same symbols not starting on reel 1 do not pay
    w[0][1] = 'plum'
    expect(evaluate(w).find((x) => x.line === 0)).toBeUndefined()
  })

  it('shows the strip in order under the stop', () => {
    const win = windowAt([19, 0, 5, 0, 0])
    expect(win[0]).toEqual([STRIPS[0][19], STRIPS[0][0], STRIPS[0][1]])
    expect(win[2][0]).toBe(STRIPS[2][5])
  })
})
