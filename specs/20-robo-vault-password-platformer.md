# SPEC 20 — Robo Vault (Mega Man 2 style platformer with password save)

> **Status:** Approved
> **Depends on:** SPEC 05, SPEC 06, SPEC 10, SPEC 12, SPEC 13, SPEC 17 (Galactic DogFight), SPEC 19
> **Date:** 2026-11-10
> **Objective:** Build an original run-and-gun platformer in the style of Mega Man 2 (4 Robot Master stages, boss weapons, a 3-room castle and a final boss named Sam) as a TypeScript engine plus a canvas component, where progress and score are saved only as a 5x5 dot-grid password that the player writes down and enters later, and where the player can delete their progress at any time (score back to 0).

## Amendments after implementation (user requests)

These override the text below where they conflict.

- Up is not jump: jump is `Space` only. `ArrowUp` / `W` held with shoot fires straight up. The touch pad `up` button is a hold button.
- Entering the boss room despawns every other enemy and enemy projectile.
- Dying in the boss room respawns the hero at the beginning of the boss fight (boss at full HP), not at the last checkpoint.
- Each defeated Master gives 10% less damage taken (stacks).
- The password screen (after a Master or room) and the victory screen have a `COPY` option that copies the filled cell labels to the clipboard.
- Crouch shoot: `ArrowDown` / `S` held on the ground crouches (smaller hitbox, no walking); shooting while crouched fires low and can hit small enemies. The touch pad `down` button is a hold button.
- Every boss defeated earns a signed-in player 1 credit (4 Masters, 4 rematch bosses, Sam: 9 per full run). This adds the RPC `award_boss_credit` and the table `boss_awards` (migrations `award_boss_credit`, `award_boss_credit_min_interval`), which the spec had listed as out of scope ("no new RPC"); the server rate-limits (3 s between awards, 30 per 24 h).
- The hero looks up (buster arm raised) while up is held; upward shots leave the raised buster.
- The boss health bar fills over the boss intro and plays a tick sound (`bossTick`) per segment.
- Boss fights play a second, heavy-metal inspired music track. This extends the registry (`music.alt`) and `GamePlayer` (an `onMusic` callback swaps the track; the boss track replaces the stage track in every boss room), which the spec had listed as out of scope.

## Why this spec exists

The user asked for a Mega Man 2 imitation whose save system works like the old password systems: no account, no storage, just a code the player keeps. "Imitation" is applied to the **rules and feel** (stage select, boss weapons with a weakness chain, password screen, a castle after the four stages).

It is **not** applied to the original **assets, names or music**. Capcom owns the sprites, the music and the "Mega Man" trademark, and this site is public. Same decision as SPEC 17 (Galaga): own title, own art (pixel run tables, no image files), own generated `.wav` audio. By user decision the villain is named **Sam** (not the original villain's name).

The password is the only persistence. No `localStorage`, no Supabase table, no new RPC. The score is part of the password, so it is capped to stop a forged password from being a free leaderboard score (see Data model).

## Scope

**In:**

- **Catalog:** new entry `robo-vault`, title `ROBO VAULT`, appended after `galactic-dogfight` in `GAMES`, `origin: "ai"`.
- **Playfield:** landscape canvas **768x576** (4:3, 16x12 tiles of 48 px), side-scrolling, pre-rendered tile layer.
- **Hero** (own design, called BOLT): run, jump (hold = higher), shoot the default buster, switch weapon, 3 lives per run, energy bar of 14 hits.
- **Title screen** (in canvas): `NEW GAME`, `PASSWORD`. **Stage select** (in canvas): 4 Robot Master panels plus a castle panel, locked until all 4 are defeated. Each defeated panel is marked.
- **4 Robot Master stages** (own designs), each a scrolling stage with enemies, hazards, one checkpoint, a boss gate and a boss room:

  | Master      | Theme         | Weapon it gives | Weak to                  |
  | ----------- | ------------- | --------------- | ------------------------ |
  | FROSTBYTE   | ice cavern    | Frost Shard     | Tide Burst (TIDEBREAKER) |
  | EMBERCORE   | foundry, lava | Ember Orb       | Frost Shard (FROSTBYTE)  |
  | GALEFORCE   | sky platforms | Gale Cutter     | Ember Orb (EMBERCORE)    |
  | TIDEBREAKER | flooded plant | Tide Burst      | Gale Cutter (GALEFORCE)  |

  The weakness chain is a cycle: Frost > Ember > Gale > Tide > Frost. Buster 1 damage, matching weapon 5 damage, any other weapon 2 damage. Boss HP 20. Numbers are design values, tuned in play.

- **Boss weapons:** each defeated Master unlocks its weapon permanently (in the password). Each weapon has 28 energy units, refilled on stage start and by pickups. `Q` / `E` cycle through unlocked weapons.
- **Sam's castle** (unlocked after the 4 Masters): 3 rooms and a final boss.
  1. Room 1: hazard room (spikes, moving platforms, turrets).
  2. Room 2: rematch room, the 4 Robot Masters fought one after another at half HP, weapon energy refilled between fights.
  3. Room 3: corridor with turrets and a gate.
  4. Sam: 2-phase final boss (hovering saucer, then walking mech), HP 30 per phase.
- **Enemies shared by all stages** (4 generic kinds, recolored per stage): walker, hopper, turret, flyer. Drops: small energy, weapon energy, 1-up.
- **Password system** (the core feature):
  - A password is a **5x5 grid of filled / empty cells** (25 bits), cells labeled `A1` to `E5` (row letter, column digit). It encodes defeated Masters, castle rooms cleared, game cleared and the score so far, plus a checksum.
  - The password is shown on the stage-select screen (always the current one), after each Master, after each castle room and on the victory screen. It is drawn as the grid and also as a list of filled cell labels, so the player can copy it either way.
  - `PASSWORD` on the title screen opens the entry screen: arrow keys move a cursor, `A` toggles a dot, `B` clears the grid, `OK` validates. A wrong or corrupt grid shows `WRONG PASSWORD` and changes nothing. A valid one loads progress and score and goes to stage select.
  - A password that restores progress also restores the score: `onScore(restoredScore)` fires, and score earned afterwards is added to it. SAVE SCORE at game over saves that total.
- **Delete progress:** `DELETE PROGRESS` on the stage-select screen (and on the title screen after a password was loaded). It asks `DELETE PROGRESS?` with `NO` (default) and `YES`. YES resets Masters, weapons, castle, game-cleared and score to zero, fires `onScore(0)` and `onLevel(1)`, and the password shown becomes the empty-progress password.
- **Run end:** 0 lives ends the run (`onGameOver`). Defeating Sam shows a victory screen with the final password; pressing `A` ends the run (`onGameOver`). Progress not captured by a password (an unfinished stage) is lost. A stage death returns to the last checkpoint of that stage.
- **Platform HUD:** Score, Lives and Level (Level = stages cleared + 1, 1 to 9: Masters defeated + castle rooms cleared + Sam defeated); Lines slot hidden. Weapon, weapon energy, hero energy and boss energy are drawn in the canvas (deliberate exception to "playfield only", like SPEC 17's banners).
- **Controls (desktop):** `←` `→` / `A` `D` move; `Space` / `ArrowUp` / `W` jump; `X` / `J` shoot; `Q` / `E` previous / next weapon. In menus: arrows move, `Space` confirms, `X` goes back.
- **Controls (touch, below 768px or when the GamePad menu is on):** `left` / `right` hold, `a` = `Space` (jump, hold), `b` = `KeyX` (shoot, hold), `x` = `KeyQ`, `y` = `KeyE`; `up` / `down` also move the menu cursor (`ArrowUp` / `ArrowDown`). Haptics `death` (life lost) and `clear` (stage / room / boss cleared).
- **Audio** (all own generated `.wav`, no licensing; the registry takes a single `music` track): one looping chiptune track `music.wav` of about 16 s (volume `0.12`) and effects at volume `0.2`: `shoot`, `jump`, `hit`, `enemyDie`, `bossHit`, `bossDie`, `pickup`, `weapon` (weapon unlock jingle), `death`, `gameover`, `select`, `victory`. The existing mute button is the only sound toggle. Melodies are original.
- Pure TypeScript engine in `lib/robo-vault/` with no React and no Next.js imports. Password encode / decode lives in `lib/robo-vault/password.ts` as pure functions.
- Client component `components/robo-vault-canvas.tsx`.
- Registry entry in `components/game-registry.tsx`.
- Migration inserting the `games` row (with `origin`), applied with MCP `apply_migration`.
- New cover class `cover-robo-vault` in `app/globals.css`, designed with `/frontend-design`.
- Frame-time check with the SPEC 12 method, result logged in `references/perf/perf-log.md`.
- Update `CLAUDE.md` and `references/GAMES.md`.

**Out of scope (for future specs):**

- Capcom sprites, music, level layouts, the name "Mega Man", the original villain's name.
- The other 4 Robot Masters, E-Tanks, items such as Item-1/2/3, a real second castle.
- Skins and themes (no `appearance` entry; one palette per stage), light theme.
- Stage-specific music (the registry supports one track).
- Saving the password to the account or to `localStorage`; any server-side validation of the password.
- Pin Collection pins for this game (the pin catalog is unchanged).
- Mode picker, difficulty select, level select in PAUSED.
- Changes to other games, `GamePlayer` or the registry types.
- Automated tests (no test runner is configured).

## Data model

Catalog entry (the `Game` type is unchanged except for the existing required `origin`). Existing unions: `Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS"`, `GameColor = "cyan" | "magenta" | "yellow" | "green"`. Pick the final `cat` and `color` with `/frontend-design`; do not extend the unions.

```ts
// lib/games.ts — appended to GAMES, after "galactic-dogfight"
{
  id: "robo-vault",
  title: "ROBO VAULT",
  short: "Beat four bosses, steal their weapons, storm Sam's castle.",
  long: "Pick a stage, defeat the Robot Master and take its weapon. Every boss is weak to another boss's weapon. Write down your password after each victory and use it later to continue from the same place, with your weapons and score. Four masters down, Sam's castle awaits.",
  cat: "ARCADE", // placeholder: verify; closest existing category
  cover: "cover-robo-vault",
  color: "green", // placeholder: must be a valid GameColor
  plays: "0",
  origin: "ai",
}
```

Progress state and the password (framework-free, `lib/robo-vault/password.ts`):

```ts
export interface Progress {
  masters: [boolean, boolean, boolean, boolean]; // FROSTBYTE, EMBERCORE, GALEFORCE, TIDEBREAKER
  castleRooms: 0 | 1 | 2 | 3; // castle rooms cleared
  cleared: boolean; // Sam defeated
  score: number; // multiple of 10, 0..SCORE_CAP
}

export const SCORE_CAP = 40_950; // 4095 units of 10
export const GRID_SIZE = 5; // 5x5 = 25 cells

export type PasswordGrid = boolean[]; // length 25, index = row * 5 + col, A1 = 0 ... E5 = 24

export function encodePassword(p: Progress): PasswordGrid;
export function decodePassword(grid: PasswordGrid): Progress | null; // null = invalid
export function cellLabel(index: number): string; // 0 -> "A1", 24 -> "E5"
export function emptyProgress(): Progress;
```

Bit layout (25 bits):

| Bits | Field                                      |
| ---- | ------------------------------------------ |
| 4    | Masters defeated (one bit each)            |
| 2    | `castleRooms` (0..3)                       |
| 1    | `cleared`                                  |
| 12   | score units (`min(score, SCORE_CAP) / 10`) |
| 6    | checksum of the 19 payload bits            |

The 25-bit word is XORed with a fixed mask and its bits are placed by a fixed permutation (`MASK`, `PERM` in `constants.ts`, own values), so the dots do not read as an obvious binary number and the empty-progress password is not an empty grid. `decodePassword` returns `null` when the checksum fails or the combination is impossible (`castleRooms > 0` without all 4 Masters, `cleared` without `castleRooms === 3`). The score written into a password is `min(score, SCORE_CAP)` rounded down to a multiple of 10; the in-run score itself can exceed the cap (it is only clamped to 10,000,000 like every game).

Engine public API:

```ts
// lib/robo-vault/engine.ts
export type RoboVaultSound =
  | "shoot"
  | "jump"
  | "hit"
  | "enemyDie"
  | "bossHit"
  | "bossDie"
  | "pickup"
  | "weapon"
  | "death"
  | "gameover"
  | "select"
  | "victory";

export interface RoboVaultCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void; // stages cleared + 1
  onGameOver: (finalScore: number) => void; // once per run
  onSound?: (name: RoboVaultSound) => void;
  onHaptic?: (name: "death" | "clear") => void;
}

export class RoboVaultEngine {
  constructor(canvas: HTMLCanvasElement, callbacks: RoboVaultCallbacks);
  start(): void; // title screen, fires onScore(0), onLives(3), onLevel(1); idempotent
  pause(): void;
  resume(): void;
  end(): void; // ends the run now, onGameOver once
  destroy(): void;
}
```

Internal state (not exported): `screen` (`"title" | "password" | "select" | "stage" | "castle" | "victory" | "confirm-delete"`), `progress: Progress`, `weapon` (`"buster" | "frost" | "ember" | "gale" | "tide"`), per-weapon energy, `hero`, `enemies`, `shots`, `pickups`, `boss`, `camera`, `checkpoint`, `score`, `lives`.

Module layout:

| File                          | Contents                                                                                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/robo-vault/constants.ts` | `W = 768`, `H = 576`, `TILE = 48`, physics values (gravity, run speed, jump), `MAX_STEP = 8`, `MAX_DT = 0.05`, `START_LIVES = 3`, `MAX_LIVES = 5`, damage table, `MASK`, `PERM`, stage palettes |
| `lib/robo-vault/password.ts`  | `Progress`, `encodePassword`, `decodePassword`, `cellLabel`, `emptyProgress`, `SCORE_CAP`                                                                                                       |
| `lib/robo-vault/levels.ts`    | Tile maps (strings) for 4 stages, 3 castle rooms, boss rooms and Sam's room; checkpoint and gate markers; enemy spawn markers                                                                   |
| `lib/robo-vault/utils.ts`     | `clampScore`, `weaponDamage(weapon, boss)`, `levelOf(progress)`, `rectsOverlap`, tile collision helpers                                                                                         |
| `lib/robo-vault/entities.ts`  | Types, sprite run tables (hero, 4 enemy kinds, 4 Masters, Sam in 2 phases, shots, pickups), draw functions receiving `ctx`                                                                      |
| `lib/robo-vault/engine.ts`    | `RoboVaultEngine`: input, screens, physics, AI, combat, password flow, draw, loop                                                                                                               |

Registry entry (existing fields only):

```ts
"robo-vault": {
  Canvas: RoboVaultCanvas,
  controls: [
    { keys: ["←", "→"], label: "MOVE" },
    { keys: ["SPACE"], label: "JUMP" },
    { keys: ["X"], label: "SHOOT" },
    { keys: ["Q", "E"], label: "WEAPON" },
  ],
  stats: { lives: true, lines: false, level: true },
  music: { src: withBasePath("/game-assets/robo-vault/music.wav"), volume: 0.12 },
  sfx: { sounds: { /* 12 sounds, withBasePath */ }, volume: 0.2 },
  touch: {
    pad: [
      { code: "ArrowLeft", label: "◀", slot: "left", hold: true },
      { code: "ArrowRight", label: "▶", slot: "right", hold: true },
      { code: "ArrowUp", label: "▲", slot: "up" },
      { code: "ArrowDown", label: "▼", slot: "down" },
      { code: "Space", label: "JUMP", slot: "a", hold: true },
      { code: "KeyX", label: "SHOOT", slot: "b", hold: true },
      { code: "KeyQ", label: "◀W", slot: "x" },
      { code: "KeyE", label: "W▶", slot: "y" },
    ],
    hint: [ /* move, jump, shoot, weapon */ ],
  },
},
```

`touch.pad` follows the exact `TouchButton` shape; the implementer adjusts. No `appearance`, `levelSelect`, `modes` or `difficultySelect`. `ArrowUp` is both menu-up and jump on desktop (`ArrowUp` jumps in stages, moves the cursor in menus).

Migration (`supabase/migrations/<version>_add_robo_vault_game.sql`; version assigned by `apply_migration`, later than `20261111014204`). Every field identical to the `GAMES` entry; `origin` is required (no column default):

```sql
insert into public.games (id, title, short, long, cat, cover, color, origin) values
  ('robo-vault', 'ROBO VAULT', 'Beat four bosses, steal their weapons, storm Sam''s castle.',
   'Pick a stage, defeat the Robot Master and take its weapon. Every boss is weak to another boss''s weapon. Write down your password after each victory and use it later to continue from the same place, with your weapons and score. Four masters down, Sam''s castle awaits.',
   '<same cat as lib/games.ts>', 'cover-robo-vault', '<same color as lib/games.ts>', 'ai');
```

Rules and conventions:

- Coordinates: origin top-left, `y` grows down, canvas pixels and seconds. Update on the engine clock, `dt` clamped to `MAX_DT`, movement in sub-steps of at most `MAX_STEP` px so nothing tunnels through tiles. The engine clock freezes while paused.
- **Callbacks** fire only on change. `onGameOver` fires once per run (0 lives, Sam defeated and `A` pressed, or `end()`), then loop and listeners stop. Score clamps to 10,000,000. Engines never play sound or vibrate: they emit `onSound` and `onHaptic`.
- **Scoring (design values):** enemy 100, boss hit 0, Master defeated 2,000, castle room cleared 1,500, Sam 10,000, pickups 0. Kills while holding the matching weakness weapon give +50%. A password stores `min(score, SCORE_CAP)`.
- **Password flow:** after each Master, each castle room and the victory, the engine sets `progress`, shows the password screen with a `CONTINUE` option and then returns to stage select. `progress.score` is taken from the live score at that moment. On a valid `decodePassword`, `score` and `progress` replace the current state and `onScore` / `onLevel` fire.
- **Weapons:** Master defeated => weapon unlocked; the unlock jingle `weapon` plays on the boss-defeated screen. Weapon energy 28, shot costs 1 (Frost Shard, Ember Orb, Gale Cutter) or 2 (Tide Burst). No energy => fires the buster. Weapon choice resets to buster on stage start.
- **Lives:** 3 lives per run, extra life every 20,000 points (max 5) and from 1-up pickups. A death restores the hero at the last checkpoint with full energy; a boss room death restarts the boss at full HP. 0 lives ends the run.
- **Delete progress:** wipes `Progress` to `emptyProgress()`, weapons to buster only, score to 0 (`onScore(0)`, `onLevel(1)`), clears the password screen state. It does not reset lives. No data outside the engine is touched, because nothing else is stored.
- **Input:** `keydown` and `keyup` on `window` using `e.code`, held set, `preventDefault` only for game keys while running and not paused. `P` and `Esc` do nothing. Held keys are cleared on `pause()`, `blur` and `visibilitychange`. The touch pad sends the same synthetic events (SPEC 10).
- Entities receive `ctx` as argument; no module-level game state. The tile layer of each level is pre-rendered once to an offscreen canvas. No `mix-blend-mode`, no animated `mask-image`, no full-screen animated layers (SPEC 12); backgrounds are plain fills and a few rects.
- Canvas 768x576 is 4:3 and scaled by CSS. All text on the canvas is English.

## Implementation plan

Before step 1, read the relevant guides in `node_modules/next/dist/docs/` if a step touches pages or caching (normally not). Invoke `/frontend-design` for the cover and the stage palettes.

1. **Catalog entry.** Append `robo-vault` to `GAMES` (temporary existing cover). `npm run build` passes; `/games/robo-vault` and `/games/robo-vault/play` render; `getGameDefinition` returns `undefined` is not acceptable for a shipped game, so this step is local only until step 11 (do not merge before the registry entry exists).
2. **Migration.** Write the migration file, apply it with `apply_migration`, rename the file to the version the tool assigns, confirm `select * from games where id = 'robo-vault'` matches `lib/games.ts`, run `get_advisors`. Types are not regenerated (schema unchanged).
3. **Cover.** `.cover-robo-vault` in `app/globals.css` (hero, boss silhouette and gate motif, different from the other covers); set `cover` in `lib/games.ts`.
4. **Password module.** `constants.ts` (masks, physics), `password.ts`. Verify with a throwaway script (not committed): encode / decode round trip over every legal `Progress` combination and a sample of scores, every single-bit flip of a valid password is rejected, the empty-progress password decodes to zero progress, cap at 40,950.
5. **Levels and entities.** `levels.ts` tile maps, `entities.ts` sprites and draw functions. `npm run lint` and `npm run build` pass.
6. **Engine, core.** Input, hero physics and tile collision, camera, buster, enemies, damage, lives, one playable stage with checkpoint and gate; public API with game over by `end()`. Folder imports nothing from `react` or `next`.
7. **Engine, bosses and weapons.** 4 Masters, boss rooms, HP and weakness table, weapons with energy, weapon switching, unlocks.
8. **Engine, screens and password UI.** Title, stage select, password display and entry screen, `WRONG PASSWORD`, delete-progress confirm, level / score callbacks.
9. **Engine, castle.** 3 rooms, the rematch room, Sam's 2 phases, victory screen and run end.
10. **Canvas wrapper.** `components/robo-vault-canvas.tsx` mirroring `components/galactic-dogfight-canvas.tsx`: Strict-Mode safe (one live loop), callbacks in a ref, `paused` and `endSignal`, `onSound`.
11. **Registry wiring.** Add the entry without audio or touch yet. HUD shows Score, Lives, Level. Screenshot the HUD of another real game to confirm no change.
12. **Audio.** Generate the 12 `.wav` effects and `music.wav` into `public/game-assets/robo-vault/` with a one-off Node script that is not shipped. Add `music`, `sfx`, wire `onSound`. Check by ear: effects differ, music loops without a click, silent when muted.
13. **Touch and haptics.** Add `touch.pad` and `touch.hint`, wire `onHaptic`. Check at 375px and with the GamePad menu at 1280px (cross skin and joystick skin).
14. **Walkthrough.** In `npm run dev` with Playwright (captures only in `.pwScreencaps/`): defeat a Master and see the new password, reload the page and enter it, confirm the score and weapon came back; enter a wrong grid; delete progress; reach the castle, finish Sam; game over; SAVE SCORE as a signed-in user and confirm the `scores` row; check at 1280px and 375px.
15. **Performance.** Measure frame time with `references/perf/measure-fps.md`, log in `references/perf/perf-log.md`; fix the engine only if the target is missed.
16. **Docs.** Update `CLAUDE.md` (engine location, callbacks, canvas size, password format, audio, touch mapping, catalog sync) and `references/GAMES.md` (with the `origin` column). Run `npm run lint` and `npm run build`.

## Acceptance criteria

Generic:

- [ ] `npm run lint` and `npm run build` finish without errors.
- [ ] `lib/games.ts` contains `robo-vault` as the last entry with `origin: "ai"`; all other entries unchanged.
- [ ] `select * from games where id = 'robo-vault'` matches `lib/games.ts` (including `cover`, `color`, `origin`); the migration file carries the applied version; `get_advisors` shows no new warning.
- [ ] `/library` lists 10 games; the card links to `/games/robo-vault`; PLAY goes to `/games/robo-vault/play`; the detail page shows `🤖 A.I MADE` first.
- [ ] The play page shows a real canvas with no mode picker; it starts on the title screen.
- [ ] PAUSE freezes everything and shows PAUSED; RESUME continues with no time jump; keys held during pause do not stay stuck.
- [ ] END opens the GAME OVER modal; `onGameOver` does not fire twice.
- [ ] Game keys do not scroll the page; typing a name in the modal input works.
- [ ] A signed-in user: SAVE SCORE inserts one row `{ game_id: "robo-vault", name, score }`; a guest sees `SIGN IN TO SAVE YOUR SCORE`. The score appears in `/games/robo-vault` and the Hall of Fame tab after a reload.
- [ ] PLAY AGAIN starts a fresh engine on the title screen (score 0, lives 3, level 1, no progress).
- [ ] EXIT or leaving the page stops the engine and the music: no rAF loop and no listener remains. In dev (Strict Mode) only one loop runs.
- [ ] At 375px width the canvas fits the CRT frame without horizontal scroll.
- [ ] All 9 other games behave exactly as before.
- [ ] No `localStorage` key, cookie or Supabase table is written for progress; `lib/storage.ts` unchanged.
- [ ] `lib/robo-vault/` imports nothing from `react` or `next`.
- [ ] No text is in Spanish; no Capcom asset, name or melody is used; the UI never says "Mega Man".
- [ ] No React hydration warnings on reload; no `mix-blend-mode`, animated `mask-image` or full-screen animated layer was added; the frame time result is in `references/perf/perf-log.md`.

Game-specific:

- [ ] The canvas is 768x576; HUD start values are Score 0, Lives 3, Level 1; no Lines slot.
- [ ] Title screen offers `NEW GAME` and `PASSWORD`; `NEW GAME` opens the stage select with 4 Master panels and a locked castle panel.
- [ ] Each Master stage is playable end to end: run, jump (higher when held), shoot, enemies, hazards, checkpoint, boss gate, boss fight; dying returns to the checkpoint, losing the last life ends the run.
- [ ] Defeating a Master marks its panel, unlocks its weapon, plays `weapon`, adds 2,000 points and shows a new password.
- [ ] A weapon deals 5 damage to its weakness Master (Frost > Ember > Gale > Tide > Frost), 2 to others, the buster 1; boss HP is 20.
- [ ] `Q` / `E` cycle only unlocked weapons; with 0 energy the buster fires; weapon resets to buster on stage start.
- [ ] The castle panel unlocks only after all 4 Masters; the castle has 3 rooms and Sam with 2 phases; defeating Sam shows the victory screen with the final password, and `A` ends the run with `onGameOver`.
- [ ] The password screen shows a 5x5 grid and the list of filled cells (`A1`..`E5`) for the current progress.
- [ ] `encodePassword` then `decodePassword` returns the same `Progress` for every legal combination; any single-cell change to a valid grid is rejected; an impossible combination (castle without 4 Masters, cleared without 3 rooms) is rejected.
- [ ] Entering a valid password on the title screen restores defeated Masters, unlocked weapons, castle progress and the score (`onScore` fires with the restored value), then goes to stage select; the SAVE SCORE value after game over includes the restored score.
- [ ] A wrong grid shows `WRONG PASSWORD` and leaves state unchanged; the empty grid is rejected.
- [ ] The score stored in a password never exceeds 40,950 and is a multiple of 10; the live score can exceed it.
- [ ] `DELETE PROGRESS` asks for confirmation with `NO` as default; `NO` changes nothing; `YES` sets score 0 (`onScore(0)`), Level 1, weapons to buster only, all panels unmarked, castle locked, and the displayed password becomes the empty-progress password, which decodes to zero progress.
- [ ] Looping music plays while a run is active and not muted, loops without a click, stops when paused or muted, restarts on PLAY AGAIN.
- [ ] The 12 effects play at the right events at volume 0.2 and are audibly different; nothing plays while muted, paused or after game over.
- [ ] On a phone-width viewport the pad shows; `left` / `right` move while held, `a` jumps (hold = higher), `b` shoots (hold = auto-fire), `x` / `y` change weapon, `up` / `down` move menu cursors; held buttons release at pause and game over.
- [ ] `death` haptic fires when a life is lost and `clear` on a Master, room or Sam cleared, only when touch UI is active.
- [ ] The PAUSED overlay shows no level select and no sound button; asset URLs load through `withBasePath` (also under `/Arcade-Vault-Claude`).

## Decisions

- **Yes:** own title (ROBO VAULT), own art, own generated audio, no "Mega Man" in the UI (user chose the precedent of SPEC 17). **No:** keeping the original name (trademark risk on a public site).
- **Yes:** the villain is named **Sam** (user decision).
- **Yes:** scope = 4 Robot Master stages plus a Sam castle of 3 rooms and a 2-phase final boss (user decision). **No:** all 8 stages, E-Tanks, extra items (too big for one spec).
- **Yes:** 5x5 dot-grid password (user decision), cells labeled `A1`..`E5`, 25 bits. **No:** alphanumeric code (less like the original).
- **Yes:** the password carries the score and restores it (user decision). Score is stored as 12 bits in steps of 10, capped at 40,950, so a forged password gains little (user chose "cap the score"). **No:** a server-side check; the site is static and the leaderboard already trusts the client for every game.
- **Yes:** the password is the only persistence: no `localStorage`, no Supabase table. This keeps the "old password system" feel and needs no migration beyond the `games` row.
- **Yes:** password UI lives in the canvas (title, stage select, victory), controlled with the same keys as the game (user decision). **No:** a React overlay or the registry `modes` picker; `GamePlayer` stays unchanged.
- **Yes:** `DELETE PROGRESS` with a confirm dialog, default `NO`, resets Masters, castle, weapons and score to 0 (user request).
- **Yes:** 3 lives per run and a platform game over, instead of the original's per-stage game over back to stage select. This keeps `onGameOver` once per run and SAVE SCORE working like every other game.
- **Yes:** one music track (registry supports a single `music` entry). **No:** per-stage music.
- **Yes:** no skins in this spec (not selected). One palette per stage, so the game is visually varied without `appearance`.
- **Yes:** weapon, weapon energy, hero energy and boss energy are drawn in the canvas, a deliberate exception to "playfield only"; the platform HUD owns Score, Lives, Level.
- **Yes:** `Level` = stages cleared + 1 (1..9) so the existing Level slot shows overall progress.
- **No:** pins for this game. The pin catalog is a manual copy of 151 rows; adding pins deserves its own spec.

## Risks

| Risk                                                                                                       | Mitigation                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| The largest engine yet (physics, 9 levels, 9 bosses, in-canvas menus).                                     | Steps 6 to 9 each leave a playable game; if it overruns, move the castle to a follow-up spec (the password already has castle bits). |
| Players can craft passwords with a large score or all progress.                                            | Score capped at 40,950 and checksummed; progress forgery is accepted (single-player, no unlock beyond the game itself).              |
| Re-entering the same password repeatedly and ending a run immediately saves the restored score many times. | Accepted; the leaderboard shows the best score per user. The cap limits the value.                                                   |
| A failed stage loses everything since the last password; the player may feel cheated.                      | The password is shown after every Master and room, and the stage-select screen always shows the current one.                         |
| Copying 25 dots by hand is error-prone.                                                                    | The cell list (`A1`..`E5`) is shown next to the grid; the checksum rejects mistakes with a clear message.                            |
| Tile collision tunneling or sticking on slopes and moving platforms.                                       | Sub-steps of at most 8 px, `MAX_DT = 0.05`, flat tiles only (no slopes) in the first version.                                        |
| Hand-authored level maps may be unfair or boring.                                                          | Maps live in `levels.ts` only; the walkthrough plays every stage and tunes enemy placement.                                          |
| Hand-made music that is too close to Capcom's tunes.                                                       | The spec requires original melodies; a criterion checks nothing is copied.                                                           |
| Pad has up to 8 live buttons on a phone.                                                                   | Check at 375px in step 13; `x` / `y` are small pills by the existing gamepad layout.                                                 |
| Strict Mode can leave two loops or duplicate listeners in dev.                                             | `start()` idempotent, `destroy()` removes everything; a criterion checks it.                                                         |
| `GAMES` and the `games` table drift apart.                                                                 | The migration inserts identical values including `origin`; documented in `CLAUDE.md`.                                                |

## What is **not** in this spec

- Capcom sprites, music, level layouts or names.
- The other 4 Robot Masters, E-Tanks, items, a second castle.
- Skins, themes, per-stage music, stage select in PAUSED, modes, difficulty.
- Saving progress outside the password; server-side password validation.
- Pins for this game, changes to other games, `GamePlayer` or the registry types.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
