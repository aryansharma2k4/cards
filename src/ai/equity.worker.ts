import { equity, equityVsRange } from './mc'

export interface EquityRequest {
  id: number
  hole: string[]
  board: string[]
  opponents: number
  iterations: number
  /** Opponents' pre-flop range (top share of hands); omitted = any two cards. */
  range?: number
}

self.onmessage = (e: MessageEvent<EquityRequest>) => {
  const { id, hole, board, opponents, iterations, range } = e.data
  self.postMessage({ id, equity: range === undefined ? equity(hole, board, opponents, iterations) : equityVsRange(hole, opponents, range, iterations) })
}
