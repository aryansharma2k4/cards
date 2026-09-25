import { memo } from 'react'
import { OUTSIDE, RED, cellNumber, corner, sixLine, split, straight, street, type BetSpot, type Bets } from './rules'
import { BetChips } from '../CasinoUi'

/** Layout geometry (stage units). */
export const L = { x: 656, y: 196, zero: 72, cw: 62, ch: 78, col: 72, row: 62 }
const W = L.zero + 12 * L.cw + L.col
const GRID_H = 3 * L.ch
export const LAYOUT_SIZE = { w: W, h: GRID_H + 2 * L.row }

export interface Zone {
  spot: BetSpot
  x: number
  y: number
  w: number
  h: number
  /** Thin line/intersection zones sit on top of the cells they touch. */
  edge?: boolean
}

const cellX = (c: number) => L.zero + c * L.cw
const cellY = (r: number) => r * L.ch

/** Every tappable bet on the layout, relative to the layout's top-left. */
export const ZONES: Zone[] = (() => {
  const z: Zone[] = []
  const E = 9 // half-width of line zones
  z.push({ spot: straight(0), x: 0, y: 0, w: L.zero, h: GRID_H })
  for (let c = 0; c < 12; c++)
    for (let r = 0; r < 3; r++) z.push({ spot: straight(cellNumber(c, r)), x: cellX(c), y: cellY(r), w: L.cw, h: L.ch })
  // 2 to 1 columns (rows top→bottom = column 3, 2, 1)
  ;[OUTSIDE.col3, OUTSIDE.col2, OUTSIDE.col1].forEach((s, r) => z.push({ spot: s, x: cellX(12), y: cellY(r), w: L.col, h: L.ch }))
  ;[OUTSIDE.dozen1, OUTSIDE.dozen2, OUTSIDE.dozen3].forEach((s, i) => z.push({ spot: s, x: cellX(4 * i), y: GRID_H, w: 4 * L.cw, h: L.row }))
  ;[OUTSIDE.low, OUTSIDE.even, OUTSIDE.red, OUTSIDE.black, OUTSIDE.odd, OUTSIDE.high].forEach((s, i) =>
    z.push({ spot: s, x: cellX(2 * i), y: GRID_H + L.row, w: 2 * L.cw, h: L.row }),
  )
  // line bets
  for (let c = 0; c < 12; c++) {
    for (let r = 0; r < 3; r++) {
      if (c < 11) z.push({ spot: split(cellNumber(c, r), cellNumber(c + 1, r)), x: cellX(c + 1) - E, y: cellY(r) + E, w: 2 * E, h: L.ch - 2 * E, edge: true })
      if (r < 2) z.push({ spot: split(cellNumber(c, r), cellNumber(c, r + 1)), x: cellX(c) + E, y: cellY(r + 1) - E, w: L.cw - 2 * E, h: 2 * E, edge: true })
      if (c < 11 && r < 2) z.push({ spot: corner(c, r), x: cellX(c + 1) - E, y: cellY(r + 1) - E, w: 2 * E, h: 2 * E, edge: true })
    }
    z.push({ spot: street(c), x: cellX(c) + E, y: GRID_H - E, w: L.cw - 2 * E, h: 2 * E, edge: true })
    if (c < 11) z.push({ spot: sixLine(c), x: cellX(c + 1) - E, y: GRID_H - E, w: 2 * E, h: 2 * E, edge: true })
  }
  return z
})()

const ZONE_BY_KEY = new Map(ZONES.map((z) => [z.spot.key, z]))
export const zoneCenter = (key: string) => {
  const z = ZONE_BY_KEY.get(key)!
  return { x: L.x + z.x + z.w / 2, y: L.y + z.y + z.h / 2 }
}

const FELT_LINE = '#f3ead0'
const txt = { fontFamily: 'var(--font-display)', fontWeight: 800, fill: '#fff' } as const

/** Printed felt: cells, numbers, outside boxes (static, rendered once). */
const Printed = memo(function Printed() {
  const zeroPath = `M${L.zero} 0H22L0 ${GRID_H / 2}L22 ${GRID_H}H${L.zero}Z`
  return (
    <g>
      <path d={zeroPath} fill="rgba(0,0,0,.08)" stroke={FELT_LINE} strokeWidth="2" />
      <ellipse cx={L.zero / 2 + 6} cy={GRID_H / 2} rx="20" ry="30" fill="#0f7a3c" stroke={FELT_LINE} strokeWidth="1.5" />
      <text x={L.zero / 2 + 6} y={GRID_H / 2 + 9} textAnchor="middle" fontSize="28" {...txt}>
        0
      </text>
      {Array.from({ length: 12 }, (_, c) =>
        [0, 1, 2].map((r) => {
          const n = cellNumber(c, r)
          const x = cellX(c)
          const y = cellY(r)
          return (
            <g key={n}>
              <rect x={x} y={y} width={L.cw} height={L.ch} fill="none" stroke={FELT_LINE} strokeWidth="2" />
              <rect x={x + 9} y={y + 12} width={L.cw - 18} height={L.ch - 24} rx="16" fill={RED.has(n) ? '#c1121f' : '#141416'} />
              <text x={x + L.cw / 2} y={y + L.ch / 2 + 10} textAnchor="middle" fontSize="27" {...txt}>
                {n}
              </text>
            </g>
          )
        }),
      )}
      {[0, 1, 2].map((r) => (
        <g key={r}>
          <rect x={cellX(12)} y={cellY(r)} width={L.col} height={L.ch} fill="none" stroke={FELT_LINE} strokeWidth="2" />
          <text x={cellX(12) + L.col / 2} y={cellY(r) + L.ch / 2 + 7} textAnchor="middle" fontSize="19" {...txt} fill={FELT_LINE}>
            2 to 1
          </text>
        </g>
      ))}
      {['1st 12', '2nd 12', '3rd 12'].map((t, i) => (
        <g key={t}>
          <rect x={cellX(4 * i)} y={GRID_H} width={4 * L.cw} height={L.row} fill="none" stroke={FELT_LINE} strokeWidth="2" />
          <text x={cellX(4 * i) + 2 * L.cw} y={GRID_H + L.row / 2 + 8} textAnchor="middle" fontSize="23" {...txt} fill={FELT_LINE}>
            {t}
          </text>
        </g>
      ))}
      {['1 to 18', 'EVEN', 'red', 'black', 'ODD', '19 to 36'].map((t, i) => {
        const x = cellX(2 * i)
        const y = GRID_H + L.row
        const cx = x + L.cw
        const cy = y + L.row / 2
        return (
          <g key={t}>
            <rect x={x} y={y} width={2 * L.cw} height={L.row} fill="none" stroke={FELT_LINE} strokeWidth="2" />
            {t === 'red' || t === 'black' ? (
              <path d={`M${cx} ${cy - 20}L${cx + 36} ${cy}L${cx} ${cy + 20}L${cx - 36} ${cy}Z`} fill={t === 'red' ? '#c1121f' : '#141416'} stroke={FELT_LINE} strokeWidth="1.5" />
            ) : (
              <text x={cx} y={cy + 8} textAnchor="middle" fontSize="21" {...txt} fill={FELT_LINE}>
                {t}
              </text>
            )}
          </g>
        )
      })}
      <rect x="0" y="0" width={W} height={GRID_H + 2 * L.row} fill="none" stroke={FELT_LINE} strokeWidth="3" rx="4" />
    </g>
  )
})

/** Betting layout with tap zones, placed chips, the winning-number marker and win highlights. */
export function Layout({
  bets,
  onBet,
  disabled,
  winner,
  winning,
}: {
  bets: Bets
  onBet: (spot: BetSpot) => void
  disabled: boolean
  winner: number | null
  winning: Set<string>
}) {
  const winZone = winner === null ? null : ZONE_BY_KEY.get(straight(winner).key)
  return (
    <g transform={`translate(${L.x} ${L.y})`}>
      <Printed />
      {/* win highlights */}
      {[...winning].map((k) => {
        const z = ZONE_BY_KEY.get(k)
        return z && !z.edge ? <rect key={k} x={z.x + 2} y={z.y + 2} width={z.w - 4} height={z.h - 4} rx="6" fill="rgba(243,220,154,.28)" stroke="#f3dc9a" strokeWidth="3" /> : null
      })}
      {/* tap zones: cells first, line bets on top */}
      {[...ZONES].sort((a, b) => Number(!!a.edge) - Number(!!b.edge)).map((z) => (
        <rect
          key={z.spot.key + (z.edge ? '-e' : '')}
          x={z.x}
          y={z.y}
          width={z.w}
          height={z.h}
          fill="transparent"
          style={{ cursor: disabled ? 'default' : 'pointer' }}
          aria-label={`Bet ${z.spot.label}`}
          onPointerDown={(e) => {
            e.preventDefault()
            if (!disabled) onBet(z.spot)
          }}
        />
      ))}
      {/* chips on the layout */}
      {Object.entries(bets).map(([k, b]) => {
        const z = ZONE_BY_KEY.get(k)
        if (!z) return null
        const cx = z.x + z.w / 2
        const cy = z.y + z.h / 2
        return (
          <g key={k} pointerEvents="none" transform={`translate(${cx} ${cy})`}>
            <BetChips amount={b.amount} width={34} />
          </g>
        )
      })}
      {/* dolly: marks the winning number */}
      {winZone && (
        <g transform={`translate(${winZone.x + winZone.w / 2} ${winZone.y + winZone.h / 2 - 8})`} pointerEvents="none" style={{ animation: 'pop-in .35s ease-out' }}>
          <ellipse cx="0" cy="22" rx="16" ry="6" fill="rgba(0,0,0,.4)" />
          <rect x="-12" y="-14" width="24" height="34" rx="10" fill="rgba(255,255,255,.55)" stroke="#fff" strokeWidth="2" />
          <ellipse cx="0" cy="-14" rx="12" ry="5" fill="rgba(255,255,255,.85)" />
        </g>
      )}
    </g>
  )
}
