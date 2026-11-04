# SPEC 05 — Asteroids game

> **Status:** Implemented
> **Depends on:** SPEC 01
> **Date:** 2026-11-04
> **Objective:** Port the vanilla-JS canvas game in `references/StarterGames/02-asteroids/game.js` to a TypeScript engine plus a React canvas component, add it to the catalog as a new playable game `asteroids`, and wire it into the existing `GamePlayer` so its score, lives and level drive the platform HUD and the GAME OVER / SAVE SCORE flow.

## Why this spec exists

Today every game page (`/games/[id]/play`) runs the same fake simulation in `components/game-player.tsx`: a timer adds random points and nothing is playable. This spec makes the first real game. It also sets the pattern for later games: a framework-free engine under `lib/`, a thin client component that owns the canvas, and `GamePlayer` as the host that shows the HUD, pause, end and score-saving UI.

The reference game is a single file (`game.js`, ~600 lines, 800x600 canvas, Spanish text). `game_BACKUP_725.js`, `game_BASE_725.js`, `game_LOCAL_725.js`, `game_REMOTE_725.js` and `.game.js.swp` in the reference folder are merge leftovers; `game.js` is the source of truth.

## Scope

**In:**

- New catalog entry `asteroids` in `lib/games.ts`, appended **after** `pixel-duel` (so the Home's `GAMES.slice(0, 6)` mini cards do not change). The existing placeholder `rocks` stays as it is.
- Full port of the gameplay in `game.js`: ship (rotate, thrust, drag, wrap-around, respawn invincibility with blinking), bullets, asteroids in 3 sizes with splitting, the traced big-asteroid shape, particles, levels (`3 + level` asteroids), 3 lives, 2 s respawn timer, and all five power-ups (Bomb, Hyper, Shield, SlowMo, Triple) with the same constants, weights and durations.
- Pure TypeScript engine in `lib/asteroids/` with no React and no Next.js imports.
- Client component `components/asteroids-canvas.tsx` that owns the `<canvas>`, creates and destroys the engine, and exposes the engine to `GamePlayer` through props.
- `GamePlayer` integration for `gameId === "asteroids"`: the fake timer and the fake arena are replaced by the real canvas; score, lives and level in the existing HUD come from the engine; PAUSE / RESUME pauses the engine; END ends the run; the existing GAME OVER modal appears on game over (engine or END) with SAVE SCORE working through `addScore`; PLAY AGAIN starts a new run. All other games keep the current fake behavior.
- Canvas draws only the playfield and the active power-up timers (HYPERMODE, TRIPLE, SLOWMO). Score, level, lives icons and the GAME OVER overlay of the original are **not** drawn on the canvas; the platform HUD and modal replace them.
- Fixed 800x600 game coordinates, scaled by CSS to fill the existing `.crt-screen` (4:3) while keeping the aspect ratio.
- Keyboard input: `←` `→` rotate, `↑` thrust, `Space` fire. A small controls hint is shown near the CRT for this game.
- In-game text in English: `HYPERMODE`, `TRIPLE`, `SLOWMO`.
- New cover class `cover-asteroids` in `app/globals.css` (neon style, designed with `/frontend-design`).
- Update `CLAUDE.md` with the engine location and the `GamePlayer` dispatch.

**Out of scope (for future specs):**

- The "shooting star" asteroid mentioned in the reference README (it does not exist in `game.js`).
- UFOs or any enemy type not present in `game.js`.
- Touch or gamepad controls; any input other than the keyboard.
- Sound and music.
- High-DPI canvas scaling (`devicePixelRatio`) and a responsive playfield size (coordinates stay 800x600).
- Restarting with `Space` (restart goes through the platform's PLAY AGAIN button).
- Real game stats: `best` and `plays` stay mock fields; the leaderboard keeps its seeded rows plus `localStorage` scores (SPEC 01 behavior). No Supabase work.
- Changes to the existing placeholder `rocks`, to the Home, to auth, Hall of Fame or the other games.
- Automated tests (no test runner is configured).

## Data model

New catalog entry (the `Game` type is unchanged):

```ts
// lib/games.ts — appended to GAMES
{
  id: "asteroids",
  title: "ASTEROIDS",
  short: "Split rocks in zero gravity and survive the field.",
  long: "Your ship drifts in open space. Rotate, thrust and fire to break big asteroids into smaller ones before they hit you. Grab power-ups: Bomb, Hyper, Shield, SlowMo and Triple shot.",
  cat: "SHOOTER",
  cover: "cover-asteroids",
  color: "cyan",
  best: 0,
  plays: "0",
}
```

Engine public API:

```ts
// lib/asteroids/engine.ts
export interface AsteroidsCallbacks {
  onScore: (score: number) => void; // called when the score changes
  onLives: (lives: number) => void; // called when lives change
  onLevel: (level: number) => void; // called when the level changes
  onGameOver: (finalScore: number) => void; // called once per run when lives reach 0
}

export class AsteroidsEngine {
  constructor(canvas: HTMLCanvasElement, callbacks: AsteroidsCallbacks);
  start(): void; // resets state, attaches key listeners, starts the rAF loop; idempotent
  pause(): void; // stops updating and drawing progress, clears held keys
  resume(): void; // continues without a time jump
  end(): void; // ends the run immediately and calls onGameOver once
  destroy(): void; // cancels rAF and removes every listener
}
```

Module layout (new folder `lib/asteroids/`; not `lib/games/`, to avoid sitting next to `lib/games.ts`):

| File                         | Contents                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `lib/asteroids/constants.ts` | `W = 800`, `H = 600`, `RADII`, `SPEEDS`, `POINTS`, power-up constants, `POWERUP_TYPES`, `BIG_VARIANT` |
| `lib/asteroids/utils.ts`     | `wrap`, `dist`, `rand`, `randInt`, `rainbow`                                                          |
| `lib/asteroids/entities.ts`  | `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`, each with `update(dt)` and `draw(ctx)`           |
| `lib/asteroids/engine.ts`    | `AsteroidsEngine`: input, game state, update, draw, loop, callbacks                                   |

Conventions:

- Constants, formulas and values are copied from `game.js` unchanged (`RADII = [0, 16, 30, 50]`, `SPEEDS = [0, 85, 55, 32]`, `POINTS = [0, 100, 50, 20]`, `POWERUP_CHANCE = 0.1`, `dt` clamped to `0.05`, ship `DRAG = 0.987` applied per frame, and so on).
- **Scoring is copied from `game.js`:** size 1 (small) = 100, size 2 (medium) = 50, size 3 (big) = 20. This matches the reference README table.
- Entities receive the `CanvasRenderingContext2D` as an argument to `draw(ctx)`; there are no module-level globals. Game state lives in the engine instance, so two instances never share state.
- Input state (`keys`) lives in the engine and is fed by `keydown` / `keyup` listeners on `window`. `preventDefault` is called for the arrow keys and `Space` only while the engine is running and not paused.
- Held keys are cleared on `pause()`, on window `blur` and on `visibilitychange` (hidden).
- `onScore`, `onLives` and `onLevel` fire only when the value changes, not every frame. `start()` fires all three with the initial values (0, 3, 1).
- `onGameOver` fires at most once per run. After it fires the engine stops updating.
- The ship's remaining `hyper` and the `tripleTimer` survive `Ship.reset()` between levels, as in the original; `killShip` clears both.
- No new `localStorage` keys. Scores are saved with the existing `addScore({ game: "asteroids", ... })`.

`GamePlayer` integration:

- A game that has a real engine is chosen by `gameId` inside `GamePlayer` (`gameId === "asteroids"`). A generic registry is not introduced yet; the second real game will justify one.
- For `asteroids`: `score`, `lives` and `level` state come from the engine callbacks; the `setInterval` simulation and the `level = 1 + floor(score / LEVEL_STEP)` formula are not used.
- A run counter `runId` is used as the React `key` of `<AsteroidsCanvas>`, so PLAY AGAIN remounts it and creates a fresh engine.

## Implementation plan

Before step 1, read the relevant guides in `node_modules/next/dist/docs/` (client components, `cacheComponents`, `PageProps`) as required by `AGENTS.md`. Invoke `/frontend-design` for the cover (step 2) and for the controls hint and canvas styling (step 6), per `CLAUDE.md`.

1. **Catalog entry.** Append the `asteroids` object to `GAMES` in `lib/games.ts` with the temporary `cover` value `cover-rocas`. `npm run build` passes; `/games/asteroids` and `/games/asteroids/play` render (still with the fake player); the Home mini cards are unchanged.
2. **Cover.** Add `.cover-asteroids` to `app/globals.css` next to the other covers (asteroid outlines and a ship on dark space, neon palette). Change the entry's `cover` to `cover-asteroids`. The card in `/library` and the detail page show the new cover.
3. **Constants and utils.** Create `lib/asteroids/constants.ts` and `lib/asteroids/utils.ts`, ported from `game.js` with types. `BIG_VARIANT` is computed the same way. `npm run build` passes; nothing imports them yet.
4. **Entities.** Create `lib/asteroids/entities.ts` with `Bullet`, `Asteroid`, `Ship`, `Particle` and `PowerUp`. Ship input and the Triple multiplier are passed in (constructor options or `update` arguments), not read from globals. `npm run lint` and `npm run build` pass.
5. **Engine.** Create `lib/asteroids/engine.ts`: state, input, `update(dt)`, `draw()`, collision rules (bullet vs asteroid, ship vs asteroid with `a.radius * 0.82` and invincibility / hyper / shield rules, ship vs power-up), `nextLevel`, `detonateBomb`, `killShip`, rAF loop with clamped `dt`, callbacks, and the public API above. Remove the original HUD text, life icons and GAME OVER overlay; keep the power-up timers in English. `npm run lint` and `npm run build` pass.
6. **Canvas component.** Create `components/asteroids-canvas.tsx` (`"use client"`): a `<canvas width={800} height={600}>` styled to fill `.crt-screen` with the 4:3 ratio kept; a `useEffect` that creates the engine, calls `start()` and returns `destroy()`; props `paused`, `onScore`, `onLives`, `onLevel`, `onGameOver` and a way for the parent to call `end()` (e.g. a ref or an `endSignal` prop); an effect that calls `pause()` / `resume()` from `paused`. Safe under React Strict Mode (mount, unmount, mount creates one live loop only).
7. **Player wiring.** In `components/game-player.tsx`, when `gameId === "asteroids"`: render `<AsteroidsCanvas key={runId} ... />` instead of `.game-arena`; take `score`, `lives`, `level` from callbacks; `END` calls the engine's `end()`; `onGameOver` sets `over`; `restart()` increments `runId` and resets score 0, lives 3, level 1, `saved` false. Show the controls hint (`← →` ROTATE · `↑` THRUST · `SPACE` FIRE). Keep the PAUSED overlay. Other games render exactly as before. Manual check in `npm run dev` with Playwright, saving captures in `.pwScreencaps/`.
8. **Docs and polish.** Add to `CLAUDE.md` the engine location (`lib/asteroids/`), the callbacks contract and the `gameId` dispatch in `GamePlayer`. Run `npm run lint` and `npm run build`; walk through library, detail, play, game over, save score and Hall of Fame at 1280px and 375px.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish without errors.
- [ ] `lib/games.ts` contains `asteroids` as the last entry, with the values listed in the data model; `rocks` is unchanged.
- [ ] The Home still shows the same 6 mini cards (`brick-buster`, `drop`, `serpentine`, `chomper`, `invaders`, `rocks`).
- [ ] `/library` shows an ASTEROIDS card with the `cover-asteroids` cover; clicking it goes to `/games/asteroids`; PLAY goes to `/games/asteroids/play`.
- [ ] `/games/asteroids/play` shows a real canvas in the CRT frame with the ship in the center, 4 big asteroids moving, and no auto-incrementing score.
- [ ] `←` / `→` rotate the ship, `↑` thrusts (with flame), `Space` fires; holding `Space` fires at the original rate (0.2 s cooldown). Arrow keys and `Space` do not scroll the page during play.
- [ ] Ship, bullets and asteroids wrap around the edges; the ship blinks and ignores hits for the first 3 s.
- [ ] Destroying a size-3 asteroid adds 20 to the HUD score and spawns two size-2; size 2 adds 50 and spawns two size-1; size 1 adds 100 and spawns none.
- [ ] Clearing all asteroids increments the HUD level and spawns `3 + level` asteroids.
- [ ] A ship hit removes one life in the HUD (`♥`) and respawns the ship after about 2 s; the third hit opens the GAME OVER modal with the final score.
- [ ] Each of the five power-ups can drop (10% on asteroid destruction) and works as in the original: Bomb clears all asteroids and adds their points, Hyper makes the ship immune with faster rainbow fire for 10 s, Shield absorbs one hit for 5 s, SlowMo halves asteroid speed for 5 s, Triple fires 3 bullets 30° apart for 10 s; the canvas shows `HYPERMODE`, `TRIPLE` and `SLOWMO` timers while active.
- [ ] No text on the canvas or in the player is in Spanish.
- [ ] PAUSE freezes asteroids, bullets and timers and shows the PAUSED overlay; RESUME continues with no position jump; keys held during pause do not stay stuck.
- [ ] END opens the GAME OVER modal with the current score and stops the game; the engine's `onGameOver` does not fire a second time.
- [ ] In the modal, typing a name with spaces in the input does not fire bullets or get blocked; SAVE SCORE stores `{ game: "asteroids", score, name }` in `av_scores` and the score appears in the `/games/asteroids` leaderboard and in the Hall of Fame tab for ASTEROIDS.
- [ ] PLAY AGAIN starts a fresh run: score 0, lives 3, level 01, 4 asteroids, ship invincible.
- [ ] EXIT, and leaving the page by any link, stops the game: no `requestAnimationFrame` loop keeps running and no `keydown` / `keyup` / `blur` / `visibilitychange` listener from the engine remains (verify with `performance`/`getEventListeners` in the browser or by checking the engine stops updating).
- [ ] In dev (React Strict Mode) only one game loop runs: the ship moves at normal speed, not double.
- [ ] At 375px width the canvas fits the CRT frame without horizontal scroll and keeps the 4:3 ratio.
- [ ] Other games' play pages (e.g. `/games/drop/play`) behave exactly as before, including the fake timer score.
- [ ] No new `localStorage` keys; `lib/storage.ts` is unchanged.
- [ ] `lib/asteroids/` imports nothing from `react` or `next`.
- [ ] Reloading `/games/asteroids/play` shows no React hydration warnings in the browser console.

## Decisions

- **Yes:** add `asteroids` as a new catalog entry. Decided by the user. It avoids touching the existing `rocks` placeholder, its mock scores and Home rows.
- **No:** replacing or renaming `rocks`. Either would change SPEC 01 / 02 data; the user preferred a new game. The library will temporarily show two similar shooters; removing `rocks` is a future product decision.
- **Yes:** append `asteroids` at the end of `GAMES`. Keeps `GAMES.slice(0, 6)` on the Home unchanged.
- **Yes:** pure TS engine + thin React wrapper. Decided by the user. It keeps game logic out of React, makes pause / destroy explicit and can be reused by the next games.
- **No:** one big client component. Faster to write but hard to reuse and to clean up listeners correctly.
- **Yes:** engine reports score, lives and level to the platform HUD; the canvas draws only the playfield and power-up timers. Decided by the user. The existing GAME OVER modal and SAVE SCORE keep working without extra wiring.
- **No:** a second canvas HUD or a canvas GAME OVER overlay. Duplicated information and a second score-saving path.
- **Yes:** port everything in `game.js`, including all five power-ups. Decided by the user.
- **No:** the README's shooting star. It is not in the code and needs design decisions; it deserves its own spec.
- **Yes:** fixed 800x600 logic, CSS-scaled. Decided by the user. Physics and balance stay identical to the original while the canvas fits the CRT on small screens.
- **No:** `devicePixelRatio` handling. Lines may look soft on high-DPI screens; accepted for this spec.
- **Yes:** keyboard only, restart through PLAY AGAIN. Decided by the user. `Space` is also used to type in the modal input, so a Space restart would conflict with the platform UI.
- **Yes:** scoring values from `game.js` (big 20, medium 50, small 100), which match the reference README table. The code is the source of truth if they ever differ.
- **Yes:** `lib/asteroids/` as the engine folder. `lib/games/` would sit beside the existing `lib/games.ts` and make `@/lib/games` ambiguous to read.
- **Yes:** dispatch by `gameId === "asteroids"` inside `GamePlayer`. A registry for one real game is premature.
- **Yes:** `best: 0`, `plays: "0"` for the new card. No invented stats for a game nobody has played yet.

## Risks

| Risk                                                                                                                                       | Mitigation                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| React Strict Mode mounts effects twice in dev, which can leave two loops or duplicate key listeners.                                       | `start()` is idempotent and `destroy()` removes everything; acceptance criterion checks single-speed movement in dev.            |
| Global key listeners interfere with typing in the GAME OVER input (`Space`, arrows).                                                       | Listeners and `preventDefault` are active only while the engine runs and is not paused; the engine stops before the modal opens. |
| The original uses module globals (`tripleTimer`, `slowTimer`) that survive `ship.reset()`; moving them into instances can change behavior. | Keep them as engine fields, not ship fields, and cover Triple / Hyper carry-over between levels in the manual walkthrough.       |
| The leaderboard of the new game shows seeded mock scores (hundreds of thousands) while `best` is `0`.                                      | Accepted as SPEC 01 mock behavior; replacing mock data with real data is a future (Supabase) spec.                               |
| Canvas CSS scaling blurs lines on high-DPI screens.                                                                                        | Accepted; a future spec can add `devicePixelRatio` scaling.                                                                      |
| Reference README mentions a shooting star that `game.js` does not implement.                                                               | Code wins; the shooting star is out of scope (documented in Scope and Decisions).                                                |
| `cacheComponents` rules for the play page and client components.                                                                           | No page changes are planned; `AsteroidsCanvas` is a client component imported by an existing client component.                   |

## What is **not** in this spec

- The shooting-star asteroid, UFOs or any new enemy.
- Touch controls, gamepad support, sound or music.
- High-DPI canvas rendering or a responsive playfield size.
- Real stats, Supabase scores or leaderboard persistence.
- Removing or changing the `rocks` placeholder.
- A game registry or engine interface shared by all games.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
