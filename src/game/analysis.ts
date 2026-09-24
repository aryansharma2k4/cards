import type { Decision, HandRecord } from './history'

const pct = (x: number) => `${Math.round(x * 100)}%`

export interface Summary {
  hands: number
  net: number
  /** Big blinds won per 100 hands (standard win-rate unit). */
  bbPer100: number
  /** Voluntarily put chips in pre-flop. */
  vpip: number
  /** Raised pre-flop. */
  pfr: number
  /** Went to showdown. */
  wtsd: number
  /** Won money when reaching showdown. */
  wsd: number
  biggestWin: number
  biggestLoss: number
}

export function summarize(hands: HandRecord[]): Summary {
  const n = hands.length || 1
  const pre = (h: HandRecord) => h.decisions.filter((d) => d.street === 'preflop')
  const showdowns = hands.filter((h) => h.showdown && !h.folded)
  return {
    hands: hands.length,
    net: hands.reduce((a, h) => a + h.net, 0),
    bbPer100: (hands.reduce((a, h) => a + h.net / h.bb, 0) / n) * 100,
    vpip: hands.filter((h) => pre(h).some((d) => d.action === 'call' || d.action === 'bet' || d.action === 'raise')).length / n,
    pfr: hands.filter((h) => pre(h).some((d) => d.action === 'raise' || d.action === 'bet')).length / n,
    wtsd: showdowns.length / n,
    wsd: showdowns.length ? showdowns.filter((h) => h.net > 0).length / showdowns.length : 0,
    biggestWin: Math.max(0, ...hands.map((h) => h.net)),
    biggestLoss: Math.min(0, ...hands.map((h) => h.net)),
  }
}

export type Tone = 'good' | 'ok' | 'warn'

/**
 * Plain-language read on one decision, from equity vs the price you were
 * getting. Equity is vs random live hands, so it's a guide, not a solver.
 */
export function verdict(d: Decision): { tone: Tone; text: string } {
  const need = d.toCall > 0 ? d.toCall / (d.pot + d.toCall) : 0
  const eq = d.equity
  if (eq === null) return { tone: 'ok', text: 'No equity estimate was ready for this decision.' }
  const odds = `you had ${pct(eq)} equity and needed ${pct(need)}`
  switch (d.action) {
    case 'fold':
      if (d.toCall === 0) return { tone: 'warn', text: `Folded when you could check for free (${pct(eq)} equity).` }
      if (eq > need + 0.1) return { tone: 'warn', text: `Probably too tight: ${odds} to call.` }
      if (eq > need) return { tone: 'ok', text: `Close fold: ${odds}. Calling was slightly +EV on raw odds.` }
      return { tone: 'good', text: `Good fold: ${odds}.` }
    case 'call':
      if (eq >= need + 0.05) return { tone: 'good', text: `Profitable call: ${odds}.` }
      if (eq >= need - 0.05) return { tone: 'ok', text: `Borderline call: ${odds}. Implied odds decide it.` }
      return { tone: 'warn', text: `Loose call: ${odds}. Needs big implied odds or a read.` }
    case 'check':
      if (eq > 0.65) return { tone: 'ok', text: `Checked a strong hand (${pct(eq)}). A bet would build the pot.` }
      return { tone: 'good', text: `Check with ${pct(eq)} equity keeps the pot small.` }
    case 'bet':
    case 'raise':
      if (eq >= 0.55) return { tone: 'good', text: `Value ${d.action} with ${pct(eq)} equity.` }
      if (eq >= 0.35) return { tone: 'ok', text: `Semi-bluff / thin ${d.action} with ${pct(eq)} equity.` }
      return { tone: 'warn', text: `Bluff with ${pct(eq)} equity: only works if they fold often.` }
  }
}

/** Sum of net by a key, in first-seen order. */
export function groupNet<K extends string>(hands: HandRecord[], key: (h: HandRecord) => K) {
  const m = new Map<K, { net: number; hands: number }>()
  for (const h of hands) {
    const k = key(h)
    const g = m.get(k) ?? { net: 0, hands: 0 }
    g.net += h.net
    g.hands++
    m.set(k, g)
  }
  return [...m.entries()].map(([k, g]) => ({ key: k, ...g }))
}
