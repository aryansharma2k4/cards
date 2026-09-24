import type { Action, LegalActions } from '../engine/engine'
import { formatMoney } from '../engine/chips'

export interface PileCheck {
  action: Action | null
  label: string
  hint: string | null
}

/**
 * What confirming a pile of `p` chips would mean for the hero: a call, bet,
 * raise or all-in, or an inline hint explaining why it isn't legal yet.
 * `bet` = hero's chips already in this street, `stack` = chips behind.
 */
export function checkPile(legal: LegalActions, p: number, bet: number, stack: number): PileCheck {
  const { toCall, min, max } = legal
  const sized = legal.actions.includes('bet') ? 'bet' : 'raise'
  const to = bet + p
  if (p <= 0) return { action: null, label: 'Confirm', hint: min !== undefined ? `Click chips to ${sized === 'bet' ? 'bet' : 'raise'}` : null }
  if (p === stack) {
    if (p <= toCall || max === undefined) return { action: { type: 'call' }, label: `All-in ${formatMoney(p)}`, hint: null }
    return { action: { type: sized, amount: max }, label: `All-in ${formatMoney(to)}`, hint: null }
  }
  if (p < toCall) return { action: null, label: 'Confirm', hint: `Add ${formatMoney(toCall - p)} more to call` }
  if (p === toCall) return { action: { type: 'call' }, label: `Call ${formatMoney(p)}`, hint: null }
  if (min === undefined || max === undefined) return { action: null, label: 'Confirm', hint: `You can only call ${formatMoney(toCall)}` }
  if (to < min)
    return {
      action: null,
      label: 'Confirm',
      hint: `Min ${sized} is ${sized === 'raise' ? 'to ' : ''}${formatMoney(min)} — add ${formatMoney(min - to)}`,
    }
  return { action: { type: sized, amount: Math.min(to, max) }, label: sized === 'bet' ? `Bet ${formatMoney(to)}` : `Raise to ${formatMoney(to)}`, hint: null }
}

/** "Raise to" target for a quick-size button, rounded to the chip unit and clamped to legal. */
export function quickTarget(kind: 'min' | 'half' | 'threeq' | 'pot' | 'max', legal: LegalActions, pot: number, bet: number, unit: number): number {
  const { min, max, toCall } = legal
  if (min === undefined || max === undefined) return 0
  if (kind === 'min') return min
  if (kind === 'max') return max
  const frac = { half: 0.5, threeq: 0.75, pot: 1 }[kind]
  const raw = bet + toCall + frac * (pot + toCall)
  return Math.min(max, Math.max(min, Math.round(raw / unit) * unit))
}
