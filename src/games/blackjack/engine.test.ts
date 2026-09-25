import { describe, expect, it } from 'vitest'
import { Blackjack, Shoe, handValue, type BJEvent } from './engine'

/** Deal order: player, dealer up, player, dealer hole, then hits in order. */
function table(cards: string[]) {
  const shoe = new Shoe(6, () => 0.5)
  shoe.stack(cards)
  return new Blackjack(shoe)
}
const results = (ev: BJEvent[]) => ev.filter((e) => e.type === 'result').map((e) => e.type === 'result' && [e.result, e.payout])

describe('hand values', () => {
  it('counts aces as 1 or 11', () => {
    expect(handValue(['As', 'Kd'])).toEqual({ total: 21, soft: true })
    expect(handValue(['As', 'As', '9c'])).toEqual({ total: 21, soft: true })
    expect(handValue(['As', '9c', 'Kd'])).toEqual({ total: 20, soft: false })
  })
})

describe('blackjack rounds', () => {
  it('natural pays 3:2 (rounded down on odd bets)', () => {
    const g = table(['As', '9d', 'Kc', '7h'])
    expect(results(g.deal(10))).toEqual([['blackjack', 25]])
    const g2 = table(['As', '9d', 'Kc', '7h'])
    expect(results(g2.deal(5))).toEqual([['blackjack', 12]])
  })

  it('dealer stands on soft 17 and player 18 wins', () => {
    const g = table(['Tc', '6d', '8h', 'As'])
    g.deal(10)
    expect(results(g.act('stand'))).toEqual([['win', 20]])
    expect(handValue(g.dealer).total).toBe(17)
  })

  it('dealer draws to 17 and busts', () => {
    const g = table(['Tc', 'Td', '7h', '6s', '9c'])
    g.deal(10)
    expect(results(g.act('stand'))).toEqual([['win', 20]])
    expect(handValue(g.dealer).total).toBe(25)
  })

  it('player bust loses without the dealer drawing', () => {
    const g = table(['Tc', '6d', '6h', 'Ts', '9c'])
    g.deal(10)
    const ev = g.act('hit')
    expect(results(ev)).toEqual([['lose', 0]])
    expect(g.dealer).toHaveLength(2)
  })

  it('double takes one card and doubles the stake', () => {
    const g = table(['6c', 'Td', '5h', '7s', 'Tc'])
    g.deal(10)
    expect(g.legal()).toContain('double')
    expect(results(g.act('double'))).toEqual([['win', 40]])
  })

  it('split plays two hands; a split 21 is not a blackjack', () => {
    // player 8,8 vs dealer 6 (hole T): hand 1 gets 3 then stands on 11? use A → 19, hand 2 gets K → 18; dealer 16 draws T → bust
    const g = table(['8c', '6d', '8h', 'Ts', 'Ac', 'Kd', 'Th'])
    g.deal(10)
    expect(g.legal()).toContain('split')
    g.act('split')
    expect(g.hands.map((h) => h.cards)).toEqual([['8c', 'Ac'], ['8h']])
    g.act('stand') // hand 1 (19); hand 2 gets its second card now
    expect(g.hands[1].cards).toEqual(['8h', 'Kd'])
    expect(results(g.act('stand'))).toEqual([['win', 20], ['win', 20]])
  })

  it('split aces get one card each; ace + ten after a split pays 1:1', () => {
    const g = table(['Ac', '9d', 'Ah', '7s', 'Kc', '5d'])
    g.deal(10)
    const ev = g.act('split')
    expect(g.hands.map((h) => h.cards.length)).toEqual([2, 2])
    expect(results(ev)[0]).toEqual(['win', 20])
  })

  it('insurance pays 2:1 when the dealer has blackjack', () => {
    const g = table(['Tc', 'Ad', '9h', 'Ks'])
    expect(g.deal(10).some((e) => e.type === 'reveal')).toBe(false)
    expect(g.phase).toBe('insurance')
    const ev = g.insurance(true)
    const ins = ev.find((e) => e.type === 'insurance')
    expect(ins).toMatchObject({ bet: 5, won: true, payout: 15 })
    expect(results(ev)).toEqual([['lose', 0]])
  })

  it('declined insurance: dealer without blackjack lets you play on', () => {
    const g = table(['Tc', 'Ad', '9h', '6s'])
    g.deal(10)
    g.insurance(false)
    expect(g.phase).toBe('player')
  })

  it('reshuffles past the cut card', () => {
    const g = new Blackjack(new Shoe(1, () => 0.3))
    let shuffled = false
    for (let i = 0; i < 20 && !shuffled; i++) {
      const ev = g.deal(10)
      shuffled = ev.some((e) => e.type === 'shuffle')
      if (g.phase === 'insurance') g.insurance(false)
      while (g.phase === 'player') g.act('stand')
    }
    expect(shuffled).toBe(true)
  })
})
