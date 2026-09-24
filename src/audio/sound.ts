import { Howl, Howler } from 'howler'

/** Sound name → number of recorded variants in public/sounds (name-1.ogg …). 0 = single file. */
const BANK = {
  shuffle: 0,
  deal: 8,
  flip: 4,
  toss: 4,
  chip: 4,
  push: 4,
  allin: 0,
  rake: 0,
  stack: 4,
  check: 0,
  win: 0,
} as const
export type SoundName = keyof typeof BANK

const BASE_VOL: Record<SoundName, number> = {
  shuffle: 0.7, deal: 0.55, flip: 0.5, toss: 0.6, chip: 0.7, push: 0.75, allin: 0.9,
  rake: 0.8, stack: 0.6, check: 0.9, win: 0.35,
}

const src = (f: string) => [`/sounds/${f}.ogg`, `/sounds/${f}.mp3`]
const howls = new Map<SoundName, Howl[]>()
const lastPlayed = new Map<SoundName, number>()
const lastVariant = new Map<SoundName, number>()
let ambient: Howl | null = null

export function initAudio() {
  if (howls.size) return
  for (const [name, n] of Object.entries(BANK) as [SoundName, number][]) {
    const files = n ? Array.from({ length: n }, (_, i) => `${name}-${i + 1}`) : [name]
    // pool: rapid chip clicks get their own voice instead of cutting each other off
    howls.set(name, files.map((f) => new Howl({ src: src(f), preload: true, pool: 8 })))
  }
}

/**
 * Play a sound with slight random pitch/volume so repeats never sound robotic.
 * The same sound re-triggered within `minGap` ms is dropped to avoid mush.
 */
export function play(name: SoundName, opts: { volume?: number; rate?: number; minGap?: number } = {}) {
  const variants = howls.get(name)
  if (!variants) return
  const now = performance.now()
  if (now - (lastPlayed.get(name) ?? -1e9) < (opts.minGap ?? 35)) return
  lastPlayed.set(name, now)
  let i = Math.floor(Math.random() * variants.length)
  if (variants.length > 1 && i === lastVariant.get(name)) i = (i + 1) % variants.length
  lastVariant.set(name, i)
  const h = variants[i]
  const id = h.play()
  h.volume(BASE_VOL[name] * (opts.volume ?? 1) * (0.88 + Math.random() * 0.12), id)
  h.rate((opts.rate ?? 1) * (0.95 + Math.random() * 0.1), id)
}

export function setMasterVolume(v: number, muted: boolean) {
  Howler.volume(v)
  Howler.mute(muted)
}

/**
 * Optional room-tone loop. Drop a CC0 file at public/sounds/ambient.(ogg|mp3)
 * (see CREDITS.md); if it's missing this silently does nothing.
 */
export function setAmbient(on: boolean) {
  if (on && !ambient) {
    ambient = new Howl({ src: src('ambient'), loop: true, volume: 0, html5: true })
    ambient.once('load', () => ambient?.fade(0, 0.25, 1500))
    ambient.play()
  } else if (!on && ambient) {
    const a = ambient
    ambient = null
    a.fade(a.volume(), 0, 600)
    setTimeout(() => a.unload(), 650)
  }
}

