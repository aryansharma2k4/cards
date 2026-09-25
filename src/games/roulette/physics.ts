/**
 * Roulette spin choreography. The result is decided first (secure RNG); this
 * plans a physically plausible ball path that ends in that pocket:
 *
 *  1. rim   – ball circles the ball track, slowing exponentially
 *  2. drop  – it spirals down, clattering off the diamond deflectors
 *  3. hops  – it bounces over a few pocket frets, each hop smaller
 *  4. rest  – it sits in the pocket and rides the rotor
 *
 * The launch speed and decay are solved so the ball's natural travel lands the
 * rattle phase exactly on the chosen pocket, so nothing ever "snaps".
 * Angles are radians, clockwise-positive (screen), 0 = top of the wheel.
 */
import { WHEEL } from './rules'

export const POCKET = (2 * Math.PI) / 37

/** Wheel geometry, in the wheel SVG's units (radius 300). */
export const R = {
  track: 257, // ball rolling on the bowl's track
  diamonds: 226, // deflector ring
  frets: 190, // top of the pocket frets
  pocket: 166, // ball resting in a pocket
}

export interface SpinPlan {
  result: number
  duration: number
  /** Rotor angle and ball position at time t (seconds). */
  at(t: number): { wheel: number; ball: number; r: number; resting: boolean }
  /** Times of audible impacts (deflectors, frets, final drop). */
  clicks: number[]
}

const TAU = Math.PI * 2
const mod = (a: number, m = TAU) => ((a % m) + m) % m

/** Pocket centre angle on the rotor for a number. */
export const pocketAngle = (n: number) => WHEEL.indexOf(n) * POCKET

/**
 * @param result      winning number (0–36)
 * @param wheelStart  current rotor angle
 * @param ballStart   ball launch angle (absolute)
 * @param rand        randomness for the look of the spin (not the result)
 */
export function planSpin(result: number, wheelStart: number, ballStart: number, rand: () => number = Math.random): SpinPlan {
  // Rotor: slow clockwise spin, gently decaying.
  const w0 = 1.3 + rand() * 0.4 // rad/s
  const tw = 14
  const wheel = (t: number) => wheelStart + w0 * tw * (1 - Math.exp(-t / tw))
  const wheelSpeed = (t: number) => w0 * Math.exp(-t / tw)

  // Ball: counter-clockwise, exponential decay from launch to the end of the drop.
  const tDrop = 6.2 + rand() * 1.2 // end of drop phase = start of hops
  const dropLen = 1.5 + rand() * 0.4
  const tRim = tDrop - dropLen
  const wEnd = 3.2 + rand() * 0.6 // ball speed (rad/s, ccw) as it reaches the frets

  // Rattle: the ball keeps moving the same way relative to the rotor for a few pockets.
  const hopPockets = 1.6 + rand() * 2.6
  const D = hopPockets * POCKET

  // Relative angle (ball − rotor) needed when the hops begin.
  const target = pocketAngle(result)
  const rho2 = target + D // ball moves in −relative direction during the hops
  // Ball absolute angle at tDrop must be rotor(tDrop) + rho2 (mod 2π); ball travels −S from ballStart.
  const X = mod(ballStart - wheel(tDrop) - rho2)
  // choose whole revolutions so the ball does ~7–9 laps
  const laps = 7 + Math.floor(rand() * 2)
  const S = X + TAU * laps
  // Solve S = τ·wEnd·(e^{tDrop/τ} − 1) for τ (monotone decreasing in τ).
  let lo = 0.3
  let hi = 60
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (mid * wEnd * (Math.exp(tDrop / mid) - 1) > S) lo = mid
    else hi = mid
  }
  const tau = (lo + hi) / 2
  const wb0 = wEnd * Math.exp(tDrop / tau)
  const ballTravel = (t: number) => wb0 * tau * (1 - Math.exp(-t / tau))
  const ballFree = (t: number) => ballStart - ballTravel(t)

  // Drop: spiral from the track to the frets with decaying deflector bounces.
  const bounces = 2 + Math.floor(rand() * 3)
  const bounceAt = Array.from({ length: bounces }, (_, i) => tRim + dropLen * (0.35 + (0.5 * (i + rand() * 0.6)) / bounces))
  const bounceAmp = bounceAt.map((_, i) => (22 - i * 5) * (0.7 + rand() * 0.6))
  const jitter = bounceAt.map(() => (rand() - 0.5) * 0.12)
  const dropR = (t: number) => {
    const u = Math.min(1, Math.max(0, (t - tRim) / dropLen))
    let r = R.track + (R.frets - R.track) * u * u * (3 - 2 * u) // smoothstep inward
    for (let i = 0; i < bounces; i++) {
      const dt = t - bounceAt[i]
      if (dt > 0 && dt < 0.22) r += bounceAmp[i] * Math.sin((Math.PI * dt) / 0.22)
    }
    return r
  }
  const dropJitter = (t: number) => {
    let a = 0
    for (let i = 0; i < bounces; i++) {
      const dt = t - bounceAt[i]
      if (dt > 0) a += jitter[i] * Math.exp(-dt / 0.25) * Math.sin(Math.min(Math.PI, dt * 14))
    }
    // fade out so the ball arrives at the frets exactly on plan
    const fade = Math.min(1, Math.max(0, (tDrop - t) / 0.35))
    return a * fade
  }

  // Hops across frets: pieces of D shrinking geometrically, each a little parabola above the pockets.
  const n = 3 + Math.floor(rand() * 2)
  const weights = Array.from({ length: n }, (_, i) => Math.pow(0.45, i))
  const wsum = weights.reduce((a, b) => a + b, 0)
  const pieces = weights.map((w) => (w / wsum) * D)
  // first hop starts at the ball's relative speed so there's no visible jerk (ease-out starts at 2× average)
  const relSpeed = wEnd + wheelSpeed(tDrop)
  const durs = pieces.map((p, i) => Math.max(0.12, (2 * p) / (relSpeed * Math.pow(0.62, i))))
  const hopStart: number[] = []
  let acc = tDrop
  for (const d of durs) {
    hopStart.push(acc)
    acc += d
  }
  const tRest = acc
  const heights = pieces.map((_, i) => (16 - i * 4) * (0.8 + rand() * 0.4))

  const clicks = [...bounceAt, ...hopStart.slice(1), tRest]
  const duration = tRest + 3.2

  return {
    result,
    duration,
    clicks,
    at(t: number) {
      const w = wheel(t)
      if (t < tDrop) {
        const r = t < tRim ? R.track : dropR(t)
        return { wheel: w, ball: ballFree(t) + dropJitter(t), r, resting: false }
      }
      if (t < tRest) {
        let k = 0
        while (k < n - 1 && t >= hopStart[k + 1]) k++
        const u = (t - hopStart[k]) / durs[k]
        const done = pieces.slice(0, k).reduce((a, b) => a + b, 0)
        const ease = 1 - (1 - u) * (1 - u)
        const rel = rho2 - done - pieces[k] * ease
        const base = R.pocket + (R.frets - R.pocket) * 0.35
        const r = base + (k === 0 ? (R.frets - base) * (1 - u) : 0) + heights[k] * Math.sin(Math.PI * u)
        return { wheel: w, ball: w + rel, r, resting: false }
      }
      // settled: sinks the last bit into the pocket and rides the rotor
      const sink = Math.min(1, (t - tRest) / 0.25)
      return { wheel: w, ball: w + target, r: R.pocket + (R.frets - R.pocket) * 0.35 * (1 - sink), resting: true }
    },
  }
}
