# cards

No-Limit Texas Hold'em against up to five AI opponents at a luxury casino table. It runs entirely in the browser.

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # engine, chip math, betting and AI tests (Vitest)
npm run build    # typecheck + production build
```

## Playing

- You start with a **$10,000 bankroll** (saved in `localStorage`; you can reset it in Settings).
- Pick a buy-in ($100 to $10,000), 1–5 opponents and their skill level. Every buy-in is 100 big blinds on a standard blind structure ($1/$1, $2/$5, $5/$10, $10/$25, $25/$50, $50/$100).
- **Betting with chips:** click stacks in your rack to build a bet and click the pile to take the last chip back. You can also use Min / ½ Pot / ¾ Pot / Pot / All-in or the slider. The confirm button only appears when the amount is legal; otherwise a hint explains why.
- **Keys:** `F` fold · `C` check/call · `R` focus the raise slider · `Enter` confirm · `Esc` clear the pile.
- **Color up** (bottom right) swaps small chips for bigger ones. It lights up when your rack gets crowded.
- Leaving the table returns your stack to the bankroll. So does closing the page.

## Architecture

```
src/
  engine/   engine.ts    typed wrapper over poker-ts: startHand / getLegalActions / act + event stream
            evaluate.ts  pokersolver: hand labels, best five cards, showdown winners
            chips.ts     denominations, stack breakdown, paying with change, color-up
  ai/       mc.ts + equity.worker.ts   Monte Carlo equity (phe evaluator) in a Web Worker
            bot.ts       personalities (tight-aggressive, loose-aggressive, rock, calling station), sizing
  game/     controller.ts  the hand loop: seats, bots' thinking time, hero input, busts and rebuys
            director.ts    turns engine events into timed animations and sounds
            store.ts       Zustand state (bankroll and settings persisted)
            betting.ts     bet-pile legality and quick-size maths
  components/  table art, SVG cards, SVG chips, seats, rack, action bar, dialogs, hand panel
  screens/     Lobby, TableScreen
  audio/       Howler sound bank
```

The UI never asks the engine for hidden information. The engine emits events (`handStart`, `blind`, `deal`, `action`, `collect`, `street`, `showdown`, `handEnd`), and the director plays each one in turn. Opponents' hole cards reach the DOM only when they are revealed at showdown. Folded hands never reach it at all.

The table is a fixed 1600×1040 stage scaled to fit the window, so every animation uses one coordinate system. Card and chip flights are GSAP tweens on `transform` only. Card flips are CSS 3D rotations.

## Libraries and why

| Need | Library | Notes |
|---|---|---|
| Game flow | [poker-ts](https://github.com/claudijo/poker-ts) 1.5 | Handles dealing, betting order, blinds, min-raise rules and legal bet ranges. **Its pot/payout code is wrong when a player goes all-in before the river**: that player is dropped from pot eligibility, and their winnings are credited to a null reference and disappear. `engine.ts` therefore builds main and side pots from each player's contributions, picks winners itself, and writes the final stacks back through poker-ts's public `standUp`/`sitDown`. Regression tests cover this. I kept poker-ts because its betting logic is correct and well tested; no better-maintained alternative handles No-Limit side pots. |
| Hand labels and winners | [pokersolver](https://github.com/goldfire/pokersolver) | Readable names and best five cards |
| Monte Carlo equity | [phe](https://github.com/thlorenz/phe) | Lookup-table evaluator, fast enough for 800–3,000 runouts per decision in the worker |
| Animation | GSAP | |
| Audio | Howler.js | Pooled voices, randomised pitch and volume |
| State | Zustand | |
| Styling | Tailwind CSS 4 + hand-written SVG | |

The spec asked for 21st.dev components and the `ui-ux-pro-max` skill. Neither was installed when this was built, so the UI kit in `src/components/ui/kit.tsx` (button, a dialog built on the native `<dialog>` element, toggle, slider, segmented control) is hand-written in the same casino theme.

Asset and font licenses are listed in [CREDITS.md](CREDITS.md).
