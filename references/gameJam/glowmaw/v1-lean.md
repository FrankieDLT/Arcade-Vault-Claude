# SPEC NN — Glowmaw game (v1 lean)

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 08, SPEC 09
> **Theme:** Pac-man (a character that opens and closes its mouth eating pellets in a simple maze while ghosts chase it)
> **Variant:** v1 lean (core loop only, canvas shapes, no optional platform features), effort S
> **Date:** 2026-11-05
> **Objective:** Build a new original maze-chase game, Glowmaw (there is no reference code), as a TypeScript engine plus a React canvas component drawn with canvas shapes only, add it to the catalog as a new entry `glowmaw`, and wire its score, lives and level into the platform HUD and the GAME OVER / SAVE SCORE flow.

## Why this spec exists

Four games are real today (`asteroids`, `tetris`, `arkanoid`, `snake`). The catalog has no maze-chase game: `chomper` is a catalog-only placeholder with the fake simulation (random score timer plus a fake arena). This spec adds a fifth real game, `glowmaw`, as a **new** entry; `chomper` stays untouched and keeps the fake simulation (agent decision, same approach as SPEC 09 with `serpentine`). The game is an original design: a luminous deep-sea orb gulps glowing motes in a coral maze while jelly drifters hunt it. It follows the SPEC 05 pattern (engine under `lib/glowmaw/`, thin canvas wrapper, `GamePlayer` as host) and the SPEC 06 score flow. The registry from SPEC 07 already exists, so the spec only adds an entry and needs no platform change.

There is no reference code and no asset: every rule, number and maze is a design value of this spec, and everything is drawn with canvas shapes. Nothing is taken from any existing game's name, characters, art, music or levels.

## Scope

**In:**

- Catalog: new entry `glowmaw` appended after `snake` in `GAMES`, category ARCADE, accent `cyan`. `chomper` is not touched.
- Gameplay (all values are design decisions of this spec):
  - Maze "Reef A": 19 columns x 15 rows of 40 px cells, canvas 800x600 (4:3, same ratio as `.crt-screen`), maze origin x = 20, y = 0. One fixed layout (table in Data model) with 135 motes, 4 pearls, a central den with a door and a side warp on row 7.
  - Glowmaw (the player) starts on column 9, row 11, motionless, and moves continuously at 5.5 tiles/s once a direction key is pressed. A pressed direction is remembered and applied at the next tile center where that way is open; a 180 degree reversal applies at once. Glowmaw stops when the way ahead is a wall.
  - Eating: a mote gives +10, a pearl gives +50. Cells are eaten when Glowmaw's center is within 10 px of the cell center.
  - Three jelly drifters hunt Glowmaw, each with its own rule: Hunter (targets Glowmaw's tile), Mirror (targets the tile opposite to Glowmaw through the maze center, `(18 - col, 14 - row)`) and Roamer (picks a random open direction at every junction). Hunter starts outside the den door at column 9, row 5; Mirror and Roamer start in the den and leave 4 s and 8 s after the run starts.
  - Pearl: eating one dazes every drifter that is outside the den for `max(2, 6 - 0.4 * (level - 1))` s. Dazed drifters flee at random, move slower and can be eaten: the n-th eaten during one daze gives `100 * n` (100, 200, 300). An eaten drifter becomes a pair of eyes that rushes back to the den, rests there 1.5 s and leaves again as a normal drifter.
  - A non-dazed drifter touching Glowmaw (centers within 26 px) costs a life. After a short death animation, Glowmaw and the drifters return to their starts; eaten motes stay eaten.
  - Warp: row 7 is open at both edges; leaving through one edge enters through the other (Glowmaw and drifters).
  - 3 lives. The run ends when the last life is lost. Eating all 139 pellets clears the reef: +1000, the level increases and the maze refills with drifters a little faster. Levels are endless up to 99.
- Pure TypeScript engine in `lib/glowmaw/` with no React and no Next.js imports.
- Client component `components/glowmaw-canvas.tsx` that owns the `<canvas>`, creates and destroys the engine.
- Registry: add a `glowmaw` entry to `components/game-registry.tsx`. `GamePlayer` dispatches through it; games not in the registry keep the fake simulation.
- Score, lives and level in the platform HUD come from the engine; PAUSE / RESUME pauses the engine; END ends the run; GAME OVER modal and SAVE SCORE (`insertScore`) work as in SPEC 06; PLAY AGAIN starts a new run.
- The canvas draws only the playfield (maze, motes, pearls, Glowmaw, drifters). Score, lives, level, PAUSED and GAME OVER belong to the platform.
- Input: `←` `↑` `→` `↓` or `W` `A` `S` `D`. Controls hint near the CRT.
- In-game text in English (the game draws no text).
- Migration `supabase/migrations/20261105180000_add_glowmaw_game.sql` that inserts the `games` row, applied with MCP `apply_migration`.
- New cover class `cover-glowmaw` in `app/globals.css` (designed with `/frontend-design`).
- Update `CLAUDE.md` and `references/GAMES.md`.

**Out of scope (for future specs):**

- Skins, themes, sound, music, level select, power-ups, bonus items, extra lives, more mazes, a fourth drifter, a scoring streak (see v2 and v3).
- Touch or gamepad controls; any input not listed above.
- High-DPI canvas scaling and a responsive playfield size.
- Real game stats: `best` and `plays` stay mock fields.
- Supabase Auth, server client, rate limiting, anti-cheat.
- Changes to other games, the Home, auth or the Hall of Fame layout. No shared code is edited except the registry entry.
- Replacing the `chomper` placeholder.
- Automated tests (no test runner is configured).

## Data model

Catalog entry (the `Game` type is unchanged):

```ts
// lib/games.ts — appended to GAMES, after "snake"
{
  id: "glowmaw",
  title: "GLOWMAW",
  short: "Gulp the glowing motes and outswim the jelly drifters.",
  long: "Guide Glowmaw, a luminous orb with a big hungry mouth, through a coral maze and gulp every glowing mote. Jelly drifters hunt you down the corridors, but a pearl leaves them dazed and good to eat. Clear the reef to dive into a faster one.",
  cat: "ARCADE",
  cover: "cover-glowmaw",
  color: "cyan",
  best: 0,
  plays: "0",
}
```

Engine public API:

```ts
// lib/glowmaw/engine.ts
export interface GlowmawCallbacks {
  onScore: (score: number) => void; // when the score changes
  onLives: (lives: number) => void; // when the lives change
  onLevel: (level: number) => void; // when the level changes
  onGameOver: (finalScore: number) => void; // once per run
}

export class GlowmawEngine {
  constructor(canvas: HTMLCanvasElement, callbacks: GlowmawCallbacks);
  start(): void; // resets state, attaches listeners, starts the rAF loop; idempotent
  pause(): void; // stops updating, clears the remembered direction
  resume(): void; // continues without a time jump
  end(): void; // ends the run immediately and calls onGameOver once
  destroy(): void; // cancels rAF and removes every listener
}
```

Module layout:

| File                        | Contents                                                                                                                                                                                                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/glowmaw/constants.ts`  | Sizes, speeds, points, timers (table below), `MAZE_A` (layout below), palette, `MAX_SCORE = 10_000_000`                                                                                                                                                                                   |
| `lib/glowmaw/utils.ts`      | `parseMaze(rows)`, `isOpen(maze, col, row, canUseDoor)` (wraps columns on open edge cells), `neighbor(col, row, dir)`, `pickStraightLine(options, target)`, `buildDistanceField(maze, target)` (BFS, door passable), `drifterSpeed(level)`, `dazeTime(level)`, `clampScore`               |
| `lib/glowmaw/entities.ts`   | Types `Dir`, `Cell`, `DrifterKind`, `DrifterState`; classes `Glowmaw` and `Drifter` (position in px, heading, `update(dt, ...)`, `draw(ctx, clock)`); `drawMaze`, `drawMotes` receiving `ctx`                                                                                              |
| `lib/glowmaw/engine.ts`     | `GlowmawEngine`: input, state, sub-stepped movement, eating, collisions, release timers, daze, death and level-clear sequences, draw, loop, callbacks                                                                                                                                      |

Maze layout `MAZE_A` (19 columns, 15 rows; legend: `#` wall, `.` mote, `o` pearl, `_` empty floor, `-` den door (drifters only), `P` Glowmaw start, empty floor). Row 7 is open at columns 0 and 18 (the warp).

```
row  0  ###################
row  1  #........#........#
row  2  #o##.###.#.###.##o#
row  3  #.................#
row  4  #.##.#.#####.#.##.#
row  5  #....#.......#....#
row  6  ####.#.##-##.#.####
row  7  .....#.#___#.#.....
row  8  ####.#.#####.#.####
row  9  #....#.......#....#
row 10  #.##.#.#####.#.##.#
row 11  #........P........#
row 12  #o##.###.#.###.##o#
row 13  #........#........#
row 14  ###################
```

Counts: 135 motes, 4 pearls (139 pellets per reef). Den cells: row 7, columns 8, 9, 10. Hunter start: column 9, row 5. Mirror start: row 7, column 9. Roamer start: row 7, column 10. Leaving the den means: move to column 9, then up through the door at row 6 to row 5.

Constants (`constants.ts`):

| Name                | Value                    | Meaning                                                              |
| ------------------- | ------------------------ | -------------------------------------------------------------------- |
| `COLS`, `ROWS`      | 19, 15                   | Maze size in cells                                                   |
| `CELL`              | 40                       | Cell size in px                                                      |
| `W`, `H`            | 800, 600                 | Logical canvas size                                                  |
| `MAZE_X`, `MAZE_Y`  | 20, 0                    | Maze origin in px                                                    |
| `PLAYER_SPEED`      | 5.5                      | Glowmaw speed in tiles/s (220 px/s)                                  |
| `DRIFTER_BASE`      | 4.2                      | Drifter speed at level 1, tiles/s                                    |
| `DRIFTER_PER_LEVEL` | 0.1                      | Added per level                                                      |
| `DRIFTER_MAX`       | 5.3                      | Cap (reached at level 12); always below `PLAYER_SPEED`               |
| `DAZED_SPEED`       | 3.0                      | Dazed drifter speed, tiles/s                                         |
| `EYES_SPEED`        | 10                       | Eaten drifter speed, tiles/s                                         |
| `START_LIVES`       | 3                        | Lives at the start                                                   |
| `RELEASE_TIMES`     | `[0, 4, 8]`              | Seconds from run start (and after a death reset) per drifter         |
| `DAZE_BASE`         | 6                        | Daze seconds at level 1                                              |
| `DAZE_STEP`         | 0.4                      | Seconds removed per level                                            |
| `DAZE_MIN`          | 2                        | Minimum daze seconds (reached at level 11)                           |
| `DAZE_BLINK`        | 1.5                      | Dazed drifters blink during the last 1.5 s                           |
| `DEN_REST`          | 1.5                      | Seconds an eaten drifter rests in the den                            |
| `READY_TIME`        | 1.5                      | Freeze at the start of a run and after each death or level change    |
| `DEATH_TIME`        | 1.2                      | Death animation seconds                                              |
| `CLEAR_TIME`        | 1.2                      | Maze flash seconds after clearing a reef                             |
| `EAT_RADIUS`        | 10                       | px, to eat a mote or pearl                                           |
| `KILL_RADIUS`       | 26                       | px, drifter-Glowmaw contact                                          |
| `MAX_STEP`          | 8                        | Max px advanced per movement sub-step                                |
| `MAX_DT`            | 0.1                      | Frame `dt` clamp, seconds                                            |
| `MAX_LEVEL`         | 99                       | Level cap                                                            |
| `MAX_SCORE`         | 10,000,000               | Score clamp                                                          |

HUD mapping:

| Platform HUD | Source game           | Callback   |
| ------------ | --------------------- | ---------- |
| Score        | `score`               | `onScore`  |
| Lives        | lives left            | `onLives`  |
| Lines slot   | hidden (not used)     | none       |
| Level        | reef number           | `onLevel`  |

Registry entry:

```ts
// components/game-registry.tsx
glowmaw: {
  Canvas: GlowmawCanvas,
  controls: [
    { keys: ["←", "↑", "→", "↓"], label: "MOVE" },
    { keys: ["W", "A", "S", "D"], label: "MOVE" },
  ],
  stats: { lives: true, lines: false, level: true },
},
```

`GlowmawCanvas` props: `paused`, `endSignal`, `onScore`, `onGameOver`, `onLives`, `onLevel`.

Migration (`supabase/migrations/20261105180000_add_glowmaw_game.sql`; the timestamp is later than `20261105020551`):

```sql
insert into public.games (id, title, short, long, cat, cover, color) values
  ('glowmaw', 'GLOWMAW', 'Gulp the glowing motes and outswim the jelly drifters.',
   'Guide Glowmaw, a luminous orb with a big hungry mouth, through a coral maze and gulp every glowing mote. Jelly drifters hunt you down the corridors, but a pearl leaves them dazed and good to eat. Clear the reef to dive into a faster one.',
   'ARCADE', 'cover-glowmaw', 'cyan');
```

Art direction (canvas shapes only; exact hex values picked with `/frontend-design`, roles fixed): near-black navy background; walls as rounded dark-teal blocks with a glowing cyan outline (`--cyan`); motes as small pale-cyan dots (radius 3); pearls as pulsing pearl-white spheres (radius 8, pulse from the engine clock); Glowmaw as a luminous cyan-white orb (radius 15) with a soft halo (`shadowBlur`) and a wedge mouth that opens and closes (half-angle oscillating between 0.05 and 0.9 rad at about 12 Hz while moving, held at 0.35 rad while stopped), facing its heading, with one dark eye dot; drifters as jelly bells (dome plus a wavy skirt animated by the engine clock) in magenta (Hunter), green (Mirror) and yellow (Roamer) with two eyes looking along their heading; dazed drifters pale blue with a worried mouth, blinking white in the last 1.5 s; eyes-only state is two white eyes; the den door as a short magenta bar.

Conventions:

- All values are design values of this spec; the layout, speeds and scoring have no source. Every tuned number lives in `constants.ts`.
- Scoring:

| Event                                  | Points                                  |
| -------------------------------------- | --------------------------------------- |
| Mote                                   | +10                                     |
| Pearl                                  | +50                                     |
| Dazed drifter, n-th in one daze        | `100 * n` (100, 200, 300)               |
| Reef cleared (all 139 pellets eaten)   | +1000                                   |

  Max reachable per reef: 135 x 10 + 4 x 50 + 4 x (100 + 200 + 300) + 1000 = 4,950. Levels are capped at 99, so the absolute ceiling is about 490,000, far under the cap; `clampScore` caps at 10,000,000 anyway. Every increment is an integer.
- Movement: continuous, in px. Each frame the engine adds `dt` (clamped to `MAX_DT`) and advances every mover in sub-steps of at most `MAX_STEP` px. When a mover reaches or crosses a tile center in a sub-step it is snapped to the center and its direction is resolved there. Glowmaw: if the remembered direction is open it becomes the heading, else the heading continues if open, else Glowmaw stops. A reversal (remembered direction opposite to the heading) applies immediately, mid-tile. Drifters decide only at tile centers.
- Drifter direction rule: from the open directions that do not reverse (a reversal is allowed only when nothing else is open, or at the instant a daze starts), Hunter and Mirror choose the one whose next cell is closest in straight line to their target, ties broken in the order up, left, down, right; Roamer picks one at random; dazed drifters pick one at random. Eyes follow `buildDistanceField` toward the den cell (row 7, column 9), downhill. The den door is passable only for leaving drifters and eyes.
- Order inside each update: move Glowmaw, eat pellet, check reef clear (a clear wins over a contact on the same step), then move drifters, then check contacts.
- Timers (release, daze, rest, death, ready, clear) use the engine clock (sum of clamped `dt`), so they freeze while paused.
- Entities receive `ctx` as an argument to `draw(ctx)`; no module-level globals. Game state, including the eaten-pellet set, lives in the engine instance.
- Input: `keydown` listener on `window` using `e.code` (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `KeyW`, `KeyA`, `KeyS`, `KeyD`); `e.repeat` is ignored. `preventDefault` only for those keys while the engine runs and is not paused. `P` and `Esc` do nothing (pause is the platform button). Only `keydown` is used (the remembered direction, not held keys).
- The remembered direction is cleared on `pause()`, window `blur` and `visibilitychange` (hidden); the heading is kept.
- Callbacks fire only on change; `start()` fires the initial values (`onScore(0)`, `onLives(3)`, `onLevel(1)`). A life lost fires `onLives` at the moment of contact.
- `onGameOver` fires at most once per run (last life lost after its death animation, or `end()`); afterwards the engine stops updating and removes its key listeners.
- The score is an integer in 0 to 10,000,000, guaranteed by `clampScore`.
- No new `localStorage` keys; `lib/storage.ts` is unchanged.

## Implementation plan

Before step 1, read the relevant guides in `node_modules/next/dist/docs/` as required by `AGENTS.md` (only if a step touches pages or caching; this one normally does not). Invoke `/frontend-design` for the cover, the canvas art and the controls hint, per `CLAUDE.md`.

1. **Catalog entry.** Append `glowmaw` to `GAMES` in `lib/games.ts` with the temporary cover `cover-glot` (the new class comes in step 3). `npm run build` passes; `/games/glowmaw` and `/games/glowmaw/play` render with the fake player; Home mini cards unchanged; `chomper` unchanged.
2. **Migration.** Write `supabase/migrations/20261105180000_add_glowmaw_game.sql`, apply it with `apply_migration`, check `select * from games where id = 'glowmaw'` matches `lib/games.ts`, run `get_advisors`.
3. **Cover.** `.cover-glowmaw` in `app/globals.css` (designed with `/frontend-design`, cyan accent, deep-sea scene with a glowing orb mid-gulp, a trail of motes and two jelly silhouettes); set `cover: "cover-glowmaw"` in `lib/games.ts`. Library card and detail page show it.
4. **Constants and utils.** Write `lib/glowmaw/constants.ts` (table above, `MAZE_A`, palette) and `utils.ts`. `parseMaze(MAZE_A)` yields 135 motes, 4 pearls and the three start cells. `npm run build` passes.
5. **Entities.** `lib/glowmaw/entities.ts`: `Glowmaw`, `Drifter` (states `den`, `leaving`, `hunting`, `dazed`, `eyes`), `drawMaze`, `drawMotes`, drawing code for the art direction. `npm run lint` and `npm run build` pass.
6. **Engine.** `lib/glowmaw/engine.ts`: state reset, input, sub-stepped movement, warp, eating, drifter rules, release timers, daze and chain scoring, contacts, death and clear sequences, draw, rAF loop, callbacks, public API. `npm run lint` and `npm run build` pass; the folder imports nothing from `react` or `next`.
7. **Canvas wrapper.** `components/glowmaw-canvas.tsx`, mirroring `components/asteroids-canvas.tsx`, Strict-Mode safe (one live loop), latest callbacks in a ref.
8. **Registry and player wiring.** Add the `glowmaw` entry to `components/game-registry.tsx`. `END` uses `endSignal`; `onGameOver` sets `over`; PLAY AGAIN bumps `runId`. The other games behave as before (check the HUD of Snake and a fake game with a screenshot each).
9. **Controls hint.** Design the hint under the CRT with `/frontend-design` (reusing the registry `controls` rendering).
10. **Score walkthrough.** In `npm run dev` with Playwright (captures only in `.pwScreencaps/`): play to game over, SAVE SCORE, confirm the row in `scores`, on `/games/glowmaw` and in the Hall of Fame tab after a reload, at 1280px and 375px.
11. **Docs.** Update `CLAUDE.md` (engine location, callbacks, registry, catalog sync, no assets) and `references/GAMES.md` (new row and section). Run `npm run lint` and `npm run build`.

## Acceptance criteria

Generic:

- [ ] `npm run lint` and `npm run build` finish without errors.
- [ ] `lib/games.ts` contains `glowmaw` as the last entry with the listed values; other entries are unchanged; the Home still shows the same 6 mini cards.
- [ ] `select * from games where id = 'glowmaw'` matches `lib/games.ts` (`id`, `title`, `short`, `long`, `cat`, `cover`, `color`); the migration file matches what was applied; `get_advisors` shows no new warning.
- [ ] `/library` shows the card; clicking it goes to `/games/glowmaw`; PLAY goes to `/games/glowmaw/play`.
- [ ] `/games/glowmaw/play` shows a real canvas in the CRT frame and no auto-incrementing score.
- [ ] Score, lives and level in the HUD come from the engine.
- [ ] PAUSE freezes the game and shows the PAUSED overlay; RESUME continues with no jump; the remembered direction does not stay stuck after a pause.
- [ ] END opens the GAME OVER modal with the current score; `onGameOver` does not fire twice.
- [ ] Game keys do not scroll the page during play; typing a name with spaces in the modal input works (`A`, `S`, `D`, `W` are game keys only while running).
- [ ] SAVE SCORE inserts one row `{ game_id: "glowmaw", name, score }` into `scores`; the modal shows `SCORE SAVED_`; a double click inserts one row.
- [ ] The saved score appears in `/games/glowmaw` and in the Hall of Fame tab for this game after a reload, when it is above the lowest mock row.
- [ ] PLAY AGAIN starts a fresh run with initial values.
- [ ] EXIT or leaving the page stops the engine: no rAF loop and no `keydown` / `blur` / `visibilitychange` listener remains.
- [ ] In dev (React Strict Mode) only one loop runs: Glowmaw moves at 5.5 tiles/s, not double.
- [ ] At 375px width the canvas fits the CRT frame without horizontal scroll and keeps its ratio.
- [ ] Asteroids, Tetris, Arkanoid, Snake and the other games' play pages behave exactly as before.
- [ ] No new `localStorage` keys; `lib/storage.ts` is unchanged.
- [ ] `lib/glowmaw/` imports nothing from `react` or `next`.
- [ ] No text on the canvas or in the player is in Spanish.
- [ ] Reloading `/games/glowmaw/play` shows no React hydration warnings.

Game-specific:

- [ ] The canvas is 800x600 with a 19x15 grid of 40 px cells at origin (20, 0); `chomper` still shows the fake simulation.
- [ ] `parseMaze(MAZE_A)` finds 135 motes and 4 pearls; every non-wall cell is reachable from the start cell.
- [ ] `start()` fires Score `0`, Lives `3`, Level `1`; the HUD shows them. The Lines slot is not shown.
- [ ] A run starts with a `READY_TIME = 1.5` s freeze, Glowmaw on column 9, row 11, motionless until a direction key is pressed.
- [ ] `←` `↑` `→` `↓` and `W` `A` `S` `D` set the remembered direction; the turn happens at the next tile center where it is open; a 180 degree reversal applies at once; key auto-repeat is ignored; Glowmaw stops at a wall.
- [ ] Glowmaw moves at 5.5 tiles/s (220 px/s) and never leaves open cells; the mouth opens and closes while moving and rests half open while stopped.
- [ ] A mote gives +10 and a pearl +50, each eaten once; a cell is eaten when Glowmaw's center is within 10 px of its center.
- [ ] Hunter starts at column 9, row 5; Mirror starts in the den at column 9 and leaves at 4 s; Roamer starts in the den at column 10 and leaves at 8 s (after the READY freeze, on the engine clock).
- [ ] Hunter heads for Glowmaw's tile; Mirror heads for `(18 - col, 14 - row)` of Glowmaw's tile; Roamer takes random turns; no drifter reverses except at a dead end or at the start of a daze.
- [ ] Drifter speed is `min(5.3, 4.2 + 0.1 * (level - 1))` tiles/s: 4.2 at level 1, 5.3 from level 12, always slower than Glowmaw.
- [ ] Eating a pearl dazes every drifter outside the den for `max(2, 6 - 0.4 * (level - 1))` s (6 s at level 1, 2 s from level 11); dazed drifters reverse once, turn pale blue, move at 3 tiles/s at random junctions and blink during the last 1.5 s; eating another pearl restarts the timer and the chain count.
- [ ] Touching a dazed drifter (centers within 26 px) gives 100, then 200, then 300 within one daze; the drifter becomes eyes, returns to the den at 10 tiles/s, rests 1.5 s and leaves as a normal drifter.
- [ ] Touching a non-dazed drifter loses a life (`onLives` fires), plays a 1.2 s death animation (the mouth closes into a shrinking orb), then Glowmaw and the drifters return to their starts with release times restarted; eaten pellets stay eaten; a 1.5 s ready freeze follows.
- [ ] Losing the last life shows `Lives 0`, finishes the death animation and then fires `onGameOver` once with the final score.
- [ ] Drifters never enter the den door except when leaving or as eyes; Glowmaw never passes the door.
- [ ] Leaving the maze through column 0 of row 7 enters at column 18 and the reverse, for Glowmaw and for drifters, with no jump or flicker.
- [ ] Eating the 139th pellet flashes the maze for 1.2 s, gives +1000, raises the level by 1 (`onLevel`), refills the pellets, resets positions and starts a ready freeze; lives and score are kept. If a drifter touches Glowmaw on the same step as the last pellet, the clear wins and no life is lost.
- [ ] The level never goes above 99.
- [ ] Pausing during the death animation, a daze, the clear flash or the ready freeze freezes those timers; resuming continues them.
- [ ] END during the death animation or the clear flash fires `onGameOver` once.
- [ ] Score is an integer; `clampScore` caps it at 10,000,000.

## Decisions

- **Yes:** add `glowmaw` as a new catalog entry and leave the `chomper` placeholder unchanged. Agent decision (same approach as SPEC 09 and `serpentine`); replacing `chomper` is listed as an open question in the index.
- **Yes:** original game, not a clone: deep-sea orb with a cyan glow instead of a yellow disc, jelly drifters with three different rules (direct, mirror, random) instead of named ghost personalities, a pearl-and-eyes loop with linear chain scoring, a center-mirror target. Agent decision.
- **Yes:** map lives and level to the existing HUD slots; hide the Lines slot. Agent decision.
- **Yes:** single hand-designed maze, 19x15, symmetric, no dead ends, with a warp on row 7 and a central den. Agent decision; keeps the engine small.
- **Yes:** accent `cyan` and category ARCADE: fits the deep-sea look and there is no maze game. Agent decision.
- **Yes:** straight-line target rule for Hunter and Mirror, BFS only for eyes. Agent decision: simple, predictable, beatable.
- **Yes:** the remembered direction persists until another key is pressed. Agent decision: forgiving cornering without an input queue.
- **Yes:** draw everything in the main canvas with shapes; no assets. Agent decision.
- **No:** skins, themes, sound, music, level select, power-ups, extra lives, more mazes, streak scoring, touch controls, new `localStorage` keys. Not part of the lean variant (see v2 and v3).
- **Yes:** nothing in shared code changes except the registry entry. Agent decision.

## Risks

| Risk                                                                                                                   | Mitigation                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| React Strict Mode mounts effects twice in dev and can leave two loops or duplicate listeners.                          | `start()` is idempotent, `destroy()` removes everything; a criterion checks single speed in dev.                           |
| Global key listeners interfere with typing in the GAME OVER input (`W`, `A`, `S`, `D` are game keys).                  | Listeners and `preventDefault` are active only while running and not paused; after game over the listeners are removed.    |
| `GAMES` and the `games` table drift apart.                                                                             | The migration inserts the row with identical values; documented in `CLAUDE.md`.                                            |
| There is no reference code, so speeds, release times and scoring are untested design choices; the game may be too hard or too easy. | All tuned numbers live in `constants.ts`; the walkthrough plays real runs and the user can adjust them without touching the engine. |
| Tile-center turning with sub-steps can let a mover skip a center (tunneling) or jitter at corners.                     | `MAX_STEP = 8` px is far below a 40 px cell; movers snap to the center they cross; a criterion covers corners and the warp. |
| Straight-line chasing can make a drifter loop around a wall block forever.                                             | Accepted (it makes the game beatable); Mirror and Roamer add variety; speeds are tunable.                                  |
| The warp wrap can cause a one-frame teleport glitch.                                                                   | Wrap by adding or subtracting 760 px (maze width) when the center leaves 20..780; drawing uses the wrapped position only.  |
| The `chomper` placeholder and `glowmaw` are two maze-chase catalog entries that may confuse players.                   | Agent decision with a distinct title, cover and accent; replacing `chomper` is a future spec.                              |
| Score could exceed the database cap or be fractional.                                                                  | Every increment is an integer; the ceiling is about 490,000; `clampScore` caps it anyway.                                  |

## What is **not** in this spec

- Skins, themes, sound, music, level select, power-ups, bonus items, extra lives, more mazes, a fourth drifter, streak scoring.
- Replacing the `chomper` placeholder.
- Touch or gamepad controls, high-DPI rendering, real stats, Auth, server validation.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
