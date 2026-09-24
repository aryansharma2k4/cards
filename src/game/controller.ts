import { PokerEngine, type Action, type EngineEvent } from '../engine/engine'
import { DENOMS, breakdown } from '../engine/chips'
import { decide, makePersonality, type Difficulty, type Style } from '../ai/bot'
import { requestEquity } from '../ai/equity'
import { play, setAmbient } from '../audio/sound'
import { AI_SEATS, HERO, NUM_SEATS } from '../ui/geometry'
import { fastForward, playEvent, sleep } from './director'
import { Recorder } from './history'
import { get, log, patchSeat, set, useGame, type Avatar, type SeatView, type TableConfig } from './store'

const NAMES = [
  'Viktor', 'Isabella', 'Mateo', 'Yuki', 'Anya', 'Rafael', 'Celeste', 'Dmitri', 'Amara', 'Lorenzo', 'Sienna', 'Kofi',
  'Ingrid', 'Thiago', 'Noor', 'Felix', 'Leona', 'Hugo', 'Esme', 'Ravi', 'Margot', 'Soren', 'Priya', 'Otto', 'Vera',
  'Julien', 'Mina', 'Caspian', 'Zara', 'Nikolai',
]
const STYLE_MIX: Style[] = ['TAG', 'LAG', 'ROCK', 'STATION', 'TAG', 'LAG']
const MOTIFS: Avatar['motif'][] = ['s', 'h', 'd', 'c']

const NICE = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2500, 5000]

/** Buy-in = 100 big blinds; small blind = the largest standard amount ≤ half of it ($2/$5, $10/$25…). */
export function blindsFor(buyIn: number) {
  const bb = Math.max(1, Math.round(buyIn / 100))
  const sb = [...NICE].reverse().find((n) => n <= bb / 2) ?? 1
  // Smallest chip worth using: divides both blinds.
  const unit = [...DENOMS].reverse().find((d) => sb % d === 0 && bb % d === 0) ?? 1
  return { sb, bb, unit }
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

function newBot(taken: Set<string>): SeatView {
  const pool = NAMES.filter((n) => !taken.has(n))
  const name = pool[Math.floor(Math.random() * pool.length)]
  const style = STYLE_MIX[Math.floor(Math.random() * STYLE_MIX.length)]
  return {
    ...emptySeat(name),
    avatar: { initials: name.slice(0, 2), hue: Math.floor(Math.random() * 360), motif: MOTIFS[Math.floor(Math.random() * 4)] },
    personality: makePersonality(style),
  }
}

function emptySeat(name: string): SeatView {
  return {
    name,
    avatar: { initials: name.slice(0, 2), hue: 40, motif: 's' },
    stack: 0,
    bet: 0,
    cards: [],
    status: null,
    folded: false,
    allIn: false,
    thinking: null,
    handLabel: null,
    winner: false,
    sittingOut: false,
  }
}

class Controller {
  private engine: PokerEngine | null = null
  private queue: EngineEvent[] = []
  /** Bumped on leave so any in-flight async loop notices and stops. */
  private gen = 0
  private heroResolve: ((a: Action) => void) | null = null
  private bustResolve: ((rebuy: boolean) => void) | null = null
  private thinkKey = 0
  private recorder = new Recorder({
    hero: HERO,
    numSeats: NUM_SEATS,
    nameOf: (seat) => (seat === HERO ? 'You' : (get().seats[seat]?.name ?? `Seat ${seat}`)),
    worth: () => get().bankroll + (this.engine?.seats()[HERO]?.stack ?? 0),
  })

  start(cfg: Omit<TableConfig, 'sb' | 'bb' | 'unit'>) {
    const { sb, bb, unit } = blindsFor(cfg.buyIn)
    const table: TableConfig = { ...cfg, sb, bb, unit }
    const engine = new PokerEngine({ smallBlind: sb, bigBlind: bb, numSeats: NUM_SEATS, heroSeat: HERO })
    engine.on((e) => this.queue.push(e))
    engine.on((e) => this.recorder.onEvent(e))
    this.engine = engine
    this.queue = []

    const seats: (SeatView | null)[] = Array(NUM_SEATS).fill(null)
    seats[HERO] = { ...emptySeat('You'), avatar: { initials: 'You', hue: 42, motif: 's' }, stack: cfg.buyIn }
    engine.sitDown(HERO, cfg.buyIn)
    const taken = new Set<string>()
    for (const i of AI_SEATS[cfg.opponents]) {
      const bot = { ...newBot(taken), stack: cfg.buyIn }
      taken.add(bot.name)
      seats[i] = bot
      engine.sitDown(i, cfg.buyIn)
    }
    set((s) => ({
      screen: 'table',
      table,
      bankroll: s.bankroll - cfg.buyIn,
      seated: cfg.buyIn,
      seats,
      board: [],
      pot: 0,
      handNo: 0,
      rack: breakdown(cfg.buyIn, unit),
      pile: [],
      log: [],
      flyers: [],
      banner: null,
      dialog: null,
      paused: false,
      colorUpHint: false,
    }))
    this.recorder.startSession({ buyIn: cfg.buyIn, sb, bb, opponents: cfg.opponents, difficulty: cfg.difficulty })
    log(`You sit down with $${cfg.buyIn.toLocaleString()} · blinds $${sb}/$${bb}`)
    setAmbient(get().settings.ambient)
    void this.loop(++this.gen)
  }

  /** Stand up: whatever is in front of you goes back to the bankroll. */
  leave() {
    this.gen++
    this.heroResolve = null
    this.bustResolve = null
    const stack = this.engine?.seats()[HERO]?.stack ?? 0
    this.recorder.endSession(stack)
    this.engine = null
    setAmbient(false)
    set((s) => ({ screen: 'lobby', bankroll: s.bankroll + stack, seated: 0, table: null, flyers: [], legal: null, dialog: null, focus: false }))
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }

  private alive = (gen: number) => gen === this.gen && this.engine !== null

  private async drain(gen: number) {
    while (this.queue.length && this.alive(gen)) await playEvent(this.queue.shift()!)
  }

  private async loop(gen: number) {
    await sleep(500)
    while (this.alive(gen)) {
      const engine = this.engine!
      await this.waitUnpaused(gen)
      if (!this.alive(gen)) return
      if (!(await this.seatPlayers(gen))) return

      engine.startHand()
      await this.drain(gen)
      while (this.alive(gen) && engine.inProgress) {
        const seat = engine.toAct
        if (seat === null) break
        const legal = engine.getLegalActions(seat)!
        const potBefore = engine.potTotal()
        const action = seat === HERO ? await this.heroTurn() : await this.botTurn(seat, gen)
        if (!this.alive(gen)) return
        if (seat === HERO) this.recorder.decision(legal, potBefore, get().equity, action)
        engine.act(seat, action)
        await this.drain(gen)
      }
      await this.drain(gen)
      await sleep(600)
    }
  }

  /** Replace busted bots, handle a busted hero. Returns false if we left the table. */
  private async seatPlayers(gen: number): Promise<boolean> {
    const engine = this.engine!
    const cfg = get().table!
    const occupied = engine.seats()
    // Hero busted?
    if (!occupied[HERO]) {
      set({ dialog: 'bust' })
      const rebuy = await new Promise<boolean>((r) => (this.bustResolve = r))
      if (!this.alive(gen)) return false
      set({ dialog: null })
      if (!rebuy || get().bankroll < cfg.buyIn) {
        this.leave()
        return false
      }
      engine.sitDown(HERO, cfg.buyIn)
      set((s) => ({ bankroll: s.bankroll - cfg.buyIn, seated: cfg.buyIn, rack: breakdown(cfg.buyIn, cfg.unit) }))
      patchSeat(HERO, { stack: cfg.buyIn })
      this.recorder.rebuy(cfg.buyIn)
      log(`You rebuy for $${cfg.buyIn.toLocaleString()}`)
      play('stack')
    }
    // Busted bots leave; fresh ones sit down.
    for (const i of AI_SEATS[cfg.opponents]) {
      if (occupied[i]) continue
      const old = get().seats[i]
      if (old) {
        log(`${old.name} leaves the table`)
        patchSeat(i, { sittingOut: true })
        await sleep(700)
      }
      const taken = new Set(get().seats.filter(Boolean).map((s) => s!.name))
      const bot = { ...newBot(taken), stack: cfg.buyIn }
      engine.sitDown(i, cfg.buyIn)
      set((s) => {
        const seats = s.seats.slice()
        seats[i] = bot
        return { seats }
      })
      log(`${bot.name} takes a seat with $${cfg.buyIn.toLocaleString()}`)
      await sleep(300)
    }
    return this.alive(gen)
  }

  private waitUnpaused(gen: number) {
    return new Promise<void>((resolve) => {
      if (!get().paused) return resolve()
      const unsub = useGame.subscribe((s) => {
        if (!s.paused || !this.alive(gen)) {
          unsub()
          resolve()
        }
      })
    })
  }

  // ---- hero ----

  private heroTurn(): Promise<Action> {
    const legal = this.engine!.getLegalActions(HERO)!
    set({ legal })
    return new Promise<Action>((resolve) => {
      this.heroResolve = (a) => {
        this.heroResolve = null
        set({ legal: null })
        resolve(a)
      }
    })
  }

  /** Called by the UI. */
  heroAct(a: Action) {
    if (a.type === 'fold' || a.type === 'check') this.returnPile()
    this.heroResolve?.(a)
  }

  /** Put an unfinished bet pile back in the rack. */
  returnPile() {
    set((s) => {
      const rack = { ...s.rack }
      for (const d of s.pile) rack[d] = (rack[d] ?? 0) + 1
      return { rack, pile: [] }
    })
  }

  answerBust(rebuy: boolean) {
    this.bustResolve?.(rebuy)
  }

  /** Current engine view the betting UI needs. */
  heroContext() {
    const e = this.engine
    const me = e?.seats()[HERO]
    return { pot: e?.potTotal() ?? 0, bet: me?.bet ?? 0, stack: me?.stack ?? 0, bb: get().table?.bb ?? 0 }
  }

  // ---- bots ----

  private async botTurn(seat: number, gen: number): Promise<Action> {
    const engine = this.engine!
    const legal = engine.getLegalActions(seat)!
    const me = engine.seats()[seat]!
    const pot = engine.potTotal()
    const active = engine.activeSeats()
    const opponents = active.length - 1
    const big = legal.toCall > pot * 0.4 || legal.toCall >= me.stack * 0.3
    const difficulty: Difficulty = get().table!.difficulty
    const fast = get().settings.speed === 'fast'
    const ms = fastForward() ? 0 : Math.max(350, rand(800, 2500) * (big ? 1.35 : 1) * (fast ? 0.55 : 1))
    if (ms) patchSeat(seat, { thinking: { ms, key: this.thinkKey++ } })

    const iterations = fastForward() ? 500 : { easy: 800, normal: 1500, hard: 3000 }[difficulty]
    // Pre-flop bots judge hand strength heads-up; after the flop, against everyone still in.
    const vs = engine.street === 'preflop' ? 1 : opponents
    const [equity] = await Promise.all([
      requestEquity(engine.holeCardsFor(seat)!, engine.board, vs, iterations),
      new Promise((r) => setTimeout(r, ms)),
    ])
    if (!this.alive(gen)) return { type: 'fold' }
    patchSeat(seat, { thinking: null })

    // Position: 0 = first to act after the button, 1 = the button itself.
    const order = [...active].sort((a, b) => ((a - engine.button - 1 + NUM_SEATS) % NUM_SEATS) - ((b - engine.button - 1 + NUM_SEATS) % NUM_SEATS))
    const position = order.length > 1 ? order.indexOf(seat) / (order.length - 1) : 1
    return decide(
      get().seats[seat]!.personality!,
      { legal, equity, pot, stack: me.stack, bet: me.bet, bb: get().table!.bb, unit: get().table!.unit, street: engine.street, opponents, position },
      difficulty,
    )
  }
}

export const game = new Controller()
