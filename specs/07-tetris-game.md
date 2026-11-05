# SPEC 07 — Tetris game

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-04
> **Objective:** Port the vanilla-JS Tetris in `references/StarterGames/03-tetris/` to a TypeScript engine plus a React canvas component, add it to the catalog as a new entry `tetris`, introduce the game registry (moving asteroids into it), and wire its score, lines and level into the platform HUD and the GAME OVER / SAVE SCORE flow.

## Why this spec exists

Today only `asteroids` is a real game. `GamePlayer` dispatches with `gameId === "asteroids"` and every other game runs the fake simulation (random score timer plus a fake arena). This spec makes the second real game, so it also adds the **game registry** that SPEC 05 deferred: one place that maps a `gameId` to its canvas component, its controls hint and the HUD stats it uses. It follows the SPEC 05 pattern (engine under `lib/tetris/`, thin canvas wrapper, `GamePlayer` as host) and the SPEC 06 score flow (`games` row, `insertScore`, `useMergedScores`).

The reference is `index.html` + `game.js` (~580 lines, one global script) + `style.css`, with Spanish UI text. `index.html` has three canvases: `#board` 300x600, `#next-canvas` 120x120 and `#hold-canvas` 120x120. There are no merge leftovers in the folder. `README.md` and `CLAUDE.md` of the source are only partly right; the differences are listed in Risks. The code wins.

## Scope

**In:**

- Catalog: new entry `tetris` appended after `asteroids` in `GAMES`. The placeholder `drop` stays unchanged and keeps the fake simulation.
- Full port of the gameplay in `game.js` (values copied unchanged):
  - Board 10 columns x 20 rows, block size 30.
  - **7 pieces**: I, O, T, S, Z, J, L, picked uniformly at random (no bag), colored by the active skin (default `retro`).
  - Spawn at `x = floor(COLS/2) - floor(width/2)`, `y = 0`. Game over when a spawned piece collides.
  - Rotation clockwise with wall kicks `[0, -1, 1, -2, 2]`.
  - Gravity by `dropInterval = max(100, 1000 - (level - 1) * 90)` ms.
  - Soft drop (+1 per row), hard drop (+2 per row), ghost piece (alpha 0.2).
  - Next piece preview.
  - **Hold** (`S`): swap the current piece with the held one.
  - **Slow fall** (hold `C`): gravity interval doubled while the key is held.
  - Line clear scoring `[0, 100, 300, 500, 800] * level`; level up every 10 lines.
- Pure TypeScript engine in `lib/tetris/` with no React and no Next.js imports.
- Client component `components/tetris-canvas.tsx` that owns the `<canvas>`, creates and destroys the engine.
- **Registry**: introduce `components/game-registry.tsx` and move asteroids into it. `GamePlayer` dispatches through it; games not in the registry keep the fake simulation. Asteroids must behave exactly as before.
- Score, Lines and Level in the platform HUD come from the engine. The Lives slot of the HUD is replaced by **LINES** for this game. PAUSE / RESUME pauses the engine; END ends the run; GAME OVER modal and SAVE SCORE (`insertScore`) work as in SPEC 06; PLAY AGAIN starts a new run.
- The canvas draws the playfield (grid, locked blocks, ghost, current piece) and the NEXT and HOLD preview boxes with their labels. Score, lines, level, PAUSED and GAME OVER belong to the platform.
- Fixed **440x600** game coordinates (not 4:3): board 300x600 on the left, a 120-wide column on the right with the NEXT and HOLD boxes. The canvas is scaled by CSS with `object-fit: contain` inside `.crt-screen` (4:3), so it keeps its ratio and shows black bars on the sides.
- Keyboard input: `←` `→` move, `↑` or `X` rotate, `↓` soft drop, `Space` hard drop, `S` hold, `C` (held) slow fall. Controls hint near the CRT.
- In-game text in English: `NEXT`, `HOLD`.
- Migration `supabase/migrations/<timestamp>_add_tetris_game.sql` that inserts the `games` row, applied with MCP `apply_migration`.
- New cover class `cover-tetris` in `app/globals.css` (designed with `/frontend-design`, visibly different from `cover-tetro`).
- Update `CLAUDE.md` with the engine location, the callbacks contract, the registry and the catalog sync.
- **Skins and theme**: the four skins of the source (`retro`, `neon`, `pastel`, `pixel`) and its light/dark theme toggle, both applied to the canvas only. The `neon` skin is redesigned to use the colors of the Arcade Vault page (`--cyan`, `--magenta`, `--yellow`, `--green`, `--gold`, `--silver`, `--bronze` from `app/globals.css`). Two mouse-operated buttons under the CRT switch them live. Default is `retro` on `dark`, as in the source. Details in Data model, "Skins and theme".
- **Background music**: the file `resources/Korobeiniki - 8-Bit Version - T. Bless - Topic (64k).mp3` is copied to `public/game-assets/tetris/korobeiniki.mp3` (renamed: no spaces). It loops at a low volume (`0.2`) while a run is playing, and a **mute button** in the player HUD toggles it with a mouse click. Details in Data model, "Music".

**Out of scope (for future specs):**

- Applying the light theme or the skins to the platform page (HUD, CRT frame, modal): they only change what the canvas draws. Remembering the skin or theme between runs or visits.
- Sound effects (move, rotate, lock, line clear, game over), a volume slider, and remembering the mute choice between runs or visits.
- The extra pieces **U** (3x3) and **dot** (1x1). The source has 9 piece types; the port has the 7 standard ones.
- The source pause menu: start-level select (1 to 15), its own restart button and controls list. The source pause keys `P` and `Esc` are dropped too (PAUSE button only).
- The source records panel: top 5 list, best combo, max lines, "reset records" (all in `localStorage` key `records`). Combo tracking (`combo`, `bestCombo`) only feeds that panel and is dropped.
- Touch or gamepad controls; any input not listed above.
- Music for any game other than `tetris`. The source game itself has no audio; the music is a platform addition requested for this spec.
- High-DPI canvas scaling and a responsive playfield size.
- Real game stats: `best` and `plays` stay mock fields.
- Supabase Auth, server client, rate limiting, anti-cheat.
- Changes to other games, the Home, auth or the Hall of Fame layout.
- Automated tests (no test runner is configured).

## Data model

Catalog entry (the `Game` type is unchanged):

```ts
// lib/games.ts — appended to GAMES, after "asteroids"
{
  id: "tetris",
  title: "TETRIS",
  short: "Stack, rotate and clear lines before the stack hits the top.",
  long: "Seven classic pieces fall into a ten-column well. Slide, rotate and drop them to clear lines, stash one piece on hold for later and follow the ghost to aim. Gravity speeds up every 10 lines.",
  cat: "PUZZLE",
  cover: "cover-tetris",
  color: "green",
  best: 0,
  plays: "0",
}
```

Engine public API:

```ts
// lib/tetris/engine.ts
export interface TetrisCallbacks {
  onScore: (score: number) => void; // when the score changes
  onLines: (lines: number) => void; // when the cleared-lines total changes
  onLevel: (level: number) => void; // when the level changes
  onGameOver: (finalScore: number) => void; // once per run
}

export type TetrisSkin = "retro" | "neon" | "pastel" | "pixel";
export type TetrisTheme = "dark" | "light";

export interface TetrisOptions {
  skin?: TetrisSkin; // default "retro"
  theme?: TetrisTheme; // default "dark"
}

export class TetrisEngine {
  constructor(
    canvas: HTMLCanvasElement,
    callbacks: TetrisCallbacks,
    options?: TetrisOptions,
  );
  setSkin(skin: TetrisSkin): void; // redraws at once, also while paused or after game over
  setTheme(theme: TetrisTheme): void; // same
  start(): void; // resets state, attaches listeners, starts the rAF loop; idempotent
  pause(): void; // stops updating, clears held keys
  resume(): void; // continues without a time jump
  end(): void; // ends the run immediately and calls onGameOver once
  destroy(): void; // cancels rAF and removes every listener
}
```

Module layout:

| File                      | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/tetris/constants.ts` | `COLS = 10`, `ROWS = 20`, `BLOCK = 30`, canvas `W = 440`, `H = 600`, `PREVIEW_BLOCK = 30`, `PIECES` (7 shapes, index 1 to 7), `SKIN_COLORS` (4 skins, index 1 to 7 each), `THEME_COLORS` (dark/light canvas colors), `NEON_BOARD` override, `LINE_SCORES = [0,100,300,500,800]`, `MIN_INTERVAL = 100`, `BASE_INTERVAL = 1000`, `INTERVAL_STEP = 90`, `LINES_PER_LEVEL = 10`, `SLOW_FACTOR = 2`, `KICKS = [0,-1,1,-2,2]`, `SOFT_DROP_POINTS = 1`, `HARD_DROP_POINTS = 2`, ghost alpha `0.2`, layout rectangles of the side column, colors of grid/background/labels |
| `lib/tetris/utils.ts`     | `createBoard`, `rotateCW`, `intervalFor(level)`, `clampScore`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `lib/tetris/entities.ts`  | `Piece` (`type`, `shape`, `x`, `y`; `makePiece(type)`), `BLOCK_DRAWERS` (the four skin drawers), `drawBlock(ctx, skin, x, y, colorIndex, size, alpha?)`, `drawPreview(ctx, skin, piece, ox, oy)`                                                                                                                                                                                                                                                                                                                                                                   |
| `lib/tetris/engine.ts`    | `TetrisEngine`: input, state, gravity, collision, lock/clear/spawn, hold, draw, loop, callbacks                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

Piece tables (copied from `game.js` lines 26 to 37, entries 1 to 7 only):

```
1 I [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]]
2 O [[2,2],[2,2]]
3 T [[0,3,0],[3,3,3],[0,0,0]]
4 S [[0,4,4],[4,4,0],[0,0,0]]
5 Z [[5,5,0],[0,5,5],[0,0,0]]
6 J [[6,0,0],[6,6,6],[0,0,0]]
7 L [[0,0,7],[7,7,7],[0,0,0]]
```

The random pick is `floor(Math.random() * 7) + 1`.

Skins and theme (in memory only):

Piece colors by skin, index 1 to 7 (I, O, T, S, Z, J, L). `retro`, `pastel` and `pixel` are copied from `game.js` lines 8 to 21 without the entries 8 and 9; `neon` is new:

| Skin     | 1 I       | 2 O       | 3 T       | 4 S       | 5 Z       | 6 J       | 7 L       |
| -------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- |
| `retro`  | `#4dd0e1` | `#ffd54f` | `#ba68c8` | `#81c784` | `#e57373` | `#64b5f6` | `#ffb74d` |
| `neon`   | `#00f5ff` | `#f5ff00` | `#ff006e` | `#00ff88` | `#d97a3a` | `#c7d0e0` | `#ffcf3a` |
| `pastel` | `#a8e6ef` | `#fff1b8` | `#d9b8f0` | `#b8e6c1` | `#f5b8b8` | `#b8d4f5` | `#fbd3a8` |
| `pixel`  | `#29b6f6` | `#fdd835` | `#ab47bc` | `#66bb6a` | `#ef5350` | `#3f6fd8` | `#fb8c00` |

The `neon` colors are, in order, the page tokens `--cyan`, `--yellow`, `--magenta`, `--green`, `--bronze`, `--silver`, `--gold` (`app/globals.css` lines 11 to 17). The source `neon` colors (`#00ffff`, `#ffff00`, ...) are dropped. The `neon` drawer is copied from the source (`shadowBlur = 12` glow with `shadowColor` set to the piece color, inner `rgba(255,255,255,0.35)` square) so the blocks glow in the page's neon style.

Block drawers, copied from `game.js` lines 208 to 249 (`drawBlock` passes `px = x * size + 1`, `s = size - 2`):

| Skin     | Drawing                                                                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `retro`  | `fillRect(px, py, s, s)`; top strip `s x 4` in `rgba(255,255,255,0.12)`                                                                                                                     |
| `neon`   | `shadowBlur 12`; `fillRect(px+2, py+2, s-4, s-4)`; `shadowBlur 0`; inner `fillRect(px+4, py+4, s-8, s-8)` in `rgba(255,255,255,0.35)`                                                       |
| `pastel` | `roundRect(px, py, s, s, s*0.3)`; highlight `roundRect(px+s*0.18, py+s*0.14, s*0.64, s*0.18, s*0.09)` in `rgba(255,255,255,0.45)`                                                           |
| `pixel`  | `fillRect` whole block, then a grid of `cell = max(2, round(s/6))` squares: edge cells top/left `rgba(255,255,255,0.35)`, bottom/right `rgba(0,0,0,0.35)`, inner checker `rgba(0,0,0,0.18)` |

Canvas colors by theme (from `style.css` lines 1 to 43):

| Role                               | `dark`    | `light`   |
| ---------------------------------- | --------- | --------- |
| Canvas background (outside boards) | `#0f0f17` | `#f2f3f7` |
| Board and preview box fill         | `#1a1a25` | `#ffffff` |
| Grid lines                         | `#22222e` | `#e3e5ee` |
| Borders                            | `#2a2a3a` | `#c8cad6` |
| Labels (`NEXT`, `HOLD`)            | `#555570` | `#6b6d85` |

With the `neon` skin the board and preview fill is `#000000` and the grid `#1c1c2c` in **both** themes (source: `[data-skin="neon"]`, `style.css` lines 40 to 43).

Controls (platform side, a row under the CRT above the controls hint, mouse-operated):

- `SKIN: RETRO` button: each click cycles `retro` -> `neon` -> `pastel` -> `pixel` -> `retro`; the label shows the active skin (`RETRO`, `NEON`, `PASTEL`, `PIXEL ART`).
- `THEME: DARK` button: each click toggles `dark` / `light`.
- `GamePlayer` owns `skin` and `theme` in `useState` (defaults `retro`, `dark`). They survive PLAY AGAIN, reset on reload, and are never written to `localStorage`.
- `TetrisCanvas` gets optional props `skin` and `theme`; the first values go to the engine constructor and later changes call `setSkin` / `setTheme` (no remount, the run continues). Each button blurs itself after a click so `Space` and the arrows do not re-activate it.
- The buttons are rendered only for registry entries with `appearance`; asteroids and the fake games show none.

Canvas layout (logical pixels; colors come from the active theme and skin tables above, the values here are `dark`):

| Area           | Rectangle (x, y, w, h)     | Notes                                                                                     |
| -------------- | -------------------------- | ----------------------------------------------------------------------------------------- |
| Board          | `0, 0, 300, 600`           | Fill `#1a1a25`, grid lines `#22222e`, line width 0.5, border `#2a2a3a`                    |
| NEXT label     | text at `x = 320, y = 10`  | `NEXT`, color `#555570`, bold 10px, letter spacing 2px (approximate with `letterSpacing`) |
| NEXT box       | `320, 20, 120, 120`        | Fill `#1a1a25`, border `#2a2a3a`; piece drawn with `drawPreview`                          |
| HOLD label     | text at `x = 320, y = 170` | `HOLD`, same style (source label is `ON HOLD`; shortened for the narrow column)           |
| HOLD box       | `320, 180, 120, 120`       | Same style; empty until the first hold                                                    |
| Rest of canvas | everything else            | Fill `#0f0f17`                                                                            |

`drawPreview` copies the source: a 4x4 grid of 30px blocks, the piece offset by `floor((4 - w) / 2)` columns and `floor((4 - h) / 2)` rows. `drawBlock` copies the `retro` drawer: `fillRect(px, py, s, s)` with the color, then a `rgba(255,255,255,0.12)` strip `s x 4` at the top, where `px = x * size + 1`, `s = size - 2` (that is the `retro` drawer; the other skins use the drawers above). Ghost blocks use the active skin's drawer at alpha 0.2.

HUD mapping:

| Platform HUD | Source game                            | Callback  |
| ------------ | -------------------------------------- | --------- |
| Score        | `score`                                | `onScore` |
| Lives        | hidden; slot shows **LINES** (`lines`) | `onLines` |
| Level        | `level`                                | `onLevel` |

Registry entry:

```tsx
// components/game-registry.tsx
export interface GameDefinition {
  Canvas: ComponentType<GameCanvasProps>;
  controls: { keys: string[]; label: string }[]; // controls hint under the CRT
  stats: { lives: boolean; lines: boolean; level: boolean };
  music?: { src: string; volume: number }; // optional background track; absent = no audio, no mute button
  appearance?: { skins: { id: string; label: string }[]; themes: boolean }; // optional skin/theme buttons
}

export const GAME_REGISTRY: Record<string, GameDefinition> = {
  asteroids: { Canvas: AsteroidsCanvas, controls: [...], stats: { lives: true, lines: false, level: true } },
  tetris: {
    Canvas: TetrisCanvas,
    controls: [...],
    stats: { lives: false, lines: true, level: true },
    music: { src: "/game-assets/tetris/korobeiniki.mp3", volume: 0.2 },
    appearance: {
      skins: [
        { id: "retro", label: "RETRO" },
        { id: "neon", label: "NEON" },
        { id: "pastel", label: "PASTEL" },
        { id: "pixel", label: "PIXEL ART" },
      ],
      themes: true,
    },
  },
};
```

Music (platform side, not in the engine, so `lib/tetris/` stays free of audio and DOM-UI concerns):

- Hook `components/use-background-music.ts` (client): `useBackgroundMusic(music, { active, muted })`. It creates one `HTMLAudioElement` per mount with `loop = true` and `volume = music.volume` (0.2), and removes it on unmount (`pause()`, `src = ""`). `GamePlayer` calls it with `active = !!definition?.music && !paused && !over`.
- `GamePlayer` owns `const [muted, setMuted] = useState(false)`. It is in memory only: no `localStorage`, and it resets to unmuted when the page is left and entered again. PLAY AGAIN keeps the current mute choice.
- Play rules:
  - While `active` and not `muted`, the track plays; PAUSE pauses it and RESUME continues from the same position; GAME OVER (engine or END) stops it; PLAY AGAIN restarts it from 0.
  - `muted` pauses the audio (it does not just set the volume to 0), so a muted page does not decode or play anything. Unmuting resumes it while `active`.
  - Browser autoplay policy: `audio.play()` returns a promise that can reject before the first user gesture. The rejection is caught and ignored; the hook then retries once on the first `keydown` or `pointerdown` on `window` and removes that listener afterwards. The normal path (arriving from a click on PLAY) usually plays at once.
- Mute button: a button in `.hud-actions` next to PAUSE / END / EXIT, rendered only when the definition has `music`. Label `MUSIC ON` / `MUSIC OFF` (`aria-pressed={muted}`), same `.btn` styling as its neighbors, operated with the mouse. After a click it calls `e.currentTarget.blur()` so a later `Space` (hard drop) does not re-activate the button.
- The track is a 64 kbps MP3; the file is served as a static asset and fetched when the audio element is created (`preload = "auto"`), not on the library or detail pages.

`GameCanvasProps` is the common prop set: `paused`, `endSignal`, `onScore`, `onGameOver` and the optional `onLives`, `onLevel`, `onLines`, `skin`, `theme` (a canvas ignores the ones its engine does not have). `GamePlayer` calls `GAME_REGISTRY[gameId]`; when it is `undefined` the fake simulation runs as today.

Migration (`supabase/migrations/<timestamp>_add_tetris_game.sql`; the timestamp must be later than `20261104154201`):

```sql
insert into public.games (id, title, short, long, cat, cover, color) values
  ('tetris', 'TETRIS', 'Stack, rotate and clear lines before the stack hits the top.',
   'Seven classic pieces fall into a ten-column well. Slide, rotate and drop them to clear lines, stash one piece on hold for later and follow the ghost to aim. Gravity speeds up every 10 lines.',
   'PUZZLE', 'cover-tetris', 'green');
```

Conventions:

- Constants, formulas and values are copied from the source unchanged (`COLS = 10`, `ROWS = 20`, `BLOCK = 30`, `LINE_SCORES = [0,100,300,500,800]`, interval `max(100, 1000 - (level - 1) * 90)`).
- Scoring is copied from the source:

| Event                            | Points                                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| Soft drop (`↓`) one row          | +1 (`game.js` line 181)                                                                      |
| Hard drop (`Space`)              | +2 per row between the piece and its ghost (`game.js` line 172)                              |
| Clear 1 / 2 / 3 / 4 lines        | `LINE_SCORES[n] * level` = 100 / 300 / 500 / 800 times the level **before** the level update |
| Gravity step, rotate, move, hold | 0                                                                                            |

- Level is `1 + floor(lines / 10)` (`startLevel` is fixed at 1). `dropInterval` is recomputed from the level when lines are cleared.
- `lockPiece()` = merge, clear lines, spawn. Gravity, soft drop and hard drop all go through it. Soft drop on a piece that cannot move down locks it without points (`game.js` lines 177 to 185).
- Gravity (`game.js` lines 429 to 445): `dropAccum += dt` in ms; when `dropAccum >= interval` (`interval = dropInterval * 2` while `C` is held) it resets to 0 and moves the piece down one row or locks it. At most one gravity step per frame. `dropAccum` is also reset to 0 by a hold.
- Hold (`game.js` lines 317 to 329): with nothing held, the current piece goes to hold (fresh `makePiece`, so rotation resets) and `spawn()` promotes `next`; with a held piece, it is swapped in at the spawn position and the swap is **ignored** when the swapped piece collides there. There is no limit of one hold per piece (copied as is).
- Spawn (`game.js` lines 193 to 200): `current = next`, `next = random`, and if `current` collides at its spawn position the run ends.
- `dt` is not clamped in the source, and none is needed: gravity moves at most one row per frame and `resume()` sets `lastTime = null` so the first frame after a pause has `dt = 0`. Same for the first frame after `start()`.
- Entities receive `ctx` as an argument to `draw`; no module-level globals. Game state (board, current, next, hold, score, lines, level, timers, held keys) lives in the engine instance.
- Input is fed by `keydown` / `keyup` listeners on `window`. `preventDefault` only for `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`, `Space`, `KeyX`, `KeyS`, `KeyC` while the engine runs and is not paused. Listeners use `e.code`.
- `keydown` with `e.repeat === true` is ignored for `Space` and `KeyS` so a held key does not chain hard drops or hold swaps; arrows (move, soft drop) and `ArrowUp` / `KeyX` keep the OS auto-repeat like the source. This is the only intentional input change.
- Held keys (`C`) are cleared on `pause()`, window `blur` and `visibilitychange` (hidden).
- Callbacks fire only on change; `start()` fires the initial values (`onScore(0)`, `onLines(0)`, `onLevel(1)`).
- `onGameOver` fires at most once per run, from a spawn collision or from `end()`; afterwards the engine stops updating and removes its key listeners. A final frame is drawn so the stack stays visible behind the modal.
- The score is an integer in 0 to 10,000,000. All increments are integers; `clampScore` caps the value with `Math.min(score, 10_000_000)` before `onScore` and `onGameOver`. See Risks.
- No new `localStorage` keys; `lib/storage.ts` is unchanged. The source keys `records`, `theme` and `skin` are not ported.

## Implementation plan

Before step 1, read the relevant guides in `node_modules/next/dist/docs/` as required by `AGENTS.md` (only if a step touches pages or caching; normally it does not). Invoke `/frontend-design` for the cover and the controls hint, per `CLAUDE.md`.

1. **Catalog entry.** Append `tetris` to `GAMES` in `lib/games.ts` with the temporary cover `cover-tetro`. `npm run build` passes; `/games/tetris` and `/games/tetris/play` render with the fake player; the Home still shows the same 6 mini cards.
2. **Migration.** Write `supabase/migrations/<timestamp>_add_tetris_game.sql`, apply it with `apply_migration`, check with `execute_sql` that `select * from games where id = 'tetris'` matches `lib/games.ts`, run `get_advisors`. No type regeneration (data-only).
3. **Cover.** Add `.cover-tetris` in `app/globals.css` (green neon, falling-blocks motif) and switch the entry from `cover-tetro` to `cover-tetris`. The library card and the detail page show it.
4. **Constants and utils.** Create `lib/tetris/constants.ts` and `lib/tetris/utils.ts` with the values above. `npm run build` passes.
5. **Entities.** Create `lib/tetris/entities.ts` (`Piece`, `makePiece`, `drawBlock`, `drawPreview`). `npm run lint` and `npm run build` pass.
6. **Engine.** Create `lib/tetris/engine.ts`: state, `collide`, `tryRotate` with kicks, `merge`, `clearLines`, `lockPiece`, `spawn`, `holdPiece`, `ghostY`, gravity with the `C` slow fall, input with the listed keys, draw of board, ghost, current piece and side boxes, rAF loop, callbacks on change, `start` / `pause` / `resume` / `end` / `destroy`. No `react` or `next` imports. Result: the file compiles and `npm run lint` passes.
7. **Canvas wrapper.** `components/tetris-canvas.tsx` mirrors `components/asteroids-canvas.tsx`: engine created once in an effect, latest callbacks in a ref, `paused` and `endSignal` effects, `<canvas width={W} height={H}>` with class `tetris-canvas` and `aria-label`. Add `.tetris-canvas` in `app/globals.css` like `.asteroids-canvas` plus `object-fit: contain`. Result: Strict-Mode safe, one live loop.
8. **Registry and player wiring.** Create `components/game-registry.tsx` with `GameDefinition`, `GameCanvasProps` and the entries `asteroids` and `tetris`. `GamePlayer` looks up `GAME_REGISTRY[gameId]` instead of `gameId === "asteroids"`: it renders `<Canvas key={runId} ... />`, passes only the callbacks of the stats the definition uses, shows LIVES or LINES in the same HUD slot according to `stats`, builds the level from the engine when `stats.level` is true, renders the controls hint from `controls`, `END` uses `endSignal` for registered games, `onGameOver` sets `over`, `restart()` bumps `runId`. Games not in the registry keep the fake timer and arena. Result: `/games/asteroids/play` behaves exactly as before, `/games/drop/play` still runs the fake simulation, `/games/tetris/play` shows the real canvas.
9. **Controls hint.** Registry `controls` for tetris: `← →` MOVE, `↑` / `X` ROTATE, `↓` SOFT DROP, `SPACE` HARD DROP, `S` HOLD, `C` SLOW FALL. Styled with the existing `.controls-hint`, wraps at 375px. Designed with `/frontend-design`.
10. **Music asset.** Copy `resources/Korobeiniki - 8-Bit Version - T. Bless - Topic (64k).mp3` to `public/game-assets/tetris/korobeiniki.mp3` (copy, do not move: `resources/` stays as it is). `http://localhost:3000/game-assets/tetris/korobeiniki.mp3` returns `200` with an audio content type.
11. **Music hook and mute button.** Create `components/use-background-music.ts`, add `music` to `GameDefinition` and to the `tetris` entry, wire the hook and the `muted` state in `GamePlayer`, and add the MUSIC ON / OFF button to `.hud-actions` (only for definitions with `music`). Designed with `/frontend-design` so it matches the other HUD buttons at 1280px and 375px. Result: asteroids and fake games show no music button and create no `Audio`.
12. **Skins and theme.** Add `SKIN_COLORS`, `THEME_COLORS` and `BLOCK_DRAWERS` to `lib/tetris/`, thread `skin` and `theme` through `drawBlock`, `drawPreview` and the engine draw (board, ghost, current piece, boxes, labels, background), add `setSkin` / `setTheme` and the constructor options, add the `skin` / `theme` props to `TetrisCanvas`, add `appearance` to the registry, and add the SKIN and THEME buttons to `GamePlayer` (designed with `/frontend-design`, wrapping at 375px). Result: each of the 4 skins and 2 themes renders correctly live, also while paused and after game over; the `neon` skin shows the page palette.
13. **Score walkthrough.** In `npm run dev` with Playwright (captures only in `.pwScreencaps/`): play to game over, SAVE SCORE, confirm the row in `scores` with `execute_sql`, then on `/games/tetris` and in the Hall of Fame tab after a reload, at 1280px and 375px. Take screenshots of the 4 skins on the dark theme and of `neon` and `retro` on the light theme. Also check the music: it plays, pauses with PAUSE, stops at GAME OVER, restarts with PLAY AGAIN, and the mute button silences it (via `audio.paused` / `audio.volume` read with `browser_evaluate`).
14. **Docs.** Update `CLAUDE.md` (engine location `lib/tetris/`, callbacks incl. `onLines`, the `skin` / `theme` options and the `appearance` registry field, the registry replacing the `gameId === "asteroids"` dispatch, catalog sync with the `tetris` migration, the optional `music` field and `useBackgroundMusic`, the "Only `asteroids` is a real game" line). Run `npm run lint` and `npm run build`.

## Acceptance criteria

Generic:

- [ ] `npm run lint` and `npm run build` finish without errors.
- [ ] `lib/games.ts` contains `tetris` as the last entry with the listed values; other entries are unchanged; the Home still shows the same 6 mini cards.
- [ ] `select * from games where id = 'tetris'` matches `lib/games.ts` (`id`, `title`, `short`, `long`, `cat`, `cover`, `color`); the migration file matches what was applied; `get_advisors` shows no new warning.
- [ ] `/library` shows the card; clicking it goes to `/games/tetris`; PLAY goes to `/games/tetris/play`.
- [ ] `/games/tetris/play` shows a real canvas in the CRT frame and no auto-incrementing score.
- [ ] Score, Lines and Level in the HUD come from the engine; the HUD shows LINES where asteroids shows LIVES, and no hearts.
- [ ] PAUSE freezes the game and shows the PAUSED overlay; RESUME continues with no jump; keys held during pause do not stay stuck.
- [ ] END opens the GAME OVER modal with the current score; `onGameOver` does not fire twice.
- [ ] Game keys do not scroll the page during play; typing a name with spaces in the modal input works.
- [ ] SAVE SCORE inserts one row `{ game_id: "tetris", name, score }` into `scores`; the modal shows `SCORE SAVED_`; a double click inserts one row.
- [ ] The saved score appears in `/games/tetris` and in the Hall of Fame tab for this game after a reload, when it is above the lowest mock row.
- [ ] PLAY AGAIN starts a fresh run with initial values (score 0, lines 0, level 1, empty board, empty hold).
- [ ] EXIT or leaving the page stops the engine: no rAF loop and no `keydown` / `keyup` / `blur` / `visibilitychange` listener remains.
- [ ] In dev (React Strict Mode) only one loop runs: speed is normal, not double.
- [ ] At 375px width the canvas fits the CRT frame without horizontal scroll and keeps its ratio (440:600, letterboxed).
- [ ] Asteroids and the other games' play pages behave exactly as before (HUD with hearts, controls hint, fake simulation for `drop` and the rest).
- [ ] No new `localStorage` keys; `lib/storage.ts` is unchanged.
- [ ] `lib/tetris/` imports nothing from `react` or `next`.
- [ ] No text on the canvas or in the player is in Spanish.
- [ ] Reloading `/games/tetris/play` shows no React hydration warnings.

Game-specific:

- [ ] The board is 10x20 and the canvas is 440x600; the NEXT box (`320,20`) and the HOLD box (`320,180`) are 120x120 and sit to the right of the board.
- [ ] Only the 7 pieces I, O, T, S, Z, J, L appear, with the colors of the active skin; the U and the dot never appear.
- [ ] A fresh page load starts with the `retro` skin on the `dark` theme; the HUD has a `SKIN: RETRO` and a `THEME: DARK` button under the CRT.
- [ ] Clicking SKIN cycles retro, neon, pastel, pixel art and back; the board, the ghost, the NEXT and HOLD boxes and the current piece change at once, without restarting or pausing the run, and also while paused and after game over.
- [ ] Each skin uses the colors in the skin table and its own block drawing (retro flat with top strip, neon glow with inner square, pastel rounded with highlight, pixel art bevelled tiles).
- [ ] The `neon` skin uses exactly `#00f5ff #f5ff00 #ff006e #00ff88 #d97a3a #c7d0e0 #ffcf3a`, equal to the page tokens `--cyan --yellow --magenta --green --bronze --silver --gold`; its board fill is `#000000` and its grid `#1c1c2c` in both themes; the seven pieces are told apart at a glance.
- [ ] Clicking THEME toggles dark/light: canvas background, board and box fill, grid, borders and label colors match the theme table; the page HUD, CRT frame and modal do not change.
- [ ] Skin and theme survive PLAY AGAIN, reset to `retro` / `dark` on reload, and no `localStorage` key is written.
- [ ] After clicking SKIN or THEME, `Space` drops the piece and arrows move it; the button is not re-activated.
- [ ] `/games/asteroids/play` and the fake games show no SKIN or THEME button.
- [ ] Pieces spawn at `x = 5 - floor(width / 2)` (I: 3, O: 4, T/S/Z/J/L: 4), `y = 0`; the NEXT box shows the piece that spawns next.
- [ ] `←` / `→` move one column per key press and stop at walls and locked blocks.
- [ ] `↑` and `X` rotate clockwise; next to a wall the kick order `0, -1, +1, -2, +2` is tried and an impossible rotation is ignored.
- [ ] `↓` moves one row and adds 1 point; with the piece resting it locks without points.
- [ ] `Space` drops the piece to the ghost position, adds 2 points per row dropped and locks; holding `Space` does not chain drops (`e.repeat` ignored).
- [ ] The ghost shows at alpha 0.2 at the landing row and never overlaps the current piece incorrectly (it is drawn under it).
- [ ] Gravity at level 1 moves the piece one row every 1000 ms; level 2 every 910 ms; level 10 every 190 ms; level 11 and above every 100 ms (`max(100, 1000 - (level - 1) * 90)`).
- [ ] Holding `C` doubles the gravity interval; releasing it, pausing, or window blur restores it.
- [ ] Clearing 1, 2, 3 and 4 lines at once gives 100, 300, 500 and 800 times the current level; the level used is the one before the clear's level update (clearing 4 lines from 8 total at level 1 gives 800 and the level becomes 2).
- [ ] The level is `1 + floor(lines / 10)`; the HUD Lines and Level change on the clear that crosses the threshold.
- [ ] `S` with an empty hold stores the piece and spawns the next one; `S` with a held piece swaps it in at the spawn position (fresh rotation); the swap does nothing if it would collide; holding `S` does not chain swaps.
- [ ] The held piece shows in the HOLD box; the HOLD box is empty at the start of every run.
- [ ] When a new piece collides at spawn the engine calls `onGameOver(finalScore)` once and stops; the final stack stays visible behind the modal.
- [ ] Key presses after game over do nothing and are not `preventDefault`ed.
- [ ] `P` and `Esc` do nothing in game (pause is the platform button).
- [ ] `public/game-assets/tetris/korobeiniki.mp3` exists and the original file in `resources/` is untouched.
- [ ] On `/games/tetris/play` the Korobeiniki track plays in a loop with `audio.volume === 0.2`; it is audibly quiet compared with the default.
- [ ] If the browser blocks the first `play()`, no error appears in the console and the music starts on the first key press or click.
- [ ] PAUSE pauses the music and RESUME continues it from the same position; GAME OVER (engine or END) stops it; PLAY AGAIN starts it from the beginning.
- [ ] The HUD shows a `MUSIC ON` button; one mouse click turns the music off (`audio.paused === true`, label `MUSIC OFF`, `aria-pressed="true"`), a second click turns it on again. The state is not stored: reloading the page starts unmuted.
- [ ] While muted, PAUSE / RESUME / PLAY AGAIN do not start the music; unmuting during a run resumes it.
- [ ] After clicking the mute button, pressing `Space` drops the piece and does not toggle the button.
- [ ] EXIT or leaving the page stops the music: no `Audio` element keeps playing.
- [ ] `/games/asteroids/play` and the fake games show no music button and load no audio.
- [ ] In dev (Strict Mode) only one audio stream plays, not two overlapping.
- [ ] Score never exceeds 10,000,000 and is always an integer.

## Decisions

- **Yes:** upgrade vs append. Append a new entry `tetris`, as the user decided; `drop` stays a fake game with its mock scores and its Home card. Reason: keeps the placeholder untouched and avoids a `games` update.
- **Yes:** introduce `components/game-registry.tsx` now and move asteroids into it. Reason: this is the second real game, as SPEC 05 planned.
- **Yes:** HUD mapping Score / Level kept, Lives slot replaced by LINES for tetris (user decision). Reason: Tetris has no lives and lines are its main progress stat.
- **Yes:** keep hold (`S`), slow fall (`C`) and the ghost piece (user decision).
- **Yes:** skins (`retro`, `neon`, `pastel`, `pixel`) and the light/dark theme toggle (user request, reverses the earlier "drop" default). Default is `retro` on `dark`, as in the source.
- **Yes:** the `neon` skin uses the page palette (`--cyan`, `--yellow`, `--magenta`, `--green`, `--bronze`, `--silver`, `--gold`) instead of the source neon colors (user request). Its glow drawer is kept.
- **Yes:** skin and theme affect the canvas only, live, in memory only, with two buttons under the CRT owned by `GamePlayer`; no `localStorage` (the source keys `theme` and `skin` stay unported). Reason: the platform has one dark look and no new keys are allowed.
- **No:** U and dot pieces (not selected by the user). Reason: they are not standard Tetris and change the difficulty; the random pick uses 7 types.
- **No:** start-level select, source pause menu, `P` / `Esc` keys, own restart button. Reason: the platform owns pause, restart and level 1 start.
- **No:** source records panel, `records` / `theme` / `skin` in `localStorage`, combo tracking. Reason: SAVE SCORE writes to Supabase; no new `localStorage` keys.
- **Yes:** extra panels drawn inside the main canvas (user decision), a single 440x600 canvas with NEXT and HOLD stacked in the right column. Reason: one canvas, one engine, simplest wrapper. The source puts HOLD on the left; it moves to the right column so the board stays flush left.
- **Yes:** `object-fit: contain` on `.tetris-canvas` since the ratio is not 4:3. Reason: `width/height: 100%` alone would stretch the bitmap.
- **Yes:** ignore `e.repeat` for `Space` and `S`. Reason: auto-repeat would chain hard drops and hold swaps, which the source allows only by accident.
- **Yes:** background music "Korobeiniki" at volume 0.2 with a mouse-operated mute button (user request). Only the music; no sound effects, no volume slider (the source has no audio).
- **Yes:** the music lives on the platform side (`useBackgroundMusic` hook plus a registry `music` field), not in the engine. Reason: the engine stays framework-free and silent; pause, game over and mute are platform states.
- **Yes:** mute is in memory only and resets on reload. Reason: no new `localStorage` keys.
- **Yes:** copy the MP3 to `public/game-assets/tetris/korobeiniki.mp3` and leave the original in `resources/`.
- **Yes:** scores are clamped to 10,000,000 in the engine before reaching `insertScore`.
- **Yes:** `lib/storage.ts`, `insertScore`, `useMergedScores` and the leaderboard are not changed.

## Risks

| Risk                                                                                                                                                                                                                                                                            | Mitigation                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| React Strict Mode mounts effects twice in dev and can leave two loops or duplicate listeners.                                                                                                                                                                                   | `start()` is idempotent, `destroy()` removes everything; a criterion checks single speed in dev.                                                                                                                                                                                                                                     |
| Global key listeners interfere with typing in the GAME OVER input.                                                                                                                                                                                                              | Listeners and `preventDefault` are active only while running and not paused; after game over the key listeners are removed.                                                                                                                                                                                                          |
| `GAMES` and the `games` table drift apart.                                                                                                                                                                                                                                      | The migration inserts the row with identical values; documented in `CLAUDE.md`.                                                                                                                                                                                                                                                      |
| README and CLAUDE.md of the source differ from the code: both say 7 pieces and one `COLORS` list, but the code has 9 piece types, 4 skins, a hold panel, a pause menu with start level, and a records panel. The README controls table also omits `X`, `Esc` and `C` in places. | The code wins; the spec ports the code's behavior for the 7 standard pieces and lists everything dropped. `X` as a second rotate key is kept (the code has it).                                                                                                                                                                      |
| The source CLAUDE.md says board cells are 1 to 7; the code stores 1 to 9.                                                                                                                                                                                                       | After dropping U and dot, board values are 1 to 7 and match the 7-entry `PIECES` and `COLORS` tables.                                                                                                                                                                                                                                |
| Score can exceed the database cap: level is unbounded, so late-game line clears grow (a 4-line clear at level 100 gives 80,000). Reaching 10,000,000 needs roughly 1,000+ lines of play.                                                                                        | `clampScore` caps at 10,000,000; the value is an integer by construction. Practically unreachable.                                                                                                                                                                                                                                   |
| The playfield is portrait (440x600) inside a 4:3 CRT, so it renders small on narrow screens (about 36% of the CRT width at 375px).                                                                                                                                              | Letterboxing keeps the ratio; acceptable for this spec. A responsive layout belongs to a future spec.                                                                                                                                                                                                                                |
| The source applies no `dt` cap and drops at most one row per frame, so a long background pause could otherwise cause a burst.                                                                                                                                                   | `visibilitychange` (hidden) clears keys; the loop sets `lastTime = null` on resume/start; `dropAccum` is reset to 0 on each gravity step, so no burst is possible. A hidden tab pauses rAF itself, and the platform does not auto-pause, so gravity resumes from the first visible frame with `dt` possibly large but only one step. |
| `drop` (fake Tetris-like placeholder) and `tetris` both exist in the catalog.                                                                                                                                                                                                   | Intended by the user. A later spec can retire or repurpose `drop`.                                                                                                                                                                                                                                                                   |
| Refactoring `GamePlayer` into the registry could regress asteroids (HUD, END, restart).                                                                                                                                                                                         | Criterion: asteroids behaves exactly as before; checked in step 8 and again in step 10.                                                                                                                                                                                                                                              |
| Hold has no once-per-piece limit in the source, so it can be used to stall indefinitely.                                                                                                                                                                                        | Copied as is; `e.repeat` is ignored so it cannot be chained by holding the key. Stalling does not raise the score.                                                                                                                                                                                                                   |
| Browsers block audio before a user gesture, so the music might not start on a direct load of `/games/tetris/play`.                                                                                                                                                              | The rejected `play()` is caught; the hook retries on the first `keydown` / `pointerdown`.                                                                                                                                                                                                                                            |
| The mute button keeps keyboard focus and `Space` (hard drop) would re-click it.                                                                                                                                                                                                 | The button blurs itself after a click; a criterion checks it.                                                                                                                                                                                                                                                                        |
| The MP3 is a third-party recording ("T. Bless - Topic"); the tune is a traditional folk song but the recording may carry its own rights.                                                                                                                                        | The user supplied the file; confirm the license before a public release. The file is only a static asset and easy to swap.                                                                                                                                                                                                           |
| Strict Mode double-mount can start two `Audio` elements.                                                                                                                                                                                                                        | The hook creates the element in an effect and its cleanup pauses and releases it; a criterion checks a single stream.                                                                                                                                                                                                                |
| The page-palette `neon` skin has two near-yellow pieces (`--yellow` `#f5ff00` for O and `--gold` `#ffcf3a` for L) and a bronze Z close to gold.                                                                                                                                 | A criterion requires the seven pieces to be told apart; if they are not, the implementer may swap the L and Z tokens for other page colors and records the change in the spec.                                                                                                                                                       |
| The light theme on a canvas inside the dark CRT frame may look out of place, and the `neon` glow is weak on a white board (the neon board stays black in both themes, which limits this).                                                                                       | Accepted: the toggle only changes the canvas, as in the source. Screenshots of both themes are taken in step 13.                                                                                                                                                                                                                     |
| `pastel` uses `CanvasRenderingContext2D.roundRect`, missing in old browsers.                                                                                                                                                                                                    | Fall back to `rect` when `roundRect` is not a function.                                                                                                                                                                                                                                                                              |
| Canvas text (`NEXT`, `HOLD`) rendering depends on the page font and `ctx.letterSpacing` support.                                                                                                                                                                                | Use a monospace stack (`"Courier New", monospace`) and skip the letter spacing when `ctx.letterSpacing` is unavailable.                                                                                                                                                                                                              |

## What is **not** in this spec

- Themed platform page, persisted skin or theme, the extra U and dot pieces, start-level select, local top 5 and combo stats.
- Sound effects, a volume slider, a persisted mute choice, and music for other games.
- A bag randomizer, SRS rotation, lock delay, T-spins, back-to-back and combo scoring.
- Touch or gamepad controls, high-DPI rendering, a responsive playfield, real stats, Auth, server validation.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
