# SPEC 09 — Snake game

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 08
> **Date:** 2026-11-04
> **Objective:** Build a new Snake game (there is no reference code) as a TypeScript engine plus a React canvas component using the fruit sprites in `references/source-assets/snake-assets/`, add it to the catalog as a new entry `snake`, and wire its score and snake length into the platform HUD and the GAME OVER / SAVE SCORE flow, with a golden bonus fruit and live skins.

## Why this spec exists

Three games are real today (`asteroids`, `tetris`, `arkanoid`). `serpentine` is a catalog placeholder with the fake simulation (random score timer plus a fake arena). This spec adds a fourth real game, `snake`, as a **new** entry; `serpentine` stays untouched and keeps the fake simulation (user decision). It follows the SPEC 05 pattern (engine under `lib/snake/`, thin canvas wrapper, `GamePlayer` as host) and the SPEC 06 score flow (`games` row, `insertScore`, `useMergedScores`). The registry from SPEC 07 already exists, so the spec adds an entry plus two small platform tweaks (a configurable label for the length stat, and hiding the Level slot for games without levels).

There is no reference game: the rules below are designed in this spec (classic Snake). The only source material is `references/source-assets/snake-assets/`: `fruits.png` (3790x442 RGBA, three rows of 22-23 fruit icons: flat, pixel-art and realistic; credit in `sprites.js`: The Spriters Resource, Google Snake game) and `sprites.js` (a `window.SPRITE_ATLAS` global with the `{ x, y, w, h }` crops of the **middle (pixel-art) row** only, `y = 136`, `h = 160`, 22 fruits; Spanish comments, ignored). The sheet has no snake body, head or tile sprites, so the snake and the board are drawn with canvas shapes.

## Scope

**In:**

- Catalog: new entry `snake` appended after `arkanoid` in `GAMES`. `serpentine` is not touched.
- Gameplay (all values are design decisions of this spec):
  - Board 20 columns x 15 rows of 40 px cells, canvas 800x600 (4:3, same ratio as `.crt-screen`).
  - The snake starts with length 3, in the middle row (row 7), head at column 10, body at columns 9 and 8, heading right. It moves one cell per tick, never stops.
  - Exactly one regular fruit is on the board at a time, on a random free cell. Eating it gives +10, grows the snake by 1 and spawns the next fruit. Each fruit shows a random sprite from the 22 in the atlas (never the same one twice in a row).
  - **Golden bonus fruit** (user decision): after each regular fruit eaten, there is a 15% chance that a bonus fruit appears on a random free cell if none is on the board. It is worth +50 and grows the snake by 1, lasts 6 s of game time (freezes while paused), blinks during its last 2 s and then disappears. It is drawn with the `pineapple` sprite and a pulsing yellow ring that shrinks as the timer runs out.
  - Walls kill: moving outside the 20x15 board ends the run. Biting the body ends the run. Moving into the cell the tail is leaving on this same tick is allowed.
  - Speed rises with length: `ticksPerSecond = min(16, 8 + 0.4 * fruitsEaten)` (8 ticks/s at start, 16 from 20 fruits eaten; a bonus fruit counts as a fruit). There are no levels (user decision).
  - The run also ends, as a win, when the snake fills all 300 cells (`onGameOver` fires with the final score).
- Pure TypeScript engine in `lib/snake/` with no React and no Next.js imports.
- Client component `components/snake-canvas.tsx` that owns the `<canvas>`, creates and destroys the engine.
- Registry: add a `snake` entry to `components/game-registry.tsx`. `GamePlayer` dispatches through it; games not in the registry keep the fake simulation.
- Score and snake length in the platform HUD come from the engine; PAUSE / RESUME pauses the engine; END ends the run; GAME OVER modal and SAVE SCORE (`insertScore`) work as in SPEC 06; PLAY AGAIN starts a new run.
- The canvas draws the playfield (checkerboard board, snake, fruit, bonus fruit and its timer ring). Score, length, PAUSED and GAME OVER belong to the platform.
- Input: `←` `↑` `→` `↓` or `W` `A` `S` `D` change direction. Controls hint near the CRT.
- **Skins** (user decision): `retro` (default), `neon`, `pastel`. A skin changes the board colors, snake colors and a CSS filter applied to the fruit sprites. A `SKIN: RETRO` button under the CRT cycles them live (also while paused). In memory only. Uses the existing `appearance` registry field with `themes: false`.
- In-game text in English (the game draws no text).
- Asset `fruits.png` copied to `public/game-assets/snake/fruits.png`; the crop table of `sprites.js` is ported to `FRUIT_SPRITES` in `constants.ts`.
- Migration `supabase/migrations/20261105140000_add_snake_game.sql` that inserts the `games` row, applied with MCP `apply_migration`.
- New cover class `cover-snake-game` in `app/globals.css` (designed with `/frontend-design`, visibly different from the existing `cover-snake` used by `serpentine`).
- Update `CLAUDE.md` with the engine location, the callbacks contract, the registry and the catalog sync.

**Out of scope (for future specs):**

- Levels, lives, obstacles, walls that wrap, maps, more bonus types, two-player mode.
- The flat and realistic fruit rows of `fruits.png` (the atlas only maps the pixel-art row; they would need new crop coordinates) and snake sprites.
- Sound and music (no audio assets were provided, not opted in).
- Light theme (`appearance.themes` is `false`).
- Remembering skin between runs or visits.
- Touch, swipe or gamepad controls; any input not listed above.
- High-DPI canvas scaling and a responsive playfield size.
- Real game stats: `best` and `plays` stay mock fields.
- Supabase Auth, server client, rate limiting, anti-cheat.
- Changes to other games, the Home, auth or the Hall of Fame layout. The only edits to shared code are the two optional platform tweaks below, with no behavior change for Asteroids, Tetris, Arkanoid and the fake games.
- Automated tests (no test runner is configured).

## Data model

Catalog entry (the `Game` type is unchanged):

```ts
// lib/games.ts — appended to GAMES, after "arkanoid"
{
  id: "snake",
  title: "SNAKE",
  short: "Eat the fruit, grow longer and never touch the wall or yourself.",
  long: "Steer a hungry snake across the grid and eat the fruit to grow. Golden fruit is worth five times more but vanishes fast. The snake speeds up with every bite, and one wrong turn into a wall or your own tail ends the run.",
  cat: "ARCADE",
  cover: "cover-snake-game",
  color: "yellow",
  best: 0,
  plays: "0",
}
```

Engine public API:

```ts
// lib/snake/engine.ts
export type SnakeSkin = "retro" | "neon" | "pastel";

export interface SnakeCallbacks {
  onScore: (score: number) => void; // when the score changes
  onLength: (length: number) => void; // when the snake length changes (wired to the `onLines` prop)
  onGameOver: (finalScore: number) => void; // once per run
}

export class SnakeEngine {
  constructor(
    canvas: HTMLCanvasElement,
    callbacks: SnakeCallbacks,
    options?: { skin?: SnakeSkin },
  );
  start(): void; // resets state, attaches listeners, loads the sheet, starts the rAF loop; idempotent
  pause(): void; // stops updating, clears held keys and the direction queue
  resume(): void; // continues without a time jump
  end(): void; // ends the run immediately and calls onGameOver once
  destroy(): void; // cancels rAF, removes every listener, flags the engine so a late image onload is a no-op
  setSkin(skin: SnakeSkin): void; // redraws at once, also while paused or after game over
}
```

Module layout:

| File                     | Contents                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/snake/constants.ts` | `COLS = 20`, `ROWS = 15`, `CELL = 40`, `W = 800`, `H = 600`, `START_LENGTH = 3`, `START_TPS = 8`, `TPS_PER_FRUIT = 0.4`, `MAX_TPS = 16`, `FRUIT_POINTS = 10`, `BONUS_POINTS = 50`, `BONUS_CHANCE = 0.15`, `BONUS_LIFETIME = 6`, `BONUS_BLINK = 2`, `MAX_DT = 0.1`, `INPUT_QUEUE = 2`, `SHEET_SRC`, `FRUIT_SPRITES` (table below), `SKINS` (palette + fruit filter), `MAX_SCORE = 10_000_000` |
| `lib/snake/utils.ts`     | `ticksPerSecond(fruitsEaten)`, `randomFreeCell(snake, occupied, rng)`, `isOpposite(a, b)`, `clampScore`                                                                                                                                                                                                                                                                                      |
| `lib/snake/entities.ts`  | Types `Cell`, `Direction`, `Fruit`, `Bonus`; `SpriteSheet` class (per engine instance: `load`, `applyFilter`, `drawFruit`, `destroy`); `drawBoard`, `drawSnake`, `drawFruit`, `drawBonus`, all receiving `ctx` as argument                                                                                                                                                                   |
| `lib/snake/engine.ts`    | `SnakeEngine`: input, state, fixed-step tick, collisions, spawning, draw, loop, callbacks                                                                                                                                                                                                                                                                                                    |

`FRUIT_SPRITES` (ported unchanged from `sprites.js`, all `y = 136`, `h = 160`, source sheet `fruits.png`): banana `x34 w110`, orange `186/150`, grape `378/110`, garlic `540/130`, eggplant `712/130`, strawberry `894/110`, cherry `1066/110`, carrot `1228/130`, mushroom `1400/130`, broccoli `1582/110`, watermelon `1734/150`, pepper `1906/150`, kiwi `2068/170`, lemon `2250/140`, peach `2432/130`, peanut `2604/130`, apple `2786/110`, tomato `2948/130`, berries `3110/150`, grapes2 `3302/110`, pineapple `3454/150`, melon `3637/130`.

Sprites are drawn scaled to fit a 36x36 px box centered in the 40 px cell, keeping their aspect ratio (all are taller than wide, so height 36).

HUD mapping:

| Platform HUD | Source game                   | Callback                                                       |
| ------------ | ----------------------------- | -------------------------------------------------------------- |
| Score        | `score`                       | `onScore`                                                      |
| Lives        | hidden (not applicable)       | none                                                           |
| Lines slot   | snake length, labelled LENGTH | `onLength` through the existing `onLines` prop (user decision) |
| Level        | hidden (no levels)            | none                                                           |

Registry entry and platform tweaks:

```ts
// components/game-registry.tsx
snake: {
  Canvas: SnakeCanvas,
  controls: [
    { keys: ["←", "↑", "→", "↓"], label: "STEER" },
    { keys: ["W", "A", "S", "D"], label: "STEER" },
  ],
  stats: { lives: false, lines: true, level: false },
  linesLabel: "Length",
  appearance: {
    skins: [
      { id: "retro", label: "RETRO" },
      { id: "neon", label: "NEON" },
      { id: "pastel", label: "PASTEL" },
    ],
    themes: false,
  },
},
```

- `GameDefinition` gets an optional `linesLabel?: string`; `GamePlayer` renders it in place of the hard-coded `Lines` label (default `Lines`, so Tetris is unchanged).
- `GamePlayer` hides the Level HUD slot when the game has a definition with `stats.level === false`. Asteroids, Tetris and Arkanoid have `level: true` and keep the slot; fake games keep it too. The implementer verifies how the slot behaves today before editing.
- `SnakeCanvas` props: `paused`, `endSignal`, `onScore`, `onGameOver`, `onLines` (mapped to `onLength`), `skin`. An effect on `skin` calls `engine.setSkin`.

Migration (`supabase/migrations/20261105140000_add_snake_game.sql`; the timestamp is later than `20261105012449`):

```sql
insert into public.games (id, title, short, long, cat, cover, color) values
  ('snake', 'SNAKE', 'Eat the fruit, grow longer and never touch the wall or yourself.',
   'Steer a hungry snake across the grid and eat the fruit to grow. Golden fruit is worth five times more but vanishes fast. The snake speeds up with every bite, and one wrong turn into a wall or your own tail ends the run.',
   'ARCADE', 'cover-snake-game', 'yellow');
```

Skins (`SKINS` in `constants.ts`; exact hex values are picked with `/frontend-design`, the roles are fixed):

| Skin     | Board                                   | Snake                                                                | Fruit filter                     |
| -------- | --------------------------------------- | -------------------------------------------------------------------- | -------------------------------- |
| `retro`  | dark green checkerboard                 | green body, lighter green head                                       | none                             |
| `neon`   | near-black board, faint cyan grid lines | page tokens (`--green` body, `--cyan` head) with glow (`shadowBlur`) | `saturate(1.4) brightness(1.1)`  |
| `pastel` | light pastel checkerboard               | pastel mint body, pastel pink head                                   | `saturate(0.7) brightness(1.15)` |

Conventions:

- Game values are the design values above; nothing is copied from source code because none exists. Sprite crops are copied unchanged from `sprites.js`.
- Scoring: regular fruit +10, golden fruit +50, nothing else scores. Max reachable score: the board holds 300 cells and the snake starts at 3, so at most 297 fruits are eaten (about 2,970 points plus bonuses, below roughly 16,000), far under the cap. `clampScore` caps at 10,000,000 anyway.
- Movement is a fixed step: an accumulator adds `dt` (clamped to `MAX_DT = 0.1` s) and one tick runs per `1 / ticksPerSecond(fruitsEaten)` s (several ticks per frame are allowed). Drawing happens every frame with no interpolation.
- Direction input: each key press pushes a direction on a queue of at most `INPUT_QUEUE = 2`; each tick pops one. A direction equal or opposite to the last queued direction is ignored (no 180° turn, no duplicates). `e.repeat` events are ignored.
- The bonus timer and the blink use the engine's own clock (sum of clamped `dt`), so they freeze while paused.
- Fruit placement uses `Math.random` over the list of free cells; no seeded generator is needed. The bonus never spawns on the fruit, the snake or its own cell.
- Entities receive `ctx` as an argument to `draw(ctx)`; no module-level globals. Game state lives in the engine instance, including the `SpriteSheet`.
- Input is fed by `keydown` / `keyup` listeners on `window` using `e.code` (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `KeyW`, `KeyA`, `KeyS`, `KeyD`). `preventDefault` only for those keys while the engine runs and is not paused.
- Held keys and the direction queue are cleared on `pause()`, window `blur` and `visibilitychange` (hidden).
- Callbacks fire only on change; `start()` fires the initial values (`onScore(0)`, `onLength(3)`).
- `onGameOver` fires at most once per run (crash, win or `end()`); afterwards the engine stops updating and removes its key listeners.
- If `fruits.png` fails to load, the engine draws fruit as flat colored circles and logs one console error; the game stays playable. Drawing the fruit waits until the image is loaded or failed.
- No new `localStorage` keys; `lib/storage.ts` is unchanged.

## Implementation plan

Before step 1, read the relevant guides in `node_modules/next/dist/docs/` as required by `AGENTS.md` (only if a step touches pages or caching; this one normally does not). Invoke `/frontend-design` for the cover, the skin palettes and the controls hint, per `CLAUDE.md`.

1. **Catalog entry.** Append `snake` to `GAMES` in `lib/games.ts` with the temporary cover `cover-snake` (the new class comes in step 3). `npm run build` passes; `/games/snake` and `/games/snake/play` render with the fake player; Home mini cards unchanged; `serpentine` unchanged.
2. **Migration.** Write `supabase/migrations/20261105140000_add_snake_game.sql`, apply it with `apply_migration`, check `select * from games where id = 'snake'` matches `lib/games.ts`, run `get_advisors`.
3. **Cover.** `.cover-snake-game` in `app/globals.css` (designed with `/frontend-design`, yellow accent, fruit and snake motif, different from `.cover-snake`); set `cover: "cover-snake-game"` in `lib/games.ts`. Library card and detail page show it.
4. **Assets, constants and utils.** Copy `fruits.png` to `public/game-assets/snake/fruits.png`. Write `lib/snake/constants.ts` and `utils.ts`. `npm run build` passes.
5. **Entities.** `lib/snake/entities.ts` (`SpriteSheet`, board, snake with eyes on the head, fruit, bonus with ring). `npm run lint` and `npm run build` pass.
6. **Engine.** `lib/snake/engine.ts`: state reset, input queue, fixed-step tick, wall and body collision, tail-cell rule, fruit and bonus spawning, bonus timer, win on full board, draw, rAF loop, callbacks, public API and `setSkin`. `npm run lint` and `npm run build` pass; the folder imports nothing from `react` or `next`.
7. **Canvas wrapper.** `components/snake-canvas.tsx`, mirroring `components/asteroids-canvas.tsx`, Strict-Mode safe (one live loop), latest callbacks in a ref, `skin` effect.
8. **Registry and player wiring.** Add the `snake` entry and `linesLabel` to `components/game-registry.tsx`; make `GamePlayer` render `linesLabel` and hide the Level slot when `stats.level === false`. `END` uses `endSignal`; `onGameOver` sets `over`; PLAY AGAIN bumps `runId`. Asteroids, Tetris, Arkanoid and the fake games behave as before (check their HUD with a screenshot each).
9. **Controls hint.** Design the controls hint under the CRT with `/frontend-design` (reusing the registry `controls` rendering; adjust only if two rows of arrows and WASD look wrong).
10. **Score walkthrough.** In `npm run dev` with Playwright (captures only in `.pwScreencaps/`): play to game over, SAVE SCORE, confirm the row in `scores`, on `/games/snake` and in the Hall of Fame tab after a reload, at 1280px and 375px. Also cycle the three skins and capture each.
11. **Docs.** Update `CLAUDE.md` (engine location, callbacks, registry, `linesLabel`, Level slot rule, assets, catalog sync). Run `npm run lint` and `npm run build`.

## Acceptance criteria

Generic:

- [ ] `npm run lint` and `npm run build` finish without errors.
- [ ] `lib/games.ts` contains `snake` as the last entry with the listed values; other entries are unchanged; the Home still shows the same 6 mini cards.
- [ ] `select * from games where id = 'snake'` matches `lib/games.ts` (`id`, `title`, `short`, `long`, `cat`, `cover`, `color`); the migration file matches what was applied; `get_advisors` shows no new warning.
- [ ] `/library` shows the card; clicking it goes to `/games/snake`; PLAY goes to `/games/snake/play`.
- [ ] `/games/snake/play` shows a real canvas in the CRT frame and no auto-incrementing score.
- [ ] Score and length in the HUD come from the engine.
- [ ] PAUSE freezes the game and shows the PAUSED overlay; RESUME continues with no jump; keys held during pause do not stay stuck.
- [ ] END opens the GAME OVER modal with the current score; `onGameOver` does not fire twice.
- [ ] Game keys do not scroll the page during play; typing a name with spaces in the modal input works (`A`, `S`, `D`, `W` are game keys only while running).
- [ ] SAVE SCORE inserts one row `{ game_id: "snake", name, score }` into `scores`; the modal shows `SCORE SAVED_`; a double click inserts one row.
- [ ] The saved score appears in `/games/snake` and in the Hall of Fame tab for this game after a reload, when it is above the lowest mock row.
- [ ] PLAY AGAIN starts a fresh run with initial values.
- [ ] EXIT or leaving the page stops the engine: no rAF loop and no `keydown` / `keyup` / `blur` / `visibilitychange` listener remains.
- [ ] In dev (React Strict Mode) only one loop runs: the snake moves at the normal 8 ticks/s at start, not double.
- [ ] At 375px width the canvas fits the CRT frame without horizontal scroll and keeps its ratio.
- [ ] Asteroids, Tetris, Arkanoid and the other games' play pages behave exactly as before (same HUD labels and slots).
- [ ] No new `localStorage` keys; `lib/storage.ts` is unchanged.
- [ ] `lib/snake/` imports nothing from `react` or `next`.
- [ ] No text on the canvas or in the player is in Spanish.
- [ ] Reloading `/games/snake/play` shows no React hydration warnings.

Game-specific:

- [ ] The canvas is 800x600 with a 20x15 grid of 40 px cells; `serpentine` still shows the fake simulation.
- [ ] A new run starts with a length-3 snake, head at column 10 and row 7, heading right; the HUD shows Score `0` and LENGTH `3` from `start()`.
- [ ] The Lives slot and the Level slot are not shown; the third HUD stat is labelled LENGTH, and Tetris still shows LINES.
- [ ] The snake moves one cell per tick, 8 ticks/s at the start, and cannot stop.
- [ ] `←` `↑` `→` `↓` and `W` `A` `S` `D` change direction; a 180° reversal is ignored; two quick turns inside one tick both apply on consecutive ticks (queue of 2); a third is dropped; key auto-repeat does not queue anything.
- [ ] Exactly one regular fruit is on the board at all times, never on the snake; it shows a sprite from the 22-entry atlas, and the next fruit never repeats the previous sprite.
- [ ] Eating a regular fruit gives +10 and grows the snake by 1 (LENGTH +1); the next fruit appears on a free cell.
- [ ] After a regular fruit is eaten, a golden fruit appears with 15% probability when none is on the board; it is never on the snake or the regular fruit.
- [ ] The golden fruit gives +50 and grows the snake by 1; it disappears after 6 s of game time, blinking during the last 2 s; its timer freezes while paused.
- [ ] Speed is `min(16, 8 + 0.4 * fruitsEaten)` ticks/s: 8 at start, 12 after 10 fruits, 16 (cap) from 20 fruits; a golden fruit counts as one fruit.
- [ ] Hitting any wall ends the run (GAME OVER modal with the final score).
- [ ] Biting the body ends the run; moving into the cell the tail is leaving that tick does not.
- [ ] Filling all 300 cells ends the run through `onGameOver`, once.
- [ ] Score is an integer; `clampScore` caps it at 10,000,000.
- [ ] SKIN cycles `RETRO`, `NEON`, `PASTEL` and redraws at once, also while paused; no `THEME` button is shown.
- [ ] If `fruits.png` fails to load (block the request), the game runs with flat circles for fruit and logs one console error.

## Decisions

- **Yes:** add `snake` as a new catalog entry and leave the `serpentine` placeholder unchanged. User decision; the placeholder keeps its mock data and fake simulation.
- **Yes:** map the snake length to the existing LINES HUD slot, relabelled LENGTH through a new optional `linesLabel`, and hide Level and Lives. User decision (Score + length, no level).
- **Yes:** classic ruleset: walls kill, self-bite kills, one fruit at a time, 20x15 grid, speed ramp by fruits eaten. User picked "Classic"; the numbers (8 to 16 ticks/s, +0.4 per fruit, +10 per fruit) are this spec's design values, since there is no source code.
- **Yes:** fruit sprite variety from the atlas and a golden bonus fruit (+50, 15% chance, 6 s). User decision.
- **Yes:** skins `retro`, `neon`, `pastel`, implemented as board and snake palettes plus a fruit filter, reusing `appearance`. User decision; the other two fruit rows of `fruits.png` are not used because the atlas has no coordinates for them.
- **No:** levels, lives, wrap-around, obstacles, sound, light theme, touch controls, new `localStorage` keys. Not requested; sound has no assets.
- **Yes:** draw the board, snake and fruit inside the single main canvas; no second canvas (there are no extra panels).
- **Yes:** assets go to `public/game-assets/snake/` (never `public/games/`).
- **Yes:** fixed-step ticks with a 2-slot direction queue, so fast double turns work and a reversal cannot kill the snake by accident.

## Risks

| Risk                                                                                                                                       | Mitigation                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| React Strict Mode mounts effects twice in dev and can leave two loops, duplicate listeners or a late image `onload` on a destroyed engine. | `start()` is idempotent, `destroy()` removes everything and flags the engine so a late `onload` is a no-op; a criterion checks single speed in dev. |
| Global key listeners interfere with typing in the GAME OVER input (`W`, `A`, `S`, `D` are game keys).                                      | Listeners and `preventDefault` are active only while running and not paused; after game over the key listeners are removed.                         |
| `GAMES` and the `games` table drift apart.                                                                                                 | The migration inserts the row with identical values; documented in `CLAUDE.md`.                                                                     |
| There is no reference code, so rules and numbers are untested design choices (speed ramp, bonus chance).                                   | All tuned numbers live in `constants.ts`; the walkthrough plays a real run and the user can adjust them without touching the engine.                |
| Two snake-like catalog entries (`serpentine` placeholder and `snake`) confuse players and share the `cover-snake` look.                    | User decision. `snake` gets a distinct cover and `yellow` accent; replacing or removing `serpentine` is a future spec.                              |
| `fruits.png` is third-party art (The Spriters Resource, Google Snake game); the license is unknown.                                        | Documented in `CLAUDE.md` with the same warning as the Arkanoid and Tetris assets: confirm the license before a public release.                     |
| `fruits.png` is 3790x442 (large for 22 small sprites) and loads on the play page.                                                          | Loaded once per engine and only on the play page; the draw waits for it. A later spec can crop the middle row into a smaller sheet.                 |
| `ctx.filter` is not supported in some browsers (older Safari), so the fruit filter in `neon` and `pastel` would do nothing.                | `applyFilter` does nothing when unsupported; board and snake palettes still change, the game stays playable.                                        |
| Score could exceed the database cap or be fractional.                                                                                      | Every increment is 10 or 50, so scores are integers; the max reachable is about 16,000; `clampScore` caps it anyway.                                |
| Hiding the Level slot or relabelling the stat could alter other games' HUD.                                                                | Both are opt-in per registry entry; a criterion checks the HUD of Asteroids, Tetris, Arkanoid and a fake game.                                      |
| Late-game board is nearly full, so random free-cell choice must not loop forever.                                                          | `randomFreeCell` builds the list of free cells and picks from it; with no free cell it returns `null` and the win rule fires.                       |

## What is **not** in this spec

- Levels, lives, wrap-around, obstacles, more bonus types and two-player mode.
- The flat and realistic fruit rows and any snake sprites.
- Sound, music and a light theme.
- Touch or gamepad controls, high-DPI rendering, real stats, Auth, server validation.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
