# SPEC 16 — Space Invaders game

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 06, SPEC 10, SPEC 11, SPEC 13
> **Date:** 2026-11-10
> **Objective:** Build a simple Space Invaders as a TypeScript engine plus a React canvas component, add it to the catalog as a new entry `space-invaders`, and wire its score, lives and level into the platform HUD and the GAME OVER / SAVE SCORE flow.

## Why this spec exists

The catalog already has `invaders`, a fake-simulation placeholder in category `SHOOTER`. This spec adds a real game as a **new** entry `space-invaders` and leaves `invaders` untouched (same pattern as `snake` / `serpentine` and `pong` / `pixel-duel`).

"Simple" means the core loop only: a grid of invaders that marches, speeds up and descends, one cannon, endless waves. Shields and the mystery ship are deliberately left out.

There is no reference code. The rules and numbers below are designed in this spec and tuned in play. This spec needs no new registry field and no change to `GamePlayer`: every feature it uses (`stats`, `levelSelect`, `appearance`, `sfx`, `touch`) already exists.

## Scope

**In:**

- Catalog: new entry `space-invaders` appended after `pong` in `GAMES`, category `SHOOTER`. `invaders` is not touched.
- Playfield: canvas 800x600 (4:3). The cannon moves left and right along the bottom. A grid of 11 columns x 5 rows of invaders marches sideways, steps down at each edge and speeds up as invaders die.
- Player: one cannon, 3 lives, one bullet on screen at a time.
- Invaders: drop bombs at random. A bomb that hits the cannon costs 1 life.
- Waves: clearing every invader starts the next wave (level + 1) with a faster march and lower start row. Waves are endless.
- Scoring: invader points by row, plus a wave-clear bonus. Score is an integer, clamped to 10,000,000.
- End of run: the run ends when lives reach 0, or when any invader reaches the cannon row (immediate game over, regardless of lives), or on END.
- Platform HUD: Score, Lives and Level show; the Lines slot is hidden.
- Level select in the PAUSED overlay (existing `levelSelect`).
- Controls (desktop): `←` `→` / `A` `D` move, `Space` fires (holding `Space` fires again as soon as the previous bullet is gone).
- Controls (touch, below 768px and when the GamePad menu turns the pad on): `left` / `right` hold buttons move, `A` fires (hold). Other slots unmapped.
- Haptics through existing patterns only: `death` (life lost), `clear` (wave cleared). The existing `tap` and `gameover` haptics apply as for every game.
- Sound effects (volume `0.2`, existing `sfx` field and `useSoundEffects`): `shoot`, `hit` (invader destroyed), `boom` (cannon destroyed), `gameover`. Four `.wav` files generated for this spec (own audio, no licensing) in `public/game-assets/space-invaders/`. The mute button under the CRT is the only sound toggle (no `pauseToggle`).
- Skins: `retro` (default), `neon`, `pastel`, `gothic`, `negative`, through the existing `appearance` field with `themes: false`. In memory only.
- Pure TypeScript engine in `lib/space-invaders/` with no React and no Next.js imports.
- Client component `components/space-invaders-canvas.tsx`.
- Migration inserting the `games` row, applied with MCP `apply_migration`.
- New cover class `cover-space-invaders` in `app/globals.css`, designed with `/frontend-design`.
- Update `CLAUDE.md` and `references/GAMES.md`.
- Frame-time check with the SPEC 12 method (`references/perf/measure-fps.md`), result logged in `references/perf/perf-log.md`.

**Out of scope (for future specs):**

- Destructible shields, the mystery ship (UFO), different invader types with different shot patterns, boss waves.
- Extra lives by score, power-ups, two-player mode.
- Background music, a volume slider, a pause-menu sound toggle, and sounds beyond the four listed (invader step, UFO).
- Sprite sheets or any image asset: all drawing is canvas shapes.
- Light theme (`themes: false`), difficulty select, game modes.
- Remembering skin or the level choice between runs or visits.
- High-DPI canvas scaling.
- Real game stats: `plays` stays a mock field.
- Changes to `invaders`, other games, the Home, auth, the Hall of Fame layout, `GamePlayer` or the registry types.
- Automated tests (no test runner is configured).

## Data model

Catalog entry (the `Game` type is unchanged). Final `color` is picked with `/frontend-design`; it must be valid in the existing `Game` color union and different from `invaders` (`green`).

```ts
// lib/games.ts — appended to GAMES, after "pong"
{
  id: "space-invaders",
  title: "SPACE INVADERS",
  short: "Hold the line. Stop the invasion.",
  long: "A fleet of invaders marches down the screen, faster with every ship you destroy. Move your cannon, shoot them one by one and dodge their bombs. Clear the wave to face a faster one. If they land, it is over.",
  cat: "SHOOTER",
  cover: "cover-space-invaders",
  color: "cyan", // placeholder: verify it exists in the Game color union
  plays: "0",
}
```

Engine public API:

```ts
// lib/space-invaders/engine.ts
export type SpaceInvadersSkin =
  "retro" | "neon" | "pastel" | "gothic" | "negative";

export interface SpaceInvadersCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void; // once per run
  onSound?: (name: "shoot" | "hit" | "boom" | "gameover") => void;
  onHaptic?: (name: "death" | "clear") => void;
}

export class SpaceInvadersEngine {
  constructor(
    canvas: HTMLCanvasElement,
    callbacks: SpaceInvadersCallbacks,
    options?: { skin?: SpaceInvadersSkin },
  );
  start(): void; // resets state, attaches listeners, starts the rAF loop; idempotent; fires onScore(0), onLives(3), onLevel(1)
  pause(): void; // stops updating, clears held keys
  resume(): void; // continues without a time jump
  end(): void; // ends the run now and calls onGameOver once
  destroy(): void; // cancels rAF, removes every listener
  setSkin(skin: SpaceInvadersSkin): void; // redraws at once, also while paused or after game over
  setLevel(level: number): void; // restarts the wave at that level, keeps score and lives; clamps 1..99; ignored after game over
}
```

Internal state (not exported):

```ts
interface Invader {
  col: number; // 0..10
  row: number; // 0..4, row 0 is the top row
  alive: boolean;
}

interface Bullet {
  x: number;
  y: number; // top of the shot, px
}

interface State {
  invaders: Invader[]; // 55 entries
  fleetX: number; // left edge of the grid, px
  fleetY: number; // top edge of the grid, px
  dir: 1 | -1; // march direction
  stepTimer: number; // seconds until the next march step
  cannonX: number; // cannon center, px
  shot: Bullet | null; // the player's single bullet
  bombs: Bullet[]; // invader bombs, at most MAX_BOMBS
  bombTimer: number; // seconds until the next bomb attempt
  respawnIn: number; // seconds of cannon respawn pause after a hit, 0 = playing
  score: number;
  lives: number;
  level: number;
  over: boolean;
}
```

Module layout:

| File                              | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/space-invaders/constants.ts` | `W = 800`, `H = 600`, `COLS = 11`, `ROWS = 5`, `INVADER_W = 32`, `INVADER_H = 24`, `PITCH_X = 48`, `PITCH_Y = 40`, `STEP_X = 16`, `STEP_DOWN = 24`, `FLEET_MARGIN = 20`, `CANNON_W = 44`, `CANNON_H = 22`, `CANNON_Y = 540`, `CANNON_SPEED = 360`, `SHOT_SPEED = 600`, `BOMB_SPEED = 240`, `MAX_BOMBS = 3`, `START_LIVES = 3`, `RESPAWN_DELAY = 1.2`, `ROW_POINTS = [30, 20, 20, 10, 10]`, `WAVE_BONUS = 100`, `MAX_DT = 0.05`, `MAX_STEP = 8`, `MAX_SCORE = 10_000_000`, `SKINS` |
| `lib/space-invaders/utils.ts`     | `clampScore`, `stepInterval(alive, level)`, `bombInterval(level)`, `fleetStartY(level)`, `lowestAliveInColumn(invaders, col)`, `rectsOverlap`                                                                                                                                                                                                                                                                                                                                     |
| `lib/space-invaders/entities.ts`  | Types `Invader`, `Bullet`; `drawInvader` (two march frames), `drawCannon`, `drawShot`, `drawBomb`, `drawGround`, all receiving `ctx` as argument                                                                                                                                                                                                                                                                                                                                  |
| `lib/space-invaders/engine.ts`    | `SpaceInvadersEngine`: input, state, update, collisions, wave logic, draw, loop, callbacks                                                                                                                                                                                                                                                                                                                                                                                        |

HUD mapping:

| Platform HUD | Source        | Callback  |
| ------------ | ------------- | --------- |
| Score        | `state.score` | `onScore` |
| Lives        | `state.lives` | `onLives` |
| Lines slot   | hidden        | none      |
| Level        | `state.level` | `onLevel` |

Registry entry (`components/game-registry.tsx`, existing fields only):

```ts
"space-invaders": {
  Canvas: SpaceInvadersCanvas,
  controls: [
    { keys: ["←", "→"], label: "MOVE" },
    { keys: ["SPACE"], label: "FIRE" },
  ],
  stats: { lives: true, lines: false, level: true },
  levelSelect: { min: 1, max: 99 },
  sfx: {
    sounds: {
      shoot: withBasePath("/game-assets/space-invaders/shoot.wav"),
      hit: withBasePath("/game-assets/space-invaders/hit.wav"),
      boom: withBasePath("/game-assets/space-invaders/boom.wav"),
      gameover: withBasePath("/game-assets/space-invaders/gameover.wav"),
    },
    volume: 0.2,
  },
  appearance: {
    skins: [ /* retro, neon, pastel, gothic, negative */ ],
    themes: false,
  },
  touch: {
    pad: [
      { code: "ArrowLeft", label: "◀", slot: "left", hold: true },
      { code: "ArrowRight", label: "▶", slot: "right", hold: true },
      { code: "Space", label: "FIRE", slot: "a", hold: true },
    ],
    hint: [
      { keys: ["◀", "▶"], label: "MOVE" },
      { keys: ["A"], label: "FIRE" },
    ],
  },
},
```

`touch.pad` labels and `hold` flags follow the existing `TouchButton` type; the implementer adjusts to its exact shape. The wrapper passes `onLives` and `onLevel` only because `stats.lives` and `stats.level` are on.

Migration (`supabase/migrations/<version>_add_space_invaders_game.sql`; the file takes the version `apply_migration` assigns, which must be later than the latest existing file in `supabase/migrations/`):

```sql
insert into public.games (id, title, short, long, cat, cover, color) values
  ('space-invaders', 'SPACE INVADERS', 'Hold the line. Stop the invasion.',
   'A fleet of invaders marches down the screen, faster with every ship you destroy. Move your cannon, shoot them one by one and dodge their bombs. Clear the wave to face a faster one. If they land, it is over.',
   'SHOOTER', 'cover-space-invaders', '<same color as lib/games.ts>');
```

Conventions:

- Coordinates: origin top-left, `y` grows down, units are canvas pixels and seconds.
- Update on engine clock: `dt` clamped to `MAX_DT`. Bullets and bombs move in sub-steps of at most `MAX_STEP` px so they never tunnel through a target. Drawing every frame. The engine clock freezes while paused.
- Fleet march: the grid moves `STEP_X` px sideways every `stepInterval(alive, level)` seconds (discrete steps, like the original). When the next step would push an alive invader past `FLEET_MARGIN` from either side, the fleet instead steps down `STEP_DOWN` px and reverses `dir`. The two draw frames of each invader alternate on every step.
- Step interval (design values): `stepInterval(alive, level) = max(0.04, 0.9 * (alive / 55)) / min(2.5, 1 + 0.08 * (level - 1))` seconds. One alive invader marches fastest.
- Start row: `fleetStartY(level) = 80 + 16 * min(level - 1, 8)` px, so later waves start lower.
- Row points: top row 30, rows 2 and 3 are 20, rows 4 and 5 are 10 (`ROW_POINTS`). Wave clear adds `WAVE_BONUS * level` at the moment the last invader dies. Scores pass through `clampScore`.
- Player shot: `Space` fires a 4x14 bullet upward at `SHOT_SPEED` from the cannon's center, only if no player shot is on screen and the cannon is not respawning. The shot disappears when it hits an invader (that invader dies), reaches the top edge, or meets an invader bomb (both disappear, no points).
- Bombs: every `bombInterval(level)` seconds (design value `max(0.35, 1.1 - 0.06 * (level - 1))`, with a random +-30% jitter) the engine tries to drop a bomb from the lowest alive invader of a random column, only if fewer than `MAX_BOMBS` bombs exist. Bombs fall at `BOMB_SPEED` and disappear at the ground line.
- Cannon hit: a bomb overlapping the cannon removes it. Lives -1, `onSound("boom")`, `onHaptic("death")`, all bombs and the player shot are cleared, and the cannon respawns at center after `RESPAWN_DELAY` (engine clock) with no input accepted during that pause. If lives reach 0 the run ends.
- Landing: if any alive invader's bottom edge reaches `CANNON_Y`, the run ends at once (`lives` is not decremented; `onLives` is not called again).
- Wave clear: when no invader is alive, add the bonus, level + 1, rebuild the grid at `fleetStartY(level)` with `dir = 1`, clear bombs and the player shot, `onHaptic("clear")`. Lives are kept. A short pause of `RESPAWN_DELAY` seconds before the new fleet moves is allowed but not required.
- `setLevel(n)`: clamps 1..99, rebuilds the grid for that level, clears bombs and shot, keeps score and lives, fires `onLevel`. Ignored after game over.
- Input: `keydown` and `keyup` on `window` using `e.code` (`ArrowLeft`, `ArrowRight`, `KeyA`, `KeyD`, `Space`). Held-key state per code; the cannon moves while a code is held at `CANNON_SPEED`, left and right together cancel, and the cannon clamps inside the field. `Space` is read as a held key (fires whenever allowed), so `e.repeat` is irrelevant. `preventDefault` only for those keys while running and not paused. `P` and `Esc` do nothing. The touch pad sends the same synthetic events (SPEC 10), so the engine has no touch-specific input.
- Held keys are cleared on `pause()`, window `blur` and `visibilitychange` (hidden).
- Callbacks fire only on change; `start()` fires `onScore(0)`, `onLives(3)`, `onLevel(1)`. `onGameOver` fires once per run (lives 0, landing, or `end()`), then the loop and key listeners stop. `end()` with a score of 0 still calls `onGameOver(0)`.
- Sounds (design values): `shoot.wav` 80 ms falling chirp from 1200 Hz to 600 Hz; `hit.wav` 120 ms noise burst with a falling tone; `boom.wav` 400 ms low noise burst, 150 Hz falling; `gameover.wav` 600 ms, 392 Hz, 262 Hz then 131 Hz. Short fade-out, mono, 22.05 kHz, normalized so volume `0.2` is clearly audible but not loud. A one-off Node script writes them; the script is not shipped.
- `onSound("shoot")` fires on every player shot, `hit` on every invader destroyed, `boom` when the cannon is destroyed, `gameover` once when the run ends. If the last life is lost, `boom` then `gameover` both fire in that order. Landing and `end()` fire only `gameover`. Nothing fires after game over, and nothing fires while paused (engine clock).
- Entities receive `ctx` as argument; no module-level game state. Colors come from `SKINS`.
- Canvas 800x600 is scaled by CSS (4:3, same ratio as `.crt-screen`).
- Performance rules from SPEC 12 apply: no `mix-blend-mode`, no animated `mask-image`, no full-screen animated layers over or behind the canvas. Neon glow uses `shadowBlur` on the cannon and shots only, never on the 55 invaders.
- The canvas draws the playfield only (invaders, cannon, shots, bombs, a ground line). Score, lives, level, PAUSED and GAME OVER belong to the platform.

## Implementation plan

Before step 1, read the relevant guides in `node_modules/next/dist/docs/` as required by `AGENTS.md` (only if a step touches pages or caching; this one normally does not). Invoke `/frontend-design` for the cover and the skin palettes, per `CLAUDE.md`.

1. **Catalog entry.** Append `space-invaders` to `GAMES` in `lib/games.ts` with a temporary existing cover. `npm run build` passes; `/games/space-invaders` and `/games/space-invaders/play` render with the fake player; `invaders` unchanged; Home unchanged.
2. **Migration.** Write the migration file, apply it with `apply_migration`, rename the file to the version the tool assigns, check `select * from games where id = 'space-invaders'` matches `lib/games.ts`, run `get_advisors`, regenerate types only if the schema changed (it does not).
3. **Cover.** `.cover-space-invaders` in `app/globals.css` (designed with `/frontend-design`, invader rows and a cannon motif, different from the `invaders` cover); set `cover: "cover-space-invaders"` in `lib/games.ts`. Library card and detail page show it.
4. **Constants and utils.** `lib/space-invaders/constants.ts` (with the `retro` skin only) and `utils.ts`. `npm run build` passes.
5. **Entities.** `lib/space-invaders/entities.ts` (invader, cannon, shot, bomb, ground). `npm run lint` and `npm run build` pass.
6. **Engine, core.** `lib/space-invaders/engine.ts`: state reset, input, cannon movement, fleet march, player shot, collisions, scoring, draw, loop, public API with game over by `end()`. The folder imports nothing from `react` or `next`.
7. **Engine, bombs, lives and waves.** Bombs, cannon hit and respawn, landing, wave clear, `setLevel`, callbacks `onLives` and `onLevel`. `npm run lint` and `npm run build` pass.
8. **Canvas wrapper.** `components/space-invaders-canvas.tsx`, mirroring `components/snake-canvas.tsx` and `components/pong-canvas.tsx`: Strict-Mode safe (one live loop), latest callbacks in a ref, `skin` and `levelRequest` effects, `paused` and `endSignal` handling.
9. **Registry wiring.** Add the `space-invaders` entry (without `touch`, `sfx` and with only the `retro` skin for now) to `components/game-registry.tsx`. HUD shows Score, Lives and Level; level select works in PAUSED. Screenshot each other real game's HUD and a fake game to confirm no change.
   9b. **Sound.** Generate the four `.wav` files into `public/game-assets/space-invaders/`. Emit `onSound` and `onHaptic` from the engine, add the `sfx` entry, pass `onSound` through the wrapper. Check by ear: four clearly different sounds at volume 0.2, silent when muted.
10. **Touch.** Add `touch.pad` and `touch.hint`; wire `onHaptic`. Check at 375px and with the GamePad menu at 1280px, with a cross skin and a joystick skin.
11. **Skins.** Add `neon`, `pastel`, `gothic`, `negative` palettes (`SKINS` in `constants.ts`) and extend the registry skin list; each skin checked for 3:1 contrast between invaders, cannon, shots and field.
12. **Score walkthrough.** In `npm run dev` with Playwright (captures only in `.pwScreencaps/`): play to game over, SAVE SCORE as a signed-in user, confirm the row in `scores`, on `/games/space-invaders` and in the Hall of Fame after a reload, at 1280px and 375px. Reach wave 2. Cycle the skins and capture each.
13. **Performance.** Measure frame time with `references/perf/measure-fps.md` and log the result in `references/perf/perf-log.md`. Fix the engine only if the target is missed.
14. **Docs.** Update `CLAUDE.md` (engine location, callbacks, canvas size, skins, sounds, touch mapping, catalog sync) and `references/GAMES.md`. Run `npm run lint` and `npm run build`.

## Acceptance criteria

Generic:

- [ ] `npm run lint` and `npm run build` finish without errors.
- [ ] `lib/games.ts` contains `space-invaders` as the last entry with the listed values; `invaders` and all other entries are unchanged; the Home still shows the same mini cards.
- [ ] `select * from games where id = 'space-invaders'` matches `lib/games.ts` (`id`, `title`, `short`, `long`, `cat`, `cover`, `color`); the migration file matches what was applied; `get_advisors` shows no new warning.
- [ ] `/library` shows the card; clicking it goes to `/games/space-invaders`; PLAY goes to `/games/space-invaders/play`.
- [ ] `/games/space-invaders/play` shows a real canvas in the CRT frame with no mode picker; no auto-incrementing score.
- [ ] PAUSE freezes the game (march, shots, bombs, respawn timer) and shows the PAUSED overlay; RESUME continues with no jump; keys held during pause do not stay stuck.
- [ ] END opens the GAME OVER modal with the score; `onGameOver` does not fire twice.
- [ ] Game keys (arrows, `Space`) do not scroll the page during play; typing a name in the modal input works.
- [ ] A signed-in user: SAVE SCORE inserts one row `{ game_id: "space-invaders", name, score }` into `scores`; the modal shows `SCORE SAVED_`; a double click inserts one row. A guest sees `SIGN IN TO SAVE YOUR SCORE`.
- [ ] The saved score appears in `/games/space-invaders` and in the Hall of Fame tab for this game after a reload.
- [ ] PLAY AGAIN starts a fresh run with initial values (score 0, lives 3, level 1).
- [ ] EXIT or leaving the page stops the engine: no rAF loop and no `keydown` / `keyup` / `blur` / `visibilitychange` listener remains.
- [ ] In dev (React Strict Mode) only one loop runs: the cannon moves at 360 px/s, not double.
- [ ] At 375px width the canvas fits the CRT frame without horizontal scroll and keeps its ratio.
- [ ] Asteroids, Tetris, Arkanoid, Snake, Glowmaw, Frogger, Pong and a fake game (including `invaders`) play pages behave exactly as before.
- [ ] No new `localStorage` keys; `lib/storage.ts` is unchanged.
- [ ] `lib/space-invaders/` imports nothing from `react` or `next`.
- [ ] No text on the canvas or in the player is in Spanish.
- [ ] Reloading `/games/space-invaders/play` shows no React hydration warnings.
- [ ] No `mix-blend-mode`, animated `mask-image` or full-screen animated layer was added; the frame time result is in `references/perf/perf-log.md`.

Game-specific:

- [ ] The canvas is 800x600; the grid has 11 columns x 5 rows (55 invaders); the cannon is 44x22 px.
- [ ] The HUD shows Score, Lives and Level (labels unchanged) and no Lines slot; the start values are 0, 3 and 1.
- [ ] `←` / `→` and `A` / `D` move the cannon; it never leaves the field; left and right together do not move it.
- [ ] `Space` fires one bullet; no second bullet fires until the first is gone; holding `Space` fires again once the bullet is gone.
- [ ] The fleet marches sideways in discrete steps, steps down 24 px and reverses at each edge, and marches visibly faster when few invaders remain.
- [ ] Destroying a top-row invader gives 30 points, a row 2 or 3 invader 20, a row 4 or 5 invader 10.
- [ ] Invaders drop bombs from the lowest alive invader of a column; never more than 3 bombs exist at once; a player shot that meets a bomb removes both without points.
- [ ] A bomb hit costs exactly 1 life, clears all bombs and the shot, pauses input for 1.2 s of engine time, then the cannon reappears at center.
- [ ] Reaching 0 lives ends the run; the GAME OVER score equals the HUD score.
- [ ] If an invader reaches the cannon row the run ends at once with lives unchanged.
- [ ] Clearing all 55 invaders adds `100 x level` points, raises Level by 1, keeps lives and score, and starts a faster fleet lower on the screen (start row capped at level 9).
- [ ] The PAUSED overlay shows `LEVEL − NN +` (1..99); picking a level restarts the wave at that level and keeps score and lives; it does nothing after game over.
- [ ] On a phone-width viewport the pad shows; `left` / `right` move the cannon while held; `A` fires and holding it keeps firing; other slots are dimmed and inert.
- [ ] Pad buttons held at pause or game over release their keys (no stuck cannon on resume).
- [ ] SKIN cycles `RETRO`, `NEON`, `PASTEL`, `GOTHIC`, `NEGATIVE` and redraws at once, also while paused; no `THEME` button is shown.
- [ ] Score is an integer; `clampScore` caps it at 10,000,000.
- [ ] A player shot plays `shoot`, a destroyed invader plays `hit`, a destroyed cannon plays `boom`, and the end of the run plays `gameover`; the four sounds are audibly different; all play at volume 0.2.
- [ ] The final life lost plays `boom` and then `gameover`; nothing plays after the GAME OVER modal opens or while paused; the mute button under the CRT silences everything.
- [ ] `death` haptic fires on a lost life and `clear` on a wave clear, only when touch UI is active.
- [ ] The PAUSED overlays of Pong and Arkanoid show no new button; the four `.wav` files load through `withBasePath` (also under `/Arcade-Vault-Claude`).

## Decisions

- **Yes:** `space-invaders` as a new catalog entry; `invaders` stays a placeholder. Same pattern as `snake` and `pong`.
- **Yes:** core plus endless waves, no shields and no UFO (user decision). Keeps the engine small; both are good candidates for a follow-up spec.
- **Yes:** row-based points (30 / 20 / 10) plus a wave-clear bonus `100 x level`, Level in the HUD and level select in PAUSED (user decision). Row points reward shooting the harder-to-reach top rows; the bonus rewards finishing a wave.
- **Yes:** instant game over when an invader lands, as in the original, even with lives left. Without it the player could ignore the descent.
- **Yes:** one player bullet on screen at a time. Original behavior; makes aiming matter and bounds the fire rate with no cooldown timer.
- **Yes:** discrete march steps with a step interval that shrinks with the alive count. The speed-up as the fleet thins is the core tension of the game.
- **Yes:** touch pad with `left` / `right` / `A` fire, haptics `death` and `clear`, five skins, four generated sound effects at volume 0.2, perf check and docs (user decisions). Reuses `touch`, `appearance`, `sfx` and `levelSelect`; no change to `GamePlayer` or the registry types.
- **Yes:** generated `.wav` files of our own, so there is nothing to license. **No:** Web Audio synthesis in the engine (engines never play sound) and downloaded sound packs (license risk).
- **Yes:** no `pauseToggle`; the existing mute button under the CRT is enough. That field exists for Pong only.
- **Yes:** shapes drawn on the canvas, no spritesheet, so there is nothing to license.
- **Yes:** `shadowBlur` only on the cannon and shots in `neon`. 55 invaders with blur would cost frame time on software render.
- **No:** extra lives by score, power-ups, difficulty select, modes, background music, light theme, remembering settings, two-player mode.

## Risks

| Risk                                                                                          | Mitigation                                                                                                               |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Fleet speed and bomb rate are untested design values; the game can feel too easy or brutal.   | All tuning lives in `constants.ts` and `utils.ts` (`stepInterval`, `bombInterval`); the walkthrough plays several waves. |
| Shot or bomb tunnels through a target on a slow frame.                                        | Sub-steps of at most 8 px and `MAX_DT = 0.05`.                                                                           |
| `Space` held on the pad (`hold: true`) behaves differently from the keyboard.                 | Both produce the same held `Space` state; step 10 verifies auto-fire on a phone viewport.                                |
| 55 invaders plus shots redrawn every frame on software render.                                | Plain fills, no blur on invaders, no blends; step 13 measures and logs it.                                               |
| React Strict Mode mounts effects twice in dev and can leave two loops or duplicate listeners. | `start()` is idempotent, `destroy()` removes everything; a criterion checks single speed in dev.                         |
| `GAMES` and the `games` table drift apart.                                                    | The migration inserts the row with identical values; documented in `CLAUDE.md`.                                          |
| Browsers block audio until a user gesture.                                                    | The first key press or click on the play page is a gesture; step 9b checks the first shot is heard.                      |
| Level 99 start row and speed cap could make a wave unwinnable or trivial.                     | Start row is capped at level 9 and step speed at 2.5x; `setLevel` is a practice tool, not a score route (score is kept). |

## What is **not** in this spec

- Shields, the mystery ship, other invader types, boss waves.
- Extra lives by score, power-ups, two-player mode, difficulty select.
- Background music, a volume slider, a pause-menu sound toggle, and sounds beyond shoot, hit, boom and game over.
- Spritesheets or any image asset.
- Remembering skin or level; light theme.
- Changes to `invaders`, `GamePlayer` or the registry types.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
