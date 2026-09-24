import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { removeFlyer, useGame, type Flyer } from '../../game/store'
import { Card } from '../cards/Card'
import { ChipCluster } from '../chips/ChipPile'

/** Sprites in flight: cards being dealt/mucked, chips moving to bets, pots and stacks. */
export function Flyers() {
  const flyers = useGame((s) => s.flyers)
  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 40 }}>
      {flyers.map((f) => (
        <FlyerView key={f.id} f={f} />
      ))}
    </div>
  )
}

function FlyerView({ f }: { f: Flyer }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current!
    const { from, to } = f
    const dx = to.x - from.x
    const dy = to.y - from.y
    // Quadratic arc: lift the control point up and slightly sideways.
    const c = { x: from.x + dx / 2 - dy * 0.12, y: from.y + dy / 2 - Math.min(90, Math.hypot(dx, dy) * 0.18) }
    const r0 = f.card?.spin ?? 0
    const r1 = f.card?.endRotate ?? 0
    const isChip = f.kind === 'chips'
    const p = { t: 0 }
    const draw = () => {
      const t = p.t
      const u = 1 - t
      const x = u * u * from.x + 2 * u * t * c.x + t * t * to.x
      const y = u * u * from.y + 2 * u * t * c.y + t * t * to.y
      const s = 1 + (isChip ? 0.1 : 0.14) * Math.sin(Math.PI * t)
      el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${r0 + (r1 - r0) * t}deg) scale(${s})`
    }
    draw()
    el.style.opacity = f.delay ? '0' : '1'
    const tl = gsap.timeline({
      delay: (f.delay ?? 0) / 1000,
      onComplete: () => {
        f.resolve?.()
        requestAnimationFrame(() => removeFlyer(f.id))
      },
    })
    tl.set(el, { opacity: 1 })
    // chips overshoot a hair and settle, so they feel heavy
    tl.to(p, { t: 1, duration: f.duration / 1000, ease: isChip ? 'back.out(1.3)' : 'power2.out', onUpdate: draw })
    return () => {
      tl.kill()
    }
  }, [f])
  return (
    <div ref={ref} className="absolute left-0 top-0 will-change-transform" style={{ opacity: 0 }}>
      <div className="-translate-x-1/2 -translate-y-1/2">
        {f.kind === 'card' && f.card ? (
          <Card code={f.card.code} faceUp={f.card.faceUp} width={f.card.width} />
        ) : (
          <ChipCluster chips={f.chips ?? []} />
        )}
      </div>
    </div>
  )
}
