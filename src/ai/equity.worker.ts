import { equity } from './mc'

export interface EquityRequest {
  id: number
  hole: string[]
  board: string[]
  opponents: number
  iterations: number
}

self.onmessage = (e: MessageEvent<EquityRequest>) => {
  const { id, hole, board, opponents, iterations } = e.data
  self.postMessage({ id, equity: equity(hole, board, opponents, iterations) })
}
