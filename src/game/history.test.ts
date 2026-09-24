import { describe, expect, it } from 'vitest'
import { PokerEngine } from '../engine/engine'
import { Recorder, useHistory } from './history'

describe('Recorder', () => {
  it('records public actions, the hero result, and only shown-down cards', () => {
    const engine = new PokerEngine({ smallBlind: 5, bigBlind: 10, numSeats: 6, heroSeat: 0 })
    ;[0, 1, 2].forEach((s) => engine.sitDown(s, 1000))
    const rec = new Recorder({ hero: 0, numSeats: 6, nameOf: (s) => `P${s}`, worth: () => 0 })
    engine.on((e) => rec.onEvent(e))
    rec.startSession({ buyIn: 1000, sb: 5, bb: 10, opponents: 2, difficulty: 'normal' })
    engine.startHand()
    let folder = -1
    while (engine.toAct !== null) {
      const seat = engine.toAct
      const l = engine.getLegalActions(seat)!
      if (folder < 0 && seat !== 0) {
        folder = seat
        engine.act(seat, { type: 'fold' })
      } else engine.act(seat, { type: l.actions.includes('check') ? 'check' : 'call' })
    }
    const folderCards = (engine as unknown as { hole: string[][] }).hole[folder]
    const [hand] = useHistory.getState().hands
    expect(hand.hole).toHaveLength(2)
    expect(hand.board).toHaveLength(5)
    expect(hand.showdown).toBe(true)
    expect(hand.shown.map((s) => s.name)).not.toContain(`P${folder}`)
    expect(JSON.stringify(hand)).not.toContain(`"${folderCards[0]}"`)
    const total = hand.winners.reduce((a, w) => a + w.amount, 0)
    expect(total).toBe(hand.pot)
    expect(hand.actions[0]).toMatchObject({ action: 'small blind', amount: 5 })
    expect(useHistory.getState().sessions[0].hands).toBe(1)
  })
})
