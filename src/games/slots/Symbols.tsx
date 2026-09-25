import { memo } from 'react'
import type { Sym } from './machine'

/** Reel symbols as reusable SVG <symbol>s (100×100). Render <SlotDefs/> once, then <use href="#slot-…">. */
export const symHref = (s: Sym) => `#slot-${s}`

const BAR_TEXT = { fontFamily: 'var(--font-display)', fontWeight: 900, textAnchor: 'middle' } as const

function Bar({ y, h, size, text }: { y: number; h: number; size: number; text: string }) {
  return (
    <g>
      <rect x="12" y={y + 2} width="76" height={h} rx={h / 3} fill="rgba(0,0,0,.35)" />
      <rect x="10" y={y} width="80" height={h} rx={h / 3} fill="url(#sl-bar)" stroke="url(#sl-gold)" strokeWidth="2.5" />
      <rect x="14" y={y + 2.5} width="72" height={h * 0.35} rx={h / 5} fill="#fff" opacity="0.12" />
      <text x="50" y={y + h / 2 + size * 0.36} fontSize={size} {...BAR_TEXT} fill={text} letterSpacing="1">
        BAR
      </text>
    </g>
  )
}

export const SlotDefs = memo(function SlotDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        <linearGradient id="sl-red" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff7a6e" />
          <stop offset="0.45" stopColor="#e3121f" />
          <stop offset="1" stopColor="#8a0610" />
        </linearGradient>
        <linearGradient id="sl-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3b8" />
          <stop offset="0.45" stopColor="#e2b44a" />
          <stop offset="1" stopColor="#8a5f12" />
        </linearGradient>
        <linearGradient id="sl-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3a40" />
          <stop offset="1" stopColor="#060607" />
        </linearGradient>
        <radialGradient id="sl-bell" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff6c4" />
          <stop offset="0.4" stopColor="#f5c534" />
          <stop offset="1" stopColor="#9a6a06" />
        </radialGradient>
        <linearGradient id="sl-gem" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#bfe3ff" />
          <stop offset="0.5" stopColor="#2c7df0" />
          <stop offset="1" stopColor="#0b2f8a" />
        </linearGradient>
        <radialGradient id="sl-plum" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#d9a6ff" />
          <stop offset="0.45" stopColor="#7b2fc9" />
          <stop offset="1" stopColor="#2e0b58" />
        </radialGradient>
        <radialGradient id="sl-lemon" cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#fffbd0" />
          <stop offset="0.45" stopColor="#ffe03a" />
          <stop offset="1" stopColor="#c99a00" />
        </radialGradient>
        <radialGradient id="sl-cherry" cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#ff9a9a" />
          <stop offset="0.45" stopColor="#e0101e" />
          <stop offset="1" stopColor="#6a0008" />
        </radialGradient>
        <linearGradient id="sl-leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9be86a" />
          <stop offset="1" stopColor="#1f7a1f" />
        </linearGradient>

        <symbol id="slot-seven" viewBox="0 0 100 100">
          <path d="M18 14H84V29C70 43 59 63 55 87H32C36 64 47 45 61 31H18Z" fill="none" stroke="#0a1650" strokeWidth="11" strokeLinejoin="round" />
          <path d="M18 14H84V29C70 43 59 63 55 87H32C36 64 47 45 61 31H18Z" fill="none" stroke="#2f6bff" strokeWidth="6" strokeLinejoin="round" />
          <path d="M18 14H84V29C70 43 59 63 55 87H32C36 64 47 45 61 31H18Z" fill="url(#sl-red)" />
          <path d="M22 17H80V21H22Z" fill="#fff" opacity="0.55" />
          <path d="M63 33C52 45 44 60 40 80" fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="3" strokeLinecap="round" />
        </symbol>

        <symbol id="slot-bar3" viewBox="0 0 100 100">
          <Bar y={14} h={22} size={16} text="#ffd76a" />
          <Bar y={39} h={22} size={16} text="#ffd76a" />
          <Bar y={64} h={22} size={16} text="#ffd76a" />
        </symbol>

        <symbol id="slot-bar" viewBox="0 0 100 100">
          <Bar y={32} h={36} size={26} text="#ffffff" />
        </symbol>

        <symbol id="slot-bell" viewBox="0 0 100 100">
          <ellipse cx="50" cy="86" rx="30" ry="5" fill="rgba(0,0,0,.25)" />
          <circle cx="50" cy="80" r="8" fill="url(#sl-bell)" stroke="#7a5200" strokeWidth="1.5" />
          <path d="M50 12c4 0 6 3 6 6 14 3 22 16 22 32v12l9 10H13l9-10V50c0-16 8-29 22-32 0-3 2-6 6-6z" fill="url(#sl-bell)" stroke="#7a5200" strokeWidth="2" strokeLinejoin="round" />
          <path d="M13 72h74" stroke="#7a5200" strokeWidth="2" />
          <path d="M34 30c-5 6-7 14-7 24" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="4" strokeLinecap="round" />
          <circle cx="50" cy="12" r="4" fill="url(#sl-bell)" stroke="#7a5200" strokeWidth="1.5" />
        </symbol>

        <symbol id="slot-gem" viewBox="0 0 100 100">
          <path d="M20 38L35 18H65L80 38L50 86Z" fill="url(#sl-gem)" stroke="#0a2a78" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M20 38H80M35 18L42 38L50 18L58 38L65 18M42 38L50 86L58 38" fill="none" stroke="#dff0ff" strokeOpacity=".7" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M35 18L42 38H20Z" fill="#fff" opacity=".35" />
          <path d="M42 38L50 86L20 38Z" fill="#fff" opacity=".12" />
          <path d="M58 38L80 38L50 86Z" fill="#001a5c" opacity=".25" />
          <circle cx="40" cy="26" r="3" fill="#fff" />
        </symbol>

        <symbol id="slot-plum" viewBox="0 0 100 100">
          <path d="M52 26C50 18 52 12 56 8" fill="none" stroke="#5a3a1a" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M55 16C64 6 78 8 82 14C74 22 62 22 55 16Z" fill="url(#sl-leaf)" stroke="#1f5a1f" strokeWidth="1.5" />
          <ellipse cx="50" cy="56" rx="32" ry="31" fill="url(#sl-plum)" stroke="#2a0a4a" strokeWidth="2" />
          <path d="M50 26C44 40 44 70 52 86" fill="none" stroke="#2a0a4a" strokeOpacity=".5" strokeWidth="2" />
          <ellipse cx="36" cy="42" rx="8" ry="5" fill="#fff" opacity=".45" transform="rotate(-30 36 42)" />
        </symbol>

        <symbol id="slot-lemon" viewBox="0 0 100 100">
          <path d="M10 52C12 44 16 38 22 34 32 24 46 20 58 22 72 24 84 32 88 42 92 46 92 50 90 54 88 64 78 74 64 78 50 82 34 80 24 72 18 68 14 62 10 58 8 56 8 54 10 52Z" fill="url(#sl-lemon)" stroke="#a37a00" strokeWidth="2" />
          <path d="M26 44C32 36 42 32 52 32" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="4" strokeLinecap="round" />
          <circle cx="40" cy="58" r="1.2" fill="#b58a00" />
          <circle cx="58" cy="62" r="1.2" fill="#b58a00" />
          <circle cx="70" cy="50" r="1.2" fill="#b58a00" />
        </symbol>

        <symbol id="slot-cherry" viewBox="0 0 100 100">
          <path d="M34 60C38 40 48 24 62 16M66 64C66 44 64 28 62 16" fill="none" stroke="#3f7a1a" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M62 16C70 8 84 10 88 16C80 24 68 24 62 16Z" fill="url(#sl-leaf)" stroke="#1f5a1f" strokeWidth="1.5" />
          <circle cx="32" cy="70" r="17" fill="url(#sl-cherry)" stroke="#5a0008" strokeWidth="2" />
          <circle cx="66" cy="72" r="17" fill="url(#sl-cherry)" stroke="#5a0008" strokeWidth="2" />
          <ellipse cx="26" cy="63" rx="5" ry="3.5" fill="#fff" opacity=".6" transform="rotate(-30 26 63)" />
          <ellipse cx="60" cy="65" rx="5" ry="3.5" fill="#fff" opacity=".6" transform="rotate(-30 60 65)" />
        </symbol>
      </defs>
    </svg>
  )
})

/** One symbol, standalone (paytable, lobby art). */
export function SymbolIcon({ sym, size }: { sym: Sym; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <use href={symHref(sym)} />
    </svg>
  )
}
