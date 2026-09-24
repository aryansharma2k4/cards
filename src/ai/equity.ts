import type { EquityRequest } from './equity.worker'

let worker: Worker | null = null
let nextId = 0
const pending = new Map<number, (v: number) => void>()

/** Equity via the Web Worker so simulations never block the UI thread. */
export function requestEquity(hole: string[], board: string[], opponents: number, iterations = 2000): Promise<number> {
  if (!worker) {
    worker = new Worker(new URL('./equity.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ id: number; equity: number }>) => {
      pending.get(e.data.id)?.(e.data.equity)
      pending.delete(e.data.id)
    }
  }
  const id = nextId++
  return new Promise((resolve) => {
    pending.set(id, resolve)
    worker!.postMessage({ id, hole, board, opponents, iterations } satisfies EquityRequest)
  })
}
