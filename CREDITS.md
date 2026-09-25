# Credits

## Audio (`public/sounds/`)

All recordings are **CC0 1.0 (public domain)** by Kenney Vleugels ([kenney.nl](https://kenney.nl)),
downloaded from Kenney's own uploads on OpenGameArt. Each file ships as `.ogg` plus an `.mp3` copy
for Safari.

| File(s) | Source file(s) | Pack |
|---|---|---|
| `shuffle` | `card-shuffle.ogg` | [Casino Audio](https://opengameart.org/content/54-casino-sound-effects-cards-dice-chips) |
| `deal-1…8` | `card-slide-1…8.ogg` | Casino Audio |
| `flip-1…4` | `card-place-1…4.ogg` | Casino Audio |
| `toss-1…4` (fold / muck) | `card-shove-1…4.ogg` | Casino Audio |
| `chip-1…3`, `chip-4` (single chip click) | `chip-lay-1…3.ogg`, `chips-collide-1.ogg` | Casino Audio |
| `push-1…4` (bet pushed in) | `chips-handle-1, 2, 5, 6.ogg` | Casino Audio |
| `stack-1…4` (riffle / re-stack / color-up) | `chips-stack-1, 3, 4, 5.ogg` | Casino Audio |
| `allin` (big shove) | `chips-handle-5` + `chips-handle-1` layered | Casino Audio (mixed with ffmpeg) |
| `rake` (pot to winner) | `chips-handle-2` → `chips-stack-3` → `chips-stack-1` | Casino Audio (mixed with ffmpeg) |
| `check` (knuckle tap) | first impact of `die-throw-2.ogg`, trimmed, low-passed, doubled | Casino Audio (edited with ffmpeg) |
| `win` | `jingles_STEEL00.ogg` | [Short Music Jingles](https://opengameart.org/content/85-short-music-jingles) |

### Optional: casino ambience loop

No CC0 casino room-tone was available from the download mirrors reachable when this was built, so the
**ambience toggle has an empty slot**. To enable it, pick any CC0 "casino ambience" or "restaurant
walla" loop (e.g. search freesound.org with the *Creative Commons 0* license filter), convert it, and
save it as:

```
public/sounds/ambient.ogg   (and optionally public/sounds/ambient.mp3)
```

Then list it here with its author, URL and license. If the file is missing, the toggle does nothing.

## Fonts

- **Manrope** by Mikhail Sharanda, SIL Open Font License 1.1 (via `@fontsource-variable/manrope`)
- **Source Serif 4** by Frank Grießhammer / Adobe, SIL Open Font License 1.1 (via `@fontsource-variable/source-serif-4`): card rank indices

## Code libraries

- [poker-ts](https://github.com/claudijo/poker-ts) (MIT): dealing, betting rounds, legal actions
- [pokersolver](https://github.com/goldfire/pokersolver) (MIT): hand names, best five cards, showdown winners
- [phe](https://github.com/thlorenz/phe) (MIT): fast hand evaluator for the Monte Carlo worker
- [GSAP](https://gsap.com) (standard "no charge" license), [Howler.js](https://howlerjs.com) (MIT),
  [Zustand](https://github.com/pmndrs/zustand) (MIT), React, Vite, Tailwind CSS (MIT)

All card, chip and table artwork is original SVG drawn for this project.
