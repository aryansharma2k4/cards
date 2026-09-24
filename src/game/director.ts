import type { EngineEvent } from '../engine/engine'
import { describeHand } from '../engine/evaluate'
import { breakdown, formatMoney, greedy, isCluttered, pay, rackTotal, type Rack } from '../engine/chips'
import { play } from '../audio/sound'
import { requestEquity } from '../ai/equity'
import { BURN, DECK, HERO, MUCK, POT, RACK, betSpot, boardSlot, holeCardPos, CARD, HERO_CARD, OPP_CARD, PILE, SEATS } from '../ui/geometry'
import { fly, get, log, patchSeat, set, type CardView } from './store'

/** Hero's hole cards for the current hand (the only ones the UI ever knows before showdown). */
let heroCards: string[] = []
let heroFolded = false
let cardKey = 0

/** After the hero folds, the rest of the hand plays out almost instantly (only the result lingers). */
export const fastForward = () => heroFolded && get().settings.skipWhenFolded
const speed = () => (fastForward() ? 0.03 : get().settings.speed === 'fast' ? 0.55 : 1)
export const T = (ms: number) => ms * speed()
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, T(ms)))
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

const name = (seat: number) => (seat === HERO ? 'You' : (get().seats[seat]?.name ?? `Seat ${seat}`))
const SUIT_GLYPH: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }
const pretty = (cards: string[]) => cards.map((c) => (c[0] === 'T' ? '10' : c[0]) + SUIT_GLYPH[c[1]]).join(' ')
const expand = (r: Rack) =>
  Object.entries(r)
    .map(([d, n]) => [Number(d), n] as const)
    .sort((a, b) => b[0] - a[0])
    .flatMap(([d, n]) => Array<number>(n).fill(d))
const flyerChips = (amount: number) => expand(greedy(amount)).slice(0, 8)
const minDenom = () => get().table?.unit ?? 1

/** Take `amount` from the hero's rack (using the bet pile first if it matches). Returns chips + origin. */
function heroPay(amount: number) {
  const { rack, pile } = get()
  const pileTotal = pile.reduce((a, b) => a + b, 0)
  if (pile.length && pileTotal === amount) {
    set({ pile: [] })
    return { chips: pile.slice().sort((a, b) => b - a).slice(0, 8), from: PILE }
  }
  const back: Rack = { ...rack }
  for (const d of pile) back[d] = (back[d] ?? 0) + 1
  const res = pay(back, amount)
  const left = res ? res.left : breakdown(Math.max(0, rackTotal(back) - amount), minDenom())
  set({ rack: left, pile: [] })
  return { chips: res ? expand(res.paid).slice(0, 8) : flyerChips(amount), from: { x: RACK.x + RACK.w / 2, y: RACK.y + 60 } }
}

function heroReceive(amount: number) {
  set((s) => {
    const rack = { ...s.rack }
    for (const [d, n] of Object.entries(breakdown(amount, minDenom()))) rack[+d] = (rack[+d] ?? 0) + n
    return { rack, colorUpHint: s.colorUpHint || isCluttered(rack) }
  })
}

function updateHeroInfo() {
  if (heroFolded || heroCards.length < 2) return
  const board = get().board.map((c) => c.code!).filter(Boolean)
  set({ heroHand: describeHand([...heroCards, ...board]) })
  if (!get().settings.showEquity) return
  const opps = get().seats.filter((s, i) => s && i !== HERO && s.cards.length && !s.folded).length
  const hand = get().handNo
  requestEquity(heroCards, board, Math.max(opps, 1), 2500).then((equity) => get().handNo === hand && !heroFolded && set({ equity }))
}

async function chipsTo(seat: number, amount: number, to = betSpot(seat)) {
  const src = seat === HERO ? heroPay(amount) : { chips: flyerChips(amount), from: SEATS[seat] }
  await fly({ kind: 'chips', from: src.from, to, duration: T(420), chips: src.chips })
}

export async function playEvent(e: EngineEvent): Promise<void> {
  switch (e.type) {
    case 'handStart': {
      heroFolded = false
      heroCards = []
      set((s) => ({
        seats: s.seats.map((v, i) =>
          v && e.seats.includes(i)
            ? { ...v, cards: [], status: null, folded: false, allIn: false, bet: 0, handLabel: null, winner: false, stack: e.stacks[i] }
            : v,
        ),
        board: [],
        burned: 0,
        pot: 0,
        button: e.button,
        handNo: s.handNo + 1,
        banner: null,
        heroHand: null,
        equity: null,
        pile: [],
      }))
      log(`— Hand #${get().handNo} · ${name(e.button)} ${e.button === HERO ? 'have' : 'has'} the button —`)
      play('shuffle')
      await sleep(900)
      return
    }

    case 'blind': {
      patchSeat(e.seat, { status: e.kind === 'small' ? 'Small blind' : 'Big blind' })
      play('push', { volume: 0.6 })
      await chipsTo(e.seat, e.amount)
      const s = get().seats[e.seat]!
      patchSeat(e.seat, { bet: e.amount, stack: s.stack - e.amount, allIn: s.stack - e.amount === 0 })
      log(`${name(e.seat)} ${e.seat === HERO ? 'post' : 'posts'} the ${e.kind} blind ${formatMoney(e.amount)}`)
      await sleep(120)
      return
    }

    case 'deal': {
      heroCards = e.hero ?? []
      const flights: Promise<void>[] = []
      let k = 0
      for (let round = 0; round < 2; round++) {
        for (const seat of e.seats) {
          const to = holeCardPos(seat, round)
          const delay = T(k++ * 120)
          const width = seat === HERO ? HERO_CARD.w : OPP_CARD.w
          setTimeout(() => play('deal', { minGap: 20 }), delay)
          flights.push(
            fly({
              kind: 'card',
              from: DECK,
              to,
              duration: T(380),
              delay,
              card: { faceUp: false, width, spin: -140 + Math.random() * 60, endRotate: to.rot },
            }).then(() => {
              const card: CardView = { id: `c${cardKey++}`, faceUp: false, code: seat === HERO ? heroCards[round] : undefined }
              set((s) => {
                const seats = s.seats.slice()
                const v = seats[seat]
                if (v) seats[seat] = { ...v, cards: [...v.cards, card] }
                return { seats }
              })
            }),
          )
        }
      }
      await Promise.all(flights)
      await sleep(150)
      if (heroCards.length) {
        await frame()
        set((s) => {
          const seats = s.seats.slice()
          const v = seats[HERO]!
          seats[HERO] = { ...v, cards: v.cards.map((c) => ({ ...c, faceUp: true })) }
          return { seats }
        })
        play('flip')
        updateHeroInfo()
        await sleep(450)
      }
      return
    }

    case 'action': {
      const who = name(e.seat)
      const verb = (a: string, b: string) => (e.seat === HERO ? a : b)
      const money = formatMoney(e.bet)
      if (e.action === 'fold') {
        const s = get().seats[e.seat]!
        patchSeat(e.seat, { cards: [], status: 'Fold', folded: true })
        play('toss')
        if (e.seat === HERO) {
          heroFolded = true
          set({ heroHand: null, equity: null })
        }
        log(`${who} ${verb('fold', 'folds')}`)
        await Promise.all(
          s.cards.map((_, i) =>
            fly({
              kind: 'card',
              from: holeCardPos(e.seat, i),
              to: { x: MUCK.x + (Math.random() - 0.5) * 20, y: MUCK.y + (Math.random() - 0.5) * 14 },
              duration: T(420),
              delay: T(i * 60),
              card: { faceUp: false, width: CARD.w * 0.62, spin: 90 + Math.random() * 120, endRotate: Math.random() * 40 - 20 },
            }),
          ),
        )
        return
      }
      if (e.action === 'check') {
        patchSeat(e.seat, { status: 'Check' })
        play('check')
        log(`${who} ${verb('check', 'checks')}`)
        await sleep(350)
        return
      }
      const status = e.allIn ? 'All-in' : e.action === 'call' ? 'Call' : e.action === 'bet' ? `Bet ${money}` : `Raise to ${money}`
      patchSeat(e.seat, { status })
      play(e.allIn && e.amount > 0 ? 'allin' : 'push')
      if (e.amount > 0) await chipsTo(e.seat, e.amount)
      patchSeat(e.seat, { bet: e.bet, stack: e.stack, allIn: e.allIn })
      log(
        e.action === 'call'
          ? `${who} ${verb('call', 'calls')} ${formatMoney(e.amount)}${e.allIn ? ' (all-in)' : ''}`
          : `${who} ${e.action === 'bet' ? verb('bet', 'bets') : verb('raise to', 'raises to')} ${money}${e.allIn ? ' (all-in)' : ''}`,
      )
      await sleep(250)
      return
    }

    case 'collect': {
      const seats = get().seats
      const moving = seats.map((s, i) => (s && s.bet > 0 ? i : -1)).filter((i) => i >= 0)
      if (moving.length) {
        play('push', { volume: 0.8 })
        const amounts = moving.map((i) => seats[i]!.bet)
        set((s) => ({ seats: s.seats.map((v) => (v ? { ...v, bet: 0 } : v)) }))
        await Promise.all(
          moving.map((seat, k) =>
            fly({ kind: 'chips', from: betSpot(seat), to: POT, duration: T(460), delay: T(k * 50), chips: flyerChips(amounts[k]) }),
          ),
        )
      }
      set((s) => ({
        pot: e.pot,
        seats: s.seats.map((v) => (v && !v.folded && !v.allIn && v.status !== null ? { ...v, status: null } : v)),
      }))
      await sleep(200)
      return
    }

    case 'street': {
      play('deal')
      await fly({ kind: 'card', from: DECK, to: BURN, duration: T(360), card: { faceUp: false, width: CARD.w * 0.62, spin: -30, endRotate: 8 } })
      set((s) => ({ burned: s.burned + 1 }))
      const start = e.board.length - e.cards.length
      await Promise.all(
        e.cards.map((code, i) => {
          const delay = T(i * 120)
          setTimeout(() => play('deal', { minGap: 20 }), delay)
          return fly({
            kind: 'card',
            from: DECK,
            to: boardSlot(start + i),
            duration: T(400),
            delay,
            card: { faceUp: false, width: CARD.w, spin: -60, endRotate: 0 },
          }).then(() => set((s) => ({ board: [...s.board, { id: `b${start + i}`, code, faceUp: false }] })))
        }),
      )
      await frame()
      for (let i = 0; i < e.cards.length; i++) {
        const idx = start + i
        set((s) => ({ board: s.board.map((c, j) => (j === idx ? { ...c, faceUp: true } : c)) }))
        play('flip')
        await sleep(e.cards.length > 1 ? 170 : 120)
      }
      await sleep(320)
      log(`${e.street[0].toUpperCase() + e.street.slice(1)}: ${pretty(e.board)}`)
      updateHeroInfo()
      return
    }

    case 'showdown': {
      for (const r of e.reveals) {
        if (r.seat !== HERO) {
          patchSeat(r.seat, { cards: r.cards.map((code, i) => ({ id: `sd${r.seat}${i}`, code, faceUp: false })) })
          await frame()
          patchSeat(r.seat, { cards: r.cards.map((code, i) => ({ id: `sd${r.seat}${i}`, code, faceUp: true })) })
          play('flip')
        }
        patchSeat(r.seat, { handLabel: r.hand.label })
        log(`${name(r.seat)} ${r.seat === HERO ? 'show' : 'shows'} ${pretty(r.cards)} — ${r.hand.label}`)
        await sleep(750)
      }
      // Gold outline on the cards that make the hero's best hand.
      const mine = e.reveals.find((r) => r.seat === HERO)
      if (mine) {
        const best = new Set(mine.hand.cards)
        set((s) => ({
          board: s.board.map((c) => ({ ...c, highlight: best.has(c.code!) })),
          seats: s.seats.map((v, i) => (v && i === HERO ? { ...v, cards: v.cards.map((c) => ({ ...c, highlight: best.has(c.code!) })) } : v)),
        }))
      }
      return
    }

    case 'handEnd': {
      const won: Record<number, number> = {}
      for (const pot of e.pots) {
        const shares = Object.entries(pot.shares).map(([s, amt]) => [Number(s), amt] as const)
        if (!shares.length) continue
        play('rake')
        await Promise.all(
          shares.map(([seat, amt], k) => {
            won[seat] = (won[seat] ?? 0) + amt
            const to = seat === HERO ? { x: RACK.x + RACK.w / 2, y: RACK.y + 70 } : SEATS[seat]
            set((s) => ({ pot: Math.max(0, s.pot - amt) }))
            return fly({ kind: 'chips', from: POT, to, duration: T(620), delay: T(k * 90), chips: flyerChips(amt) }).then(() => {
              if (seat === HERO) heroReceive(amt)
              const v = get().seats[seat]
              if (v) patchSeat(seat, { stack: v.stack + amt })
            })
          }),
        )
        await sleep(200)
      }
      set({ pot: 0 })
      if (won[HERO]) play('stack')

      // Authoritative stacks from the engine; keep the hero's rack in sync.
      set((s) => ({
        seats: s.seats.map((v, i) => (v && e.stacks[i] !== undefined ? { ...v, stack: e.stacks[i], winner: !!won[i], bet: 0 } : v)),
      }))
      const heroStack = e.stacks[HERO]
      if (heroStack !== undefined && rackTotal(get().rack) !== heroStack) set({ rack: breakdown(heroStack, minDenom()) })
      if (heroStack !== undefined) set({ seated: heroStack })

      const winners = Object.keys(won).map(Number)
      const reveal = !e.uncontested
      const label = (seat: number) => (reveal ? get().seats[seat]?.handLabel : null)
      const title =
        winners.length === 1
          ? `${name(winners[0])} ${winners[0] === HERO ? 'win' : 'wins'} ${formatMoney(won[winners[0]])}`
          : `Split pot · ${winners.map(name).join(' & ')}`
      const shown = reveal ? get().seats[winners[0]]?.cards.map((c) => c.code).filter((c): c is string => !!c) : []
      const detail = reveal ? [label(winners[0]), shown?.length ? pretty(shown) : ''].filter(Boolean).join(' · ') : 'Everyone else folded'
      set({ banner: { title, detail, hero: !!won[HERO] } })
      for (const w of winners) log(`${name(w)} ${w === HERO ? 'win' : 'wins'} ${formatMoney(won[w])}${label(w) ? ` with ${label(w)}` : ''}`)
      if (won[HERO]) play('win')
      heroFolded = false // don't fast-forward the between-hands pause
      await sleep(2200)
      set({ banner: null })
      return
    }
  }
}
