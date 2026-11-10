# SPEC 17 — Galactic DogFight (arcade fixed-shooter, Galaga-style)

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 06, SPEC 10, SPEC 11, SPEC 12, SPEC 13, SPEC 16 (Space Invaders)
> **Date:** 2026-11-10
> **Objective:** Build a faithful arcade-style "Galaga" clone, named Galactic DogFight, as a TypeScript engine plus a React canvas component with our own generated art, music and sound effects, add it to the catalog as a new entry `galactic-dogfight`, and wire its score, lives and stage into the platform HUD and the GAME OVER / SAVE SCORE flow.

## Why this spec exists

The user asked for a 1 to 1 copy of Galaga, including music and sound effects. "1 to 1" is applied to the **rules and feel** (formation, entry flights, dive attacks, Boss Galaga with the tractor beam, capture and rescue, dual fighter, Challenging Stages, stage badges, accuracy stats, arcade scoring and extra lives).

It is **not** applied to the original **assets or name**. Namco owns the original sprites, the ROM audio, the melodies and the "Galaga" trademark, and this site is public (see the third-party asset warning in `CLAUDE.md`). So, by user decision:

- The catalog title is **GALACTIC DOGFIGHT** (id `galactic-dogfight`), not "Galaga".
- All art is drawn by us (pixel run tables, no image files).
- All music and sound effects are our own generated `.wav` files that evoke the arcade style. They must not reproduce the original Galaga melodies or sound samples note for note.

The catalog has no existing Galaga placeholder, so this is a plain addition (no fake entry to leave untouched). There is no reference code: numbers below are design values, tuned in play. Every feature used already exists in the platform (`stats`, `appearance`, `sfx`, `music`, `touch`), so this spec needs no new registry field and no change to `GamePlayer`.

## Scope

**In:**

- Catalog: new entry `galactic-dogfight` appended after `space-invaders` in `GAMES`, category `SHOOTER`.
- Playfield: portrait canvas **480x600** (4:3 CRT frame, side bars via `object-fit: contain`, same pattern as Tetris 440x600). Scrolling starfield drawn inside the canvas.
- Player: one fighter along the bottom, 3 lives, up to 2 shots in flight (4 with the dual fighter).
- Enemies (own designs): **Bee** (20), **Butterfly** (16) and **Boss** (4, needs 2 hits) in a 10 x 5 formation of 40 ships.
- Stage flow: `STAGE n` banner and start jingle, five entry waves of 8 ships flying Bezier paths into formation, formation sway and breathing, dive attacks with shots, Boss dives with escorts, stage clear and accuracy banner, next stage. Endless stages.
- **Boss tractor beam, capture and rescue, dual fighter**: a Boss can capture the fighter; shooting that Boss while it dives rescues the ship, which docks beside the player for a dual fighter (double shots, wider target).
- **Challenging Stages** on stage 3 and every 4th stage after it (3, 7, 11, ...): five waves of 8 ships that fly a path and leave, never shoot; 100 points each; perfect 40 / 40 gives 10,000.
- Arcade scoring (table in Data model), extra lives at 20,000 and 70,000 then every 70,000 (max 5).
- In-canvas extras (deliberate exceptions to "canvas draws playfield only", like Pong's scoreboard): `STAGE n` / `READY` / `CHALLENGING STAGE` / `FIGHTER CAPTURED` / `PERFECT` banners, the end-of-stage `SHOTS FIRED / NUMBER OF HITS / HIT-MISS RATIO` banner, reserve fighters bottom-left, stage badges bottom-right. Score, Lives, Level, PAUSED and GAME OVER stay in the platform.
- End of run: the last fighter destroyed or captured, or END.
- Platform HUD: Score, Lives (total fighters including the active one) and Level (= stage); Lines slot hidden.
- Controls (desktop): `←` `→` / `A` `D` move; `Space` fires (hold = auto-fire).
- Controls (touch, below 768px and when the GamePad menu turns the pad on): `left` / `right` hold buttons move, `A` fires (hold). Other slots unmapped.
- Haptics through existing patterns only: `death` (fighter destroyed or captured), `clear` (stage cleared). Existing `tap` and `gameover` apply as for every game.
- **Audio** (all own generated `.wav`, no licensing):
  - Sound effects, volume `0.2`, via existing `sfx` and `useSoundEffects`: `shoot`, `hit` (enemy destroyed), `bossHit` (Boss damaged, not yet dead), `death` (fighter destroyed), `gameover`, `stageStart` (jingle), `beam` (tractor beam hum), `capture` (fighter captured), `rescue` (fighter rescued and docked), `challenge` (Challenging Stage jingle), `perfect` (perfect bonus fanfare), `extraLife`.
  - **Looping background music** via existing `music` (volume `0.12`): one original chiptune loop of about 12 s. The arcade game has no constant music; this is an explicit user addition.
  - The existing mute button under the CRT is the only sound toggle (label `MUSIC ON/OFF` because `music` is set). No `pauseToggle`.
- Skins: `retro` (default), `neon`, `pastel`, `gothic`, `negative` through existing `appearance` with `themes: false`. Memory only.
- Pure TypeScript engine in `lib/galactic-dogfight/` with no React and no Next.js imports.
- Client component `components/galactic-dogfight-canvas.tsx`.
- Migration inserting the `games` row, applied with MCP `apply_migration`.
- New cover class `cover-galactic-dogfight` in `app/globals.css`, designed with `/frontend-design`.
- Frame-time check with the SPEC 12 method (`references/perf/measure-fps.md`), result logged in `references/perf/perf-log.md`.
- Update `CLAUDE.md` and `references/GAMES.md`.

**Out of scope (for future specs):**

- Original Namco sprites, ROM audio, original melodies, the name "Galaga".
- 2-player alternating mode, mode picker, difficulty select.
- Stage select in PAUSED (no `levelSelect`, no `setLevel`; the user did not ask for it).
- Light theme (`themes: false`), remembering skin between runs, high-DPI canvas scaling.
- Real game stats: `plays` stays a mock field.
- Changes to other games, the Home, auth, the Hall of Fame layout, `GamePlayer` or the registry types.
- Automated tests (no test runner is configured).

## Data model

Catalog entry (the `Game` type is unchanged). Final `color` is picked with `/frontend-design`; it must be valid in the existing `Game` color union and differ from `space-invaders` (`cyan`) and `invaders` (`green`).

```ts
// lib/games.ts — appended to GAMES, after "space-invaders"
{
  id: "galactic-dogfight",
  title: "GALACTIC DOGFIGHT",
  short: "Break the formation. Rescue your captured ship.",
  long: "Alien squadrons swoop in, lock into formation and dive at your fighter. Shoot them down, beware the Boss tractor beam that steals your ship, and win it back for a deadly dual fighter. Survive the Challenging Stages for a perfect bonus.",
  cat: "SHOOTER",
  cover: "cover-galactic-dogfight",
  color: "yellow", // placeholder: verify it exists in the Game color union
  plays: "0",
}
```

Engine public API:

```ts
// lib/galactic-dogfight/engine.ts
export type GalacticDogfightSkin =
  "retro" | "neon" | "pastel" | "gothic" | "negative";

export type GalacticDogfightSound =
  | "shoot"
  | "hit"
  | "bossHit"
  | "death"
  | "gameover"
  | "stageStart"
  | "beam"
  | "capture"
  | "rescue"
  | "challenge"
  | "perfect"
  | "extraLife";

export interface GalacticDogfightCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void; // total fighters incl. the active one
  onLevel: (stage: number) => void;
  onGameOver: (finalScore: number) => void; // once per run
  onSound?: (name: GalacticDogfightSound) => void;
  onHaptic?: (name: "death" | "clear") => void;
}

export class GalacticDogfightEngine {
  constructor(
    canvas: HTMLCanvasElement,
    callbacks: GalacticDogfightCallbacks,
    options?: { skin?: GalacticDogfightSkin },
  );
  start(): void; // resets state, attaches listeners, starts rAF; idempotent; fires onScore(0), onLives(3), onLevel(1)
  pause(): void; // stops updating, clears held keys
  resume(): void; // continues without a time jump
  end(): void; // ends the run now and calls onGameOver once
  destroy(): void; // cancels rAF, removes every listener
  setSkin(skin: GalacticDogfightSkin): void; // redraws at once, also paused or after game over
}
```

Internal state (not exported):

```ts
type EnemyKind = "bee" | "butterfly" | "boss";
type EnemyMode =
  | "entering" // flying its entry path toward the slot
  | "formation" // parked in its slot (sway and breathing)
  | "diving" // on an attack path
  | "returning" // re-entering from the top toward its slot
  | "beaming" // Boss only: stopped, emitting the tractor beam
  | "challenge" // Challenging Stage flight, never shoots, leaves the screen
  | "dead";

interface Enemy {
  id: number;
  kind: EnemyKind;
  col: number; // 0..9, formation slot
  row: number; // 0..4
  mode: EnemyMode;
  t: number; // path progress, seconds
  x: number;
  y: number; // center, px
  hp: number; // Boss starts at 2, others 1
  carrying: boolean; // Boss holds a captured fighter beside it
  escortOf: number | null; // Boss id when diving as an escort
  wave: number; // 0..4, entry group
}

interface Fighter {
  x: number; // center of the pair, px
  dual: boolean; // two ships side by side
  alive: boolean;
  state: "ready" | "playing" | "captured" | "respawning";
  respawnIn: number; // seconds, engine clock
}

interface Shot {
  x: number;
  y: number;
} // player shot, top of the bullet
interface EnemyShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface RescuePod {
  x: number;
  y: number;
  angle: number;
} // freed ship falling toward the player

interface State {
  stage: number;
  phase: "banner" | "entry" | "battle" | "clearing" | "stats" | "over";
  phaseT: number; // seconds in the phase
  challenging: boolean;
  enemies: Enemy[]; // 40 per stage
  fighter: Fighter;
  shots: Shot[];
  enemyShots: EnemyShot[];
  pod: RescuePod | null;
  beam: { bossId: number; t: number } | null;
  stars: { x: number; y: number; speed: number; phase: number }[];
  swayT: number;
  diveTimer: number;
  fired: number;
  hits: number; // accuracy for the stats banner
  challengeHits: number;
  score: number;
  lives: number; // total fighters
  nextExtraLife: number; // next score threshold
  over: boolean;
}
```

Module layout:

| File                                 | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/galactic-dogfight/constants.ts` | `W = 480`, `H = 600`, `COLS = 10`, `ROWS = 5`, `SLOT_X0 = 60`, `PITCH_X = 40`, `SLOT_Y0 = 110`, `PITCH_Y = 34`, `ENEMY_W = 28`, `ENEMY_H = 24`, `PLAYER_Y = 540`, `PLAYER_W = 26`, `PLAYER_H = 26`, `DUAL_GAP = 28`, `PLAYER_SPEED = 240`, `SHOT_SPEED = 700`, `MAX_SHOTS = 2` (4 dual), `FIRE_COOLDOWN = 0.16`, `START_LIVES = 3`, `MAX_LIVES = 5`, `RESPAWN_DELAY = 2`, `BEAM_DURATION = 3`, `SWAY_AMP = 16`, `SWAY_PERIOD = 4`, `SCORES`, `EXTRA_LIFE_FIRST = 20000`, `EXTRA_LIFE_STEP = 70000`, `ENTRY_GROUPS`, `MAX_DT = 0.05`, `MAX_STEP = 8`, `MAX_SCORE = 10_000_000`, `SKINS` |
| `lib/galactic-dogfight/paths.ts`     | Bezier path tables `ENTRY_PATHS`, `CHALLENGE_PATHS`, `DIVE_PATHS` as control points (own design), `pathPoint(path, t)`, `pathDuration(path, speed)`                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `lib/galactic-dogfight/utils.ts`     | `clampScore`, `stageParams(stage)`, `isChallengingStage(stage)`, `slotPosition(col, row, swayT)`, `bossComboPoints(escorts)`, `badgesFor(stage)`, `rectsOverlap`, `inBeam(x, beam)`                                                                                                                                                                                                                                                                                                                                                                                                    |
| `lib/galactic-dogfight/entities.ts`  | Types `Enemy`, `Fighter`, `Shot`, `EnemyShot`; sprite run tables (two wing frames per enemy, Boss in two color states, fighter, dual fighter, captured red fighter); `drawEnemy`, `drawFighter`, `drawShot`, `drawEnemyShot`, `drawBeam`, `drawStars`, `drawReserve`, `drawBadges`, `drawBanner`, all receiving `ctx` as argument                                                                                                                                                                                                                                                      |
| `lib/galactic-dogfight/engine.ts`    | `GalacticDogfightEngine`: input, state machine, entry and dive logic, capture and rescue, collisions, scoring, draw, loop, callbacks                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

Entry groups (`ENTRY_GROUPS`, 40 ships in 5 waves of 8; design values):

| Wave | Contents             | Enters from |
| ---- | -------------------- | ----------- |
| 0    | 4 Boss + 4 Butterfly | top, left   |
| 1    | 8 Butterfly          | top, right  |
| 2    | 4 Butterfly + 4 Bee  | left edge   |
| 3    | 8 Bee                | right edge  |
| 4    | 8 Bee                | left edge   |

Totals: 4 Boss, 16 Butterfly, 20 Bee. Formation slots: row 0 = Bosses (cols 3-6), rows 1-2 = Butterflies (cols 1-8), rows 3-4 = Bees (cols 0-9). Waves launch 1.4 s apart; ships in a wave leave 0.12 s apart.

Scoring (`SCORES`, arcade values):

| Target                                     | Points     |
| ------------------------------------------ | ---------- |
| Bee in formation / diving                  | 50 / 100   |
| Butterfly in formation / diving            | 80 / 160   |
| Boss in formation / diving alone           | 150 / 400  |
| Boss diving with 1 escort / with 2 escorts | 800 / 1600 |
| Rescue (captured fighter docks)            | 1000       |
| Captured fighter destroyed while diving    | 500        |
| Challenging Stage ship                     | 100        |
| Challenging Stage perfect (40 / 40)        | +10,000    |

Boss takes 2 hits: the first changes its color state and plays `bossHit`; the second destroys it and scores. All scores pass through `clampScore`.

Stage difficulty (`stageParams(stage)`, design values, caps at stage 31):

| Param                      | Formula                                 |
| -------------------------- | --------------------------------------- |
| Dive interval              | `max(0.8, 2.6 - 0.15 * (stage - 1))` s  |
| Max simultaneous divers    | `min(6, 2 + floor((stage - 1) / 2))`    |
| Enemy shot speed           | `min(380, 220 + 12 * (stage - 1))` px/s |
| Max enemy shots            | `min(6, 3 + floor((stage - 1) / 4))`    |
| Dive speed factor          | `min(1.6, 1 + 0.03 * (stage - 1))`      |
| Enemies shoot during entry | from stage 4                            |

HUD mapping:

| Platform HUD | Source        | Callback  |
| ------------ | ------------- | --------- |
| Score        | `state.score` | `onScore` |
| Lives        | `state.lives` | `onLives` |
| Lines slot   | hidden        | none      |
| Level        | `state.stage` | `onLevel` |

Registry entry (`components/game-registry.tsx`, existing fields only):

```ts
"galactic-dogfight": {
  Canvas: GalacticDogfightCanvas,
  controls: [
    { keys: ["←", "→"], label: "MOVE" },
    { keys: ["SPACE"], label: "FIRE" },
  ],
  stats: { lives: true, lines: false, level: true },
  music: {
    src: withBasePath("/game-assets/galactic-dogfight/music.wav"),
    volume: 0.12,
  },
  sfx: {
    sounds: {
      shoot: withBasePath("/game-assets/galactic-dogfight/shoot.wav"),
      hit: withBasePath("/game-assets/galactic-dogfight/hit.wav"),
      bossHit: withBasePath("/game-assets/galactic-dogfight/boss-hit.wav"),
      death: withBasePath("/game-assets/galactic-dogfight/death.wav"),
      gameover: withBasePath("/game-assets/galactic-dogfight/gameover.wav"),
      stageStart: withBasePath("/game-assets/galactic-dogfight/stage-start.wav"),
      beam: withBasePath("/game-assets/galactic-dogfight/beam.wav"),
      capture: withBasePath("/game-assets/galactic-dogfight/capture.wav"),
      rescue: withBasePath("/game-assets/galactic-dogfight/rescue.wav"),
      challenge: withBasePath("/game-assets/galactic-dogfight/challenge.wav"),
      perfect: withBasePath("/game-assets/galactic-dogfight/perfect.wav"),
      extraLife: withBasePath("/game-assets/galactic-dogfight/extra-life.wav"),
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

Migration (`supabase/migrations/<version>_add_galactic_dogfight_game.sql`; the file takes the version `apply_migration` assigns, which must be later than `20261110204111`):

```sql
insert into public.games (id, title, short, long, cat, cover, color) values
  ('galactic-dogfight', 'GALACTIC DOGFIGHT', 'Break the formation. Rescue your captured ship.',
   'Alien squadrons swoop in, lock into formation and dive at your fighter. Shoot them down, beware the Boss tractor beam that steals your ship, and win it back for a deadly dual fighter. Survive the Challenging Stages for a perfect bonus.',
   'SHOOTER', 'cover-galactic-dogfight', '<same color as lib/games.ts>');
```

Rules and conventions:

- Coordinates: origin top-left, `y` grows down, units are canvas pixels and seconds.
- Update on the engine clock: `dt` clamped to `MAX_DT`. Shots and enemy shots move in sub-steps of at most `MAX_STEP` px so they never tunnel. Drawing every frame. The engine clock (including stars, sway, banners, beam, respawn) freezes while paused.
- **Phases:** `banner` (1.8 s: `STAGE n`, or `CHALLENGING STAGE`, with the `stageStart` or `challenge` jingle; `READY` on the first stage) then `entry` then `battle` then `clearing` (1.5 s) then `stats` (3 s) then the next stage. The fighter can move and shoot from `entry` on. In `banner` it is visible but inert.
- **Entry:** each wave launches its 8 ships along `ENTRY_PATHS[wave]` and they land in their slots. Ships that finished entry sway with the formation. The formation sways `SWAY_AMP` px sideways with period `SWAY_PERIOD` and breathes (pitch scales by up to +-6%, period 3 s) once all 40 are parked. `battle` starts when every ship is in formation.
- **Dives:** every `diveInterval` seconds, if fewer than `maxDivers` ships dive and the fighter is playing, a random formation ship leaves its slot on a dive path aimed at the fighter's x at launch (bee, butterfly) or a Boss launches with up to 2 butterflies from the slots next to it as escorts. A diver may fire 1-2 enemy shots during the dive. A diver that leaves the bottom re-enters at the top (`returning`) and flies back to its slot; during the dive its slot is kept.
- **Enemy shots:** aimed at the fighter's x at fire time, speed `stageParams.shotSpeed`, never more than `maxShots` at once, removed at the bottom.
- **Fighter hit:** an enemy shot or a diving ship overlapping the fighter destroys it (a ramming ship dies too, scoring normally). Lives -1, `onSound("death")`, `onHaptic("death")`, all enemy shots are cleared, new dives are held until the fighter is back, and the fighter respawns after `RESPAWN_DELAY` of engine clock at center. With the dual fighter, a hit destroys both ships and costs one life (they count as one life). 0 lives ends the run.
- **Shooting:** `Space` fires a bullet from the fighter (two bullets, one per ship, with the dual fighter) if shots in flight are below the cap and `FIRE_COOLDOWN` has passed since the last shot. A hit enemy dies (Boss: 2 hits). `fired` counts bullets, `hits` counts bullets that hit an enemy.
- **Tractor beam:** a diving Boss may, when no ship is already captured by any Boss and the fighter is playing, stop above `y = 300`, enter `beaming` for `BEAM_DURATION` and draw an expanding cone beam with `onSound("beam")`. A fighter whose x is inside the cone while the beam is active is captured: it lifts to the Boss, spins, `onSound("capture")`, `onHaptic("death")`, lives -1, and the Boss returns to its slot carrying a red captured fighter beside it (`carrying = true`). With the dual fighter, only one ship is captured (the pair becomes a single fighter, no life lost). Killing the Boss during the beam prevents the capture. If the captured fighter was the last life the run ends after the capture animation, with no rescue possible.
- **Rescue:** a Boss that carries a ship and is destroyed **while diving** (not in formation) frees it: a `RescuePod` spins down toward the fighter row; if the playing fighter touches it, the ship docks and the dual fighter starts (`onSound("rescue")`, +1000). A missed pod leaves the screen. A carrying Boss destroyed **in formation** destroys the captured fighter with it (no rescue). A carried ship that dives with its Boss as an escort and is shot scores 500 and is lost.
- **Extra lives:** at 20,000, 70,000 and every 70,000 after, `lives + 1` (max 5), `onSound("extraLife")`, `onLives` fires.
- **Stage clear:** when no enemy is alive (including returning ones), `onHaptic("clear")`, go to `clearing` then `stats`. The stats banner shows `SHOTS FIRED n`, `NUMBER OF HITS n`, `HIT-MISS RATIO nn.n%` (0 shots shows 0.0%). The stage number then increases and `onLevel` fires.
- **Challenging Stage:** `isChallengingStage(stage)` is true for 3, 7, 11, ... (`stage >= 3 and (stage - 3) % 4 === 0`). The 40 ships fly `CHALLENGE_PATHS` in 5 waves, never shoot, never dive and never form. Each hit is `100`. The stage ends when all 40 have been shot or have left the screen. The stats banner shows `NUMBER OF HITS n`; `n === 40` adds `+10,000` with `PERFECT` and `onSound("perfect")`. Missed enemies are simply gone. The fighter and carrying Boss rules do not apply (no Boss formation, no capture).
- **Input:** `keydown` and `keyup` on `window` using `e.code` (`ArrowLeft`, `ArrowRight`, `KeyA`, `KeyD`, `Space`). Held set per code; left and right together cancel; the fighter clamps inside the field (dual fighter clamps both ships). `Space` is read as held (auto-fire), so `e.repeat` is irrelevant. `preventDefault` only for those keys while running and not paused. `P` and `Esc` do nothing. The touch pad sends the same synthetic events (SPEC 10): no touch-specific input in the engine.
- Held keys are cleared on `pause()`, window `blur` and `visibilitychange` (hidden).
- Callbacks fire only on change. `start()` fires `onScore(0)`, `onLives(3)`, `onLevel(1)`. `onGameOver` fires once per run (last fighter lost, last fighter captured, or `end()`), then the loop and key listeners stop. `end()` with score 0 still calls `onGameOver(0)`.
- `onSound` rules: `shoot` per bullet, `hit` per destroyed enemy, `bossHit` per non-lethal Boss hit, `death` when a fighter is destroyed, `beam` when a beam starts, `capture` at capture, `rescue` at dock, `stageStart` at a normal stage banner, `challenge` at a Challenging Stage banner, `perfect` on a perfect bonus, `extraLife` per extra life, `gameover` once at the end of the run (after `death` or `capture` if that caused it; alone for `end()`). Nothing fires after game over or while paused.
- **Audio files** in `public/game-assets/galactic-dogfight/`, generated by a one-off Node script that is not shipped. Mono, 22.05 kHz, 16-bit, short fade-outs, normalized so volume `0.2` is clearly audible but not loud; the 12 sounds must be audibly different from each other. Design values: `shoot` 70 ms falling square chirp; `hit` 150 ms noise burst with a falling tone; `bossHit` 120 ms metallic two-tone ping; `death` 700 ms descending noise sweep; `gameover` 900 ms three falling tones; `stageStart` about 1.6 s rising arpeggio jingle; `challenge` about 1.6 s different jingle; `beam` 3 s warbling hum (matches `BEAM_DURATION`); `capture` 900 ms spiraling up tone; `rescue` 700 ms rising happy arpeggio; `perfect` about 2 s fanfare; `extraLife` 600 ms bright jingle; `music.wav` about 12 s original loop that loops without a click. Melodies are original compositions, not the arcade tunes.
- Entities receive `ctx` as argument; no module-level game state. Colors come from `SKINS`.
- Canvas 480x600 is scaled by CSS and uses `object-fit: contain` (non-4:3).
- Performance rules from SPEC 12 apply: no `mix-blend-mode`, no animated `mask-image`, no full-screen animated layers over or behind the canvas (the starfield is drawn inside the canvas as about 60 tiny `fillRect` calls). Neon glow uses `shadowBlur` on the fighter and shots only, never on the 40 enemies or the beam.
- The canvas draws the playfield and the in-canvas extras listed in Scope. Banner text is in English.

## Implementation plan

Before step 1, read the relevant guides in `node_modules/next/dist/docs/` as required by `AGENTS.md` (only if a step touches pages or caching; this one normally does not). Invoke `/frontend-design` for the cover and the skin palettes, per `CLAUDE.md`.

1. **Catalog entry.** Append `galactic-dogfight` to `GAMES` in `lib/games.ts` with a temporary existing cover. `npm run build` passes; `/games/galactic-dogfight` and `/games/galactic-dogfight/play` render with the fake player; all other entries and the Home are unchanged.
2. **Migration.** Write the migration file, apply it with `apply_migration`, rename the file to the version the tool assigns, check `select * from games where id = 'galactic-dogfight'` matches `lib/games.ts`, run `get_advisors`. Types are not regenerated (schema unchanged).
3. **Cover.** `.cover-galactic-dogfight` in `app/globals.css` (designed with `/frontend-design`: formation and a diving ship motif, different from the `invaders` and `space-invaders` covers); set `cover` in `lib/games.ts`. Library card and detail page show it.
4. **Constants, paths and utils.** `constants.ts` (with the `retro` skin only), `paths.ts`, `utils.ts`. `npm run build` passes.
5. **Entities.** `entities.ts`: sprite run tables and draw functions (own designs). `npm run lint` and `npm run build` pass.
6. **Engine, core.** State reset, input, fighter movement and shooting, starfield, stage phases and banners, entry waves into the formation, sway and breathing, collisions, scoring, stage clear and stats banner, public API with game over by `end()`. The folder imports nothing from `react` or `next`.
7. **Engine, attacks and lives.** Dives with escorts, enemy shots, fighter hit and respawn, lives, extra lives, `onLives` and `onLevel`, stage difficulty progression.
8. **Engine, Boss mechanics.** 2-hit Boss, tractor beam, capture, carrying Boss, rescue pod, dual fighter, last-life-captured game over.
9. **Engine, Challenging Stages.** `CHALLENGE_PATHS`, no-shoot flight, hit counting, perfect bonus. `npm run lint` and `npm run build` pass.
10. **Canvas wrapper.** `components/galactic-dogfight-canvas.tsx`, mirroring `components/space-invaders-canvas.tsx`: Strict-Mode safe (one live loop), latest callbacks in a ref, `skin` effect, `paused` and `endSignal` handling.
11. **Registry wiring.** Add the entry (without `touch`, `sfx`, `music`, and with only the `retro` skin for now). HUD shows Score, Lives and Level. Screenshot each other real game's HUD and a fake game to confirm no change.
12. **Audio.** Generate the 12 `.wav` effects and `music.wav` into `public/game-assets/galactic-dogfight/`. Emit `onSound` from the engine, add `sfx` and `music`, pass `onSound` through the wrapper. Check by ear: all effects audibly different at volume 0.2, music loops cleanly, everything silent when muted, music pauses with the run and restarts with PLAY AGAIN.
13. **Touch.** Add `touch.pad` and `touch.hint`; wire `onHaptic`. Check at 375px and with the GamePad menu at 1280px, with a cross skin and a joystick skin.
14. **Skins.** Add `neon`, `pastel`, `gothic`, `negative` palettes and extend the registry skin list; check 3:1 contrast between enemies, fighter, shots and field.
15. **Walkthrough.** In `npm run dev` with Playwright (captures only in `.pwScreencaps/`): reach stage 2 and stage 3 (Challenging), get captured and rescue a ship, play to game over, SAVE SCORE as a signed-in user, confirm the row in `scores`, on `/games/galactic-dogfight` and in the Hall of Fame after a reload, at 1280px and 375px. Cycle the skins and capture each.
16. **Performance.** Measure frame time with `references/perf/measure-fps.md`; log the result in `references/perf/perf-log.md`. Fix the engine only if the target is missed.
17. **Docs.** Update `CLAUDE.md` (engine location, callbacks, canvas size, skins, audio, touch mapping, catalog sync) and `references/GAMES.md`. Run `npm run lint` and `npm run build`.

## Acceptance criteria

Generic:

- [ ] `npm run lint` and `npm run build` finish without errors.
- [ ] `lib/games.ts` contains `galactic-dogfight` as the last entry with the listed values; all other entries are unchanged; the Home still shows the same mini cards.
- [ ] `select * from games where id = 'galactic-dogfight'` matches `lib/games.ts` (`id`, `title`, `short`, `long`, `cat`, `cover`, `color`); the migration file matches what was applied; `get_advisors` shows no new warning.
- [ ] `/library` shows the card; it links to `/games/galactic-dogfight`; PLAY goes to `/games/galactic-dogfight/play`.
- [ ] The play page shows a real canvas in the CRT frame with no mode picker and no auto-incrementing score.
- [ ] PAUSE freezes everything (stars, formation, dives, beam, banners, respawn timer) and shows the PAUSED overlay; RESUME continues with no jump; keys held during pause do not stay stuck.
- [ ] END opens the GAME OVER modal with the score; `onGameOver` does not fire twice.
- [ ] Game keys (arrows, `Space`) do not scroll the page during play; typing a name in the modal input works.
- [ ] A signed-in user: SAVE SCORE inserts one row `{ game_id: "galactic-dogfight", name, score }` into `scores`; the modal shows `SCORE SAVED_`; a double click inserts one row. A guest sees `SIGN IN TO SAVE YOUR SCORE`.
- [ ] The saved score appears in `/games/galactic-dogfight` and in the Hall of Fame tab for this game after a reload.
- [ ] PLAY AGAIN starts a fresh run (score 0, lives 3, stage 1).
- [ ] EXIT or leaving the page stops the engine and the music: no rAF loop and no `keydown` / `keyup` / `blur` / `visibilitychange` listener remains.
- [ ] In dev (React Strict Mode) only one loop runs: the fighter moves at 240 px/s, not double.
- [ ] At 375px width the canvas fits the CRT frame without horizontal scroll and keeps its ratio.
- [ ] Asteroids, Tetris, Arkanoid, Snake, Glowmaw, Frogger, Pong, Space Invaders and a fake game (including `invaders`) play pages behave exactly as before.
- [ ] No new `localStorage` keys; `lib/storage.ts` is unchanged.
- [ ] `lib/galactic-dogfight/` imports nothing from `react` or `next`.
- [ ] No text on the canvas or in the player is in Spanish.
- [ ] No Namco asset, name or melody is used: no file in the repo is copied from the arcade game, and the catalog and UI never say "Galaga".
- [ ] Reloading the play page shows no React hydration warnings.
- [ ] No `mix-blend-mode`, animated `mask-image` or full-screen animated layer was added; the frame time result is in `references/perf/perf-log.md`.

Game-specific:

- [ ] The canvas is 480x600; the formation has 40 ships (4 Boss, 16 Butterfly, 20 Bee) in a 10 x 5 grid; the fighter is 26x26 px.
- [ ] The HUD shows Score, Lives and Level and no Lines slot; start values are 0, 3 and 1.
- [ ] A scrolling starfield is drawn inside the canvas and freezes while paused.
- [ ] Stage 1 shows a `READY` / `STAGE 1` banner with the `stageStart` jingle, then five entry waves of 8 ships fly into formation; the formation sways and breathes once complete.
- [ ] `←` / `→` and `A` / `D` move the fighter; it never leaves the field; left and right together do not move it.
- [ ] `Space` fires; at most 2 bullets are in flight (4 with the dual fighter); holding `Space` keeps firing no faster than every 0.16 s.
- [ ] Ships leave the formation and dive at the fighter, shoot while diving, and fly back to their slot after leaving the bottom; the number of simultaneous divers and the dive rate follow `stageParams`.
- [ ] Points: Bee 50 / 100, Butterfly 80 / 160, Boss 150 / 400 (formation / diving); a Boss dive with 1 escort scores 800 and with 2 escorts 1600 when the Boss dies.
- [ ] A Boss needs 2 hits; the first changes its color and plays `bossHit`, the second destroys it.
- [ ] A bullet or a diving ship touching the fighter costs exactly 1 life, plays `death`, clears enemy shots, holds new dives, and the fighter respawns at center after 2 s of engine time.
- [ ] A Boss can stop and show a tractor beam for 3 s; a fighter inside the beam is captured (lives -1, `capture` sound) and the Boss returns to formation carrying a red ship; a fighter outside the beam is unaffected; killing the Boss during the beam prevents capture.
- [ ] Shooting a carrying Boss while it dives frees the ship, which falls and docks with the fighter for the dual fighter (+1000, `rescue`); the dual fighter fires two bullets, is wider, and counts as one life; a hit destroys both ships.
- [ ] Shooting a carrying Boss while in formation destroys the captured ship with it; no dual fighter results.
- [ ] If the last life is captured, the run ends after the capture animation.
- [ ] An extra life is granted at 20,000, at 70,000 and every 70,000 after, max 5 total, with the `extraLife` sound and `onLives`.
- [ ] Clearing all 40 ships shows the stats banner with `SHOTS FIRED`, `NUMBER OF HITS` and `HIT-MISS RATIO`, then the next stage starts with Level raised by 1.
- [ ] Stages 3, 7 and 11 are Challenging Stages: `CHALLENGING STAGE` banner and `challenge` jingle, 40 ships fly past without shooting, each hit gives 100, a perfect 40 / 40 adds 10,000 with `PERFECT` and the `perfect` sound; stages 1, 2, 4, 5, 6 are normal.
- [ ] Reserve fighters (bottom-left) match `Lives - 1`; stage badges (bottom-right) match the stage number.
- [ ] Looping music plays while a run is active and not muted, loops without a click, stops when paused or muted, and restarts on PLAY AGAIN.
- [ ] The 12 sound effects play at the right events at volume 0.2 and are audibly different; nothing plays while muted, paused, or after game over; the final life lost plays `death` (or `capture`) then `gameover`.
- [ ] On a phone-width viewport the pad shows; `left` / `right` move the fighter while held; `A` fires and holding it keeps firing; other slots are dimmed and inert.
- [ ] Pad buttons held at pause or game over release their keys (no stuck fighter on resume).
- [ ] `death` haptic fires when a fighter is lost or captured and `clear` on stage clear, only when touch UI is active.
- [ ] SKIN cycles `RETRO`, `NEON`, `PASTEL`, `GOTHIC`, `NEGATIVE` and redraws at once, also while paused; no `THEME` button is shown.
- [ ] Score is an integer; `clampScore` caps it at 10,000,000.
- [ ] The PAUSED overlay shows no level select and no sound button; the files under `public/game-assets/galactic-dogfight/` load through `withBasePath` (also under `/Arcade-Vault-Claude`).

## Decisions

- **Yes:** faithful rules, own assets, own name (user decision after being told Namco owns the sprites, ROM audio, melodies and the trademark). "1 to 1" applies to gameplay, not to assets. **No:** ripped ROM assets and the name "Galaga" on a public site (copyright and trademark risk).
- **Yes:** the entry is `galactic-dogfight`, title `GALACTIC DOGFIGHT` (user decision).
- **Yes:** full core loop (user decision): entry flights, dives, Boss tractor beam, capture, rescue, dual fighter, Challenging Stages, stats banner, arcade scoring. **No:** a lean version without capture and challenge stages (not a 1:1 copy).
- **No:** 2-player alternating mode. Needs a mode flow and a second score; deserves its own spec.
- **Yes:** portrait canvas 480x600 (user decision) with `object-fit: contain`, like Tetris. Keeps the arcade proportions. **No:** 800x600 landscape (stretches the formation).
- **Yes:** arcade lives rules (user decision): 3 lives, extra life at 20,000 and 70,000 then every 70,000, max 5. The dual fighter counts as one life with two ships.
- **Yes:** the stats banner and reserve fighters / stage badges are drawn in the canvas (user decision on the banner), a deliberate exception to "playfield only", as Pong's scoreboard. The platform HUD still owns Score, Lives and Level.
- **Yes:** full audio set (user decision): stage start, shoot, hit, death, game over, beam, capture, rescue, Challenging Stage jingle, perfect fanfare, plus extra sounds `bossHit` and `extraLife` needed by the mechanics, all generated by us at volume 0.2. **Yes:** a looping background music track (user decision) even though the arcade game has none; it is an original composition at volume 0.12 and follows the shared mute button.
- **Yes:** held `Space` auto-fires with a 0.16 s cooldown, a deliberate small deviation from the arcade (one press per shot) so the touch `A` button is playable.
- **Yes:** touch pad and haptics, and five skins (user decisions). **No:** stage select (not selected by the user), difficulty select, modes, light theme.
- **Yes:** perf check and docs update are in the plan: perf follows the SPEC 12 rule every real game obeys, and `references/GAMES.md` must be kept current per `CLAUDE.md`.
- **Yes:** sprites as pixel run tables in `entities.ts` (like Space Invaders): no image files, nothing to license. **Yes:** `shadowBlur` only on the fighter and shots in `neon`.
- **Yes:** music and effects as generated `.wav` files, no Web Audio in the engine (engines never play sound). **No:** downloaded sound packs.
- **Yes:** the engine owns every number in `constants.ts` / `utils.ts` so tuning never touches engine logic.

## Risks

| Risk                                                                                                             | Mitigation                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| This is by far the largest engine in the repo (paths, dives, beam, capture, challenge stages).                   | The plan splits it into steps 6 to 9, each leaving a playable game; if it still overruns, split capture and Challenging Stages into a follow-up spec. |
| Entry, dive and challenge paths are hand-authored Bezier tables; they may look wrong or unfair.                  | Paths live in `paths.ts` only; the walkthrough plays several stages and tunes them. They do not need to match the arcade exactly.                     |
| "1 to 1" expectation versus own assets and name; the result will look and sound different.                       | Stated in the objective and decisions; rules, scoring and mechanics are matched.                                                                      |
| Hand-made music that sounds too close to the arcade tunes would be a copyright problem.                          | The spec requires original melodies; a criterion checks nothing is copied.                                                                            |
| 12 generated sounds plus a 12 s music loop add repo and download weight (about 0.7 MB at 22.05 kHz mono 16-bit). | Short effects, mono 22.05 kHz; music is the only large file. Lazy `Audio` loading already avoids blocking the page.                                   |
| Looping `.wav` may click at the loop point.                                                                      | The generator writes whole bars and fades neither end; step 12 checks by ear.                                                                         |
| Complex state (beam, pod, carrying Boss, dual fighter, last-life capture) can desync or leak.                    | One explicit `phase` and `Fighter.state`; a rescued, captured or destroyed ship has one exit path each; the walkthrough covers capture and rescue.    |
| Many sprites and shots on software render.                                                                       | Plain fills, no blur on enemies, no blends; stars are tiny rects; step 16 measures and logs it.                                                       |
| Shots tunnel through ships on a slow frame.                                                                      | Sub-steps of at most 8 px and `MAX_DT = 0.05`.                                                                                                        |
| React Strict Mode mounts effects twice in dev and can leave two loops or duplicate listeners.                    | `start()` is idempotent, `destroy()` removes everything; a criterion checks single speed in dev.                                                      |
| `GAMES` and the `games` table drift apart.                                                                       | The migration inserts the row with identical values; documented in `CLAUDE.md`.                                                                       |
| Browsers block audio until a user gesture, so the first sound or music could be silent.                          | `useBackgroundMusic` retries on the first key press or click; step 12 checks the first shot is heard.                                                 |

## What is **not** in this spec

- Original Namco sprites, ROM audio, melodies or the name "Galaga".
- 2-player alternating mode, mode picker, difficulty select.
- Stage select, light theme, remembering skin, high-DPI scaling.
- Changes to other games, `GamePlayer` or the registry types.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
