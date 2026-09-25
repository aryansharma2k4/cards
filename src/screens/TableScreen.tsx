import { useEffect, useState } from 'react'
import { set, useGame } from '../game/store'
import { game } from '../game/controller'
import { formatMoney } from '../engine/chips'
import { Stage } from '../components/table/Stage'
import { TableArt } from '../components/table/TableArt'
import { Banner, Board, DealerButton, Seats } from '../components/table/Seats'
import { Flyers } from '../components/table/Flyers'
import { PanelRack, Rack } from '../components/table/Rack'
import { MOBILE } from '../ui/device'
import { ActionBar } from '../components/table/ActionBar'
import { HandPanel } from '../components/HandPanel'
import { BustDialog, ColorUpDialog, LeaveDialog, LogDrawer } from '../components/Dialogs'
import { Button } from '../components/ui/kit'
import { Chip } from '../components/chips/Chip'

const EXPAND = 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'
const SHRINK = 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5'

/** Full screen: browser fullscreen + hide everything except the table and hand rankings. */
function setFocus(on: boolean) {
  set({ focus: on, ...(on ? { dialog: null } : {}) })
  if (on && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {})
  if (!on && document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
}

const Icon = ({ d }: { d: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
)

function Hud() {
  const table = useGame((s) => s.table)!
  const paused = useGame((s) => s.paused)
  const handNo = useGame((s) => s.handNo)
  const bankroll = useGame((s) => s.bankroll)
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3">
      <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-black/45 px-3 py-2 text-[15px] text-[#d8ccb0] ring-1 ring-[#d4af5a]/25 backdrop-blur-sm">
        <span>
          Blinds <b className="text-[#f6e6b4]">{formatMoney(table.sb)}/{formatMoney(table.bb)}</b>
        </span>
        <span className="h-4 w-px bg-[#d4af5a]/30" />
        <span>Hand #{handNo || '—'}</span>
        <span className="h-4 w-px bg-[#d4af5a]/30" />
        <span>
          Bankroll <b className="text-[#f6e6b4]">{formatMoney(bankroll)}</b>
        </span>
      </div>
      <div className="pointer-events-auto flex gap-2">
        <Button
          size="sm"
          variant={paused ? 'gold' : 'wood'}
          aria-pressed={paused}
          onClick={() => set({ paused: !paused })}
          title="Pause before the next hand"
        >
          <Icon d={paused ? 'M7 5l12 7-12 7z' : 'M8 5v14M16 5v14'} />
          {paused ? 'Resume' : 'Pause'}
        </Button>
        <Button size="sm" variant="wood" onClick={() => setFocus(true)} title="Full screen: just the table and hand rankings">
          <Icon d={EXPAND} />
          Full screen
        </Button>
        <Button size="sm" variant="wood" onClick={() => set((s) => ({ dialog: s.dialog === 'log' ? null : 'log' }))}>
          <Icon d="M4 6h16M4 12h16M4 18h10" />
          Log
        </Button>
        <Button size="sm" variant="wood" onClick={() => set({ dialog: 'settings' })} aria-label="Settings">
          <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </Button>
        <Button size="sm" variant="danger" onClick={() => game.leave()} title="Leave the table; your stack returns to your bankroll">
          <Icon d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l-5-5 5-5M5 12h12" />
          Leave
        </Button>
      </div>
    </div>
  )
}

const ICONS = {
  hands: 'M4 5h16v14H4zM8 9h8M8 13h5',
}

/** Phone HUD: a menu button and the hand-rankings toggle, tucked in the top-left corner. */
function MobileHud() {
  const paused = useGame((s) => s.paused)
  const table = useGame((s) => s.table)!
  const [menu, setMenu] = useState(false)
  const btn = 'grid h-10 w-10 place-items-center rounded-full bg-black/55 text-[#efe6cf] ring-1 ring-[#d4af5a]/40 active:scale-90'
  const toggleHands = () => set((s) => ({ settings: { ...s.settings, panelOpen: !s.settings.panelOpen } }))
  const item = (label: string, onClick: () => void, danger = false) => (
    <button
      key={label}
      onClick={() => {
        setMenu(false)
        onClick()
      }}
      className={`block w-full px-4 py-2.5 text-left text-[15px] active:bg-white/10 ${danger ? 'text-[#ffb4a8]' : 'text-[#efe6cf]'}`}
    >
      {label}
    </button>
  )
  return (
    <div className="absolute left-2 top-2 z-30" style={{ paddingLeft: 'env(safe-area-inset-left)' }}>
      <div className="flex items-center gap-1.5">
        <button className={btn} onClick={() => setMenu(!menu)} aria-label="Menu" aria-expanded={menu}>
          <Icon d="M4 7h16M4 12h16M4 17h16" />
        </button>
        <button className={btn} onClick={toggleHands} aria-label="Hand rankings">
          <Icon d={ICONS.hands} />
        </button>
        {paused && <span className="rounded-full bg-[#c9a24a] px-2 py-1 text-[11px] font-bold text-[#241808]">Paused</span>}
      </div>
      {menu && (
        <div className="mt-2 w-52 overflow-hidden rounded-xl bg-[#140e09]/97 py-1 shadow-2xl ring-1 ring-[#d4af5a]/40" role="menu">
          <div className="px-4 py-1.5 text-[11px] text-[#9d937c]">
            Blinds {formatMoney(table.sb)}/{formatMoney(table.bb)}
          </div>
          {item(paused ? 'Resume' : 'Pause after this hand', () => set({ paused: !paused }))}
          {item('Hand history', () => set({ dialog: 'log' }))}
          {item('Settings', () => set({ dialog: 'settings' }))}
          {item('Leave table', () => set({ dialog: 'leave' }), true)}
        </div>
      )}
    </div>
  )
}

/** Phone side panel: your hand, actions and a tappable chip rack. */
function SidePanel() {
  const hand = useGame((s) => s.heroHand)
  const equity = useGame((s) => s.equity)
  const hint = useGame((s) => s.colorUpHint)
  return (
    <aside
      className="flex h-full w-[236px] shrink-0 flex-col gap-2 overflow-y-auto border-l border-[#d4af5a]/25 bg-[linear-gradient(180deg,rgba(22,16,11,.97),rgba(8,6,4,.98))] p-2"
      style={{ paddingRight: 'max(0.5rem, env(safe-area-inset-right))' }}
    >
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="truncate font-display text-[14px] font-bold text-[#f6e6b4]">{hand?.label ?? '—'}</span>
        {hand && equity !== null && <span className="text-[#bfb49a]">{Math.round(equity * 100)}%</span>}
      </div>
      <ActionBar />
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d4af5a]/70">Tap chips to bet</span>
        <button
          onClick={() => set({ dialog: 'colorup', colorUpHint: false })}
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold text-[#f6e6b4] ring-1 ring-[#d4af5a]/50 ${hint ? 'bg-[#c9a24a]/30' : ''}`}
        >
          Color up
        </button>
      </div>
      <PanelRack />
    </aside>
  )
}

function ColorUpButton() {
  const hint = useGame((s) => s.colorUpHint)
  return (
    <div className="absolute flex items-center gap-2" style={{ right: 20, top: 780, zIndex: 31 }}>
      {hint && (
        <span className="rounded-lg bg-black/70 px-2.5 py-1 text-[12px] text-[#f6e6b4] ring-1 ring-[#d4af5a]/40" style={{ animation: 'pop-in .3s ease-out' }}>
          Your rack is getting crowded
        </span>
      )}
      <button
        onClick={() => set({ dialog: 'colorup', colorUpHint: false })}
        className={`flex items-center gap-2 rounded-full bg-[linear-gradient(180deg,#2a1c10,#120c07)] py-1 pl-1 pr-3 text-[13px] font-semibold text-[#f6e6b4] ring-1 ring-[#d4af5a]/50 transition hover:ring-[#f3dc9a] ${hint ? 'shadow-[0_0_18px_rgba(243,220,154,.6)]' : ''}`}
        aria-label="Color up: exchange small chips for larger ones"
      >
        <Chip denom={1000} size={28} />
        Color up
      </button>
    </div>
  )
}

export function TableScreen() {
  const focus = useGame((s) => s.focus)
  // Leaving browser fullscreen (Esc, F11) also leaves focus mode.
  useEffect(() => {
    const onChange = () => !document.fullscreenElement && set({ focus: false })
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  return (
    <div className="flex h-full" style={{ background: 'radial-gradient(ellipse at 50% 42%, #2b1a0f 0%, #140c07 45%, #060403 100%)' }}>
      {!MOBILE && <HandPanel />}
      <main className="relative h-full min-w-0 flex-1" style={MOBILE ? { paddingLeft: 'env(safe-area-inset-left)' } : undefined}>
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'repeating-linear-gradient(90deg, rgba(255,255,255,.018) 0 2px, transparent 2px 120px), repeating-linear-gradient(0deg, rgba(0,0,0,.25) 0 1px, transparent 1px 22px)',
          }}
          aria-hidden
        />
        <div className={`absolute inset-x-0 bottom-0 ${focus || MOBILE ? 'top-0' : 'top-12'}`}>
        <Stage>
          <TableArt />
          <Board />
          <Seats />
          <DealerButton />
          <Rack />
          {!MOBILE && <ActionBar />}
          {!MOBILE && <ColorUpButton />}
          <Banner />
          <Flyers />
        </Stage>
        </div>
        {MOBILE ? (
          <>
            <MobileHud />
            <HandPanel />
          </>
        ) : focus ? (
          <button
            onClick={() => setFocus(false)}
            aria-label="Exit full screen"
            title="Exit full screen (Esc)"
            className="absolute right-3 top-3 z-30 rounded-lg bg-black/40 p-2 text-[#e9dcb8] opacity-50 ring-1 ring-[#d4af5a]/30 transition hover:opacity-100"
          >
            <Icon d={SHRINK} />
          </button>
        ) : (
          <Hud />
        )}
      </main>
      {MOBILE && <SidePanel />}
      {!focus && <LogDrawer />}
      <LeaveDialog />
      <BustDialog />
      <ColorUpDialog />
    </div>
  )
}
