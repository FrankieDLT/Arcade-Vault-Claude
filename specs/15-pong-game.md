# SPEC 15 — Pong game (PvE and PvP)

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 10, SPEC 11, SPEC 13
> **Date:** 2026-11-10
> **Objective:** Build a new Pong game as a TypeScript engine plus a React canvas component, add it to the catalog as a new entry `pong` with a mode picker (PvE against a CPU with a difficulty selector in the pause menu, or local two-player PvP), and wire its score into the platform HUD and the GAME OVER / SAVE SCORE flow.

## Why this spec exists

The catalog already has `pixel-duel`, a fake-simulation placeholder with a Pong-like description. This spec adds a real game as a **new** entry `pong` and leaves `pixel-duel` untouched (user decision), as SPEC 09 did with `serpentine` and `snake`.

Pong is the first real game with two modes and two human players on one keyboard. The platform has no concept of "mode" before a run starts, and no per-mode setting in the PAUSED overlay (only `levelSelect`). This spec adds two small optional registry fields for that (`modes`, `difficultySelect`), with no behavior change for the other real games and the fake games.

There is no reference code. The rules and numbers below are designed in this spec.

## Scope

**In:**

- Catalog: new entry `pong` appended after `frogger` in `GAMES`, category `VERSUS`. `pixel-duel` is not touched.
- Playfield: canvas 800x600 (4:3). Left paddle = Player 1, right paddle = Player 2 or the CPU. A ball bounces between them and off the top and bottom walls. A ball that passes a paddle's end line is a goal for the other side.
- **Two modes**, chosen before the run starts:
  - **PVE**: the human (left paddle) against the CPU (right paddle). Only the human has lives (3). The CPU has no lives, so the run is endless until the human loses 3 lives.
  - **PVP**: two humans on the same screen, 3 lives each. The run ends when either player reaches 0 lives.
- **Difficulty** (PvE only): `EASY`, `NORMAL` (default), `HARD`. Changed in the PAUSED overlay. Picking a different difficulty restarts the match: lives, paddle positions, ball, rally and score all reset (picking the active one does nothing). Each difficulty has a score multiplier for the human in PvE: `EASY` x0.75, `NORMAL` x1, `HARD` x1.5, applied to hit bonuses and goal points and rounded to a whole number (the CPU's score and all PvP scores are not multiplied). In memory only.
- **Lives and goals:** a player that lets the ball pass loses 1 life. The opponent scores the goal.
- **Scoring:** two sources, both credited to a human player.
  - **Hit bonus:** each time a human paddle returns the ball, that player gets `+5` at once. The CPU gets nothing for its hits. In PvP each player gets `+5` for their own returns.
  - **PvE multiplier growth (all difficulties):** every 3 goals scored by the human adds 1 unit to their multiplier, on top of the difficulty's base (`NORMAL` 1 to 2, `EASY` 0.75 to 1.75, `HARD` 1.5 to 2.5, and so on). It stacks and is capped at 10 extra units, so the multiplier tops out at base + 10 after 30 human goals. Losing a life does not reduce it; a new match (PLAY AGAIN, `CHANGE MODE` or a difficulty change) starts back at the base. It applies to hit bonuses and goal points, rounded to a whole number. PvP has no multiplier. The PvE `P1` tag on the canvas shows the current value (`P1  X2.75`).
  - **Goal:** a goal is worth `10 x rally hits` points (minimum 10), credited to the scorer. Rally hits = number of paddle hits since the last serve, both paddles counted. It stacks on top of the hit bonuses of that rally.
- **Leaderboard record:** one score per run. PvE: the human's score. PvP: the higher of the two players' scores. Saved with the existing SAVE SCORE flow under `game_id = "pong"`. PvE and PvP share the one leaderboard.
- Controls (desktop):
  - Player 1: `W` up, `S` down.
  - Player 2 (PvP): `↑` up, `↓` down.
  - PvE: the human accepts both pairs (`W` `S` and `↑` `↓`).
- Controls (touch, below 768px, and when the GamePad menu turns the pad on):
  - Player 1: the d-pad or joystick, up and down only. The pad sends `KeyW` and `KeyS`.
  - Player 2: `A` button = up (`ArrowUp`), `B` button = down (`ArrowDown`), both hold buttons.
  - Left and right pad slots, `X` and `Y` are unmapped (dimmed by the existing pad rules).
  - PvE: the d-pad and the `A` / `B` buttons both move the human paddle.
- **Mode picker:** a platform overlay shown on the CRT before the run starts (new optional registry field `modes`). The canvas mounts after a mode is picked. PLAY AGAIN keeps the mode. The GAME OVER modal gets a `CHANGE MODE` button for games with `modes`.
- **Difficulty selector:** shown in the PAUSED overlay only in PvE (new optional registry field `difficultySelect`), reusing the `.level-select` look.
- Canvas draws: center net, paddles, ball, both scores as large numerals, each player's life pips and small `P1` / `P2` / `CPU` tags, and the serve delay (ball blinks). This is a deliberate exception to "playfield only": in a two-sided game each side's score and lives must sit next to its paddle. The platform HUD still shows the record score.
- **Sound effects** (volume `0.2`, three different sounds, existing `sfx` registry field and `useSoundEffects`):
  - `paddle`: a short high blip when the ball hits a paddle.
  - `goal`: a rising two-tone chime when a goal is registered.
  - `gameover`: a falling three-tone sound when the run ends (life loss to 0, or END).
  - The engine emits `onSound(name)`; the platform plays it. Nothing plays while muted.
  - Three small `.wav` files generated for this spec (no third-party audio), in `public/game-assets/pong/`.
  - **Pause-menu toggle:** the PAUSED overlay shows a `SOUND ON` / `SOUND OFF` button. It drives the same shared `muted` state as the existing mute button under the CRT, so both always agree. In memory only.
- Skins: `retro` (default), `neon`, `pastel`, `gothic`, `negative`, through the existing `appearance` registry field with `themes: false`. Skin changes live, also while paused. In memory only.
- Touch: `touch.pad` entry and hint in the registry, haptics through existing patterns (no new pattern).
- Pure TypeScript engine in `lib/pong/` with no React and no Next.js imports.
- Client component `components/pong-canvas.tsx`.
- Migration `supabase/migrations/20261110120000_add_pong_game.sql` that inserts the `games` row, applied with MCP `apply_migration`.
- New cover class `cover-pong` in `app/globals.css`, designed with `/frontend-design`.
- Update `CLAUDE.md` and `references/GAMES.md`.
- Frame-time check with the SPEC 12 method (`references/perf/measure-fps.md`), result logged in `references/perf/perf-log.md`.

**Out of scope (for future specs):**

- Power-ups (user decision), more than two paddles, wall variants, obstacles, ball spin.
- Background music, a volume slider, and more sounds than the three listed (wall bounce, serve, life lost).
- Online multiplayer, spectating, replays.
- Separate leaderboards for PvE and PvP, and storing the mode in `scores` (no schema change).
- Saving both players' scores as two rows.
- Remembering mode, difficulty, skin or the sound toggle between runs or visits.
- Light theme (`themes: false`).
- A human-vs-human mode on a phone with a pad skin that has fewer than two action buttons (all four pad skins have `a` and `b`).
- High-DPI canvas scaling.
- Real game stats: `plays` stays a mock field.
- Changes to `pixel-duel`, other games, the Home, auth or the Hall of Fame layout. The only shared-code edits are the two optional registry fields and the mode picker, difficulty selector and CHANGE MODE button in `GamePlayer`.
- Automated tests (no test runner is configured).

## Data model

Catalog entry (the `Game` type is unchanged). Final `color` is picked with `/frontend-design`; it must be valid in the existing `Game` color union and different from `pixel-duel` (`cyan`).

```ts
// lib/games.ts — appended to GAMES, after "frogger"
{
  id: "pong",
  title: "PONG",
  short: "Two paddles, one ball. Beat the CPU or a friend.",
  long: "The arcade classic: bounce the ball past your rival's paddle. Play solo against a CPU with three difficulty levels, or share the keyboard with a friend. Longer rallies are worth more points, and three missed balls end the match.",
  cat: "VERSUS",
  cover: "cover-pong",
  color: "magenta", // placeholder: verify it exists in the Game color union
  plays: "0",
}
```

Engine public API:

```ts
// lib/pong/engine.ts
export type PongMode = "pve" | "pvp";
export type PongDifficulty = "easy" | "normal" | "hard";
export type PongSkin = "retro" | "neon" | "pastel" | "gothic" | "negative";

export interface PongCallbacks {
  onScore: (record: number) => void; // record score: PvE = human, PvP = max(p1, p2); fires on change
  onGameOver: (finalScore: number) => void; // once per run, same value as the record
  onSound?: (name: "paddle" | "goal" | "gameover") => void; // only from update / game over
  onHaptic?: (name: "death") => void; // a life was lost
}

export class PongEngine {
  constructor(
    canvas: HTMLCanvasElement,
    callbacks: PongCallbacks,
    options: { mode: PongMode; difficulty?: PongDifficulty; skin?: PongSkin },
  );
  start(): void; // resets state, attaches listeners, starts the rAF loop; idempotent; fires onScore(0)
  pause(): void; // stops updating, clears held keys
  resume(): void; // continues without a time jump
  end(): void; // ends the run now and calls onGameOver once
  destroy(): void; // cancels rAF, removes every listener
  setSkin(skin: PongSkin): void; // redraws at once, also while paused or after game over
  setDifficulty(d: PongDifficulty): void; // PvE only, ignored in PvP; a different difficulty restarts the match (lives, positions, score)
}
```

Mode is fixed per engine instance. The mode picker mounts a fresh engine per run through `key={runId}`.

Internal state (not exported):

```ts
interface Player {
  y: number; // paddle top, px
  lives: number; // 3 at start; the CPU is not given lives in PvE
  score: number;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface State {
  p1: Player;
  p2: Player;
  ball: Ball;
  hits: number; // paddle hits in the current rally
  serveIn: number; // seconds left before the ball launches, 0 = in play
  over: boolean;
}
```

Module layout:

| File                    | Contents                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/pong/constants.ts` | `W = 800`, `H = 600`, `PADDLE_W = 12`, `PADDLE_H = 100`, `PADDLE_MARGIN = 30`, `PADDLE_SPEED = 420`, `BALL_SIZE = 14`, `BALL_START_SPEED = 420`, `BALL_SPEED_PER_HIT = 0.05`, `BALL_MAX_SPEED = 900`, `MAX_BOUNCE_ANGLE = 55` (deg), `SERVE_DELAY = 1`, `START_LIVES = 3`, `GOAL_POINTS_PER_HIT = 10`, `HIT_POINTS = 5`, `MAX_DT = 0.05`, `MAX_STEP = 8`, `MAX_SCORE = 10_000_000`, `CPU` (table below), `SKINS` |
| `lib/pong/utils.ts`     | `clampScore`, `reflectAngle(offset)`, `ballSpeed(hits)`, `predictBallY(ball, targetX)` (wall-bounce prediction), `cpuTarget(state, difficulty, rng)`                                                                                                                                                                                                                                                             |
| `lib/pong/entities.ts`  | Types `Player`, `Ball`; `drawField`, `drawPaddle`, `drawBall`, `drawScoreboard` (numerals, life pips, tags), all receiving `ctx` as argument                                                                                                                                                                                                                                                                     |
| `lib/pong/engine.ts`    | `PongEngine`: input, state, sub-stepped update, collisions, serve timer, CPU, draw, loop, callbacks                                                                                                                                                                                                                                                                                                              |

CPU difficulty table (`CPU` in `constants.ts`; the numbers are design values, tuned in play):

| Difficulty | Paddle speed (px/s) | Reaction delay (s) | Aim error (± px) | Base score multiplier (PvE human) |
| ---------- | ------------------- | ------------------ | ---------------- | --------------------------------- |
| `easy`     | 190                 | 0.45               | 120              | 0.75                              |
| `normal`   | 270                 | 0.22               | 60               | 1                                 |
| `hard`     | 480                 | 0.04               | 8                | 1.5                               |

CPU behavior: while the ball moves toward the CPU, after the reaction delay it picks a target `y` (predicted ball `y` at the paddle line, including wall bounces, plus a random error within the aim error, re-rolled once per rally) and moves toward it at its paddle speed. While the ball moves away, it drifts to the vertical center. The CPU never reads the human's input.

HUD mapping:

| Platform HUD | Source                                 | Callback  |
| ------------ | -------------------------------------- | --------- |
| Score        | record (PvE human, PvP max of players) | `onScore` |
| Lives        | hidden (drawn on the canvas per side)  | none      |
| Lines slot   | hidden                                 | none      |
| Level        | hidden                                 | none      |

Registry entry and platform changes:

```ts
// components/game-registry.tsx — new optional fields on GameDefinition
modes?: { id: string; label: string; hint: string }[];
difficultySelect?: {
  options: { id: string; label: string }[];
  default: string;
  onlyModes: string[]; // modes where the selector shows
};

// GameCanvasProps gets two optional props
mode?: string;
difficulty?: string;

// registry entry
pong: {
  Canvas: PongCanvas,
  controls: [
    { keys: ["W", "S"], label: "PLAYER 1" },
    { keys: ["↑", "↓"], label: "PLAYER 2 / PVE" },
  ],
  stats: { lives: false, lines: false, level: false },
  sfx: {
    sounds: {
      paddle: withBasePath("/game-assets/pong/paddle.wav"),
      goal: withBasePath("/game-assets/pong/goal.wav"),
      gameover: withBasePath("/game-assets/pong/gameover.wav"),
    },
    volume: 0.2,
    pauseToggle: true, // new optional flag: SOUND ON/OFF button in the PAUSED overlay
  },
  modes: [
    { id: "pve", label: "PVE", hint: "YOU VS THE CPU" },
    { id: "pvp", label: "PVP", hint: "2 PLAYERS, ONE SCREEN" },
  ],
  difficultySelect: {
    options: [
      { id: "easy", label: "EASY" },
      { id: "normal", label: "NORMAL" },
      { id: "hard", label: "HARD" },
    ],
    default: "normal",
    onlyModes: ["pve"],
  },
  appearance: {
    skins: [ /* retro, neon, pastel, gothic, negative */ ],
    themes: false,
  },
  touch: {
    pad: [
      { code: "KeyW", label: "▲", slot: "up", hold: true },
      { code: "KeyS", label: "▼", slot: "down", hold: true },
      { code: "ArrowUp", label: "P2 ▲", slot: "a", hold: true },
      { code: "ArrowDown", label: "P2 ▼", slot: "b", hold: true },
    ],
    hint: [
      { keys: ["D-PAD"], label: "PLAYER 1" },
      { keys: ["A", "B"], label: "PLAYER 2 UP / DOWN" },
    ],
  },
},
```

`touch.pad` labels and `hold` flags follow the existing `TouchButton` type; the implementer adjusts to its exact shape.

`GamePlayer` state added (memory only, no `localStorage`):

```ts
const [mode, setMode] = useState<string | null>(
  definition?.modes ? null : "default",
);
const [difficulty, setDifficulty] = useState<string | undefined>(
  definition?.difficultySelect?.default,
);
```

- `mode === null` and `definition.modes` present: the CRT shows the mode picker (two buttons with their `hint`), no canvas, PAUSE and END disabled.
- Picking a mode sets `mode`, resets the HUD values and mounts `<Canvas key={runId} mode={mode} difficulty={difficulty} />`.
- PAUSED overlay shows the difficulty selector when `difficultySelect` exists and `mode` is in `onlyModes`. Each click sets `difficulty`; the canvas wrapper calls `engine.setDifficulty` in an effect.
- PAUSED overlay shows the `SOUND ON` / `SOUND OFF` button when `sfx.pauseToggle` is true. Existing entries with `sfx` (Arkanoid) do not set the flag, so their overlay is unchanged. The `sfx` type gets `pauseToggle?: boolean`. `onSound` is passed to the canvas as today (only entries with `sfx`).
- GAME OVER modal: `CHANGE MODE` sets `mode` to `null`, bumps `runId`, clears the over state.

Migration (`supabase/migrations/20261110120000_add_pong_game.sql`; the file takes the version `apply_migration` assigns, which must be later than `20261110001157`):

```sql
insert into public.games (id, title, short, long, cat, cover, color) values
  ('pong', 'PONG', 'Two paddles, one ball. Beat the CPU or a friend.',
   'The arcade classic: bounce the ball past your rival''s paddle. Play solo against a CPU with three difficulty levels, or share the keyboard with a friend. Longer rallies are worth more points, and three missed balls end the match.',
   'VERSUS', 'cover-pong', '<same color as lib/games.ts>');
```

Conventions:

- Coordinates: origin top-left, `y` grows down, units are canvas pixels and seconds.
- Fixed update on engine clock: `dt` clamped to `MAX_DT`, ball moved in sub-steps of at most `MAX_STEP` px so it never tunnels through a paddle. Drawing every frame.
- Paddle hit: bounce angle = `offset * MAX_BOUNCE_ANGLE`, where `offset` is the hit point relative to paddle center, from -1 to 1. Ball speed after hit `n` = `min(BALL_MAX_SPEED, BALL_START_SPEED * (1 + BALL_SPEED_PER_HIT * n))`. The ball always leaves toward the other side.
- Top and bottom walls reflect `vy`. Paddles clamp inside the field.
- Hit bonus: on every paddle hit by a human (both paddles in PvP, only the left paddle in PvE) that player's score gains `HIT_POINTS` (5) through `clampScore`, before the bounce is computed. The CPU paddle never scores for a hit. The record callback fires on change as usual.
- Goal: ball center passes the left or right edge. The conceding player loses 1 life (PvE CPU: nothing). The scorer gains `10 * max(1, hits)`. `hits` resets to 0. After a goal the ball resets to center and serves after `SERVE_DELAY` toward the player who conceded, with a random vertical angle within ±25°. The first serve of a run goes toward Player 2 / the CPU.
- Serve delay uses the engine clock (freezes while paused). The ball blinks during it.
- Input: `keydown` and `keyup` on `window` using `e.code` (`KeyW`, `KeyS`, `ArrowUp`, `ArrowDown`). Held-key state per code; paddle moves while a code is held, up and down together cancel. `preventDefault` only for those keys while running and not paused. `e.repeat` is ignored. The touch pad sends the same synthetic events (SPEC 10), so the engine has no touch-specific input.
- PvP key map: `KeyW` / `KeyS` move Player 1, `ArrowUp` / `ArrowDown` move Player 2. PvE key map: all four keys move the human paddle; the CPU paddle ignores keys.
- Held keys are cleared on `pause()`, window `blur` and `visibilitychange` (hidden).
- Callbacks fire only on change; `start()` fires `onScore(0)`. `onGameOver` fires once per run (life loss to 0, or `end()`), then the loop and key listeners stop. `end()` with a score of 0 still calls `onGameOver(0)`.
- Record: PvE `p1.score`, PvP `max(p1.score, p2.score)`, always passed through `clampScore`.
- Entities receive `ctx` as argument; no module-level game state. Colors come from `SKINS`.
- Canvas 800x600 is scaled by CSS (4:3, same ratio as `.crt-screen`).
- Performance rules from SPEC 12 apply: no `mix-blend-mode`, no animated `mask-image`, no full-screen animated layers over or behind the canvas. Neon glow uses `shadowBlur` on paddles and ball only.
- Sounds (design values): `paddle.wav` 60 ms blip at 880 Hz; `goal.wav` 250 ms, 523 Hz then 784 Hz; `gameover.wav` 600 ms, 392 Hz, 262 Hz then 131 Hz. Square-ish wave with a short fade-out, mono, 22.05 kHz, normalized so volume `0.2` is clearly audible but not loud. A one-off Node script writes them; the script is not shipped.
- `onSound("paddle")` fires on every paddle hit, `onSound("goal")` on every goal, `onSound("gameover")` once when the run ends. If the goal ends the run (last life lost), `goal` then `gameover` both fire in that order, so the game-over sound is the last one heard. Nothing fires after game over. Sounds use the engine clock like all update events, so none fire while paused.
- `onHaptic("death")` fires when any life is lost; `GamePlayer` maps it to the existing `death` haptic only when touch UI is active. No new haptic patterns.

## Implementation plan

Before step 1, read the relevant guides in `node_modules/next/dist/docs/` as required by `AGENTS.md` (only if a step touches pages or caching; this one normally does not). Invoke `/frontend-design` for the cover, the skin palettes, the mode picker and the difficulty selector, per `CLAUDE.md`.

1. **Catalog entry.** Append `pong` to `GAMES` in `lib/games.ts` with a temporary existing cover (the new class comes in step 3). `npm run build` passes; `/games/pong` and `/games/pong/play` render with the fake player; `pixel-duel` unchanged; Home unchanged.
2. **Migration.** Write `supabase/migrations/20261110120000_add_pong_game.sql`, apply it with `apply_migration`, rename the file to the version the tool assigns, check `select * from games where id = 'pong'` matches `lib/games.ts`, run `get_advisors`.
3. **Cover.** `.cover-pong` in `app/globals.css` (designed with `/frontend-design`, paddles and ball motif, different from `.cover-duelo`); set `cover: "cover-pong"` in `lib/games.ts`. Library card and detail page show it.
4. **Constants and utils.** `lib/pong/constants.ts` and `utils.ts` (`reflectAngle`, `ballSpeed`, `predictBallY`, `cpuTarget`, `clampScore`). `npm run build` passes.
5. **Entities.** `lib/pong/entities.ts` (field, paddles, ball, scoreboard with numerals, life pips and tags). `npm run lint` and `npm run build` pass.
6. **Engine, PvP core.** `lib/pong/engine.ts`: state reset, input, sub-stepped update, paddle and wall collisions, goals, lives, scoring (`+5` per human paddle hit, `10 x hits` per goal), serve timer, record callback, game over, draw, loop, public API with `mode: "pvp"` working. The folder imports nothing from `react` or `next`.
7. **Engine, PvE and difficulty.** Add the CPU paddle, `setDifficulty`, the PvE key map, the "CPU has no lives" rule. `npm run lint` and `npm run build` pass.
8. **Canvas wrapper.** `components/pong-canvas.tsx`, mirroring `components/snake-canvas.tsx`: Strict-Mode safe (one live loop), latest callbacks in a ref, `skin` and `difficulty` effects, `mode` read once at engine creation.
9. **Registry and player wiring.** Add `modes`, `difficultySelect` and `mode` / `difficulty` props to `components/game-registry.tsx`; add the `pong` entry (without `touch` and with only the `retro` skin for now). In `GamePlayer`: mode picker overlay, difficulty selector in PAUSED, CHANGE MODE in the GAME OVER modal, PAUSE and END disabled until a mode is picked, HUD with only the Score slot when `stats` are all false. Other games behave as before (screenshot of each real game's HUD and a fake game).
   9b. **Sound.** Generate `paddle.wav`, `goal.wav`, `gameover.wav` into `public/game-assets/pong/`. Emit `onSound` from the engine, add the `sfx` entry and `pauseToggle` support in `GamePlayer` (button in PAUSED, shared `muted` state), pass `onSound` through `PongCanvas`. Check by ear: three clearly different sounds at volume 0.2, silent when muted.
10. **Touch.** Add `touch.pad` and `touch.hint` to the `pong` entry; wire `onHaptic("death")`. Check at 375px and with the GamePad menu at 1280px.
11. **Skins.** Add `neon`, `pastel`, `gothic`, `negative` palettes (`SKINS` in `constants.ts`) and extend the registry skin list; each skin checked for 3:1 contrast between paddles, ball and field.
12. **Score walkthrough.** In `npm run dev` with Playwright (captures only in `.pwScreencaps/`): play PvE to game over, SAVE SCORE as a signed-in user, confirm the row in `scores`, on `/games/pong` and in the Hall of Fame after a reload, at 1280px and 375px. Play a PvP run to game over and save. Cycle the skins and capture each.
13. **Performance.** Measure frame time with `references/perf/measure-fps.md` and log the result in `references/perf/perf-log.md`.
14. **Docs.** Update `CLAUDE.md` (engine location, callbacks, registry fields `modes` and `difficultySelect`, mode picker, canvas size, catalog sync, touch mapping) and `references/GAMES.md`. Run `npm run lint` and `npm run build`.

## Acceptance criteria

Generic:

- [ ] `npm run lint` and `npm run build` finish without errors.
- [ ] `lib/games.ts` contains `pong` as the last entry with the listed values; `pixel-duel` and all other entries are unchanged; the Home still shows the same mini cards.
- [ ] `select * from games where id = 'pong'` matches `lib/games.ts` (`id`, `title`, `short`, `long`, `cat`, `cover`, `color`); the migration file matches what was applied; `get_advisors` shows no new warning.
- [ ] `/library` shows the card; clicking it goes to `/games/pong`; PLAY goes to `/games/pong/play`.
- [ ] `/games/pong/play` shows the mode picker first, then a real canvas in the CRT frame; no auto-incrementing score.
- [ ] PAUSE freezes the game and shows the PAUSED overlay; RESUME continues with no jump; keys held during pause do not stay stuck.
- [ ] END opens the GAME OVER modal with the record score; `onGameOver` does not fire twice.
- [ ] Game keys (`W`, `S`, arrows) do not scroll the page during play; typing a name in the modal input works.
- [ ] A signed-in user: SAVE SCORE inserts one row `{ game_id: "pong", name, score }` into `scores`; the modal shows `SCORE SAVED_`; a double click inserts one row. A guest sees `SIGN IN TO SAVE YOUR SCORE`.
- [ ] The saved score appears in `/games/pong` and in the Hall of Fame tab for this game after a reload.
- [ ] PLAY AGAIN starts a fresh run in the same mode with initial values.
- [ ] EXIT or leaving the page stops the engine: no rAF loop and no `keydown` / `keyup` / `blur` / `visibilitychange` listener remains.
- [ ] In dev (React Strict Mode) only one loop runs: ball speed is the normal 420 px/s at serve, not double.
- [ ] At 375px width the canvas fits the CRT frame without horizontal scroll and keeps its ratio.
- [ ] Asteroids, Tetris, Arkanoid, Snake, Glowmaw, Frogger and a fake game (including `pixel-duel`) play pages behave exactly as before (same HUD labels and slots, no mode picker).
- [ ] No new `localStorage` keys; `lib/storage.ts` is unchanged.
- [ ] `lib/pong/` imports nothing from `react` or `next`.
- [ ] No text on the canvas or in the player is in Spanish.
- [ ] Reloading `/games/pong/play` shows no React hydration warnings.
- [ ] No `mix-blend-mode`, animated `mask-image` or full-screen animated layer was added; the frame time result is in `references/perf/perf-log.md`.

Game-specific:

- [ ] The canvas is 800x600; paddles are 12x100 px at 30 px from each side; the ball is 14 px.
- [ ] The mode picker shows `PVE` and `PVP` with their hints; no canvas is mounted and PAUSE and END are disabled until one is picked.
- [ ] The HUD shows only the Score slot (no Lives, Lines or Level).
- [ ] The first ball serves after 1 s of engine time, toward Player 2 / the CPU, blinking during the delay; the serve timer freezes while paused.
- [ ] A paddle hit sends the ball to the other side; hitting near a paddle edge gives a steeper angle (up to 55°) than hitting the center; the ball never tunnels through a paddle at 900 px/s.
- [ ] Ball speed after `n` hits is `min(900, 420 * (1 + 0.05 * n))` px/s and resets to 420 after a goal.
- [ ] The ball reflects off the top and bottom walls.
- [ ] Each human paddle hit adds 5 points to that player's score at once; the CPU paddle never adds points; in PvP both players earn 5 per own hit.
- [ ] A goal removes 1 life from the conceding player, adds `10 x max(1, hits)` to the scorer, resets the rally and serves toward the conceder after 1 s.
- [ ] Each side's score and 3 life pips are drawn next to its paddle with `P1` and `P2` (PvP) or `CPU` (PvE) tags; in PvE the CPU side shows no life pips.
- [ ] PvP: `W` / `S` move only Player 1; `↑` / `↓` move only Player 2; both can move at once; releasing a key stops that paddle.
- [ ] PvP: the run ends when either player reaches 0 lives; the GAME OVER score is `max(p1.score, p2.score)`.
- [ ] PvE: `W` / `S` and `↑` / `↓` all move the human paddle; the CPU never loses a life; the run ends only when the human loses 3 lives; the GAME OVER score is the human's score.
- [ ] The PAUSED overlay shows the `EASY` / `NORMAL` / `HARD` selector only in PvE, defaulting to `NORMAL`; it is not shown in PvP.
- [ ] Changing difficulty while paused restarts the match: score back to 0, lives back to 3, paddles centered, ball back to a fresh serve. Picking the already active difficulty changes nothing. CPU speed, reaction delay and aim error follow the new level.
- [ ] In PvE the human's hit bonus and goal points are multiplied by the difficulty base (`EASY` x0.75, `NORMAL` x1, `HARD` x1.5) and rounded to a whole number; the CPU's score and PvP scores are not multiplied.
- [ ] In PvE, on every difficulty, each 3 goals scored by the human add 1 unit to the multiplier (`NORMAL` 1, then 2 after 3 goals, 3 after 6; `EASY` 0.75, then 1.75). The goal that completes a group pays at the old value, the next points use the new one. The bonus stops at 10 extra units, is kept after a life is lost, and resets with a new match. The `P1` tag shows the live value in PvE only.
- [ ] On `HARD` the CPU returns more balls than on `EASY` over the same number of serves (verified by a 10-rally playthrough of each).
- [ ] On a phone-width viewport the pad shows; the d-pad or joystick up / down moves Player 1 (`KeyW` / `KeyS`); the `A` button moves Player 2 up and `B` moves Player 2 down; holding either keeps the paddle moving; left, right, `X` and `Y` are dimmed and inert.
- [ ] On a phone-width viewport in PvE, the d-pad and the `A` / `B` buttons both move the human paddle.
- [ ] Pad buttons held at pause or game over release their keys (no stuck paddle on resume).
- [ ] SKIN cycles `RETRO`, `NEON`, `PASTEL`, `GOTHIC`, `NEGATIVE` and redraws at once, also while paused; no `THEME` button is shown.
- [ ] GAME OVER shows a `CHANGE MODE` button that returns to the mode picker with a fresh run.
- [ ] Score is an integer; `clampScore` caps it at 10,000,000.
- [ ] A paddle hit plays `paddle`, a goal plays `goal`, and the end of the run plays `gameover`; the three sounds are audibly different from each other; all play at volume 0.2.
- [ ] The last goal of a run plays `goal` and then `gameover`; nothing plays after the GAME OVER modal opens.
- [ ] The PAUSED overlay shows a `SOUND ON` / `SOUND OFF` button; turning it off silences all three sounds, turning it on restores them; the button and the mute button under the CRT always show the same state.
- [ ] No sound plays while paused or before a mode is picked; PLAY AGAIN keeps the sound toggle state.
- [ ] The PAUSED overlay of Arkanoid shows no new button; the three `.wav` files load through `withBasePath` (also under `/Arcade-Vault-Claude`).

## Decisions

- **Yes:** `pong` as a new catalog entry; `pixel-duel` stays a placeholder. User decision; the same pattern as `snake` and `serpentine`.
- **Yes:** score is `10 x rally hits` per goal. User decision, after the discarded plain-goal option made the PvP record always 3.
- **Yes:** `+5` for every paddle hit by a human, on top of the goal score. User decision, added after the first implementation: it rewards each return, not only the goal that ends a rally. The CPU gets no hit bonus, so its score stays a function of goals only.
- **No:** plain `+1` per goal and flat `100` per goal. Both give a flat leaderboard.
- **Yes:** PvE has lives only for the human, so the run is endless and scores can grow. If the CPU had 3 lives the score would be capped at 3 goals.
- **Yes:** PvP saves the higher of the two scores as one row. User decision; one SAVE SCORE flow, one name.
- **No:** two rows per PvP run (needs two names, breaks the SAVE SCORE flow).
- **Yes:** mode picker as a platform overlay before the run (new optional `modes` registry field). The mode is fixed for a run and PLAY AGAIN keeps it.
- **No:** two catalog entries (`pong-pve`, `pong-pvp`): double the covers, migrations and leaderboards. **No:** a picker drawn inside the canvas: the canvas draws the playfield, not menus.
- **Yes:** difficulty in the PAUSED overlay, PvE only (user decision), through an optional `difficultySelect` field styled like `levelSelect`.
- **Yes:** mobile Player 2 uses `A` = up and `B` = down as hold buttons that send `ArrowUp` / `ArrowDown`; Player 1 uses the d-pad or joystick, remapped to `KeyW` / `KeyS` in the registry. The engine keeps no touch-specific input (SPEC 10 rule).
- **Yes:** in PvE the human paddle accepts both key pairs, so the human can use whichever hand is comfortable, and on a phone both the d-pad and `A` / `B` work.
- **Yes:** the canvas draws per-side scores, life pips and `P1` / `P2` / `CPU` tags, a deliberate exception to "playfield only", because each side's state must sit next to its paddle. The platform HUD shows the record.
- **Yes:** one shared leaderboard for both modes. A PvP record is not comparable to a PvE one, but no schema change is needed. Separate boards need a `mode` column and a new spec.
- **Yes:** three sound effects (paddle, goal, game over) at volume 0.2, user decision, through the existing `sfx` registry field and `useSoundEffects`. The engine emits `onSound`, the platform plays it (engine rule: engines never play sound).
- **Yes:** the pause-menu sound toggle reuses the shared `muted` state instead of a second state, so it cannot disagree with the mute button under the CRT. It is opt-in with `sfx.pauseToggle` so Arkanoid's overlay does not change.
- **Yes:** the sounds are generated `.wav` files of our own, so there is nothing to license. **No:** Web Audio synthesis in the engine (breaks the engine rule) and downloaded sound packs (license risk).
- **Yes:** `normal` is the default difficulty (user decision).
- **Yes:** PvE multiplier growth (user decision): +1 unit per 3 goals the human scores, max +10, on every difficulty. A rally-winning streak is worth more than one lucky hit, and the cap bounds the leaderboard (a PvE score still ends at `clampScore`). The count is per match and not lost with a life, so a long match keeps paying more.
- **Yes:** difficulty tuning after first play (user decision): `EASY` and `NORMAL` got a slower, less responsive CPU and double the aim error, and each difficulty has a PvE score multiplier (0.75 / 1 / 1.5) so harder levels pay more. Switching difficulty restarts the match, so a run's score always comes from one difficulty only (no switching to `EASY` mid-run to farm lives, and no mixed multipliers).
- **No:** power-ups (user decision), background music, light theme, remembering settings, online play.
- **Yes:** visual assets: none. All drawing is canvas shapes, so there is nothing to license.

## Risks

| Risk                                                                                                                         | Mitigation                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `GamePlayer` has no concept of a pre-run state; the mode picker adds one and could break others.                             | The picker is opt-in per registry entry (`modes`); a criterion checks the HUD and start of every other real game and a fake game.            |
| A HUD with `stats` all `false` may render an empty or broken slot row.                                                       | Step 9 verifies it first and fixes `GamePlayer` for opt-in only; other games keep their slots.                                               |
| Two humans at one keyboard: `W` / `S` and `↑` / `↓` pressed together with other keys can hit key ghosting on some keyboards. | Documented limit of the hardware; the engine tracks each code independently.                                                                 |
| Pad button codes `KeyW` / `KeyS` as touch slots could confuse the SPEC 10 joystick, which assumes arrow codes.               | The joystick sends the code of each mapped direction slot (not hard-coded arrows); step 10 verifies with the joystick skins.                 |
| Ball tunnels through a paddle at 900 px/s on a slow frame.                                                                   | Sub-steps of at most 8 px and `MAX_DT = 0.05`; a criterion checks no tunneling at max speed.                                                 |
| CPU feels unbeatable or trivial; numbers are untested.                                                                       | All tuning lives in the `CPU` table in `constants.ts`; the walkthrough plays each level and the user can adjust without touching the engine. |
| An endless PvE run with a perfect rally (`10 x hits` with hits growing without bound) inflates scores.                       | Ball speed is capped at 900 px/s and the CPU has a miss chance from its aim error, so rallies end; `clampScore` caps at 10,000,000 anyway.   |
| PvE and PvP records share one leaderboard and are not comparable.                                                            | Accepted (see Decisions); a later spec can add a `mode` column.                                                                              |
| React Strict Mode mounts effects twice in dev and can leave two loops or duplicate listeners.                                | `start()` is idempotent, `destroy()` removes everything; a criterion checks single speed in dev.                                             |
| `GAMES` and the `games` table drift apart.                                                                                   | The migration inserts the row with identical values; documented in `CLAUDE.md`.                                                              |
| Browsers block audio until a user gesture, so the first sound could be silent.                                               | Picking a mode is a click, and `useSoundEffects` creates and plays its `Audio` after it; step 9b checks the first paddle hit is heard.       |
| Frame time on software render.                                                                                               | Few draw calls, no blends; step 13 measures and logs it.                                                                                     |

## What is **not** in this spec

- Power-ups, more than two paddles, spin, obstacles.
- Background music, a volume slider, and sounds beyond paddle, goal and game over.
- Online multiplayer, replays, spectating.
- Separate PvE / PvP leaderboards and a stored `mode`.
- Two score rows per PvP run.
- Remembering mode, difficulty or skin; light theme.
- Changes to `pixel-duel`.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
