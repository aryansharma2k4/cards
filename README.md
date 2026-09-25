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

## Android app

The Android app is the same React app in a [Capacitor](https://capacitorjs.com) shell (`android/`), so the engine, bots, animations, sounds, stats and sync are all identical. On phones the layout switches automatically: the table fills the screen with bigger cards, and actions plus a tappable chip rack sit in a side panel. The app is locked to landscape, runs full screen, and keeps the screen awake while you play. The Android back button closes whatever is open, asks before you leave a table, and exits from the lobby.

Build it (needs JDK 21 and Android SDK 36):

```sh
npm run build && npx cap sync android
cd android && ./gradlew assembleRelease   # → app/build/outputs/apk/release/app-release.apk
```

Release builds are signed with the key at `~/.android/cards-release.jks`, with its passwords in `~/.gradle/gradle.properties` (`CARDS_STORE_FILE`, `CARDS_STORE_PASSWORD`, `CARDS_KEY_ALIAS`, `CARDS_KEY_PASSWORD`). **Back up both files.** Android only installs an update if it's signed with the same key.

## Stats, saving and sync

- **Saved on this device:** your bankroll (including chips on the table, so a refresh or a crash never loses them), settings, and every hand you play.
- **Stats** (Lobby → Stats): net-worth graph, profit by session and by position, win rate in big blinds per 100 hands, VPIP/PFR, showdown numbers, and a list of hands. Click a hand to see it street by street, with each of your decisions judged against the pot odds.
- **Cloud sync** (Settings → Cloud sync): create an account with email and password. Your balance, sessions and hands sync to Postgres on [Neon](https://neon.com) in Singapore. On a new device, sign in and it pulls everything down. For the balance, the most recent change wins.

### Sync backend (for the phone app too)

| Piece | Where |
|---|---|
| Accounts | Neon Auth (managed Better Auth), email + password |
| API | Neon Function `sync` → [`api/sync.ts`](api/sync.ts), declared in [`neon.ts`](neon.ts) |
| Data | Postgres tables `profiles`, `sessions`, `hands` (created by the function on first use) |

A client signs in with the auth URL (`@neondatabase/auth`, or Better Auth's REST endpoints `POST /sign-in/email` then `GET /token`) and calls the function with `Authorization: Bearer <jwt>`:

- `GET /state?since=<ms>` returns `{ balance, balanceAt, sessions, hands }`
- `POST /sync` with `{ balance, balanceAt, sessions, hands }` returns the same shape. Hands and sessions are keyed by UUIDs, so re-sending them is harmless. The balance only changes if `balanceAt` is newer than the stored one.

Every query is scoped to the token's user id, so one user can't read or change another user's rows. Deploy changes with `npx neon deploy --env .env.local`.

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
  cloud/       Neon Auth client + sync
api/           Neon Function: the sync API
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
