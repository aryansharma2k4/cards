/** Everything on the table lives in one fixed stage coordinate system that is scaled to fit the screen. */
export const STAGE = { w: 1600, h: 1040 }
export const CENTER = { x: 800, y: 440 }

export const FELT = { x: 190, y: 170, w: 1220, h: 560 }
export const RAIL = { x: 116, y: 96, w: 1368, h: 708 }

export type Pt = { x: number; y: number }

/** Engine seat index → avatar position. Seat 0 is the hero, then clockwise. */
export const SEATS: Pt[] = [
  { x: 800, y: 800 }, // hero, bottom centre
  { x: 400, y: 752 }, // bottom-left
  { x: 138, y: 400 }, // left end
  { x: 470, y: 108 }, // top-left
  { x: 1130, y: 108 }, // top-right
  { x: 1462, y: 400 }, // right end
  { x: 1200, y: 752 }, // bottom-right
]
export const NUM_SEATS = SEATS.length
export const HERO = 0

/** Which AI seats to use for n opponents: keeps the table balanced. */
export const AI_SEATS: Record<number, number[]> = {
  1: [4],
  2: [3, 4],
  3: [2, 4, 5],
  4: [1, 3, 4, 6],
  5: [1, 2, 3, 5, 6],
}

const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

/** Where a seat's bet sits on the felt. */
export const betSpot = (seat: number): Pt =>
  seat === HERO ? { x: 800, y: 568 } : lerp(SEATS[seat], CENTER, seat === 2 || seat === 5 ? 0.33 : 0.4)

/** Opponent hole cards: just inside the rail, toward the middle. */
export const cardSpot = (seat: number): Pt => (seat === HERO ? HERO_CARDS : lerp(SEATS[seat], CENTER, 0.2))

/** Dealer button sits beside the bet spot. */
export const buttonSpot = (seat: number): Pt => {
  if (seat === HERO) return { x: 668, y: 640 }
  const b = betSpot(seat)
  const s = SEATS[seat]
  const dx = CENTER.x - s.x
  const dy = CENTER.y - s.y
  const len = Math.hypot(dx, dy) || 1
  return { x: b.x - (dy / len) * 62, y: b.y + (dx / len) * 62 }
}

export const HERO_CARDS: Pt = { x: 800, y: 664 }
export const CARD = { w: 80, h: 112 }
export const HERO_CARD = { w: 100, h: 140 }
export const OPP_CARD = { w: 50, h: 70 }

export const boardSlot = (i: number): Pt => ({ x: CENTER.x + (i - 2) * 92, y: CENTER.y })
export const POT: Pt = { x: 800, y: 322 }
export const DEALER: Pt = { x: 800, y: 52 }
export const DECK: Pt = { x: 800, y: 208 }
export const MUCK: Pt = { x: 694, y: 212 }
export const BURN: Pt = { x: 906, y: 212 }

/** Hero chip rack (stacks laid out left→right, high → low). */
export const RACK = { x: 470, y: 862, w: 660, h: 160 }
export const rackStack = (i: number, n: number): Pt => {
  const gap = Math.min(76, (RACK.w - 60) / Math.max(n, 1))
  return { x: RACK.x + RACK.w / 2 + (i - (n - 1) / 2) * gap, y: RACK.y + RACK.h - 28 }
}

/** Centre + tilt of a seat's i-th hole card. */
export function holeCardPos(seat: number, i: number): Pt & { rot: number } {
  const c = cardSpot(seat)
  if (seat === HERO) return { x: c.x + (i ? 54 : -54), y: c.y, rot: i ? 3 : -3 }
  return { x: c.x + (i ? 13 : -13), y: c.y, rot: i ? 8 : -8 }
}

/** Where the hero's bet-in-progress pile sits. */
export const PILE: Pt = { x: 968, y: 650 }
