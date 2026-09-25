import { HAND_NAMES } from '../engine/evaluate'
import { useGame, set } from '../game/store'
import { MOBILE } from '../ui/device'

// High card → Royal flush, matching HAND_NAMES order.
const EX: string[] = [
  'Ah Jc 8d 5s 2h',
  'Th Tc Kd 6s 3h',
  'Js Jd 4c 4h Ah',
  '7c 7d 7s Kh 2d',
  '9d 8s 7h 6c 5d',
  'Ad Jd 8d 6d 2d',
  'Qs Qh Qd 7c 7s',
  'Ks Kh Kd Kc 3s',
  '9h 8h 7h 6h 5h',
  'As Ks Qs Js Ts',
]
const SUIT: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }

function Mini({ code, lit }: { code: string; lit: boolean }) {
  const red = code[1] === 'h' || code[1] === 'd'
  return (
    <span
      className={`inline-flex h-[30px] w-[22px] flex-col items-center justify-center rounded-[3px] bg-[linear-gradient(180deg,#fffdf8,#ece5d3)] font-serif text-[13px] font-bold leading-[12px] shadow-[0_1px_2px_rgba(0,0,0,.6)] transition ${
        red ? 'text-[#c8102e]' : 'text-[#15110e]'
      } ${lit ? '' : 'opacity-80'}`}
    >
      <span>{code[0] === 'T' ? '10' : code[0]}</span>
      <span className="text-[11px]">{SUIT[code[1]]}</span>
    </span>
  )
}

export function HandPanel() {
  const hand = useGame((s) => s.heroHand)
  const equity = useGame((s) => s.equity)
  const open = useGame((s) => s.settings.panelOpen)
  const showEquity = useGame((s) => s.settings.showEquity)
  const toggle = () => set((s) => ({ settings: { ...s.settings, panelOpen: !s.settings.panelOpen } }))

  if (MOBILE && !open) return null
  return (
    <aside
      className={`${MOBILE ? 'absolute left-0 top-0 z-40' : 'relative z-20'} flex h-full shrink-0 flex-col border-r border-[#d4af5a]/25 bg-[linear-gradient(180deg,rgba(20,14,9,.92),rgba(8,6,4,.96))] shadow-[8px_0_30px_-10px_rgba(0,0,0,.9)] transition-[width] duration-300 ease-out ${
        open ? 'w-[250px]' : 'w-[46px]'
      }`}
      aria-label="Hand rankings"
    >
      <button
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? 'Collapse hand rankings' : 'Expand hand rankings'}
        className="flex h-12 shrink-0 items-center gap-2 px-3 text-left text-[#d4af5a] hover:text-[#fff3c4]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 transition-transform duration-300 ${open ? '' : 'rotate-180'}`}>
          <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {open && <span className="font-serif text-[17px] font-bold tracking-wide">Hand Rankings</span>}
      </button>

      {open && (
        <>
          <ol className="flex flex-1 flex-col gap-1 overflow-y-auto px-2.5 pb-2">
            {HAND_NAMES.map((_, k) => 9 - k).map((cat) => {
              const lit = hand?.category === cat
              return (
                <li
                  key={cat}
                  aria-current={lit ? 'true' : undefined}
                  className={`relative rounded-xl px-2.5 py-1.5 transition-all duration-500 ${
                    lit
                      ? 'bg-[linear-gradient(90deg,rgba(243,220,154,.22),rgba(201,162,74,.08))] shadow-[0_0_0_1px_rgba(243,220,154,.8),0_0_22px_-4px_rgba(243,220,154,.65)]'
                      : 'hover:bg-white/[.03]'
                  }`}
                >
                  <div className="flex items-baseline justify-between">
                    <span className={`text-[13.5px] font-semibold ${lit ? 'text-[#fff3c4]' : 'text-[#d8ccb0]'}`}>{HAND_NAMES[cat]}</span>
                    <span className="text-[10px] tabular-nums text-[#d4af5a]/50">{10 - cat}</span>
                  </div>
                  <div className="mt-1 flex gap-[3px]">
                    {EX[cat].split(' ').map((c) => (
                      <Mini key={c} code={c} lit={lit} />
                    ))}
                  </div>
                </li>
              )
            })}
          </ol>
          <div className="border-t border-[#d4af5a]/20 px-3 py-3" aria-live="polite">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d4af5a]/70">Your hand</div>
            <div className="mt-0.5 min-h-[22px] font-serif text-[16px] font-bold text-[#f6e6b4]">{hand?.label ?? '—'}</div>
            {showEquity && (
              <div className="mt-2">
                <div className="flex justify-between text-[11px] text-[#bfb49a]">
                  <span>Win equity</span>
                  <span className="font-bold tabular-nums text-[#f6e6b4]">{hand && equity !== null ? `${Math.round(equity * 100)}%` : '—'}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/50">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#8c6a27,#f3dc9a)] transition-[width] duration-700 ease-out"
                    style={{ width: `${hand && equity !== null ? equity * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  )
}
