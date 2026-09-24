import { set, useGame } from '../game/store'
import { game } from '../game/controller'
import { formatMoney } from '../engine/chips'
import { Stage } from '../components/table/Stage'
import { TableArt } from '../components/table/TableArt'
import { Banner, Board, DealerButton, Seats } from '../components/table/Seats'
import { Flyers } from '../components/table/Flyers'
import { Rack } from '../components/table/Rack'
import { ActionBar } from '../components/table/ActionBar'
import { HandPanel } from '../components/HandPanel'
import { BustDialog, ColorUpDialog, LogDrawer } from '../components/Dialogs'
import { Button } from '../components/ui/kit'
import { Chip } from '../components/chips/Chip'

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
  return (
    <div className="flex h-full" style={{ background: 'radial-gradient(ellipse at 50% 42%, #2b1a0f 0%, #140c07 45%, #060403 100%)' }}>
      <HandPanel />
      <main className="relative h-full min-w-0 flex-1">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'repeating-linear-gradient(90deg, rgba(255,255,255,.018) 0 2px, transparent 2px 120px), repeating-linear-gradient(0deg, rgba(0,0,0,.25) 0 1px, transparent 1px 22px)',
          }}
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 top-12">
        <Stage>
          <TableArt />
          <Board />
          <Seats />
          <DealerButton />
          <Rack />
          <ActionBar />
          <ColorUpButton />
          <Banner />
          <Flyers />
        </Stage>
        </div>
        <Hud />
      </main>
      <LogDrawer />
      <BustDialog />
      <ColorUpDialog />
    </div>
  )
}
