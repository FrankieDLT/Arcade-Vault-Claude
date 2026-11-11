# SPEC 25 — Wingshot: a mouse and tap shooting gallery with a different scene per skin

> **Status:** Implemented
> **Depends on:** SPEC 06, SPEC 10, SPEC 11, SPEC 13, SPEC 19
> **Date:** 2026-11-11
> **Objective:** Add Wingshot, an original aim-and-shoot gallery game played only by clicking or tapping flying targets on the canvas, with rounds of waves, 3 shots per wave and a hit quota per round, where each skin changes the whole scene and its companion (fisherman and fish, plague doctor and moths, astronaut and space pigeons, samurai and paper cranes) and the companion reacts to every wave with a happy or a comic tune.

## Why this spec exists

The user asked for a game "like Duck Hunt, similar but different enough as to not infringe on any trademark", playable with the mouse or by tapping the screen, "with no further buttons". Two consequences shape this spec:

- **Legal distance.** The loop (limited shots per wave, a quota per round, targets that escape) is a game mechanic and is free to use. Everything protectable is original here: the name `Wingshot`, all art, all sounds, the scene layouts, the target kinds. There is **no dog, no duck, no zapper gun, no orange-and-green NES look, no "Duck Hunt" wording and no Nintendo asset or melody**, in the UI, code, comments or docs. The user asked for a reacting companion (the original has a dog that laughs or celebrates); here it is a different character per scene (fisherman, plague doctor, astronaut, samurai), never an animal, with own art and own tunes.
- **Skin = theme (user decision).** In every other game a skin changes colors only. Here a skin changes the fiction: scene, target sprites, companion, shot effect and palette. Gameplay numbers, hit boxes and sounds are identical in every skin, so no skin is easier than another.

Input is one action only: a pointer press on the canvas (mouse, touch, pen) fires one shot at that point. The game adds no button of its own. The platform's existing buttons (PAUSE, END, MUTE, SKIN, HAPTICS) stay as they are for every game.

## Scope

**In:**

- **Engine** `WingshotEngine` in `lib/wingshot/` (framework-free), canvas 800x600 (4:3), shots by hit-scan at the pointer position.
- **Rounds, waves and quota.** A round is 10 targets. A wave launches 1 target (rounds 1 and 2) or 2 targets (round 3 on). The player has 3 shots per wave. A round ends when its 10 targets are resolved (hit or escaped). If hits are below the round quota the run ends, else the next round starts.
- **Target kinds:** `common`, `quick` (round 3 on), `rare` (round 2 on) and the harmless `decoy` (round 4 on), each with a sprite per scene (table below).
- **Four scenes**, one per skin family, drawn with canvas shapes and pixel run tables (no image files):
  - `lake` (skin `retro`, the default): fish leaping out of a pixel lake, with a fisherman.
  - `moors` (skin `gothic`): moths, bats and fireflies over a dark moor lit by a lantern flash, with a plague doctor.
  - `orbit` (skin `neon`): alien pigeons over a planet horizon, shot with a stun ray, with an astronaut.
  - `origami` (skins `pastel` and `negative`): paper cranes over a paper-cut dusk, with a samurai. `negative` uses the same scene with a computed inverse palette, so the samurai's color scheme is reversed in `negative` too (user decision).
- **Companion (user request).** One character per scene (`fisherman`, `plague-doctor`, `astronaut`, `samurai`). At the end of every wave it pops up from the bottom edge for 1.8 s: a `cheer` pose with a happy tune if the wave hit at least one real target (not a decoy), a comic `gag` pose with a comic tune if it hit none. It is decoration: it cannot be shot, takes no input and does not change score. Two new effects, `cheer` (short rising fanfare) and `blooper` (comic descending slide with a wobble), identical in every skin.
- **Skins.** The five mandatory skins of the catalog (`retro` default, `neon`, `pastel`, `gothic`, `negative`) mapped as above, plus fresh skins proposed by `skin-designer`. A fresh skin must pick one of the four scenes and give it a new palette (it does not need a new scene). `themes: false` (no dark/light switch).
- **Input.** `pointerdown` on the canvas fires one shot (mouse, touch and pen, all pointer types). Pointer position is mapped to canvas pixels with `getBoundingClientRect`. No keyboard input, no touch pad, no swipe. The mouse cursor is the CSS `crosshair` on the canvas. A short muzzle flash at the shot point gives feedback for touch.
- **Platform HUD.** `onScore` = score, `onLines` = hits in the current round (label `Hits`), `onLevel` = round. No lives slot. Ammo pips (3 shots) and the quota tick row are drawn inside the canvas, a deliberate exception to "playfield only" (same precedent as Pong's score digits).
- **Sound effects only (user decision):** 11 generated `.wav` effects (9 gameplay plus the two companion tunes), no music loop.
- **Catalog:** entry in `lib/games.ts`, `games` row by migration, cover in the existing cover system, registry entry, `references/GAMES.md` and `CLAUDE.md`.
- **Pipeline:** normal `/full-game-impl` (the skin stage is not skipped; skins are a requirement of this spec).
- UI (cover, scenes, sprites, in-canvas HUD) designed with `/frontend-design`.

**Out of scope (for future specs):**

- Any extra button, menu, mode picker, difficulty picker or level select inside or beside the game for this game (user decision: no further buttons).
- Keyboard play, gamepad skins and a touch pad (the touch pad is not registered, the `hint` only).
- An animal companion (a dog or similar), a companion that can be shot, tapped or that changes gameplay, more than one pose pair per companion, companion dialogue text, two-player mode, multiple weapons, power-ups, bosses.
- Credits, Pin Collection pins or `award_credit` changes beyond the platform's normal play-time credit.
- Saving progress, passwords, or anything in `localStorage`.
- Music loop, haptic patterns new to `lib/haptics.ts`.
- Automated tests.

## Data model

Catalog entry in `GAMES` (`lib/games.ts`, last entry):

```ts
{
  id: "wingshot",
  title: "WINGSHOT",
  short: "Aim, click, shoot. Hit the flock before it escapes.",
  long: "Targets burst into the sky and you only get three shots per wave. Click or tap to fire, hit enough of each round to move on, and watch out for the decoys. Switch the skin and the whole scene changes: a lake, a haunted moor, deep space or a paper dusk.",
  cat: "SHOOTER",
  cover: "cover-wingshot",
  color: "yellow",
  plays: "0",
  origin: "ai",
}
```

The `games` row is a manual copy of this entry (migration `add_wingshot_game`), including `origin`.

Engine (`lib/wingshot/`: `constants.ts`, `utils.ts`, `entities.ts`, `companions.ts`, `scenes.ts`, `engine.ts`):

```ts
// constants.ts
export const WIDTH = 800,
  HEIGHT = 600;
export const SHOTS_PER_WAVE = 3;
export const ROUND_TARGETS = 10;
export const HIT_RADIUS = 36; // px, all pointer types
export const TOUCH_HIT_BONUS = 8; // px added for touch and pen
export const TARGET_SIZE = 64; // 16x16 run table drawn at x4
export const FALL_TIME = 0.5; // s, hit target falls
export const ESCAPE_TIME = 1.0; // s, target flies off when ammo is gone or its flight ends
export const COMPANION_TIME = 1.8; // s, companion visible at the end of each wave
export const COMPANION_RISE = 0.3; // s, rise from and sink to the bottom edge
export const ROUND_BANNER_TIME = 1.5; // s, "ROUND N"
export const ROUND_RESULT_TIME = 2.0; // s, "N / 10 HITS"
export const MAX_SCORE = 10_000_000;

export type TargetKind = "common" | "quick" | "rare" | "decoy";
export type SceneId = "lake" | "moors" | "orbit" | "origami";
export type CompanionId =
  "fisherman" | "plague-doctor" | "astronaut" | "samurai";
export type CompanionPose = "cheer" | "gag"; // 2 animation frames each

export const KIND_POINTS = { common: 100, quick: 200, rare: 400, decoy: -200 }; // score never below 0
export const PERFECT_BONUS = 1000; // x round, when all 10 targets of a round are hit

// utils.ts (pure)
export function quota(round: number): number; // min(10, 6 + floor((round - 1) / 2))
export function targetsPerWave(round: number): 1 | 2; // 1 for rounds 1-2, 2 from round 3
export function targetSpeed(round: number, kind: TargetKind): number; // px/s
export function flightTime(round: number): number; // s on screen before it escapes
export function kindWeights(round: number): Record<TargetKind, number>;
```

Round tuning (all values live in `constants.ts` and `utils.ts`):

- `targetSpeed` base = `min(420, 160 + 20 * (round - 1))`, multiplied by 1 (`common`), 1.6 (`quick`), 1.3 (`rare`), 0.8 (`decoy`).
- `flightTime` = `max(3.5, 6 - 0.3 * (round - 1))` s.
- `quota`: rounds 1-2 need 6 hits, 3-4 need 7, 5-6 need 8, 7-8 need 9, round 9 on needs 10.
- Kind weights per target: `quick` 0 until round 3 then 20%; `rare` 0 until round 2 then 5%; `common` the rest. A `decoy` is an extra non-quota flyer: from round 4, one decoy appears in 1 of every 3 waves. A decoy does not count toward the 10 targets and never costs a life or a quota point when it leaves.
- Movement: a launch from a random x along the bottom edge of the playfield (`lake`: from the water line), a heading between 20 and 160 degrees, a sine wobble of 24 px amplitude, bounces off the left, right and top walls. When the flight time ends, or when the wave has no shots left and the target is alive, it flies off the top over `ESCAPE_TIME` (counts as a miss).
- A hit target plays its fall (`FALL_TIME`), then the wave continues. One shot hits at most one target: the closest to the pointer inside the radius (`HIT_RADIUS`, plus `TOUCH_HIT_BONUS` for touch and pen).

Game state:

```ts
// engine.ts (internal)
type Phase = "banner" | "wave" | "companion" | "result" | "over";
interface WingshotEngineState {
  phase: Phase;
  companionPose: CompanionPose | null; // set when a wave ends, null outside "companion"
  companionX: number; // px, x of the last resolved target clamped to 100..700
  round: number; // 1..99
  waveIndex: number; // 0..(ROUND_TARGETS / targetsPerWave) - 1
  shotsLeft: number; // 0..3
  hitsThisRound: number; // counts quota targets only
  resolvedThisRound: number; // hits + escapes of quota targets
  score: number;
}

export interface WingshotCallbacks {
  onScore: (score: number) => void;
  onLines: (hitsThisRound: number) => void; // shown as "Hits"
  onLevel: (round: number) => void;
  onGameOver: (score: number) => void;
  onSound?: (name: WingshotSound) => void;
  onHaptic?: (name: "brick" | "clear" | "death") => void;
}
export type WingshotSound =
  | "shot"
  | "hit"
  | "rare"
  | "escape"
  | "decoy"
  | "roundStart"
  | "roundClear"
  | "perfect"
  | "gameover"
  | "cheer" // companion, wave with at least one real hit
  | "blooper"; // companion, wave with no real hit

export interface WingshotOptions {
  skin?: string;
}
```

Scoring and flow:

- Hit: `KIND_POINTS[kind]` (decoy subtracts 200, the score never goes below 0). The first shot of a wave does not give a bonus: points are flat per kind.
- Clearing a round (hits at or above the quota): the result card shows `N / 10 HITS`, then the next round starts. 10 of 10 hits adds `PERFECT_BONUS x round`.
- A round with hits below the quota ends the run: result card `N / 10 HITS · NEED Q`, then `onGameOver(score)` once.
- Score is clamped to 10,000,000. `start()` fires `onScore(0)`, `onLines(0)`, `onLevel(1)`.
- A pointer press with `phase !== "wave"`, or `shotsLeft === 0`, or while paused or over, does nothing and uses no shot. A shot that hits nothing uses one shot and plays `shot`.
- A wave ends when every target of the wave is hit or has left the screen. The engine then enters `companion` for `COMPANION_TIME`: pose `cheer` and `onSound("cheer")` if at least one non-decoy target of the wave was hit, else pose `gag` and `onSound("blooper")`. A wave with 2 targets where 1 is hit is a `cheer`; a wave where only a decoy was hit is a `gag`. The companion rises over `COMPANION_RISE`, holds, and sinks over `COMPANION_RISE`. After the last wave of a round, `result` follows the companion; otherwise the next wave starts. Pointer presses are ignored during `companion` (no shot is used). Freezes while paused.
- Companion placement: centered on the x of the last resolved target (`companionX`, clamped to 100..700), standing on the bottom edge of the playfield (`lake`: on the shore).

Scene and target table (every skin of a family shares it; art is own work):

| Scene     | Skins                | common         | quick            | rare          | decoy         | Shot effect         |
| --------- | -------------------- | -------------- | ---------------- | ------------- | ------------- | ------------------- |
| `lake`    | `retro`              | leaping minnow | darting trout    | golden carp   | old boot      | harpoon splash ring |
| `moors`   | `gothic`             | moth           | bat              | glow firefly  | barn owl      | lantern flash       |
| `orbit`   | `neon`               | alien pigeon   | swift drone-bird | golden pigeon | satellite     | stun-ray pulse      |
| `origami` | `pastel`, `negative` | paper crane    | paper swallow    | gold crane    | paper lantern | paper dart puff     |

Companion table (own art, 24x32 run tables drawn at x4 = 96x128 px, 2 frames per pose, comedy through movement only, no text):

| Scene     | Companion       | `cheer` pose                                | `gag` pose                                               |
| --------- | --------------- | ------------------------------------------- | -------------------------------------------------------- |
| `lake`    | `fisherman`     | holds a fish up on the line and grins       | reels in an old boot, hat flops over his eyes            |
| `moors`   | `plague-doctor` | raises the lantern, beak mask bobs with joy | the long beak droops, he sneezes into a handkerchief     |
| `orbit`   | `astronaut`     | thumbs up, floats a little off the ground   | spins upside down, helmet fogs up, boots kick in the air |
| `origami` | `samurai`       | salutes with the sword, topknot bounces     | sword stuck in its sheath backwards, trips and sits down |

In `negative` the companion uses the same computed inverse palette as the rest of the scene, so the samurai's colors are reversed there.

Registry entry (`components/game-registry.tsx`):

```ts
wingshot: {
  Canvas: WingshotCanvas,
  controls: "Click or tap a target to shoot. 3 shots per wave. Hit the quota to clear the round.",
  stats: { lives: false, lines: true, level: true },
  linesLabel: "Hits",
  appearance: { skins: [/* retro, neon, pastel, gothic, negative + fresh skins */], themes: false },
  sfx: { sounds: {/* 11 sounds */}, volume: 0.2 },
  touch: { hint: "Tap a target to shoot. 3 shots per wave." },
}
```

No `modes`, `difficultySelect`, `levelSelect`, `music` or `touch.pad`.

Rules and conventions:

- Engine follows the repo rules: framework-free (no `react` or `next` imports), no module-level state, `new WingshotEngine(canvas, callbacks, { skin })`, `start()`, `pause()`, `resume()`, `end()`, `destroy()`, `setSkin()` (redraws at once, also paused or over). Callbacks fire only on change. `onGameOver` fires once. `P` and `Esc` do nothing. Engines never play sound or vibrate: they emit `onSound` and `onHaptic`.
- The engine clock does not advance while paused (flight times, falls, banners, the companion freeze).
- `setSkin()` mid-run swaps scene, sprites, companion and palette without changing positions, timers or state (a companion mid-pose switches to the same pose of the new companion).
- Scenes are pre-rendered to offscreen canvases per skin (one per `setSkin`). No `mix-blend-mode`, no animated `mask-image`, no full-screen animated layer.
- The pointer listener is on the canvas only (`pointerdown`), removed on `destroy()`. `touch-action: none` already applies to canvases.
- `object-fit` stays default (4:3).
- Sprites are own `16x16` run tables in `entities.ts`, 2 flap frames per kind and scene. Companion sprites are own `24x32` run tables in `companions.ts` (4 companions x 2 poses x 2 frames). Asset URLs for sounds go through `withBasePath` (registry convention).
- All text in the canvas is English.

## Implementation plan

Before step 1, read the relevant guides in `node_modules/next/dist/docs/` if a step touches pages or caching (normally not). Invoke `/frontend-design` for the cover, scenes, sprites and in-canvas HUD.

1. **Catalog entry.** Add the `wingshot` entry to `GAMES`. `npm run lint` passes.
2. **Game migration.** Apply `add_wingshot_game` with MCP `apply_migration` (insert the `games` row identical to the entry, including `cover` and `origin`), rename the file in `supabase/migrations/` to the applied version, compare with `GAMES`, run `get_advisors`.
3. **Cover.** Add `cover-wingshot` to the existing cover system (a sky with a crosshair and a flock silhouette). Check it on `/library` and `/`.
4. **Engine core.** `constants.ts`, `utils.ts` (`quota`, `targetsPerWave`, `targetSpeed`, `flightTime`, `kindWeights`) and an engine skeleton that clamps score, runs the loop with a clamped `dt`, and supports `start`, `pause`, `resume`, `end`, `destroy`.
5. **Targets, waves and shots.** `entities.ts` with flight, bounce, wobble, fall and escape; wave and round flow; hit-scan with the closest-target rule; ammo; quota; game over; callbacks. Placeholder flat shapes for targets are enough here.
6. **Canvas wrapper and registry.** `components/wingshot-canvas.tsx` (engine created once in an effect, destroyed on cleanup, narrows `skin` with a guard, `pointerdown` mapped to canvas pixels) and the registry entry without `appearance` and `sfx` yet. The game is playable from the library.
7. **Scenes and sprites.** `scenes.ts` and the sprite tables for the four scenes, banner and result cards, ammo pips, quota ticks and muzzle flash in the canvas. Default skin `retro` (`lake`) first, then the other three.
8. **Companion.** Add the `companion` phase (wave end rule, `COMPANION_TIME`, rise and sink, `companionX`), `companions.ts` with the four companions and their two poses, drawing and the skin lookup, and `onSound("cheer" | "blooper")`. Check `cheer` after a hit, `gag` after a full miss, a decoy-only wave and a 2-target wave with one hit.
9. **Skins.** Done by the `skin-designer` stage: the five mandatory skins mapped as in the scene table, then fresh skins on top of the four scenes (they inherit that scene's companion). `appearance` added to the registry.
10. **Audio.** Generate the 11 effects (including `cheer` and `blooper`) with a one-off Node script (not shipped) into `public/game-assets/wingshot/`; add `sfx` to the registry; wire `onSound`. Check by ear that `cheer` is happy and `blooper` is comic and that both differ from `hit`, `escape` and `roundClear`.
11. **Touch and haptics.** `touch.hint` only (done by the `mobile-porter` stage); `GamePlayer` already sends `tap` on touch-downs for canvases with `touch`, and the engine emits `onHaptic("brick")` on hit, `"clear"` on a cleared round and `"death"` on game over.
12. **Walkthrough.** Playwright run (captures only in `.pwScreencaps/`): play by mouse at 1280 px and by touch emulation at 375 px, check every scene and its companion in both poses (the samurai in `pastel` and in `negative`), a failed round, a cleared round, a perfect round, a decoy, SAVE SCORE signed in, SIGN IN prompt as a guest.
13. **Docs.** Update `CLAUDE.md` (route notes, `GAMES`, per-game notes) and `references/GAMES.md`. Run `npm run lint` and `npm run build`.

Performance is Stage 4 of `/full-game-impl` (`game-perf-booster`), not a plan step.

## Acceptance criteria

Generic:

- [ ] `npm run lint` and `npm run build` finish without errors.
- [ ] `GAMES` has 12 entries, `wingshot` last, `origin: "ai"`; the `games` row matches it; the migration file carries the applied version; `get_advisors` shows no new warning.
- [ ] `/games/wingshot` and `/games/wingshot/play` load; the leaderboard works, SAVE SCORE works signed in, a guest sees `SIGN IN TO SAVE YOUR SCORE`.
- [ ] The detail page shows `🤖 A.I MADE` and the library card shows the emoji.
- [ ] All 11 other games behave as before.
- [ ] `lib/wingshot/` imports nothing from `react` or `next`.
- [ ] No `localStorage` key, cookie or extra table is written; `lib/storage.ts` is unchanged.
- [ ] No text is in Spanish. The words "Duck", "Hunt" and "Nintendo", a dog, a duck, a zapper and any third-party sprite, sound or melody do not appear anywhere.
- [ ] No React hydration warnings on reload; no `mix-blend-mode`, animated `mask-image` or full-screen animated layer was added.
- [ ] Leaving the page or EXIT stops the engine: no loop and no listener remains.
- [ ] Sound URLs load through `withBasePath` (also under `/Arcade-Vault-Claude`).

Game-specific:

- [ ] No control exists for this game beyond the existing platform buttons: no mode picker, no difficulty or level select, no touch pad, no on-canvas button. The whole game is played with pointer presses on the canvas.
- [ ] A mouse click, a finger tap and a pen tap each fire exactly one shot at the pressed point; keyboard keys do nothing.
- [ ] A shot hits the closest target inside 36 px (44 px for touch and pen) and never more than one target.
- [ ] A wave has exactly 3 shots; a press with 0 shots left, between waves, while paused or after game over uses no shot and does nothing.
- [ ] Rounds 1 and 2 launch 1 target per wave; from round 3, 2 targets per wave; every round has 10 quota targets.
- [ ] The quota is 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, ... for rounds 1, 2, 3, ...; ending a round below the quota calls `onGameOver` exactly once, and meeting it starts the next round.
- [ ] `common` gives 100, `quick` 200, `rare` 400; a decoy subtracts 200 and never takes the score below 0; a decoy never counts toward the 10 targets or the quota.
- [ ] `quick` appears from round 3, `rare` from round 2, decoys from round 4; none appears earlier.
- [ ] 10 of 10 hits adds `1000 x round`.
- [ ] A target that outlives its flight time, or is alive when the wave has no shots left, flies off the top and counts as a miss.
- [ ] The Hits slot shows hits in the current round and resets at each round; the Level slot shows the round; no Lives slot is shown.
- [ ] The canvas shows ammo pips, quota ticks, the round banner and the result card; PAUSED and GAME OVER are the platform's.
- [ ] `retro` shows the lake, `gothic` the moors, `neon` the orbit and `pastel` and `negative` the origami scene; `negative` is the inverse palette of `pastel`; changing the skin mid-run, also paused, swaps the scene and sprites at once and keeps score, positions and timers.
- [ ] Hit box, speed, score and sounds are identical in every skin.
- [ ] At the end of every wave the companion of the active scene rises, holds and sinks over 1.8 s: `lake` shows the fisherman, `moors` the plague doctor, `orbit` the astronaut, `origami` the samurai.
- [ ] A wave with at least one non-decoy hit shows the `cheer` pose and plays `cheer` once; a wave with no non-decoy hit (including a decoy-only hit and a wave where every target escaped) shows the `gag` pose and plays `blooper` once.
- [ ] The companion is not hit by a shot, takes no input, uses no shot and changes no score, quota or HUD value; a press during the companion phase does nothing.
- [ ] The companion appears after the last wave of a round before the result card, and the next wave or the result starts only after it sinks.
- [ ] In `negative` the samurai uses the inverse of the `pastel` samurai palette; every companion of `negative` follows the scene's inverse palette.
- [ ] Changing the skin while the companion shows swaps it for the new scene's companion in the same pose without restarting its timer; pausing freezes it.
- [ ] No companion is an animal and none resembles any third-party character.
- [ ] Each fresh skin built by `skin-designer` uses one of the four scenes.
- [ ] 11 sound effects exist at volume 0.2 (`cheer` is a happy rising tune, `blooper` a comic descending one, both audibly different from the other nine) and nothing plays while muted, paused or after game over; there is no music loop; MUTE shows `SOUND ON/OFF`.
- [ ] Below 768 px the touch hint shows; no pad is rendered; page does not scroll or zoom while tapping the canvas.
- [ ] While paused, flight times, falls and banners do not advance.

## Decisions

- **Yes:** the Duck Hunt loop (limited shots per wave, per-round quota, escaping targets) because mechanics are free to reuse. **No:** the name, dog, ducks, zapper, NES palette, layout and every asset of that game, to stay clear of trademark.
- **Yes:** skin = whole theme (user decision: fish default, moths for gothic, space pigeons for neon, paper cranes for pastel and negative). **No:** palette-only skins, which would keep one fiction.
- **Yes:** a human companion per scene (fisherman, plague doctor, astronaut, samurai; user request), with a happy tune on a hit and a comic tune on a miss. **No:** a dog or any animal, to stay clear of the original's mascot.
- **Yes:** the companion reacts at the end of each wave, as the original's mascot does. Not per shot, which would interrupt the aim.
- **Yes:** a wave counts as a success if at least one real (non-decoy) target was hit; a wave of 2 targets with 1 hit cheers. **No:** requiring all targets, which would make most 2-target waves a gag.
- **Yes:** the two tunes are shared by all skins (`cheer`, `blooper`), only the sprite changes. Keeps "sounds identical in every skin" true.
- **Yes:** `negative` reverses the samurai's colors by using the scene's inverse palette (user request), not a separate hand-made palette.
- **Yes:** the companion is decoration only: not shootable, no score, no input. **No:** a bonus for tapping it (would add a second target and break the one-action rule).
- **Yes:** `negative` uses the paper-crane scene with an inverse palette. The user's answer listed "3 to pastel, 3 to Negative", so both point to option 3 (paper cranes). If `negative` was meant to take another theme, change the scene table and the acceptance criterion in one edit.
- **Yes:** `retro` (the default skin) gets the fish lake (user decision: "option 4 to default").
- **Yes:** waves with 3 shots and a quota (user choice, recommended). **No:** endless lives or timed rounds.
- **Yes:** one input only, `pointerdown` on the canvas, same for mouse, touch and pen. **No:** a fire button, a touch pad, keyboard aiming (user requirement: no further buttons).
- **Yes:** skins stay (user choice), so the normal four-stage pipeline runs. **No:** a `Pipeline overrides` skip.
- **Yes:** sound effects only, no music (user choice). **No:** a loop or third-party audio.
- **Yes:** instant hit-scan at the pressed point. **No:** projectiles with travel time, which would be unfair for touch.
- **Yes:** a 44 px hit radius for touch and pen (36 + 8) because a finger covers the target. **No:** different radius per skin.
- **Yes:** flat points per kind, no first-shot bonus. Keeps the rules easy to read without extra HUD.
- **Yes:** decoys only from round 4 and penalty-only (no life). **No:** instant game over on a decoy hit.
- **Yes:** `onLines` shown as `Hits` for the quota progress and ammo/quota drawn in the canvas. **No:** a new HUD slot in `GamePlayer`.
- **Yes:** no `levelSelect`, `modes` or `difficultySelect`, since those add buttons (user requirement).
- **Yes:** game id `wingshot`, title `WINGSHOT`. The name is generic, not a known trademark in games; confirm before public marketing.

## Risks

| Risk                                                                                                        | Mitigation                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| The companion pause after every wave slows the game (up to 10 pauses of 1.8 s per round).                   | One pause of 1.8 s is short and is also the rest between waves; `COMPANION_TIME` is a constant if it feels slow.           |
| Four scenes with four sprite sets per kind is a lot of art (about 32 run tables, plus 16 companion frames). | Sprites are 16x16 with 2 frames; shared flight code; if it overruns, ship `lake` and `moors` first and add the others.     |
| A skin change mid-run could desync scene and sprites.                                                       | Scene and sprite set are looked up from the skin at draw time; `setSkin()` only swaps the lookup and re-renders the scene. |
| A finger hides the target, so taps feel unfair.                                                             | 44 px radius for touch, muzzle flash at the tap point, 3 shots per wave.                                                   |
| Taps on the platform buttons could count as shots.                                                          | The listener is on the canvas element only; the buttons are outside it.                                                    |
| Double-tap zoom or page scroll while tapping fast.                                                          | `touch-action: none` on the canvas (already global); verified in the walkthrough at 375 px.                                |
| Round 1 may feel too easy or too hard (quota 6 of 10).                                                      | All tuning numbers are constants in `constants.ts` and `utils.ts`; retune after the walkthrough.                           |
| Wrong skin-to-scene mapping for `negative`.                                                                 | Flagged in Decisions; one table edit changes it.                                                                           |
| A resemblance to the original in the fish scene (waterline, reeds).                                         | Own layout and palette, a human companion (no animal), no gun sprite; reviewed in the walkthrough.                         |

## What is **not** in this spec

- Any extra button, menu, mode, difficulty or level select for the game.
- Keyboard play, touch pad, gamepad skins.
- An animal companion, a shootable or interactive companion, companion text, two-player mode, power-ups, bosses.
- Music, new haptic patterns, credits beyond the platform's play-time credit.
- Saving progress, passwords, `localStorage`.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
