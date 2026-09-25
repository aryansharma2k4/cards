import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { STAGE } from '../../ui/geometry'

/** Fixed-size stage scaled (aspect preserved) to fill its container. */
export function Stage({ children, size = STAGE }: { children: ReactNode; size?: { w: number; h: number } }) {
  const ref = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState({ s: 1, x: 0, y: 0 })
  useLayoutEffect(() => {
    const el = ref.current!
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      const s = Math.min(width / size.w, height / size.h)
      setFit({ s, x: (width - size.w * s) / 2, y: (height - size.h * s) / 2 })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [size])
  return (
    <div ref={ref} className="relative h-full w-full overflow-hidden">
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: size.w, height: size.h, transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.s})` }}
      >
        {children}
      </div>
    </div>
  )
}
