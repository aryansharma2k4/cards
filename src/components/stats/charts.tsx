import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

// Validated on the #15100b surface (dataviz validate_palette.js, dark): blue↔red diverging pair, gold single series.
export const PROFIT = '#3987e5'
export const LOSS = '#e66767'
export const LINE = '#c9a13f'
const GRID = 'rgba(233,220,184,.08)'
const AXIS = '#9d937c'

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(600)
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current!)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/** "Nice" tick values covering [lo, hi]. */
function ticks(lo: number, hi: number, n = 4): number[] {
  if (lo === hi) return [lo]
  const raw = (hi - lo) / n
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(v)
  return out
}

const short = (v: number) => {
  const a = Math.abs(v)
  const s = a >= 1e6 ? `${+(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${+(a / 1e3).toFixed(1)}K` : `${Math.round(a)}`
  return `${v < 0 ? '−' : ''}$${s}`
}

function Tooltip({ x, y, w, children }: { x: number; y: number; w: number; children: ReactNode }) {
  const left = Math.min(Math.max(x + 12, 0), w - 190)
  return (
    <div
      className="pointer-events-none absolute z-10 w-[180px] rounded-lg bg-[#0b0806]/95 px-3 py-2 text-[12.5px] leading-snug text-[#efe6cf] shadow-xl ring-1 ring-[#d4af5a]/35"
      style={{ left, top: Math.max(0, y - 70) }}
    >
      {children}
    </div>
  )
}

export interface LinePoint {
  y: number
  tip: ReactNode
}

/** Single-series line with a crosshair tooltip. */
export function LineChart({ points, height = 220, label }: { points: LinePoint[]; height?: number; label: string }) {
  const [ref, w] = useWidth()
  const [hover, setHover] = useState<number | null>(null)
  const pad = { l: 56, r: 12, t: 12, b: 24 }
  const ys = points.map((p) => p.y)
  const lo = Math.min(...ys)
  const hi = Math.max(...ys)
  const span = hi - lo || Math.max(1, Math.abs(hi) * 0.1)
  const y0 = lo - span * 0.08
  const y1 = hi + span * 0.08
  const X = (i: number) => pad.l + (points.length > 1 ? (i / (points.length - 1)) * (w - pad.l - pad.r) : (w - pad.l - pad.r) / 2)
  const Y = (v: number) => pad.t + (1 - (v - y0) / (y1 - y0)) * (height - pad.t - pad.b)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.y).toFixed(1)}`).join('')
  const onMove = (e: React.PointerEvent) => {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect()
    const i = Math.round(((e.clientX - r.left - pad.l) / (w - pad.l - pad.r)) * (points.length - 1))
    setHover(Math.max(0, Math.min(points.length - 1, i)))
  }
  return (
    <div ref={ref} className="relative">
      <svg width={w} height={height} role="img" aria-label={label} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {ticks(y0, y1).map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={Y(t)} y2={Y(t)} stroke={GRID} />
            <text x={pad.l - 8} y={Y(t) + 4} textAnchor="end" fontSize="11" fill={AXIS}>
              {short(t)}
            </text>
          </g>
        ))}
        <text x={pad.l} y={height - 6} fontSize="11" fill={AXIS}>
          first hand
        </text>
        <text x={w - pad.r} y={height - 6} textAnchor="end" fontSize="11" fill={AXIS}>
          latest
        </text>
        <path d={d} fill="none" stroke={LINE} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && (
          <>
            <line x1={X(hover)} x2={X(hover)} y1={pad.t} y2={height - pad.b} stroke="rgba(233,220,184,.35)" />
            <circle cx={X(hover)} cy={Y(points[hover].y)} r="5" fill={LINE} stroke="#15100b" strokeWidth="2" />
          </>
        )}
      </svg>
      {hover !== null && (
        <Tooltip x={X(hover)} y={Y(points[hover].y)} w={w}>
          {points[hover].tip}
        </Tooltip>
      )}
    </div>
  )
}

export interface Bar {
  label: string
  value: number
  tip: ReactNode
}

/** Diverging bars around zero: profit up in blue, loss down in red, value labelled. */
export function BarChart({ bars, height = 200, label, onSelect }: { bars: Bar[]; height?: number; label: string; onSelect?: (i: number) => void }) {
  const [ref, w] = useWidth()
  const [hover, setHover] = useState<number | null>(null)
  const pad = { l: 56, r: 12, t: 18, b: 28 }
  const vals = bars.map((b) => b.value)
  const hi = Math.max(0, ...vals)
  const lo = Math.min(0, ...vals)
  const span = hi - lo || 1
  const Y = (v: number) => pad.t + (1 - (v - lo) / span) * (height - pad.t - pad.b)
  const slot = (w - pad.l - pad.r) / Math.max(bars.length, 1)
  const bw = Math.max(4, Math.min(48, slot - 2)) // 2px surface gap between neighbours
  return (
    <div ref={ref} className="relative">
      <svg width={w} height={height} role="img" aria-label={label}>
        {ticks(lo, hi).map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={Y(t)} y2={Y(t)} stroke={t === 0 ? 'rgba(233,220,184,.35)' : GRID} />
            <text x={pad.l - 8} y={Y(t) + 4} textAnchor="end" fontSize="11" fill={AXIS}>
              {short(t)}
            </text>
          </g>
        ))}
        {bars.map((b, i) => {
          const x = pad.l + i * slot + (slot - bw) / 2
          const top = Y(Math.max(0, b.value))
          const h = Math.max(1, Math.abs(Y(b.value) - Y(0)))
          const r = Math.min(4, bw / 2, h / 2)
          const up = b.value >= 0
          // rounded data end, square at the baseline
          const path = up
            ? `M${x} ${top + h} V${top + r} Q${x} ${top} ${x + r} ${top} H${x + bw - r} Q${x + bw} ${top} ${x + bw} ${top + r} V${top + h} Z`
            : `M${x} ${top} V${top + h - r} Q${x} ${top + h} ${x + r} ${top + h} H${x + bw - r} Q${x + bw} ${top + h} ${x + bw} ${top + h - r} V${top} Z`
          return (
            <g
              key={i}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onClick={() => onSelect?.(i)}
              className={onSelect ? 'cursor-pointer' : ''}
            >
              <rect x={pad.l + i * slot} y={pad.t} width={slot} height={height - pad.t - pad.b} fill="transparent" />
              <path d={path} fill={up ? PROFIT : LOSS} opacity={hover === null || hover === i ? 1 : 0.55} />
              {bars.length <= 12 && (
                <text x={x + bw / 2} y={height - 10} textAnchor="middle" fontSize="11" fill={AXIS}>
                  {b.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {hover !== null && (
        <Tooltip x={pad.l + hover * slot + slot / 2} y={Y(Math.max(0, bars[hover].value))} w={w}>
          {bars[hover].tip}
        </Tooltip>
      )}
    </div>
  )
}
