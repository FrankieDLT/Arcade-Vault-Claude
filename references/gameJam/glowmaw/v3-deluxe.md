# SPEC NN — Glowmaw game (v3 deluxe)

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 08, SPEC 09
> **Theme:** Pac-man (a character that opens and closes its mouth eating pellets in a simple maze while ghosts chase it)
> **Variant:** v3 deluxe (v2 plus a second maze, treasure shells with Surge and Shield power-ups, a timed Feast bonus level, sound effects and music), effort L
> **Date:** 2026-11-05
> **Objective:** Build a new original maze-chase game, Glowmaw (there is no reference code), as a TypeScript engine plus a React canvas component drawn with canvas shapes, add it to the catalog as a new entry `glowmaw`, and wire its score, lives and level into the platform HUD and the GAME OVER / SAVE SCORE flow, with a gulp-streak multiplier, two mazes, power-ups, Feast bonus levels, live skins, level select, sound effects and music.

## Why this spec exists

Four games are real today (`asteroids`, `tetris`, `arkanoid`, `snake`). The catalog has no maze-chase game: `chomper` is a catalog-only placeholder with the fake simulation (random score timer plus a fake arena). This spec adds a fifth real game, `glowmaw`, as a **new** entry; `chomper` stays untouched and keeps the fake simulation (agent decision, same approach as SPEC 09 with `serpentine`). The game is an original design: a luminous deep-sea orb gulps glowing motes in a coral maze while jelly drifters hunt it, the score loop rewards unbroken gulping through a streak multiplier, and treasure shells hand out power-ups. It follows the SPEC 05 pattern (engine under `lib/glowmaw/`, thin canvas wrapper, `GamePlayer` as host) and the SPEC 06 score flow. The registry from SPEC 07 already supports everything this variant needs (`appearance`, `levelSelect`, `sfx`, `music`), so the spec only adds an entry and needs no platform change.

There is no reference code. Every rule, number and maze is a design value of this spec, and all visuals are canvas shapes. Audio is **not** available in the repository: the sound effects and the music loop listed below are **to be supplied by the user** (see Decisions). Nothing is taken from any existing game's name, characters, art, music or levels.

## Scope

**In:**

- Catalog: new entry `glowmaw` appended after `snake` in `GAMES`, category ARCADE, accent `cyan`. `chomper` is not touched.
- Gameplay (all values are design decisions of this spec):
  - Two mazes of 19 columns x 15 rows of 40 px cells, canvas 800x600 (4:3, same ratio as `.crt-screen`), maze origin x = 20, y = 0. "Reef A" is used on odd levels and "Reef B" on even levels (layouts in Data model). Both share the same central den, door, Glowmaw start and a side warp on row 7. Reef A holds 135 motes and 4 pearls (139 pellets); Reef B holds 141 motes and 4 pearls (145 pellets).
  - Glowmaw (the player) starts on column 9, row 11, motionless, and moves continuously at 5.5 tiles/s once a direction key is pressed. A pressed direction is remembered and applied at the next tile center where that way is open; a 180 degree reversal applies at once. Glowmaw stops when the way ahead is a wall.
  - Eating: a mote gives `10 * multiplier`, a pearl gives +50. Cells are eaten when Glowmaw's center is within 10 px of the cell center.
  - **Twist, gulp streak:** each mote or pearl eaten within 0.6 s of the previous one extends the streak; the multiplier for the n-th link is `min(5, 1 + floor((n - 1) / 10))`. A gap longer than 0.6 s, a lost life or a new reef resets the streak. A pearl extends the streak but always scores its flat 50. The canvas shows a ring around Glowmaw that fills toward the next multiplier step and an `x2` to `x5` tag when the multiplier is above 1.
  - Three jelly drifters from level 1, a fourth from level 4. Hunter (targets Glowmaw's tile), Mirror (targets the tile opposite to Glowmaw through the maze center, `(18 - col, 14 - row)`), Roamer (random open direction at every junction) and Pacer (keeps the wall on its right: right turn, then straight, then left, then back, first one open). Hunter starts outside the den door at column 9, row 5; Mirror, Roamer and Pacer start in the den and leave 4 s, 8 s and 12 s after the reef starts.
  - Pearl: eating one dazes every drifter outside the den for `max(2, 6 - 0.4 * (level - 1))` s. Dazed drifters flee at random, move slower and can be eaten: the n-th eaten during one daze gives `100 * n` (100 to 400). An eaten drifter becomes eyes that rush back to the den, rest there 1.5 s and leave again as a normal drifter.
  - A non-dazed drifter touching Glowmaw (centers within 26 px) costs a life, unless Shield is active. After a short death animation, Glowmaw and the drifters return to their starts; eaten pellets stay eaten and power-ups are lost.
  - Warp: row 7 is open at both edges; leaving through one edge enters through the other (Glowmaw and drifters).
  - **Treasure shells:** after 45 and again after 90 pellets eaten in a reef, a shell appears on column 9, row 11 (Glowmaw's start cell) for 9 s (blinks the last 2.5 s). Eating it gives `SHELL_POINTS[min(level - 1, 5)]` = 100, 200, 300, 500, 700, 1000 and grants one random power-up (50% Surge, 50% Shield).
  - **Surge:** Glowmaw moves at x1.3 speed (7.15 tiles/s) for 6 s. **Shield:** a bubble around Glowmaw for up to 10 s that absorbs one drifter contact: the touching drifter is sent back to the den as eyes (no points), the bubble pops and no life is lost. Taking the same power-up again restarts its timer. Their timers are drawn on the canvas.
  - **Feast bonus level:** every third level (3, 6, 9, ...) is a Feast: no drifters, no pearls (the 4 pearl cells are motes), no shells, every mote worth a flat 20 (no streak), 45 s to eat everything. Eating all motes gives `50 * floor(secondsLeft)` and starts the next level; when the timer runs out the Feast simply ends with no bonus and no life lost. Feast on level 3 uses Reef A (139 motes), on level 6 Reef B (145 motes), alternating by level parity.
  - 3 lives at the start, an extra life at 10,000 points and then every 40,000 (50,000, 90,000, ...), at most 5 lives. The run ends when the last life is lost. Clearing a normal reef gives +1000, raises the level and refills the maze with drifters a little faster. Levels are endless up to 99.
- Pure TypeScript engine in `lib/glowmaw/` with no React and no Next.js imports.
- Client component `components/glowmaw-canvas.tsx` that owns the `<canvas>`, creates and destroys the engine.
- Registry: add a `glowmaw` entry to `components/game-registry.tsx` using `stats`, `appearance`, `levelSelect`, `sfx` and `music`. `GamePlayer` dispatches through it; games not in the registry keep the fake simulation.
- Score, lives and level in the platform HUD come from the engine; PAUSE / RESUME pauses the engine; END ends the run; GAME OVER modal and SAVE SCORE (`insertScore`) work as in SPEC 06; PLAY AGAIN starts a new run.
- The canvas draws only the playfield (maze, pellets, shell, Glowmaw, drifters, streak ring and tag) and in-game timers (`SURGE Ns`, `SHIELD Ns`, the Feast timer bar). Score, lives, level, PAUSED and GAME OVER belong to the platform.
- **Skins** (agent decision): `abyss` (default), `neon`, `coral`, via `appearance` with `themes: false`. A `SKIN: ABYSS` button cycles them live (also while paused). In memory only.
- **Level select** (agent decision): `levelSelect: { min: 1, max: 99 }`; while paused, `LEVEL - NN +` calls `engine.setLevel(level)`, which restarts the reef (and picks its maze and Feast status) at that level, keeping score and lives.
- **Sound effects** (to be supplied by the user): `sfx` with the events `gulp`, `pearl`, `bite`, `shell`, `death`. The engine only emits `onSound(name)`; the platform plays them.
- **Music** (to be supplied by the user): one looping track, volume 0.2, through the registry `music` field. The mute button is shown by the platform and reads `MUSIC ON/OFF`.
- Input: `←` `↑` `→` `↓` or `W` `A` `S` `D`. Controls hint near the CRT.
- In-game text in English (canvas text: the `x2` to `x5` tag, `SURGE Ns`, `SHIELD Ns`).
- Migration `supabase/migrations/20261105180000_add_glowmaw_game.sql` that inserts the `games` row, applied with MCP `apply_migration`.
- New cover class `cover-glowmaw` in `app/globals.css` (designed with `/frontend-design`).
- Update `CLAUDE.md` and `references/GAMES.md`.

**Out of scope (for future specs):**

- Light theme (`themes` is `false`; the three skins cover the look), more than two mazes, more power-ups, a boss or ending, two-player mode.
- Touch or gamepad controls; any input not listed above.
- High-DPI canvas scaling and a responsive playfield size.
- Remembering skin, level or mute between runs or visits.
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
export type GlowmawSkin = "abyss" | "neon" | "coral";

export interface GlowmawCallbacks {
  onScore: (score: number) => void; // when the score changes
  onLives: (lives: number) => void; // when the lives change (loss or extra life)
  onLevel: (level: number) => void; // when the level changes
  onSound?: (sound: "gulp" | "pearl" | "bite" | "shell" | "death") => void; // from update only
  onGameOver: (finalScore: number) => void; // once per run
}

export class GlowmawEngine {
  constructor(
    canvas: HTMLCanvasElement,
    callbacks: GlowmawCallbacks,
    options?: { skin?: GlowmawSkin },
  );
  start(): void; // resets state, attaches listeners, starts the rAF loop; idempotent
  pause(): void; // stops updating, clears the remembered direction
  resume(): void; // continues without a time jump
  end(): void; // ends the run immediately and calls onGameOver once
  destroy(): void; // cancels rAF and removes every listener
  setSkin(skin: GlowmawSkin): void; // redraws at once, also while paused or after game over
  setLevel(level: number): void; // clamps to 1..99, restarts the reef (maze, Feast) at that level, keeps score and lives, redraws at once; ignored after game over
}
```

Module layout:

| File                        | Contents                                                                                                                                                                                                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/glowmaw/constants.ts`  | Sizes, speeds, points, timers (table below), `MAZES` (`MAZE_A`, `MAZE_B`), `SHELL_POINTS`, `SKINS` (palettes), `MAX_SCORE = 10_000_000`                                                                                                                                                                                                           |
| `lib/glowmaw/utils.ts`      | `parseMaze(rows, feast)` (feast turns pearls into motes), `mazeForLevel(level)`, `isFeast(level)`, `isOpen(maze, col, row, canUseDoor)` (wraps columns on open edge cells), `neighbor`, `pickStraightLine`, `pickWallFollow`, `buildDistanceField(maze, target)` (BFS, door passable), `drifterSpeed(level)`, `dazeTime(level)`, `streakMultiplier(links)`, `shellPoints(level)`, `clampScore` |
| `lib/glowmaw/entities.ts`   | Types `Dir`, `Cell`, `DrifterKind`, `DrifterState`, `PowerUp`; classes `Glowmaw` and `Drifter` (`update(dt, ...)`, `draw(ctx, clock, palette)`), `Shell`; `drawMaze`, `drawMotes`, `drawStreak`, `drawTimers` receiving `ctx`                                                                                                                      |
| `lib/glowmaw/engine.ts`     | `GlowmawEngine`: input, state, sub-stepped movement, eating, streak, shells and power-ups, Feast mode, collisions, release timers, daze, death and level-clear sequences, extra lives, skin, `setLevel`, sound events, draw, loop, callbacks                                                                                                        |
| `public/game-assets/glowmaw/` | `gulp.mp3`, `pearl.mp3`, `bite.mp3`, `shell.mp3`, `death.mp3`, `reef-loop.mp3`: **to be supplied by the user** (no source file exists in `references/source-assets/`)                                                                                                                                                                         |

Maze layouts (19 columns, 15 rows; legend: `#` wall, `.` mote, `o` pearl, `_` empty floor, `-` den door (drifters only), `P` Glowmaw start, empty floor). Row 7 is open at columns 0 and 18 (the warp). Rows 6 to 8 are identical in both mazes.

```
Reef A (odd levels)               Reef B (even levels)
row  0  ###################       row  0  ###################
row  1  #........#........#       row  1  #o.......#.......o#
row  2  #o##.###.#.###.##o#       row  2  #.###.##...##.###.#
row  3  #.................#       row  3  #...#.........#...#
row  4  #.##.#.#####.#.##.#       row  4  #....#.#####.#....#
row  5  #....#.......#....#       row  5  #....#.......#....#
row  6  ####.#.##-##.#.####       row  6  ####.#.##-##.#.####
row  7  .....#.#___#.#.....       row  7  .....#.#___#.#.....
row  8  ####.#.#####.#.####       row  8  ####.#.#####.#.####
row  9  #....#.......#....#       row  9  #....#.......#....#
row 10  #.##.#.#####.#.##.#       row 10  #....#.#####.#....#
row 11  #........P........#       row 11  #...#....P....#...#
row 12  #o##.###.#.###.##o#       row 12  #.###.##...##.###.#
row 13  #........#........#       row 13  #o.......#.......o#
row 14  ###################       row 14  ###################
```

Counts: Reef A 135 motes + 4 pearls = 139 pellets; Reef B 141 motes + 4 pearls = 145 pellets. In a Feast the pearls are motes: 139 motes (A) or 145 motes (B). Den cells: row 7, columns 8, 9, 10. Hunter start: column 9, row 5. Mirror start: row 7, column 9. Roamer start: row 7, column 10. Pacer start: row 7, column 8. Leaving the den means: move to column 9, then up through the door at row 6 to row 5. Neither maze has dead ends.

Constants (`constants.ts`):

| Name                | Value           | Meaning                                                                       |
| ------------------- | --------------- | ----------------------------------------------------------------------------- |
| `COLS`, `ROWS`      | 19, 15          | Maze size in cells                                                            |
| `CELL`              | 40              | Cell size in px                                                               |
| `W`, `H`            | 800, 600        | Logical canvas size                                                           |
| `MAZE_X`, `MAZE_Y`  | 20, 0           | Maze origin in px                                                             |
| `PLAYER_SPEED`      | 5.5             | Glowmaw speed in tiles/s (220 px/s)                                           |
| `SURGE_FACTOR`      | 1.3             | Speed multiplier while Surge is active                                        |
| `SURGE_TIME`        | 6               | Surge seconds                                                                 |
| `SHIELD_TIME`       | 10              | Max Shield seconds                                                            |
| `DRIFTER_BASE`      | 4.2             | Drifter speed at level 1, tiles/s                                             |
| `DRIFTER_PER_LEVEL` | 0.1             | Added per level                                                               |
| `DRIFTER_MAX`       | 5.3             | Cap (reached at level 12); below `PLAYER_SPEED`, but Surge makes Glowmaw faster still |
| `DAZED_SPEED`       | 3.0             | Dazed drifter speed, tiles/s                                                  |
| `EYES_SPEED`        | 10              | Eaten drifter speed, tiles/s                                                  |
| `START_LIVES`       | 3               | Lives at the start                                                            |
| `MAX_LIVES`         | 5               | Cap for extra lives                                                           |
| `EXTRA_LIFE_FIRST`  | 10,000          | Score of the first extra life                                                 |
| `EXTRA_LIFE_STEP`   | 40,000          | Distance between later extra lives                                            |
| `RELEASE_TIMES`     | `[0, 4, 8, 12]` | Seconds from reef start (and after a death reset) per drifter                 |
| `FOURTH_LEVEL`      | 4               | First level with the Pacer                                                    |
| `DAZE_BASE`         | 6               | Daze seconds at level 1                                                       |
| `DAZE_STEP`         | 0.4             | Seconds removed per level                                                     |
| `DAZE_MIN`          | 2               | Minimum daze seconds (reached at level 11)                                    |
| `DAZE_BLINK`        | 1.5             | Dazed drifters blink during the last 1.5 s                                    |
| `DEN_REST`          | 1.5             | Seconds an eaten drifter rests in the den                                     |
| `STREAK_GAP`        | 0.6             | Max seconds between two eaten cells to keep the streak                        |
| `STREAK_STEP`       | 10              | Links per multiplier step                                                     |
| `MAX_MULT`          | 5               | Multiplier cap                                                                |
| `SHELL_AT`          | `[45, 90]`      | Pellets eaten in a reef at which a shell appears                              |
| `SHELL_LIFETIME`    | 9               | Shell seconds                                                                 |
| `SHELL_BLINK`       | 2.5             | Shell blinks during its last 2.5 s                                            |
| `SHELL_POINTS`      | `[100, 200, 300, 500, 700, 1000]` | Indexed by `min(level - 1, 5)`                              |
| `FEAST_EVERY`       | 3               | Every third level is a Feast                                                  |
| `FEAST_TIME`        | 45              | Feast seconds                                                                 |
| `FEAST_MOTE`        | 20              | Flat points per mote in a Feast                                               |
| `FEAST_TIME_BONUS`  | 50              | Points per whole second left when a Feast is cleared                          |
| `READY_TIME`        | 1.5             | Freeze at the start of a run and after each death, level change or `setLevel` |
| `DEATH_TIME`        | 1.2             | Death animation seconds                                                       |
| `CLEAR_TIME`        | 1.2             | Maze flash seconds after clearing a reef or a Feast                           |
| `EAT_RADIUS`        | 10              | px, to eat a pellet or a shell                                                |
| `KILL_RADIUS`       | 26              | px, drifter-Glowmaw contact                                                   |
| `MAX_STEP`          | 8               | Max px advanced per movement sub-step (also at Surge speed: 28.6 px per frame is split into 4 steps) |
| `MAX_DT`            | 0.1             | Frame `dt` clamp, seconds                                                     |
| `MAX_LEVEL`         | 99              | Level cap                                                                     |
| `MAX_SCORE`         | 10,000,000      | Score clamp                                                                   |

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
  appearance: {
    skins: [
      { id: "abyss", label: "ABYSS" },
      { id: "neon", label: "NEON" },
      { id: "coral", label: "CORAL" },
    ],
    themes: false,
  },
  levelSelect: { min: 1, max: 99 },
  // Only when the audio files exist (to be supplied by the user):
  music: { src: withBasePath("/game-assets/glowmaw/reef-loop.mp3"), volume: 0.2 },
  sfx: {
    sounds: {
      gulp: withBasePath("/game-assets/glowmaw/gulp.mp3"),
      pearl: withBasePath("/game-assets/glowmaw/pearl.mp3"),
      bite: withBasePath("/game-assets/glowmaw/bite.mp3"),
      shell: withBasePath("/game-assets/glowmaw/shell.mp3"),
      death: withBasePath("/game-assets/glowmaw/death.mp3"),
    },
    volume: 0.6,
  },
},
```

`GlowmawCanvas` props: `paused`, `endSignal`, `onScore`, `onGameOver`, `onLives`, `onLevel`, `onSound`, `skin` (narrowed with a guard, falls back to `abyss`), `levelRequest`. An effect on `skin` calls `engine.setSkin`; an effect on `levelRequest.id` calls `engine.setLevel(levelRequest.level)`.

Migration (`supabase/migrations/20261105180000_add_glowmaw_game.sql`; the timestamp is later than `20261105020551`):

```sql
insert into public.games (id, title, short, long, cat, cover, color) values
  ('glowmaw', 'GLOWMAW', 'Gulp the glowing motes and outswim the jelly drifters.',
   'Guide Glowmaw, a luminous orb with a big hungry mouth, through a coral maze and gulp every glowing mote. Jelly drifters hunt you down the corridors, but a pearl leaves them dazed and good to eat. Clear the reef to dive into a faster one.',
   'ARCADE', 'cover-glowmaw', 'cyan');
```

Art direction (canvas shapes only; exact hex values picked with `/frontend-design`, roles fixed): near-black navy background; walls as rounded dark-teal blocks with a glowing cyan outline; motes as small pale-cyan dots (radius 3); pearls as pulsing pearl-white spheres (radius 8); Glowmaw as a luminous cyan-white orb (radius 15) with a soft halo and a wedge mouth that opens and closes (half-angle 0.05 to 0.9 rad at about 12 Hz while moving, 0.35 rad while stopped), facing its heading, with one dark eye dot; drifters as jelly bells (dome plus a wavy skirt) with two eyes; dazed drifters pale blue with a worried mouth, blinking white in the last 1.5 s; eyes-only state is two white eyes; the den door as a short bar. The treasure shell is a scallop fan (radius 13) in gold with a small spark; the Shield is a translucent cyan ring bubble (radius 24) around Glowmaw; Surge adds a short trailing glow behind Glowmaw. The Feast timer is a thin bar along the top border row that drains from full to empty. The `SURGE Ns` and `SHIELD Ns` timers are small text over the top border row (left and right).

Skins (`SKINS` in `constants.ts`; roles are fixed, hex values are picked with `/frontend-design`):

| Skin    | Background / walls                                   | Pellets and shell                     | Glowmaw                          | Drifters (Hunter, Mirror, Roamer, Pacer)     |
| ------- | ---------------------------------------------------- | ------------------------------------- | -------------------------------- | -------------------------------------------- |
| `abyss` | near-black navy, dark-teal blocks, cyan outline      | pale cyan motes, pearl white, gold shell | cyan-white orb with cyan halo | magenta, green, yellow, silver               |
| `neon`  | pure black, no fill, bright page-token outlines with glow (`shadowBlur`) | `--yellow` motes, `--magenta` pearls, `--gold` shell | `--yellow` orb with strong glow | `--magenta`, `--cyan`, `--green`, `--silver` |
| `coral` | warm dark plum, coral-pink blocks, peach outline     | sand motes, cream pearls, amber shell | warm gold orb with peach halo    | teal, lilac, mint, sand                      |

Conventions:

- All values are design values of this spec; layouts, speeds and scoring have no source. Every tuned number lives in `constants.ts`.
- Scoring:

| Event                                      | Points                                                    |
| ------------------------------------------ | --------------------------------------------------------- |
| Mote (normal reef)                         | `10 * multiplier` (x1 to x5)                              |
| Pearl                                      | +50 (flat)                                                |
| Dazed drifter, n-th in one daze            | `100 * n` (100, 200, 300, 400)                            |
| Treasure shell                             | `SHELL_POINTS[min(level - 1, 5)]` (100 to 1000)           |
| Reef cleared (all pellets eaten)           | +1000                                                     |
| Mote in a Feast                            | +20 (flat)                                                |
| Feast cleared                              | `50 * floor(secondsLeft)` (0 to 2,200)                    |

  Max reachable per normal reef, assuming an unbroken streak (not actually possible): motes in Reef B `(100 + 200 + 300 + 400) + 101 x 10 x 5 = 6,050`, pearls 200, drifters 4 x 1,000 = 4,000, shells 2 x 1,000 = 2,000, clear 1,000, total 13,250. A Feast is at most 145 x 20 + 50 x 44 = 5,100. Levels are capped at 99, so the absolute ceiling is about 1,300,000, far under the cap; `clampScore` caps at 10,000,000 anyway. Every increment is an integer.
- Movement: continuous, in px. Each frame the engine adds `dt` (clamped to `MAX_DT`) and advances every mover in sub-steps of at most `MAX_STEP` px. When a mover reaches or crosses a tile center in a sub-step it is snapped to the center and its direction is resolved there. Glowmaw: if the remembered direction is open it becomes the heading, else the heading continues if open, else Glowmaw stops. A reversal applies immediately, mid-tile. Drifters decide only at tile centers.
- Drifter direction rule: from the open directions that do not reverse (a reversal is allowed only when nothing else is open, or at the instant a daze starts), Hunter and Mirror choose the one whose next cell is closest in straight line to their target, ties broken in the order up, left, down, right; Roamer picks one at random; Pacer uses `pickWallFollow`; dazed drifters pick one at random. Eyes follow `buildDistanceField` toward the den cell (row 7, column 9), downhill. The den door is passable only for leaving drifters and eyes.
- Order inside each update: move Glowmaw, eat pellet or shell (streak, power-up, extra-life check), check reef or Feast clear (a clear wins over a contact on the same step), then move drifters, then check contacts (Shield first).
- Timers (release, daze, rest, death, ready, clear, streak gap, shell, Surge, Shield, Feast) use the engine clock (sum of clamped `dt`), so they freeze while paused.
- Sound events are emitted only from `update`, never from `setSkin` or `setLevel`. `gulp` is emitted at most once per 0.08 s of engine time. A sound plays only if the registry entry has `sfx`; the engine is silent otherwise.
- Entities receive `ctx` as an argument to `draw(ctx)`; no module-level globals. Game state, including the eaten-pellet set, the streak, power-ups and the skin, lives in the engine instance.
- Input: `keydown` listener on `window` using `e.code` (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `KeyW`, `KeyA`, `KeyS`, `KeyD`); `e.repeat` is ignored. `preventDefault` only for those keys while the engine runs and is not paused. `P` and `Esc` do nothing (pause is the platform button). Only `keydown` is used.
- The remembered direction is cleared on `pause()`, window `blur` and `visibilitychange` (hidden); the heading is kept.
- Callbacks fire only on change; `start()` fires the initial values (`onScore(0)`, `onLives(3)`, `onLevel(1)`). `setLevel` fires `onLevel` only if the level changed.
- `onGameOver` fires at most once per run (last life lost after its death animation, or `end()`); afterwards the engine stops updating and removes its key listeners.
- The score is an integer in 0 to 10,000,000, guaranteed by `clampScore`.
- No new `localStorage` keys (mute stays in memory); `lib/storage.ts` is unchanged.

## Implementation plan

Before step 1, read the relevant guides in `node_modules/next/dist/docs/` as required by `AGENTS.md` (only if a step touches pages or caching; this one normally does not). Invoke `/frontend-design` for the cover, the skin palettes, the canvas art and the controls hint, per `CLAUDE.md`.

1. **Catalog entry.** Append `glowmaw` to `GAMES` in `lib/games.ts` with the temporary cover `cover-glot` (the new class comes in step 3). `npm run build` passes; `/games/glowmaw` and `/games/glowmaw/play` render with the fake player; Home mini cards unchanged; `chomper` unchanged.
2. **Migration.** Write `supabase/migrations/20261105180000_add_glowmaw_game.sql`, apply it with `apply_migration`, check `select * from games where id = 'glowmaw'` matches `lib/games.ts`, run `get_advisors`.
3. **Cover.** `.cover-glowmaw` in `app/globals.css` (designed with `/frontend-design`, cyan accent, deep-sea scene with a glowing orb mid-gulp, a trail of motes, a gold shell and jelly silhouettes); set `cover: "cover-glowmaw"` in `lib/games.ts`. Library card and detail page show it.
4. **Audio assets (user supplied).** Check that `public/game-assets/glowmaw/` holds `gulp.mp3`, `pearl.mp3`, `bite.mp3`, `shell.mp3`, `death.mp3` and `reef-loop.mp3` supplied by the user. If any file is missing, stop and report which; the registry `sfx` and `music` fields are added only for files that exist. Record in `CLAUDE.md` that the audio is third-party or user-made and that its license must be confirmed before a public release.
5. **Constants and utils.** Write `lib/glowmaw/constants.ts` (tables above, both mazes, `SHELL_POINTS`, `SKINS`) and `utils.ts`. `parseMaze(MAZE_A, false)` yields 135 motes and 4 pearls, `parseMaze(MAZE_B, false)` 141 and 4, `parseMaze(MAZE_B, true)` 145 motes and 0 pearls; `mazeForLevel(1)` is A and `(2)` is B; `isFeast(3)`, `(6)` true and `(4)` false; `streakMultiplier(11)` is 2. `npm run build` passes.
6. **Entities.** `lib/glowmaw/entities.ts`: `Glowmaw`, `Drifter` (kinds Hunter, Mirror, Roamer, Pacer; states `den`, `leaving`, `hunting`, `dazed`, `eyes`), `Shell`, `drawMaze`, `drawMotes`, `drawStreak`, `drawTimers`, drawing code for the art direction and the three palettes. `npm run lint` and `npm run build` pass.
7. **Engine.** `lib/glowmaw/engine.ts`: state reset, input, sub-stepped movement, warp, eating and streak, drifter rules, release timers, daze and chain scoring, shells, Surge and Shield, Feast mode, contacts, extra lives, death and clear sequences, sound events, `setSkin`, `setLevel`, draw (static maze pre-rendered to an offscreen canvas per maze and skin), rAF loop, callbacks, public API. `npm run lint` and `npm run build` pass; the folder imports nothing from `react` or `next`.
8. **Canvas wrapper.** `components/glowmaw-canvas.tsx`, mirroring `components/asteroids-canvas.tsx` and `components/arkanoid-canvas.tsx`, Strict-Mode safe (one live loop), latest callbacks in a ref, `skin` and `levelRequest` effects, `onSound` passthrough.
9. **Registry and player wiring.** Add the `glowmaw` entry (with `appearance`, `levelSelect`, and `music` / `sfx` for the files confirmed in step 4) to `components/game-registry.tsx`. `END` uses `endSignal`; `onGameOver` sets `over`; PLAY AGAIN bumps `runId`. The other games behave as before (check the HUD of Snake, Arkanoid and a fake game with a screenshot each).
10. **Controls hint.** Design the hint under the CRT with `/frontend-design` (reusing the registry `controls` rendering).
11. **Score walkthrough.** In `npm run dev` with Playwright (captures only in `.pwScreencaps/`): play to game over, SAVE SCORE, confirm the row in `scores`, on `/games/glowmaw` and in the Hall of Fame tab after a reload, at 1280px and 375px. Cycle the three skins and capture each; use level select to capture Reef B, a Feast (level 3 and 6) and a level with four drifters; capture a shell, Surge and Shield; toggle the mute button.
12. **Docs.** Update `CLAUDE.md` (engine location, callbacks, registry, skins, level select, power-ups, Feast, audio and license note, catalog sync) and `references/GAMES.md` (new row and section). Run `npm run lint` and `npm run build`.

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
- [ ] EXIT or leaving the page stops the engine: no rAF loop and no `keydown` / `blur` / `visibilitychange` listener remains, and the music stops.
- [ ] In dev (React Strict Mode) only one loop runs: Glowmaw moves at 5.5 tiles/s, not double.
- [ ] At 375px width the canvas fits the CRT frame without horizontal scroll and keeps its ratio.
- [ ] Asteroids, Tetris, Arkanoid, Snake and the other games' play pages behave exactly as before.
- [ ] No new `localStorage` keys; `lib/storage.ts` is unchanged.
- [ ] `lib/glowmaw/` imports nothing from `react` or `next`.
- [ ] No text on the canvas or in the player is in Spanish.
- [ ] Reloading `/games/glowmaw/play` shows no React hydration warnings.

Game-specific:

- [ ] The canvas is 800x600 with a 19x15 grid of 40 px cells at origin (20, 0); `chomper` still shows the fake simulation.
- [ ] Reef A parses to 135 motes and 4 pearls, Reef B to 141 motes and 4 pearls; every non-wall cell of both is reachable from the start cell; level 1 uses Reef A, level 2 Reef B, level 3 Reef A (Feast), and so on by parity.
- [ ] `start()` fires Score `0`, Lives `3`, Level `1`; the HUD shows them. The Lines slot is not shown.
- [ ] A reef starts with a `READY_TIME = 1.5` s freeze, Glowmaw on column 9, row 11, motionless until a direction key is pressed.
- [ ] `←` `↑` `→` `↓` and `W` `A` `S` `D` set the remembered direction; the turn happens at the next tile center where it is open; a 180 degree reversal applies at once; key auto-repeat is ignored; Glowmaw stops at a wall.
- [ ] Glowmaw moves at 5.5 tiles/s (220 px/s) and never leaves open cells, also at Surge speed (7.15 tiles/s); the mouth opens and closes while moving and rests half open while stopped.
- [ ] A pearl gives +50 flat and a mote gives `10 * multiplier`; each cell is eaten once; a cell is eaten when Glowmaw's center is within 10 px of its center.
- [ ] Streak: links 1 to 10 score x1, 11 to 20 x2, 21 to 30 x3, 31 to 40 x4, 41 and up x5; a gap over 0.6 s resets the streak; a pearl extends it; a lost life and a new reef reset it; the streak gap freezes while paused; the ring and the `x2` to `x5` tag follow it.
- [ ] Hunter starts at column 9, row 5; Mirror leaves the den at 4 s, Roamer at 8 s; from level 4 Pacer leaves at 12 s (reef clock, after the READY freeze). Levels 1 and 2 have three drifters.
- [ ] Hunter heads for Glowmaw's tile; Mirror heads for `(18 - col, 14 - row)` of Glowmaw's tile; Roamer takes random turns; Pacer prefers right, straight, left, back; no drifter reverses except at a dead end or at the start of a daze.
- [ ] Drifter speed is `min(5.3, 4.2 + 0.1 * (level - 1))` tiles/s: 4.2 at level 1, 5.3 from level 12.
- [ ] Eating a pearl dazes every drifter outside the den for `max(2, 6 - 0.4 * (level - 1))` s; dazed drifters reverse once, turn pale blue, move at 3 tiles/s at random junctions and blink during the last 1.5 s; another pearl restarts the timer and the chain count.
- [ ] Touching a dazed drifter gives 100, 200, 300, then 400 within one daze; the drifter becomes eyes, returns to the den at 10 tiles/s, rests 1.5 s and leaves as a normal drifter.
- [ ] Touching a non-dazed drifter without Shield loses a life (`onLives` fires), plays a 1.2 s death animation, then Glowmaw and the drifters return to their starts with release times restarted; eaten pellets stay eaten; the streak and all power-ups reset; a 1.5 s ready freeze follows.
- [ ] A shell appears on column 9, row 11 after the 45th and again after the 90th pellet eaten in a normal reef, lasts 9 s (blinks the last 2.5 s, freezes while paused) and then disappears; it never appears in a Feast; at most one shell is on the board.
- [ ] Eating a shell gives `SHELL_POINTS[min(level - 1, 5)]` (100 at level 1, 1000 from level 6) and grants Surge or Shield with equal probability.
- [ ] Surge lasts 6 s at x1.3 speed and shows `SURGE Ns`; Shield lasts up to 10 s, shows `SHIELD Ns`, and on a drifter contact removes the Shield, sends that drifter to the den as eyes for no points and costs no life; taking the same power-up while active restarts its timer; power-ups end on death and on a reef change.
- [ ] Every third level (3, 6, 9, ...) is a Feast: no drifters, no pearls (pearl cells are motes), no shell, motes score a flat 20 with no streak, the top bar drains over 45 s; clearing all motes gives `50 * floor(secondsLeft)` and starts the next level; at 0 s the Feast ends with no bonus and no life lost; Feast level 3 has 139 motes (Reef A) and level 6 has 145 (Reef B).
- [ ] Clearing a normal reef (all 139 or 145 pellets) flashes the maze 1.2 s, gives +1000, raises the level (`onLevel`), refills the pellets, resets positions and starts a ready freeze; if a drifter touches Glowmaw on the same step as the last pellet, the clear wins.
- [ ] Reaching 10,000 points gives one extra life, then another at 50,000, 90,000 and so on; lives never exceed 5.
- [ ] Losing the last life shows `Lives 0`, finishes the death animation and then fires `onGameOver` once with the final score.
- [ ] Drifters never enter the den door except when leaving or as eyes; Glowmaw never passes the door.
- [ ] Leaving the maze through column 0 of row 7 enters at column 18 and the reverse, for Glowmaw and drifters, in both mazes, with no jump or flicker.
- [ ] The level never goes above 99.
- [ ] While paused, `LEVEL - NN +` calls `setLevel`; the reef restarts at that level with the right maze and Feast status (for example level 6 is a Feast on Reef B), the streak and power-ups reset, score and lives are kept; the level is clamped to 1..99; `setLevel` after game over does nothing.
- [ ] SKIN cycles `ABYSS`, `NEON`, `CORAL` and redraws at once, also while paused; no THEME button is shown.
- [ ] Sound effects: `gulp` on a mote (at most once per 0.08 s), `pearl`, `bite` on a drifter eaten, `shell`, `death` on a lost life; none while muted or paused; none from `setSkin` or `setLevel`. Music plays while a run is active, stops on pause or game over, and the mute button reads `MUSIC ON/OFF`. (These two criteria apply only if the audio files were supplied; otherwise the registry entry has no `sfx` / `music` and there is no mute button.)
- [ ] Pausing during the death animation, a daze, a power-up, a Feast, the clear flash or the ready freeze freezes those timers; resuming continues them.
- [ ] END during the death animation or the clear flash fires `onGameOver` once.
- [ ] Score is an integer; `clampScore` caps it at 10,000,000.

## Decisions

- **Yes:** add `glowmaw` as a new catalog entry and leave the `chomper` placeholder unchanged. Agent decision (same approach as SPEC 09 and `serpentine`); replacing `chomper` is an open question in the index.
- **Yes:** original game, not a clone: deep-sea orb with a cyan glow, jelly drifters with four different rules, a gulp-streak multiplier, treasure shells with two power-ups, a timed Feast bonus level, a center-mirror target. Agent decision.
- **Yes:** the twist is the gulp streak, extended in v3 by shells (Surge and Shield) and Feast levels. Agent decision: more variety per run and more decisions per route.
- **Yes:** map lives and level to the existing HUD slots; hide the Lines slot. Agent decision.
- **Yes:** two hand-designed mazes alternating by level parity, sharing the den, start and warp, so the engine has a single set of spawn rules. Agent decision.
- **Yes:** fourth drifter (Pacer) from level 4 and extra lives at 10,000 then every 40,000 up to 5. Agent decision.
- **Yes:** skins `abyss`, `neon`, `coral` through `appearance`, `themes: false`. Agent decision: the platform already supports it; a light theme does not fit a deep-sea look.
- **Yes:** level select `{ min: 1, max: 99 }`. Agent decision; score and lives are kept, as in Arkanoid.
- **Yes:** sound effects and music, but the audio files are **to be supplied by the user**; no file exists in the repository. Agent decision: the registry fields are added only for files that exist (step 4), and the criteria that need audio are conditional. The engine itself stays silent.
- **No:** light theme, a third maze, more power-ups, touch controls, new `localStorage` keys, remembering mute or skin. Not requested; keeps the scope at L.
- **Yes:** accent `cyan` and category ARCADE: fits the deep-sea look and there is no maze game. Agent decision.
- **Yes:** straight-line target rule for Hunter and Mirror, BFS only for eyes. Agent decision.
- **Yes:** the remembered direction persists until another key is pressed. Agent decision.
- **Yes:** draw everything in the main canvas with shapes; the only files in `public/game-assets/glowmaw/` are audio. Agent decision.
- **Yes:** nothing in shared code changes except the registry entry. Agent decision.

## Risks

| Risk                                                                                                                       | Mitigation                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| React Strict Mode mounts effects twice in dev and can leave two loops, duplicate listeners or double music.                | `start()` is idempotent, `destroy()` removes everything; the music hook owns one `Audio` per mount; a criterion checks single speed.       |
| Global key listeners interfere with typing in the GAME OVER input (`W`, `A`, `S`, `D` are game keys).                      | Listeners and `preventDefault` are active only while running and not paused; after game over the listeners are removed.                      |
| `GAMES` and the `games` table drift apart.                                                                                 | The migration inserts the row with identical values; documented in `CLAUDE.md`.                                                             |
| The audio files do not exist, so sfx and music cannot be wired.                                                            | Step 4 stops and reports missing files; the registry fields are optional, so the game ships silent without them.                            |
| Supplied audio is third-party and its license is unknown.                                                                  | `CLAUDE.md` gets the same warning as the Tetris, Arkanoid and Snake assets: confirm the license before a public release.                    |
| There is no reference code, so speeds, release times, streak, power-up and Feast numbers are untested design choices.      | All tuned numbers live in `constants.ts`; the walkthrough plays real runs and the user can adjust them without touching the engine.        |
| Tile-center turning with sub-steps can let a mover skip a center (tunneling) or jitter at corners, worse at Surge speed.   | `MAX_STEP = 8` px is far below a 40 px cell; movers snap to the center they cross; a criterion covers corners, the warp and Surge.          |
| The warp wrap can cause a one-frame teleport glitch.                                                                       | Wrap by adding or subtracting 760 px (maze width) when the center leaves 20..780; drawing uses the wrapped position only.                   |
| Shield plus Surge could make a run nearly invulnerable.                                                                    | Shield absorbs one contact only and shells appear at most twice per reef; both timers are tunable.                                          |
| Level select could jump straight to Feast or high levels.                                                                  | Same behavior as Arkanoid (score is kept, no bonus for the jump); scores come from eaten pellets only. Accepted.                             |
| The Pacer wall-follow rule can loop in an isolated block, never reaching the player.                                       | Accepted: it is a nuisance, not the main hunter; it is dazed and eaten like the others.                                                     |
| `shadowBlur` and per-frame maze redraw cost on the neon skin.                                                              | The static maze is pre-rendered to an offscreen canvas per maze and skin (rebuilt on `setSkin` and maze change); only entities draw live.   |
| The `chomper` placeholder and `glowmaw` are two maze-chase catalog entries that may confuse players.                       | Agent decision with a distinct title, cover and accent; replacing `chomper` is a future spec.                                               |
| Score could exceed the database cap or be fractional.                                                                      | Every increment is an integer; the ceiling is about 1,300,000; `clampScore` caps it anyway.                                                 |

## What is **not** in this spec

- Light theme, a third maze, more power-ups, a boss or ending, two-player mode.
- Replacing the `chomper` placeholder.
- Remembering skin, level or mute between visits.
- Touch or gamepad controls, high-DPI rendering, real stats, Auth, server validation.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
