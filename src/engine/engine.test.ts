import { describe, expect, it } from 'vitest'
import { CardRank, CardSuit } from 'poker-ts/dist/lib/card'
import { PokerEngine, buildPots, splitPot, type EngineEvent } from './engine'
import { describeHand } from './evaluate'

function setup(stacks: number[], blinds = [1, 2], hero = 0) {
  const engine = new PokerEngine({ smallBlind: blinds[0], bigBlind: blinds[1], numSeats: 6, heroSeat: hero })
  stacks.forEach((s, i) => engine.sitDown(i, s))
  const events: EngineEvent[] = []
  engine.on((e) => events.push(e))
  return { engine, events }
}

/** Stack the deck: hole cards are dealt seat by seat (2 each), then the board. */
function rig(engine: PokerEngine, draws: string[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deck = (engine as any).table._table._deck
  const code = (c: { rank: number; suit: number }) =>
    CardRank[c.rank].replace('_', '') + CardSuit[c.suit][0].toLowerCase()
  deck.shuffle = () => {
    const all = Array.from({ length: 52 }, (_, i) => deck[i])
    const picked = draws.map((d) => all.find((c) => code(c) === d))
    const rest = all.filter((c) => !picked.includes(c))
    ;[...rest, ...picked.reverse()].forEach((c, i) => (deck[i] = c))
  }
}

/** Everyone shoves or calls until the hand ends. */
function allIn(engine: PokerEngine) {
  while (engine.toAct !== null) {
    const seat = engine.toAct
    const l = engine.getLegalActions(seat)!
    if (l.max !== undefined) engine.act(seat, { type: l.actions.includes('bet') ? 'bet' : 'raise', amount: l.max })
    else engine.act(seat, { type: l.actions.includes('call') ? 'call' : 'check' })
  }
}

const passive = (engine: PokerEngine, seat: number) => {
  const l = engine.getLegalActions(seat)!
  engine.act(seat, { type: l.actions.includes('check') ? 'check' : 'call' })
}

describe('blinds', () => {
  it('posts small then big blind clockwise from the button', () => {
    const { engine, events } = setup([100, 100, 100])
    engine.startHand()
    const blinds = events.filter((e) => e.type === 'blind')
    const b = engine.button
    expect(blinds).toEqual([
      { type: 'blind', seat: (b + 1) % 3, amount: 1, kind: 'small' },
      { type: 'blind', seat: (b + 2) % 3, amount: 2, kind: 'big' },
    ])
    expect(engine.potTotal()).toBe(3)
    // 3-handed the button acts first preflop
    expect(engine.toAct).toBe(b)
  })

  it('heads-up: the button posts the small blind', () => {
    const { engine, events } = setup([100, 100])
    engine.startHand()
    const sb = events.find((e) => e.type === 'blind' && e.kind === 'small')
    expect(sb && sb.type === 'blind' && sb.seat).toBe(engine.button)
  })

  it('a short stack posts what it has', () => {
    const { engine, events } = setup([100, 3, 100], [5, 10])
    while (!events.some((e) => e.type === 'blind' && e.seat === 1)) {
      engine.startHand()
      while (engine.toAct !== null) engine.act(engine.toAct, { type: 'fold' })
    }
    expect(events.find((e) => e.type === 'blind' && e.seat === 1)).toMatchObject({ amount: 3 })
  })
})

describe('min-raise', () => {
  it('enforces raise-to = last bet + last raise size', () => {
    const { engine } = setup([100, 100, 100])
    engine.startHand()
    const first = engine.toAct!
    const l = engine.getLegalActions(first)!
    expect(l).toMatchObject({ toCall: 2, min: 4, max: 100 })
    expect(() => engine.act(first, { type: 'raise', amount: 3 })).toThrow()

    engine.act(first, { type: 'raise', amount: 6 }) // raise of 4
    const next = engine.toAct!
    expect(engine.getLegalActions(next)).toMatchObject({ min: 10 })
    expect(() => engine.act(next, { type: 'raise', amount: 9 })).toThrow()
    engine.act(next, { type: 'raise', amount: 10 })
  })

  it('only the player to act may act', () => {
    const { engine } = setup([100, 100, 100])
    engine.startHand()
    const other = (engine.toAct! + 1) % 3
    expect(engine.getLegalActions(other)).toBeNull()
    expect(() => engine.act(other, { type: 'call' })).toThrow()
  })
})

describe('all-in and side pots', () => {
  it('builds a main pot and side pot, each paid to the right player', () => {
    const { engine, events } = setup([50, 100, 200])
    // seat0 aces, seat1 kings, seat2 junk; dry board
    rig(engine, ['As', 'Ad', 'Ks', 'Kd', '7c', '2h', 'Qh', '9c', '5d', '3s', '8h'])
    engine.startHand()
    allIn(engine)
    const end = events.find((e) => e.type === 'handEnd')!
    if (end.type !== 'handEnd') throw 0
    expect(end.pots[0]).toMatchObject({ amount: 150, winners: [0] })
    expect(end.pots[1]).toMatchObject({ amount: 100, winners: [1] })
    expect(end.stacks).toMatchObject({ 0: 150, 1: 100, 2: 100 })
    expect(end.board).toHaveLength(5)
    // runout still arrives street by street
    expect(events.filter((e) => e.type === 'street').map((e) => e.type === 'street' && e.street)).toEqual([
      'flop', 'turn', 'river',
    ])
  })
})

describe('buildPots', () => {
  it('caps pots at each all-in level; folded chips stay in', () => {
    // A all-in 50, B all-in 100, C 200, D folded after putting in 30
    expect(buildPots({ 0: 50, 1: 100, 2: 200, 3: 30 }, [0, 1, 2])).toEqual([
      { amount: 180, eligible: [0, 1, 2] },
      { amount: 100, eligible: [1, 2] },
      { amount: 100, eligible: [2] }, // uncalled excess goes back to C
    ])
  })
})

describe('split pots', () => {
  it('splits evenly when the board plays', () => {
    const { engine, events } = setup([100, 100])
    rig(engine, ['2c', '3d', '2h', '3s', 'Ah', 'Kd', 'Qs', 'Jc', 'Th'])
    engine.startHand()
    allIn(engine)
    const end = events.find((e) => e.type === 'handEnd')!
    if (end.type !== 'handEnd') throw 0
    expect(end.pots[0].winners.sort()).toEqual([0, 1])
    expect(end.stacks).toEqual({ 0: 100, 1: 100 })
  })

  it('gives odd chips clockwise from the button', () => {
    expect(splitPot(5, [3, 1], 0, 6)).toEqual({ 1: 3, 3: 2 })
    expect(splitPot(5, [3, 1], 2, 6)).toEqual({ 3: 3, 1: 2 })
  })
})

describe('showdown reveals', () => {
  it('never exposes folded or opponent hole cards; reveals only live hands', () => {
    const { engine, events } = setup([100, 100, 100])
    engine.startHand()
    if (engine.toAct === 0) passive(engine, 0) // seat 0 is the hero; fold someone else
    const folder = engine.toAct!
    const secret = [0, 1, 2].filter((x) => x !== 0).flatMap((x) => engine.holeCardsFor(x)!)
    const folderCards = engine.holeCardsFor(folder)!
    engine.act(folder, { type: 'fold' })
    while (engine.toAct !== null) passive(engine, engine.toAct)

    const deal = events.find((e) => e.type === 'deal')!
    if (deal.type !== 'deal') throw 0
    expect(deal.hero).toHaveLength(2)
    const beforeShowdown = JSON.stringify(events.filter((e) => e.type !== 'showdown'))
    for (const c of secret) expect(beforeShowdown).not.toContain(`"${c}"`)
    for (const c of folderCards) expect(JSON.stringify(events)).not.toContain(`"${c}"`)

    const sd = events.find((e) => e.type === 'showdown')!
    if (sd.type !== 'showdown') throw 0
    expect(sd.reveals.map((r) => r.seat).sort()).toEqual([0, 1, 2].filter((s) => s !== folder))
    expect(engine.holeCardsFor(folder)).toBeNull()
  })

  it('no showdown when everyone folds to one player', () => {
    const { engine, events } = setup([100, 100, 100])
    engine.startHand()
    engine.act(engine.toAct!, { type: 'fold' })
    engine.act(engine.toAct!, { type: 'fold' })
    expect(events.some((e) => e.type === 'showdown')).toBe(false)
    const end = events.find((e) => e.type === 'handEnd')!
    expect(end.type === 'handEnd' && end.uncontested).toBe(true)
  })

  it('the last river aggressor shows first', () => {
    const { engine, events } = setup([100, 100, 100])
    engine.startHand()
    while (engine.street !== 'river') passive(engine, engine.toAct!)
    const bettor = engine.toAct!
    engine.act(bettor, { type: 'bet', amount: 10 })
    while (engine.toAct !== null) passive(engine, engine.toAct)
    const sd = events.find((e) => e.type === 'showdown')!
    expect(sd.type === 'showdown' && sd.reveals[0].seat).toBe(bettor)
  })
})

describe('describeHand', () => {
  it('labels hands', () => {
    expect(describeHand(['Ah', 'Kh', 'Qh', 'Jh', 'Th', '2c', '3d']).label).toBe('Royal flush')
    expect(describeHand(['Qs', 'Qd', 'Qc', '5h', '5s', '2d', '3c']).label).toBe('Full house, Queens full of Fives')
    const wheel = describeHand(['As', '2d', '3c', '4h', '5s', 'Kd', 'Kc'])
    expect(wheel.label).toBe('Straight, Five high')
    expect(wheel.cards).toContain('As')
    expect(describeHand(['As', 'Ad']).category).toBe(1)
  })
})

describe('all-in on a later street', () => {
  it('pays a player who went all-in before the river (poker-ts payout bug)', () => {
    const { engine, events } = setup([60, 1000, 1000])
    // seat0 flops a set of aces; seats 1 and 2 have nothing
    rig(engine, ['As', 'Ad', '7c', '2h', '8d', '3s', 'Ah', '9c', '5d', 'Kh', 'Jc'])
    engine.startHand()
    while (engine.street === 'preflop') passive(engine, engine.toAct!)
    // flop: seat 0 shoves when it acts, everyone else calls
    while (engine.street === 'flop' && engine.toAct !== null) {
      const seat = engine.toAct
      const l = engine.getLegalActions(seat)!
      if (seat === 0 && l.max !== undefined) engine.act(0, { type: l.actions.includes('bet') ? 'bet' : 'raise', amount: l.max })
      else passive(engine, seat)
    }
    const shove = events.find((e) => e.type === 'action' && e.seat === 0 && e.allIn)
    expect(shove).toMatchObject({ bet: 58, stack: 0 })
    while (engine.toAct !== null) passive(engine, engine.toAct)
    const end = events.find((e) => e.type === 'handEnd')!
    if (end.type !== 'handEnd') throw 0
    expect(end.pots[0].winners).toEqual([0])
    expect(end.stacks[0]).toBe(180)
    expect(Object.values(end.stacks).reduce((a, b) => a + b, 0)).toBe(2060)
  })
})
