# SPEC 08 — Arkanoid game

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-04
> **Objective:** Port the vanilla-JS Arkanoid in `references/StarterGames/04-arkanoid/` to a TypeScript engine plus a React canvas component, add it to the catalog as a new entry `arkanoid`, and wire its score, lives and level into the platform HUD and the GAME OVER / SAVE SCORE flow, keeping power-ups, mouse control, level select, skins and sound effects.

## Why this spec exists

Two games are real today (`asteroids`, `tetris`); `brick-buster` and every other catalog game run the fake simulation (random score timer plus a fake arena). This spec makes the third real game. The registry from SPEC 07 already exists, so this spec only adds an entry, plus four small platform extensions the game needs: a generalized `appearance` (skins are no longer Tetris-typed), an engine `onSound` event with a platform sound hook and mute button, a level selector in the pause overlay, and a `levelRequest` prop. It follows the SPEC 05 pattern (engine under `lib/arkanoid/`, thin canvas wrapper, `GamePlayer` as host) and the SPEC 06 score flow (`games` row, `insertScore`, `useMergedScores`).

The reference is `index.html` + `game.js` (~660 lines, one global script) + `assets/spritesheet.js` (frame tables, loader, skin filter) + `assets/spritesheet-breakout.png` + `assets/sounds/*.mp3`. UI text is already English. One canvas, `#game`, 640x480 (4:3). There are no merge leftovers; `assets/.DS_Store` and `assets/sounds/.DS_Store` are ignored. The source also has `specs/01` and `specs/02`, which record the design intent used below. README and code differ in places; they are listed in Risks. The code wins.

## Scope

**In:**

- Catalog: new entry `arkanoid` appended after `tetris` in `GAMES`. The placeholder `brick-buster` stays unchanged and keeps the fake simulation (user decision).
- Full port of the gameplay in `game.js` (values copied unchanged):
  - 640x480 field, wall of 6 rows x 10 columns of 64x32 bricks starting at `y = 60`, row colors `red, yellow, cyan, magenta, hotpink, green`.
  - Paddle 100x12 at `y = 440`, speed 480 px/s; ball 16x16, base speed 320 px/s; 3 lives; 10 points per brick.
  - Ball sits on the paddle until launched (`Space` or click); paddle-angle bounce up to 60° from vertical; ball speed renormalized after every sub-step.
  - Endless levels from `generateLevel(level)` (seeded mulberry32, left-right symmetric, hole chance `min(0.5, (level - 1) * 0.1)`); clearing the wall goes to the next level and keeps score and lives; ball base speed `+5%` of 320 per level, capped at 2x.
  - **Power-ups** (user decision): 10% drop chance per destroyed brick; capsules fall at 120 px/s; types Triple ball (`T`), Complete bar (`B`, 10 s) and Frenzy (`F`, 2x ball speed, 10 s); max 6 balls; effects refresh when caught again and clear on life loss, level change and level select.
  - Sub-stepped ball movement (`MAX_STEP = 8` px) so fast balls do not tunnel.
  - Brick explosions: 4 frames over 150 ms.
- Pure TypeScript engine in `lib/arkanoid/` with no React and no Next.js imports.
- Client component `components/arkanoid-canvas.tsx` that owns the `<canvas>`, creates and destroys the engine.
- Registry: add an `arkanoid` entry to `components/game-registry.tsx`. `GamePlayer` dispatches through it; games not in the registry keep the fake simulation.
- Score, lives and level in the platform HUD come from the engine; PAUSE / RESUME pauses the engine; END ends the run; GAME OVER modal and SAVE SCORE (`insertScore`) work as in SPEC 06; PLAY AGAIN starts a new run.
- The canvas draws the playfield (bricks, paddle, balls, capsules, explosions, the complete bar) and the timers of the active timed power-ups (`BAR 7s`, `FRENZY 3s`). Score, lives, level, PAUSED and GAME OVER belong to the platform.
- Fixed **640x480** game coordinates (4:3, same ratio as `.crt-screen`), scaled by CSS.
- Input (keyboard and mouse, user decision): `←` `→` or `A` `D` move the paddle; the mouse over the canvas moves the paddle; `Space` or a click on the canvas launches the ball. Controls hint near the CRT.
- **Level select** (user decision): while the game is paused, the PAUSED overlay shows `LEVEL − 03 +` (range 1 to 99). Choosing a level restarts the wall at that level, clears effects and capsules, puts the ball back on the paddle, and keeps score and lives. The selector is platform UI, not canvas.
- **Skins** (user decision): `retro` (default), `pastel`, `neon`, made by filtering the spritesheet as in the source. A `SKIN: RETRO` button under the CRT cycles them live. In memory only. This needs the registry `appearance` to stop being Tetris-typed (see Data model).
- **Sound effects** (user decision): `ball-bounce.mp3` and `break-sound.mp3` copied to `public/game-assets/arkanoid/`. The engine emits `onSound("bounce" | "brick")`; the platform plays them. A `SOUND ON` / `SOUND OFF` button in the player HUD mutes them.
- In-game text in English (`BAR`, `FRENZY`, capsule letters `T B F`).
- Assets copied to `public/game-assets/arkanoid/` (spritesheet and the two sounds).
- Migration `supabase/migrations/<timestamp>_add_arkanoid_game.sql` that inserts the `games` row, applied with MCP `apply_migration`.
- New cover class `cover-arkanoid` in `app/globals.css` (designed with `/frontend-design`, visibly different from `cover-bricks`).
- Update `CLAUDE.md` with the engine location, the callbacks contract, the registry, the new platform pieces and the catalog sync.

**Out of scope (for future specs):**

- The source high score (`HI`, `localStorage` key `arkanoid:v1:highscore`, `newRecord`): SAVE SCORE and the leaderboard replace it.
- The source game-over screen (record line, "Press Space or click to play again", on-canvas skin picker with Left/Right) and restart key: replaced by the platform modal, PLAY AGAIN and the SKIN button.
- The source pause key `P` and the on-canvas pause menu (lives icons, active power-ups list, level selector drawn on canvas): the platform PAUSE button and the platform level selector replace them.
- The on-canvas HUD (`Score:`, `Level N`, lives icons, `HI:`): the platform HUD replaces it. The 60 px strip above the wall stays empty except for the power-up timers.
- Armored bricks, more power-ups, hand-made levels, a win screen.
- Remembering skin or mute between runs or visits; a volume slider; sounds for power-ups; music.
- Light theme (`appearance.themes` is `false` for this game).
- Touch or gamepad controls; any input not listed above.
- High-DPI canvas scaling and a responsive playfield size.
- Real game stats: `best` and `plays` stay mock fields.
- Supabase Auth, server client, rate limiting, anti-cheat (see the level select risk).
- Changes to other games, the Home, auth or the Hall of Fame layout. The only edits that touch Asteroids and Tetris code are the type widening of `skin` and the new optional props, with no behavior change.
- Automated tests (no test runner is configured).

## Data model

Catalog entry (the `Game` type is unchanged):

```ts
// lib/games.ts — appended to GAMES, after "tetris"
{
  id: "arkanoid",
  title: "ARKANOID",
  short: "Break the wall, catch the power-ups and keep the ball alive.",
  long: "Slide the paddle, bounce the ball and smash a wall of colored bricks. Falling capsules split the ball, add a safety bar or send it into a frenzy. Every level builds a new wall and the ball gets faster.",
  cat: "ARCADE",
  cover: "cover-arkanoid",
  color: "magenta",
  best: 0,
  plays: "0",
}
```

Engine public API:

```ts
// lib/arkanoid/engine.ts
export type ArkanoidSkin = "retro" | "pastel" | "neon";
export type ArkanoidSound = "bounce" | "brick";

export interface ArkanoidCallbacks {
  onScore: (score: number) => void; // when the score changes
  onLives: (lives: number) => void; // when the lives change
  onLevel: (level: number) => void; // when the level changes
  onSound: (sound: ArkanoidSound) => void; // each bounce / brick break, only while playing
  onGameOver: (finalScore: number) => void; // once per run
}

export interface ArkanoidOptions {
  skin?: ArkanoidSkin; // default "retro"
}

export class ArkanoidEngine {
  constructor(
    canvas: HTMLCanvasElement,
    callbacks: ArkanoidCallbacks,
    options?: ArkanoidOptions,
  );
  setSkin(skin: ArkanoidSkin): void; // redraws at once, also while paused or after game over
  setLevel(level: number): void; // level select: clamps to 1..99, ignored if equal to the current level or after game over; works while paused
  start(): void; // resets state, loads the spritesheet, attaches listeners, starts the rAF loop; idempotent
  pause(): void; // stops updating, clears held keys
  resume(): void; // continues without a time jump
  end(): void; // ends the run immediately and calls onGameOver once
  destroy(): void; // cancels rAF and removes every listener
}
```

Module layout:

| File                        | Contents                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/arkanoid/constants.ts` | `W = 640`, `H = 480`, `BRICK`, `ROW_COLORS`, `PADDLE`, `BALL`, `LEVEL`, `POWERUP`, `BAR`, `CAPSULE_STYLE`, `SKINS` (label + filter), `LEVEL_MIN = 1`, `LEVEL_MAX = 99`, `MAX_STEP`, `MAX_BOUNCE_ANGLE`, `START_LIVES`, `POINTS_PER_BRICK`, `MAX_DT = 1 / 30`, `SHEET_SRC`, `SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION` (tables below), `MAX_SCORE = 10_000_000` |
| `lib/arkanoid/utils.ts`     | `mulberry32`, `generateLevel`, `baseBallSpeed`, `clampScore`                                                                                                                                                                                                                                                                                                            |
| `lib/arkanoid/entities.ts`  | Types `Ball`, `Brick`, `Capsule`, `Explosion`; `createBricks(level)`; `SpriteSheet` class (per engine instance: `load`, `applySkin`, `drawSprite`, `drawFrame`, `destroy`); `drawBricks`, `drawBar`, `drawPaddle`, `drawBalls`, `drawExplosions`, `drawCapsules`, `drawTimers`, all receiving `ctx` as argument                                                         |
| `lib/arkanoid/engine.ts`    | `ArkanoidEngine`: input, state, update, collisions, power-ups, levels, draw, loop, callbacks                                                                                                                                                                                                                                                                            |

Constants copied from `game.js` lines 5 to 49 (`BRICK = { cols: 10, rows: 6, w: 64, h: 32, top: 60 }`, `PADDLE = { w: 100, h: 12, y: 440, speed: 480 }`, `BALL = { size: 16, speed: 320 }`, `LEVEL = { speedStep: 0.05, speedCapFactor: 2, holeChanceStep: 0.1, holeChanceMax: 0.5 }`, `POWERUP = { dropChance: 0.10, types: ["triple","bar","frenzy"], capsule: { w: 32, h: 16, fallSpeed: 120 }, tripleAngle: 25° in radians, maxBalls: 6, barDuration: 10, frenzyDuration: 10, frenzyFactor: 2 }`, `BAR = { y: 468, h: 8 }`, `CAPSULE_STYLE = { triple: T #2e86de, bar: B #27ae60, frenzy: F #e67e22 }`, `MAX_STEP = 8`, `MAX_BOUNCE_ANGLE = 60°`, `START_LIVES = 3`, `POINTS_PER_BRICK = 10`). Skin filters (`game.js` lines 32 to 36): `retro: "none"`, `pastel: "hue-rotate(20deg) saturate(0.55) brightness(1.25)"`, `neon: "hue-rotate(-30deg) saturate(2.2) contrast(1.2) brightness(1.1)"`. `dt` is capped at `1 / 30` s (`game.js` line 648). The bar color is `#7fd1ff`.

Sprite tables, copied from `assets/spritesheet.js` (all frames are 32x16 except the paddle and ball; the unused `gray` entries are dropped):

| Sprite          | `sx` | `sy` | `sw` | `sh` |
| --------------- | ---- | ---- | ---- | ---- |
| `paddle`        | 32   | 112  | 162  | 14   |
| `ball`          | 32   | 32   | 16   | 16   |
| block `red`     | 32   | 176  | 32   | 16   |
| block `cyan`    | 32   | 192  | 32   | 16   |
| block `green`   | 32   | 208  | 32   | 16   |
| block `magenta` | 32   | 224  | 32   | 16   |
| block `yellow`  | 32   | 240  | 32   | 16   |
| block `hotpink` | 32   | 256  | 32   | 16   |

Explosion frames: 4 per color, `sx` = 256, 288, 320, 352, same `sy` as the block of that color, `sw = 32`, `sh = 16`. `EXPLOSION_DURATION = 150` ms.

Sprite sheet (the source keeps this in module-level variables; the port moves it into an instance):

- `SpriteSheet.load(src, onDone)` loads `/game-assets/arkanoid/spritesheet-breakout.png`, copies it to an offscreen canvas (the original, kept for skins) and calls `onDone`. `applySkin(filter)`: `"none"` restores the original; otherwise it draws the original onto a new offscreen canvas with `ctx.filter = filter`, and does nothing when `ctx.filter` is unsupported. `drawSprite` / `drawFrame` draw nothing until the sheet is loaded.
- If the image fails to load, the engine logs `console.error("Failed to load spritesheet")` and runs with a fallback: bricks and explosions as `fillRect` in the row color, the paddle and the ball as white `fillRect`. (The source never starts the loop in that case; the fallback keeps the page usable.)
- `start()` begins loading and the loop only after the sheet is ready (or has failed); initial callbacks (`onScore(0)`, `onLives(3)`, `onLevel(1)`) fire in `start()` before that. `destroy()` before the load finishes must make the late `onload` a no-op.

HUD mapping:

| Platform HUD | Source game                                        | Callback  |
| ------------ | -------------------------------------------------- | --------- |
| Score        | `state.score`                                      | `onScore` |
| Lives        | `state.lives` (hearts replace the on-canvas icons) | `onLives` |
| Level        | `state.level`                                      | `onLevel` |

Registry entry and platform extensions:

```tsx
// components/game-registry.tsx
export interface GameCanvasProps {
  // ...existing props
  skin?: string; // was TetrisSkin; TetrisCanvas and ArkanoidCanvas narrow it with a guard and fall back to their default
  onSound?: (sound: string) => void; // new
  levelRequest?: { level: number; id: number }; // new: a change of `id` asks the engine to jump to `level`
}

export interface GameDefinition {
  // ...existing fields
  appearance?: { skins: { id: string; label: string }[]; themes: boolean }; // `id` was TetrisSkin
  sfx?: { sounds: Record<string, string>; volume: number }; // new
  levelSelect?: { min: number; max: number }; // new
}

arkanoid: {
  Canvas: ArkanoidCanvas,
  controls: [
    { keys: ["←", "→"], label: "MOVE" },
    { keys: ["MOUSE"], label: "PADDLE" },
    { keys: ["SPACE", "CLICK"], label: "LAUNCH" },
  ],
  stats: { lives: true, lines: false, level: true },
  appearance: {
    skins: [
      { id: "retro", label: "RETRO" },
      { id: "pastel", label: "PASTEL" },
      { id: "neon", label: "NEON" },
    ],
    themes: false,
  },
  sfx: {
    sounds: {
      bounce: "/game-assets/arkanoid/ball-bounce.mp3",
      brick: "/game-assets/arkanoid/break-sound.mp3",
    },
    volume: 1,
  },
  levelSelect: { min: 1, max: 99 },
}
```

Platform changes (all optional per registry entry; entries without the field behave exactly as before):

- **Skin typing.** `GamePlayer` stores `skin` as `string`, initialised from `appearance.skins[0].id` (Tetris and Arkanoid both start on `retro`). `appearance.themes === false` hides the THEME button (already so). The SKIN button cycles `appearance.skins` in order as today. `TetrisCanvas` keeps its `TetrisSkin` type internally and narrows the prop with a guard. No behavior change for Tetris.
- **Sound hook** `components/use-sound-effects.ts`: `useSoundEffects(sfx, { muted })` returns a stable `play(name)`. It creates the `Audio` objects lazily on the first `play` (that happens after the player launched the ball, so the autoplay policy is satisfied), plays a `cloneNode()` so fast hits overlap (as in `game.js` line 186), sets `volume = sfx.volume`, ignores a rejected `play()` promise, and does nothing while `muted` or when `sfx` is `undefined`. `GamePlayer` passes `onSound={play}` only when the definition has `sfx`.
- **Mute button.** The existing mute button in `.hud-actions` is rendered when the definition has `music` or `sfx`; it shares the `muted` state; its label is `MUSIC ON/OFF` when the entry has `music`, otherwise `SOUND ON/OFF`. It blurs itself after a click (already so).
- **Level selector.** When the definition has `levelSelect` and the game is paused, the PAUSED overlay shows, under the existing text, `LEVEL`, a `−` button, the level as two digits and a `+` button, and the line `CHANGING LEVEL RESTARTS THE WALL (SCORE AND LIVES KEPT)`. `−` is disabled at `min`, `+` at `max`. Each click sets `levelRequest = { level: clamp(engineLevel ± 1), id: previousId + 1 }`; `restart()` resets it to `undefined`. The buttons blur after a click. Designed with `/frontend-design`, readable at 375px.
- **`ArkanoidCanvas`** props: `paused`, `endSignal`, `onScore`, `onLives`, `onLevel`, `onSound`, `onGameOver`, `skin`, `levelRequest`. An effect on `levelRequest.id` calls `engine.setLevel(level)`; an effect on `skin` calls `engine.setSkin`.

Migration (`supabase/migrations/<timestamp>_add_arkanoid_game.sql`; the timestamp must be later than `20261105002355`):

```sql
insert into public.games (id, title, short, long, cat, cover, color) values
  ('arkanoid', 'ARKANOID', 'Break the wall, catch the power-ups and keep the ball alive.',
   'Slide the paddle, bounce the ball and smash a wall of colored bricks. Falling capsules split the ball, add a safety bar or send it into a frenzy. Every level builds a new wall and the ball gets faster.',
   'ARCADE', 'cover-arkanoid', 'magenta');
```

Conventions:

- Constants, formulas and values are copied from the source unchanged (`W = 640`, `H = 480`, `PADDLE.speed = 480`, `BALL.speed = 320`, `MAX_STEP = 8`, `POINTS_PER_BRICK = 10`, `dt` cap `1/30`).
- Scoring is copied from the source:

| Event                                      | Points |
| ------------------------------------------ | ------ |
| Destroy a brick                            | +10    |
| Catch a capsule, clear a wall, lose a life | 0      |

- Ball speed (px/s): `baseBallSpeed(level) = 320 * min(2, 1 + 0.05 * (level - 1))`: level 1 = 320, level 2 = 336, level 11 = 480, level 21 and above = 640. `currentBallSpeed()` = base, times 2 while Frenzy is active (not capped: up to 1280).
- Launch (`game.js` lines 112 to 121): `vx = (Math.random() * 2 - 1) * 0.3`, `vy = -1`, normalized to the current speed. Mode `ready` -> `playing`.
- Paddle bounce (lines 447 to 459): only when the ball moves down and overlaps the paddle; `hit = clamp((ballCenterX - paddleCenterX) / (PADDLE.w / 2), -1, 1)`, `angle = hit * 60°`, `vx = sin(angle) * speed`, `vy = -cos(angle) * speed`, ball placed at `PADDLE.y - BALL.size`.
- Walls and ceiling reflect; the bar (while `effects.bar > 0`) reflects a downward ball at `BAR.y`; a bottom miss (`y > H`) removes the ball. A life is lost only when the last ball is gone: `lives--`, `resetEffects()`, then `ready` with the ball on the paddle, or game over at 0 lives.
- Brick collision (lines 395 to 421): first overlapping alive brick, +10, explosion, drop roll, reflect on the axis of least penetration, one brick per sub-step.
- Drop roll: `Math.random() < 0.10`, then the type is `types[floor(Math.random() * 3)]`. The capsule is centered on the destroyed brick.
- Triple ball: copies of the **first** ball rotated by `+25°` and `-25°`, adding only as many as fit under 6 balls. Bar and Frenzy set their timer to 10 s (refresh when already active); Frenzy rescales every moving ball to the new speed, and again when it expires. Timers count down with `dt` only while `mode === "playing"` and not paused.
- `resetEffects()` (bar = 0, frenzy = 0, capsules cleared) runs on life loss, level change, level select and run start.
- Wall cleared (checked after every sub-step): `level++`, `resetEffects()`, new wall, `ready`, ball on the paddle, score and lives kept.
- `setLevel(n)` (replaces the source pause menu, lines 235 to 244): clamp to 1..99; same level or game over -> ignored; otherwise `level = n`, `resetEffects()`, new wall, explosions cleared, `ready`, ball on the paddle; `onLevel(n)` fires; the canvas is redrawn at once, also while paused.
- Explosions use the engine clock (milliseconds accumulated from the capped `dt`, advanced only in `update`) instead of `performance.now()` (`game.js` line 404), so they freeze while paused. This is the one intentional timing change.
- Entities receive `ctx` as an argument to `draw`; no module-level globals. Game state (bricks, balls, capsules, effects, paddle, mouse position, held keys, sprite sheet, clock) lives in the engine instance.
- Input is fed by `keydown` / `keyup` listeners on `window` and by `mousemove` / `mousedown` listeners on the canvas. Keys use `e.code`: `ArrowLeft` / `KeyA` and `ArrowRight` / `KeyD` set the held flags; `Space` launches the ball and ignores `e.repeat`. `preventDefault` only for those five codes while the engine runs and is not paused. `KeyP` and `Esc` do nothing.
- Mouse: `mousemove` stores `mouseX = (clientX - rect.left) * (W / rect.width)`; each update, if set, the paddle centers on it and `mouseX` resets to `null`, so the keyboard takes over until the mouse moves again (`game.js` lines 275 to 278). `mousedown` launches the ball when `ready`. Both are ignored while paused.
- Held keys are cleared on `pause()`, window `blur` and `visibilitychange` (hidden).
- Callbacks fire only on change; `start()` fires the initial values (`onScore(0)`, `onLives(3)`, `onLevel(1)`). `onSound` fires on every event and only from `update` (never while paused).
- Sound events: `"bounce"` on a side-wall, ceiling, paddle or bar bounce; `"brick"` on a brick break (`game.js` lines 403, 432 to 466).
- `onGameOver` fires at most once per run, from the last life lost or from `end()`; afterwards the engine stops updating and removes its key and mouse listeners. A final frame is drawn without balls, so the wall stays visible behind the modal.
- Randomness: the engine calls `Math.random()` in this order only: once at launch, once per destroyed brick for the drop roll, once more when a capsule drops for its type. Level layouts use the seeded `mulberry32(level)` (same generator, unchanged).
- The score is an integer in 0 to 10,000,000. Every increment is 10, so it is an integer by construction; `clampScore` caps it at 10,000,000 before `onScore` and `onGameOver`. See Risks.
- No new `localStorage` keys; `lib/storage.ts` is unchanged. The source key `arkanoid:v1:highscore` is not ported.

Canvas layout: the whole 640x480 canvas is the playfield (black background from the CSS class). The strip `y < 60` is empty except `BAR Ns   FRENZY Ns` timers, left-aligned at `x = 16, y = BRICK.top - 10`, bold 12px sans-serif white (the source text, `game.js` lines 556 to 563). Capsules: rounded rectangle (`roundRect` radius 8, fall back to `rect` when `roundRect` is not a function) with the white letter in bold 14px sans-serif, centered.

## Implementation plan

Before step 1, read the relevant guides in `node_modules/next/dist/docs/` as required by `AGENTS.md` (only if a step touches pages or caching; normally it does not). Invoke `/frontend-design` for the cover, the controls hint, the level selector, the SKIN and SOUND buttons, per `CLAUDE.md`.

1. **Catalog entry.** Append `arkanoid` to `GAMES` in `lib/games.ts` with the temporary cover `cover-bricks`. `npm run build` passes; `/games/arkanoid` and `/games/arkanoid/play` render with the fake player; the Home still shows the same 6 mini cards.
2. **Migration.** Write `supabase/migrations/<timestamp>_add_arkanoid_game.sql`, apply it with `apply_migration`, check with `execute_sql` that `select * from games where id = 'arkanoid'` matches `lib/games.ts`, run `get_advisors`. No type regeneration (data-only).
3. **Cover.** Add `.cover-arkanoid` in `app/globals.css` (magenta neon, paddle-ball-bricks motif) and switch the entry from `cover-bricks` to `cover-arkanoid`. The library card and the detail page show it.
4. **Assets.** Copy `assets/spritesheet-breakout.png`, `assets/sounds/ball-bounce.mp3` and `assets/sounds/break-sound.mp3` to `public/game-assets/arkanoid/` (copy, do not move). `http://localhost:3000/game-assets/arkanoid/spritesheet-breakout.png` returns `200` with `image/png`, and both MP3 files return `200` with an audio type.
5. **Constants and utils.** Create `lib/arkanoid/constants.ts` and `lib/arkanoid/utils.ts` with the values above. `npm run build` passes. Check in a scratch script that `generateLevel(1)` has 60 bricks, level 2 has 54, level 3 has 48, level 6 has 34, and every layout is left-right symmetric.
6. **Entities.** Create `lib/arkanoid/entities.ts` (types, `createBricks`, `SpriteSheet` with the failure fallback, draw functions). `npm run lint` and `npm run build` pass.
7. **Engine.** Create `lib/arkanoid/engine.ts`: state, input (keyboard and mouse), launch, paddle, sub-stepped ball movement and collisions, capsules and the three effects, levels, `setLevel`, `setSkin`, clock, draw, rAF loop with `dt` cap, callbacks on change, `onSound`, `start` / `pause` / `resume` / `end` / `destroy`. No `react` or `next` imports. `npm run lint` passes.
8. **Canvas wrapper.** `components/arkanoid-canvas.tsx` mirrors `components/asteroids-canvas.tsx`: engine created once in an effect, latest callbacks in a ref, `paused`, `endSignal`, `skin` and `levelRequest` effects, `<canvas width={640} height={480}>` with class `arkanoid-canvas` and `aria-label`. Add `.arkanoid-canvas` in `app/globals.css` like `.asteroids-canvas`. Strict-Mode safe: one live loop, and a late spritesheet `onload` after `destroy()` does nothing.
9. **Platform extensions.** In `components/game-registry.tsx`: widen `skin` to `string`, add `onSound`, `levelRequest`, `sfx`, `levelSelect`; add the `arkanoid` entry; narrow `skin` in `TetrisCanvas`. Create `components/use-sound-effects.ts`. In `GamePlayer`: skin state initialised from the definition, `onSound`, mute button label rule, level selector in the PAUSED overlay, `levelRequest` state reset by `restart()`. Result: `/games/asteroids/play`, `/games/tetris/play` and `/games/drop/play` look and behave as before (Tetris skin and theme buttons, music button, no level selector, no sound).
10. **Controls hint.** Registry `controls` for arkanoid as above, styled with the existing `.controls-hint`, wraps at 375px. Designed with `/frontend-design`.
11. **Score walkthrough.** In `npm run dev` with Playwright (captures only in `.pwScreencaps/`): play to game over, SAVE SCORE, confirm the row in `scores` with `execute_sql`, then on `/games/arkanoid` and in the Hall of Fame tab after a reload, at 1280px and 375px. Take screenshots of the 3 skins. Force power-ups by stubbing `Math.random` with `browser_evaluate` (for example a queue `[launch, 0.05, 0.5]` gives a drop of type `bar`; `0.05, 0.2` -> `triple`; `0.05, 0.9` -> `frenzy`). Check the sound by wrapping `HTMLMediaElement.prototype.play` with `browser_evaluate` and counting calls per source.
12. **Docs.** Update `CLAUDE.md` (engine location `lib/arkanoid/`, callbacks incl. `onLives` and `onSound`, `setSkin` / `setLevel`, the registry fields `sfx` and `levelSelect`, `appearance` no longer Tetris-typed, `useSoundEffects`, the mute button label rule, catalog sync with the `arkanoid` migration, the "`asteroids` and `tetris` are real games" line). Run `npm run lint` and `npm run build`.

## Acceptance criteria

Generic:

- [ ] `npm run lint` and `npm run build` finish without errors.
- [ ] `lib/games.ts` contains `arkanoid` as the last entry with the listed values; other entries are unchanged; the Home still shows the same 6 mini cards.
- [ ] `select * from games where id = 'arkanoid'` matches `lib/games.ts` (`id`, `title`, `short`, `long`, `cat`, `cover`, `color`); the migration file matches what was applied; `get_advisors` shows no new warning.
- [ ] `/library` shows the card; clicking it goes to `/games/arkanoid`; PLAY goes to `/games/arkanoid/play`.
- [ ] `/games/arkanoid/play` shows a real canvas in the CRT frame and no auto-incrementing score.
- [ ] Score, Lives and Level in the HUD come from the engine (hearts for lives).
- [ ] PAUSE freezes the game (ball, capsules, timers, explosions) and shows the PAUSED overlay; RESUME continues with no jump; keys held during pause do not stay stuck.
- [ ] END opens the GAME OVER modal with the current score; `onGameOver` does not fire twice.
- [ ] Game keys do not scroll the page during play; typing a name with spaces in the modal input works.
- [ ] SAVE SCORE inserts one row `{ game_id: "arkanoid", name, score }` into `scores`; the modal shows `SCORE SAVED_`; a double click inserts one row.
- [ ] The saved score appears in `/games/arkanoid` and in the Hall of Fame tab for this game after a reload, when it is above the lowest mock row.
- [ ] PLAY AGAIN starts a fresh run with initial values (score 0, lives 3, level 1, full 60-brick wall, ball on the paddle, no effects).
- [ ] EXIT or leaving the page stops the engine: no rAF loop and no `keydown` / `keyup` / `blur` / `visibilitychange` / canvas mouse listener remains.
- [ ] In dev (React Strict Mode) only one loop runs: ball speed is normal, not double.
- [ ] At 375px width the canvas fits the CRT frame without horizontal scroll and keeps its 4:3 ratio.
- [ ] Asteroids, Tetris and the other games' play pages behave exactly as before (HUD, controls hint, music button and skin / theme buttons of Tetris, fake simulation for the rest).
- [ ] No new `localStorage` keys; `lib/storage.ts` is unchanged.
- [ ] `lib/arkanoid/` imports nothing from `react` or `next`.
- [ ] No text on the canvas or in the player is in Spanish.
- [ ] Reloading `/games/arkanoid/play` shows no React hydration warnings.

Game-specific:

- [ ] The canvas is 640x480; the wall has 6 rows x 10 columns of 64x32 bricks starting at `y = 60`, row colors from top to bottom red, yellow, cyan, magenta, hotpink, green; the paddle is 100x12 at `y = 440`.
- [ ] A fresh page load starts with the `retro` skin; the HUD area under the CRT has a `SKIN: RETRO` button and no THEME button.
- [ ] Before the launch, the ball rests on the paddle center and follows it; `Space` or a click on the canvas launches it upward with `|vx / vy| <= 0.3`; holding `Space` does not relaunch.
- [ ] `ArrowLeft` / `KeyA` and `ArrowRight` / `KeyD` move the paddle at 480 px/s and stop at the walls; moving the mouse over the canvas centers the paddle on the cursor (also when the canvas is scaled by CSS); the keyboard takes over again after the mouse stops.
- [ ] The paddle bounce angle goes from 0° at the center to ±60° at the edges; the speed after every bounce equals `currentBallSpeed()`.
- [ ] Walls and ceiling reflect the ball; a ball below `y = 480` is removed.
- [ ] Each destroyed brick gives exactly +10 and shows a 4-frame explosion over 150 ms; one brick is destroyed per sub-step.
- [ ] Ball speed is 320 px/s at level 1, 336 at level 2, 480 at level 11 and 640 at level 21 and above.
- [ ] `generateLevel(1)` has 60 bricks, level 2 has 54, level 3 has 48; layouts are left-right symmetric and identical on every call for the same level.
- [ ] Clearing the last brick moves to the next level: Level in the HUD +1, ball back on the paddle, score and lives unchanged, effects and capsules cleared.
- [ ] Losing the last ball costs exactly one life (HUD hearts -1), clears effects and capsules, and puts the ball back on the paddle; losing the third life calls `onGameOver(finalScore)` once and the wall stays visible without balls behind the modal.
- [ ] With `Math.random` stubbed to force a drop, a capsule appears centered on the destroyed brick, falls at 120 px/s, shows the letter `T`, `B` or `F` on its color (`#2e86de`, `#27ae60`, `#e67e22`), and is removed when it leaves the canvas or touches the paddle. Capsules do not drop with the roll `>= 0.10`.
- [ ] Over 1000 brick breaks with the real `Math.random`, the number of drops is between 70 and 130 (checked in a scratch script that mirrors the roll, or by counting in the browser).
- [ ] Catching Triple ball with one ball gives 3 balls, the new ones at ±25° from the first at the same speed; the ball count never exceeds 6; losing one of several balls does not cost a life.
- [ ] Catching Complete bar draws a full-width bar (`#7fd1ff`, `y = 468`, height 8) for 10 s of play time; balls bounce on it with a `bounce` sound; the timer `BAR Ns` shows at the top left; catching it again resets the timer to 10 s.
- [ ] Catching Frenzy makes every ball move at twice the base speed for 10 s and back to normal after; `FRENZY Ns` shows at the top left; catching it again resets the timer; no ball passes through a brick, the paddle or the bar at 1280 px/s (level 21+ with Frenzy) in a 60-second run.
- [ ] The effect timers do not count down in `ready`, while paused, or after game over.
- [ ] The level selector shows only while paused: `LEVEL − NN +`, `−` disabled at 1 and `+` at 99. A click changes the level by 1: the wall is rebuilt for that level, effects and capsules are cleared, the ball returns to the paddle (`ready`), score and lives are unchanged, the HUD Level updates, and the canvas shows the new wall at once while still paused. Selecting the current level does nothing.
- [ ] After a level select, RESUME continues with the ball on the paddle waiting for the launch.
- [ ] SKIN cycles retro, pastel, neon and back; bricks, paddle, ball and explosions change color at once, without restarting or pausing the run, also while paused and after game over; the background, the bar and the capsules do not change. Retro draws the original sprites. In a browser without `ctx.filter` the button does nothing harmful.
- [ ] The skin survives PLAY AGAIN, resets to `retro` on reload, and no `localStorage` key is written.
- [ ] After clicking SKIN, SOUND or a level button, `Space` launches the ball and the arrows move the paddle; the button is not re-activated.
- [ ] A bounce plays `ball-bounce.mp3` and a brick break plays `break-sound.mp3`; fast hits overlap; nothing plays while paused or after game over.
- [ ] The HUD shows a `SOUND ON` button; one click mutes (label `SOUND OFF`, `aria-pressed="true"`, no `play()` calls), a second click unmutes. Reloading starts unmuted. PLAY AGAIN keeps the choice.
- [ ] `/games/asteroids/play`, `/games/tetris/play` (its button still says `MUSIC ON`) and the fake games load no arkanoid asset and create no sound `Audio`; they show no level selector.
- [ ] If the spritesheet fails to load (blocked in the browser), the game still runs with flat colored shapes and logs one console error.
- [ ] `P` and `Esc` do nothing in game (pause is the platform button).
- [ ] Key presses and clicks after game over do nothing and are not `preventDefault`ed.
- [ ] Score never exceeds 10,000,000 and is always an integer.

## Decisions

- **Yes:** append a new entry `arkanoid` (user decision) with its own `cover-arkanoid` and `games` row. `brick-buster` stays a fake game with its mock scores and Home card, as `drop` did when Tetris landed.
- **Yes:** registry entry only, no new registry. It already exists from SPEC 07.
- **Yes:** HUD mapping Score / Lives / Level, all three from the engine. Arkanoid has all three natively.
- **Yes:** keep power-ups (user decision): Triple ball, Complete bar and Frenzy with the source values.
- **Yes:** keep mouse paddle control and click to launch (user decision), listening on the canvas with CSS pixels mapped to the 640x480 space.
- **Yes:** keep the pause-menu level select (user decision) as platform UI in the PAUSED overlay, driven by `levelSelect` in the registry and `engine.setLevel()`. Reason: the engine canvas must not draw platform UI, and other games can reuse the field.
- **Yes:** keep skins retro / pastel / neon (user decision) and generalize `appearance` and `skin` to strings. Reason: the registry was typed to Tetris skins; a string id is the smallest change, and each wrapper narrows it.
- **Yes:** keep sound effects (user decision). The engine stays silent and emits `onSound`; the platform plays the files through `useSoundEffects`. Reason: same split as the music in SPEC 07 (engine free of audio, mute is a platform state).
- **Yes:** the mute button is shared between `music` and `sfx` entries, label chosen by the entry. Reason: one `muted` state, one button, no layout change for Tetris.
- **Yes:** the sound volume is `1` (the source plays at the default volume). Tunable in the registry without code changes.
- **Yes:** explosions run on the engine clock instead of `performance.now()` so a pause freezes them. The only intentional timing change.
- **Yes:** if the spritesheet fails to load, run with flat shapes instead of never starting (the source stays dead).
- **Yes:** assets go to `public/game-assets/arkanoid/` and the source folder in `references/` is untouched.
- **Yes:** scores are clamped to 10,000,000 in the engine before reaching `insertScore`.
- **Yes:** `lib/storage.ts`, `insertScore`, `useMergedScores` and the leaderboard are not changed.
- **No:** source high score and `localStorage` key, on-canvas HUD, game-over screen with skin picker, `P` pause key, on-canvas pause menu, restart key. Reason: the platform owns them; SAVE SCORE writes to Supabase.
- **No:** a light theme (no equivalent in the source) and a theme button.
- **No:** a dev hook to set `dropChance`. Reason: tests stub `Math.random`; the engine's random call order is part of the contract above.

## Risks

| Risk                                                                                                                                                                                                                                                          | Mitigation                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React Strict Mode mounts effects twice in dev and can leave two loops, duplicate listeners or a late image `onload` on a destroyed engine.                                                                                                                    | `start()` is idempotent, `destroy()` removes everything and flags the engine so a late `onload` is a no-op; a criterion checks single speed in dev.                                                                     |
| Global key listeners interfere with typing in the GAME OVER input (`A`, `D` and `Space` are game keys).                                                                                                                                                       | Listeners and `preventDefault` are active only while running and not paused; after game over the key and mouse listeners are removed.                                                                                   |
| `GAMES` and the `games` table drift apart.                                                                                                                                                                                                                    | The migration inserts the row with identical values; documented in `CLAUDE.md`.                                                                                                                                         |
| README and code differ: the README lists only arrows / A D / mouse and Space or click, and says nothing about power-ups, levels, pause (`P`), skins or the pause level select. The source `CLAUDE.md` says the game-over screen restarts with Space or click. | The code wins. This spec ports the code's behavior and lists every dropped piece. The source `CLAUDE.md` also says `EXPLOSION_FRAMES.gray` may be a placeholder; the gray entries are unused and dropped.               |
| Score can exceed the database cap or be fractional.                                                                                                                                                                                                           | Every increment is 10, so scores are integers. Reaching 10,000,000 needs at least 1,000,000 bricks (more than 16,000 full walls); `clampScore` caps it anyway.                                                          |
| Level select allows farming: breaking most of a wall, switching level and getting a fresh wall again, or lowering the level to slow the ball. Points per brick do not depend on the level.                                                                    | Accepted: no anti-cheat is in scope (the scores table is anonymous and free-text). Level select only changes the wall and ball speed, never the score. A later spec can disable it or limit it to a set number of uses. |
| Tunneling at Frenzy speed on high levels (up to 1280 px/s, 43 px per frame at `dt = 1/30`).                                                                                                                                                                   | Sub-steps of at most 8 px per collision check, as in the source; a criterion covers a 60-second run.                                                                                                                    |
| `ctx.filter` is not supported in some browsers (older Safari), so skins would do nothing.                                                                                                                                                                     | `applySkin` does nothing when unsupported; the game stays on Retro and is fully playable.                                                                                                                               |
| The canvas has a 60 px empty strip above the wall (the source HUD lived there).                                                                                                                                                                               | Kept so brick coordinates stay unchanged; the strip still hosts the power-up timers.                                                                                                                                    |
| The spritesheet and the two MP3 files are third-party assets of unknown license, and `break-sound` / `ball-bounce` play at full volume (the source default).                                                                                                  | The user supplied the files. Confirm the licenses before a public release; they are static assets and easy to swap. Volume lives in the registry `sfx.volume`.                                                          |
| Browsers block audio before a user gesture.                                                                                                                                                                                                                   | Sounds only occur after the player launched the ball (a key press or click); a rejected `play()` is caught and ignored.                                                                                                 |
| Fast hits can create many `Audio` clones.                                                                                                                                                                                                                     | The clips are short (a few KB); clones are garbage collected after playback; the engine fires at most a handful of events per frame.                                                                                    |
| Widening `skin` to `string` and adding props could regress Tetris or Asteroids.                                                                                                                                                                               | Criterion: both behave exactly as before; checked in step 9 and again in step 11.                                                                                                                                       |
| The level selector overlay and the canvas mouse listener compete for clicks.                                                                                                                                                                                  | The overlay (`.crt-content`, z-index 5) sits above the canvas, and the engine also ignores mouse input while paused.                                                                                                    |
| Browsers keep keyboard focus on a clicked button, so `Space` (launch) would re-click it.                                                                                                                                                                      | Every new button (SKIN, SOUND, level `−` / `+`) calls `e.currentTarget.blur()` after a click; a criterion checks it.                                                                                                    |
| `CanvasRenderingContext2D.roundRect` is missing in old browsers.                                                                                                                                                                                              | Fall back to `rect` when `roundRect` is not a function.                                                                                                                                                                 |

## What is **not** in this spec

- The source high score, on-canvas HUD, game-over screen, `P` pause key and on-canvas pause menu.
- A light theme, persisted skin or mute, a volume slider, sounds for power-ups, music.
- Armored bricks, more power-ups, hand-made levels, a win screen.
- Touch or gamepad controls, high-DPI rendering, a responsive playfield, real stats, Auth, server validation, anti-cheat for level select.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
