# SPEC 21 — Marcy the Vampire Hunter (gothic castle platformer with password save)

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 06, SPEC 10, SPEC 12, SPEC 13, SPEC 17, SPEC 19, SPEC 20 (Robo Vault)
> **Date:** 2026-11-10
> **Objective:** Build an original gothic exploration platformer (a big castle with a map, relics that open new routes, RPG levels and equipment, two playable heroes, Marcy Delrre with a whip and Frankford Delrre with a sword, and a final boss named Count Faust) as a TypeScript engine plus a canvas component, where progress is saved only as a 12x12 dot-grid password that the player writes down, copies or pastes back in.

## Why this spec exists

The user asked for a game that plays like Konami's "Symphony of the Night" (open castle, map, RPG growth, relics that unlock routes), with two heroes and the same save approach as SPEC 20: no account, no storage, just a password the player keeps.

"Imitation" applies to the **rules and feel** (explore, backtrack with new abilities, level up, equip gear). It does not apply to Konami's **assets, names or music**. Same decision as SPEC 17 and SPEC 20: own title, own art (pixel run tables, no image files), own generated `.wav` audio. The UI never says "Castlevania", "Symphony of the Night", "Dracula" or "Belmont". The villain is **Count Faust** (user decision). The title `MARCY THE VAMPIRE HUNTER` uses the hero's own name (changed from the first draft to avoid echoing another series' character); the heroes `Marcy Delrre` and `Frankford Delrre` are original characters.

The user asked for a **large castle** (10+ zones, inverted castle) and a **full RPG** (stats, many equipment slots, spells, familiars). That is more than one spec can carry, so the work is split in three (user decision, see Decisions):

- **SPEC 21 (this spec):** engine, both heroes, the main castle (10 zones), XP and levels, 6 relics, 5 equipment slots, one special art per hero, the 12x12 password with copy and paste.
- **SPEC 22 (future):** the inverted castle.
- **SPEC 23 (future):** the Credit Coin, a rare drop that gives Pin Collection credits. Spells and familiars were dropped from the plan (out of scope, no spec planned).

The password reserves 32 bits for SPEC 22 and keeps 26 spare bits, so later specs fit without changing the grid size.

## Scope

**In:**

- **Catalog:** new entry `marcy-vampire-hunter`, title `MARCY THE VAMPIRE HUNTER`, appended after `robo-vault` in `GAMES`, `origin: "ai"`.
- **Playfield:** landscape canvas **768x576** (4:3, 16x12 tiles of 48 px), side-scrolling rooms, tile layer of each room pre-rendered to an offscreen canvas (cache of the current room and its neighbours).
- **Two heroes**, chosen on a hero-select screen after `NEW GAME`. The hero is stored in the password and cannot change inside a save.

  | Hero             | Weapon | Reach and speed                                       | Special art (costs MP)                   | Stat lean      |
  | ---------------- | ------ | ----------------------------------------------------- | ---------------------------------------- | -------------- |
  | Marcy Delrre     | Whip   | Long reach (about 144 px), slower recovery, hits up   | `CRIMSON LASH` (8 MP): whip burst, 3 hit | LCK and INT up |
  | Frankford Delrre | Sword  | Short reach (about 72 px), fast 3-hit combo, can duck | `MOON SLASH` (6 MP): arcing wave shot    | STR and DEF up |

  Both share jump, crouch, upward attack and the same castle. Numbers are design values, tuned in play.

- **RPG systems:** HP, MP, STR, DEF, INT, LCK. Hero level 1 to 50; XP from kills (`xpToNext(level)` curve in `utils.ts`); level up restores HP and MP and plays `levelUp`. Vitality Crests (one hidden per zone, 10 total) raise max HP. MP regenerates slowly and powers the special art.
- **Equipment:** 5 slots (`weapon`, `head`, `body`, `cloak`, `ring`), 10 tiers each (tier 0 = empty). Each hero has its own weapon list (10 whips, 10 swords); the other four slots are shared. Tiers come from chests, boss drops and rare enemy drops (LCK raises the chance). A higher tier is a strict upgrade, so the password stores one tier per slot and a restore equips it.
- **6 relics** (each dropped by a zone boss, permanent, shown on the status tab):

  | Relic     | Effect                                                          | Dropped by (zone) |
  | --------- | --------------------------------------------------------------- | ----------------- |
  | `dash`    | Short ground dash, passes under low gaps (`L` / `Shift`)        | Zone 2 boss       |
  | `leap`    | Double jump                                                     | Zone 3 boss       |
  | `lantern` | Lights dark rooms and reveals hidden doors                      | Zone 4 boss       |
  | `mist`    | `Down` + dash on the ground becomes mist for 2 s, passes grates | Zone 5 boss       |
  | `glide`   | Hold `Space` while falling to fall slowly                       | Zone 6 boss       |
  | `sigil`   | Attacks break sigil walls                                       | Zone 7 boss       |

- **The castle (main castle only):** 10 zones, about 80 rooms. Rooms are 1 to 4 screens wide and 12 tiles tall, joined at room edges and doors. Relics gate routes, so the player must return to earlier zones.

  | Zone | Name                | Theme                      | Boss                   |
  | ---- | ------------------- | -------------------------- | ---------------------- |
  | 1    | Gate Court          | Ruined courtyard, tutorial | none (first altar)     |
  | 2    | Chapel of Ash       | Burnt chapel, candles      | Ashen Bishop           |
  | 3    | Catacombs           | Bone halls                 | Bone Colossus          |
  | 4    | Flooded Cellars     | Dark water, drains         | Drowned Matron         |
  | 5    | Clockwork Tower     | Gears, pendulums           | Gear Warden            |
  | 6    | Library of Whispers | Shelves, floating books    | The Archivist          |
  | 7    | Garden of Thorns    | Dead roses, glass dome     | Thorn Duchess          |
  | 8    | Bell Spire          | Rooftops, gargoyles        | Stone Sentinel         |
  | 9    | Blood Cistern       | Crimson vaults             | Crimson Herald         |
  | 10   | Faust's Keep        | Throne hall, final climb   | Count Faust (2 phases) |

  Zone 9 opens only after the zone 2 to 8 bosses are defeated; zone 10 opens only after the zone 9 boss. Boss HP, boss damage and weakness are design values (each boss has one weak damage type: fire, bone-crush, holy, slash or whip; heroes get `fire`/`holy` from some equipment).

- **Bestiary:** about 18 enemy kinds, two or more per zone, gothic only (skeleton knight, bat swarm, ghoul, gargoyle, cultist, wraith, armor, rat swarm, bookworm, thorn crawler, and so on), recolored per zone. Drops: small HP, MP, XP gems, equipment, 1-up.
- **Altars:** Save Altars (one per zone, plus the Gate Court altar) restore HP and MP, show the password and set the respawn point. Boss defeat also shows the password.
- **Map:** the menu `MAP` tab draws every visited room (and every room of a zone marked in the password). From the map the player can warp to the altar of any zone whose map bit is set.
- **In-canvas menu** (key `Enter`, or a pointer tap on the small `MENU` tag drawn top-right of the canvas): tabs `MAP`, `EQUIP`, `STATUS`, `PASSWORD`. The world is frozen while the menu is open; the engine clock freezes like in pause.
- **Title screen** (in canvas): `NEW GAME`, `PASSWORD`. `DELETE PROGRESS` appears after a password was loaded. **Hero-select screen** after `NEW GAME`.
- **Password system** (the core feature), see Data model:
  - A password is a **12x12 grid of filled / empty cells** (144 bits), cells labeled `A1` to `L12` (row letter, column number). It encodes hero, relics, bosses, level, equipment, score, Vitality Crests, zone map bits, 32 reserved bits for SPEC 22, 26 spare bits, and a checksum.
  - It is shown on every Save Altar, after every boss, on the `PASSWORD` menu tab and on the victory screen. It is drawn as the grid and as a list of filled cell labels, with a `COPY` button that copies the labels (`A2 A3 B10 ...`) with `navigator.clipboard` (textarea fallback, `COPIED` / `COPY FAILED`).
  - The entry screen (`PASSWORD` on the title): arrows move the cursor over the grid and over the option row `PASTE`, `CLEAR`, `OK`, `BACK`. `Space` toggles a dot or presses an option; `C` clears; `Enter` validates; `X` goes back. **Paste:** the `PASTE` option and `Ctrl+V` fill the grid from clipboard text of cell labels (see Rules). A wrong or corrupt grid shows `WRONG PASSWORD` and changes nothing. A valid one loads progress and score and starts the run at the Gate Court altar, with a `WARP` option on the map.
  - A password that restores progress also restores the score: `onScore(restoredScore)` fires, and score earned afterwards is added. SAVE SCORE at game over saves that total.
- **Delete progress:** `DELETE PROGRESS` on the title (after a load) and on the `PASSWORD` menu tab. It asks `DELETE PROGRESS?` with `NO` (default) and `YES`. YES resets hero, relics, bosses, level, equipment, crests, map bits and score to zero, fires `onScore(0)` and `onLevel(1)`, and returns to the title.
- **Run end:** 3 lives per run. A life is lost when HP reaches 0; the hero returns to the last Save Altar with full HP and MP and keeps everything earned in the run. 0 lives ends the run (`onGameOver`). Defeating Count Faust shows the victory screen with the final password; pressing `Space` ends the run (`onGameOver`). Progress not captured by a password is lost when the run ends.
- **Platform HUD:** Score, Lives and Level (Level = hero level, 1 to 50); Lines slot hidden. HP bar, MP bar, equipped weapon name, boss bar and room name are drawn in the canvas (deliberate exception to "playfield only", like SPEC 20).
- **Controls (desktop):** `←` `→` / `A` `D` move; `Space` jump (again in air with `leap`); `X` / `J` attack; `↑` / `W` held with attack attacks upward, and `↑` / `W` alone interacts (altar, door, chest); `↓` / `S` crouches (crouch attack, smaller hitbox); `C` / `K` special art; `L` / `Shift` dash (with `dash`); `Enter` menu. In menus: arrows move, `Space` confirms, `X` goes back.
- **Controls (touch, below 768px or when the GamePad menu is on):** `left` / `right` hold, `up` / `down` hold, `a` = `Space` (jump, hold), `b` = `KeyX` (attack, hold), `x` = `KeyC` (special), `y` = `KeyL` (dash). The `MENU` tag in the canvas opens the menu by tap. Haptics `death` (life lost) and `clear` (boss defeated).
- **Audio** (all own generated `.wav`, no licensing; a single `music` track plus `music.alt` for bosses, as in SPEC 20): gothic style only. `music.wav` (about 24 s loop, volume `0.12`): pipe organ and harpsichord in a minor key with harmonic-minor runs, slow bell tones and a choir-like pad. `music-boss.wav` (about 20 s loop, volume `0.18`): faster, pounding organ pedal, tritone stabs, sustained choir pad. Effects at volume `0.2`: `whip`, `slash`, `hit`, `enemyDie`, `bossHit`, `bossTick`, `bossDie`, `pickup`, `relic`, `levelUp`, `jump`, `dash`, `save`, `death`, `gameover`, `select`, `victory`. The existing mute button is the only sound toggle. Melodies are original: no tune from Konami games, no Bach or other known piece.
- **Art:** gothic only (stone, stained glass, candles, iron, thorns, pale skin, long coats), pixel run tables (1 char per pixel, drawn at x3), no image files, one palette per zone.
- Pure TypeScript engine in `lib/vampire-hunter/` with no React and no Next.js imports. Password encode / decode in `lib/vampire-hunter/password.ts` as pure functions.
- Client component `components/vampire-hunter-canvas.tsx`.
- Registry entry in `components/game-registry.tsx`.
- Migration inserting the `games` row (with `origin`), applied with MCP `apply_migration`.
- New cover class `cover-vampire-hunter` in `app/globals.css`, designed with `/frontend-design`.
- Frame-time check with the SPEC 12 method, result logged in `references/perf/perf-log.md`.
- Update `CLAUDE.md` and `references/GAMES.md`.

**Out of scope (for future specs):**

- The inverted castle (SPEC 22) and the Credit Coin drop (SPEC 23); spells and familiars (out of scope, no spec planned). The password reserves 32 bits for SPEC 22 and keeps 26 spare.
- Any Konami sprite, music, map layout, enemy design, item name, the names "Castlevania", "Symphony of the Night", "Dracula" or "Belmont".
- Shops, gold, crafting, multiple save slots, switching hero inside a save, co-op.
- Skins and themes (no `appearance` entry; one palette per zone), light theme.
- Per-zone music (the registry supports one track plus one alternate).
- Saving the password to the account or to `localStorage`; any server-side validation of the password.
- Credits for bosses (the `award_boss_credit` RPC is Robo Vault only); Pin Collection pins for this game (the pin catalog is unchanged).
- Mode picker, difficulty select, level select in PAUSED.
- Changes to other games, `GamePlayer` or the registry types.
- Automated tests (no test runner is configured).

## Data model

Catalog entry (the `Game` type is unchanged). Existing unions: `Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS"`, `GameColor = "cyan" | "magenta" | "yellow" | "green"`. Pick the final `cat` and `color` with `/frontend-design`; do not extend the unions.

```ts
// lib/games.ts — appended to GAMES, after "robo-vault"
{
  id: "marcy-vampire-hunter",
  title: "MARCY THE VAMPIRE HUNTER",
  short: "Explore Count Faust's castle with a whip or a sword.",
  long: "Pick Marcy Delrre and her whip or Frankford Delrre and his sword, then explore a huge gothic castle. Defeat bosses to win relics that open new paths, level up and find better gear. Write down your password at every altar and paste it back later to continue with your hero, relics and score.",
  cat: "ARCADE", // placeholder: verify; closest existing category
  cover: "cover-vampire-hunter",
  color: "magenta", // placeholder: must be a valid GameColor
  plays: "0",
  origin: "ai",
}
```

Progress state and the password (framework-free, `lib/vampire-hunter/password.ts`):

```ts
export type Hero = "marcy" | "frankford";
export type Relic = "dash" | "leap" | "lantern" | "mist" | "glide" | "sigil";
export type Slot = "weapon" | "head" | "body" | "cloak" | "ring";

export interface Progress {
  hero: Hero;
  relics: Record<Relic, boolean>;
  bosses: boolean[]; // length 9: zones 2..9 bosses, then Count Faust
  level: number; // 1..50
  equipment: Record<Slot, number>; // tier 0..10 (0 = empty)
  crests: boolean[]; // length 10, one Vitality Crest per zone
  mapped: boolean[]; // length 10, zone map revealed
  score: number; // multiple of 10, 0..SCORE_CAP
}

export const SCORE_CAP = 40_950; // 4095 units of 10
export const GRID_COLS = 12;
export const GRID_SIZE = 144; // 12x12 cells

export type PasswordGrid = boolean[]; // length 144, index = row * 12 + col, A1 = 0 ... L12 = 143

export function encodePassword(p: Progress): PasswordGrid;
export function decodePassword(grid: PasswordGrid): Progress | null; // null = invalid
export function cellLabel(index: number): string; // 0 -> "A1", 143 -> "L12"
export function parsePasswordText(text: string): PasswordGrid | null; // null = invalid text
export function emptyProgress(hero: Hero): Progress;
```

Bit layout (144 bits):

| Bits | Field                                                             |
| ---- | ----------------------------------------------------------------- |
| 1    | `hero` (0 = marcy, 1 = frankford)                                 |
| 6    | relics (one bit each, order `dash leap lantern mist glide sigil`) |
| 9    | bosses defeated (zones 2..9, then Count Faust)                    |
| 6    | `level` (1..50)                                                   |
| 20   | equipment, 5 slots x 4 bits (tier 0..10)                          |
| 12   | score units (`min(score, SCORE_CAP) / 10`)                        |
| 10   | Vitality Crests (zones 1..10)                                     |
| 10   | map revealed (zones 1..10)                                        |
| 32   | reserved for SPEC 22 (must be 0 in this spec)                     |
| 26   | spare, reserved for future specs (must be 0)                      |
| 12   | checksum of the 132 payload bits (CRC-12, own polynomial)         |

The 144-bit word is XORed with a fixed mask and its bits are placed by a fixed permutation (`MASK`, `PERM` in `constants.ts`, own values), so the dots do not read as an obvious binary number and no valid password is an empty grid. `decodePassword` returns `null` when the checksum fails or the combination is impossible: level outside 1..50, equipment tier above 10, reserved bits not zero, a relic held without the boss that drops it, Count Faust defeated without the 8 zone bosses, zone 9 boss defeated without zones 2 to 8 bosses, a boss defeated in a zone whose map bit is not set. CRC-12 detects every single-bit error, so every single-cell change of a valid grid is rejected. The score written into a password is `min(score, SCORE_CAP)` rounded down to a multiple of 10; the in-run score can exceed the cap (clamped to 10,000,000 like every game). XP is not stored: a restore sets XP to the start of the stored level.

Engine public API:

```ts
// lib/vampire-hunter/engine.ts
export type VampireHunterSound =
  | "whip"
  | "slash"
  | "hit"
  | "enemyDie"
  | "bossHit"
  | "bossTick"
  | "bossDie"
  | "pickup"
  | "relic"
  | "levelUp"
  | "jump"
  | "dash"
  | "save"
  | "death"
  | "gameover"
  | "select"
  | "victory";

export interface VampireHunterCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void; // hero level 1..50
  onGameOver: (finalScore: number) => void; // once per run
  onSound?: (name: VampireHunterSound) => void;
  onHaptic?: (name: "death" | "clear") => void;
  onMusic?: (track: "stage" | "boss") => void;
}

export class VampireHunterEngine {
  constructor(canvas: HTMLCanvasElement, callbacks: VampireHunterCallbacks);
  start(): void; // title screen, fires onScore(0), onLives(3), onLevel(1); idempotent
  pause(): void;
  resume(): void;
  end(): void; // ends the run now, onGameOver once
  destroy(): void;
}
```

Internal state (not exported): `screen` (`"title" | "hero-select" | "password-entry" | "play" | "menu" | "altar" | "confirm-delete" | "victory"`), `progress: Progress`, `hero`, `stats`, `xp`, `room`, `entities`, `shots`, `pickups`, `boss`, `camera`, `respawn`, `visitedRooms`, `score`, `lives`.

Module layout:

| File                              | Contents                                                                                                                                                                                                   |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/vampire-hunter/constants.ts` | `W = 768`, `H = 576`, `TILE = 48`, physics values, `MAX_STEP = 8`, `MAX_DT = 0.05`, `START_LIVES = 3`, `MAX_LIVES = 5`, `MAX_LEVEL = 50`, `MASK`, `PERM`, `CRC_POLY`, zone palettes, relic and boss tables |
| `lib/vampire-hunter/password.ts`  | `Progress`, `encodePassword`, `decodePassword`, `parsePasswordText`, `cellLabel`, `emptyProgress`, `SCORE_CAP`                                                                                             |
| `lib/vampire-hunter/items.ts`     | Equipment tables (names, stat bonuses, tiers per slot and per hero weapon), drop tables                                                                                                                    |
| `lib/vampire-hunter/world.ts`     | Zones, rooms (tile maps as strings, size, exits, doors, altars, chests, relic gates), enemy spawn markers, map coordinates, built with a small helper                                                      |
| `lib/vampire-hunter/utils.ts`     | `clampScore`, `xpToNext`, `computeStats(progress)`, `damage(attacker, target)`, `rectsOverlap`, tile collision helpers                                                                                     |
| `lib/vampire-hunter/entities.ts`  | Types, sprite run tables (2 heroes, enemies, 9 bosses, shots, pickups), draw functions receiving `ctx`                                                                                                     |
| `lib/vampire-hunter/engine.ts`    | `VampireHunterEngine`: input, screens, physics, AI, combat, menu, password flow, draw, loop                                                                                                                |

Registry entry (existing fields only):

```ts
"marcy-vampire-hunter": {
  Canvas: VampireHunterCanvas,
  controls: [
    { keys: ["←", "→"], label: "MOVE" },
    { keys: ["SPACE"], label: "JUMP" },
    { keys: ["X"], label: "ATTACK" },
    { keys: ["C"], label: "SPECIAL" },
    { keys: ["ENTER"], label: "MENU" },
  ],
  stats: { lives: true, lines: false, level: true },
  music: {
    src: withBasePath("/game-assets/marcy-vampire-hunter/music.wav"),
    volume: 0.12,
    alt: { src: withBasePath("/game-assets/marcy-vampire-hunter/music-boss.wav"), volume: 0.18 },
  },
  sfx: { sounds: { /* 17 sounds, withBasePath */ }, volume: 0.2 },
  touch: {
    pad: [
      { code: "ArrowLeft", label: "◀", slot: "left", hold: true },
      { code: "ArrowRight", label: "▶", slot: "right", hold: true },
      { code: "ArrowUp", label: "▲", slot: "up", hold: true },
      { code: "ArrowDown", label: "▼", slot: "down", hold: true },
      { code: "Space", label: "JUMP", slot: "a", hold: true },
      { code: "KeyX", label: "ATTACK", slot: "b", hold: true },
      { code: "KeyC", label: "SPECIAL", slot: "x" },
      { code: "KeyL", label: "DASH", slot: "y" },
    ],
    hint: [ /* move, jump, attack, special, dash, menu tag */ ],
  },
},
```

`touch.pad` follows the exact `TouchButton` shape; the implementer adjusts. No `appearance`, `levelSelect`, `modes` or `difficultySelect`.

Migration (`supabase/migrations/<version>_add_marcy_vampire_hunter_game.sql`; version assigned by `apply_migration`, later than `20261111023221`). Every field identical to the `GAMES` entry; `origin` is required (no column default):

```sql
insert into public.games (id, title, short, long, cat, cover, color, origin) values
  ('marcy-vampire-hunter', 'MARCY THE VAMPIRE HUNTER', '<same short as lib/games.ts>',
   '<same long as lib/games.ts>',
   '<same cat as lib/games.ts>', 'cover-vampire-hunter', '<same color as lib/games.ts>', 'ai');
```

Rules and conventions:

- Coordinates: origin top-left, `y` grows down, canvas pixels and seconds. Update on the engine clock, `dt` clamped to `MAX_DT`, movement in sub-steps of at most `MAX_STEP` px so nothing tunnels through tiles. The engine clock freezes while paused and while the in-canvas menu is open.
- **Callbacks** fire only on change. `onGameOver` fires once per run (0 lives, Count Faust defeated and `Space` pressed, or `end()`), then loop and listeners stop. Score clamps to 10,000,000. Engines never play sound or vibrate: they emit `onSound`, `onHaptic` and `onMusic`. `onMusic("boss")` when a boss room activates, `onMusic("stage")` when the boss dies, the hero dies in the boss room or a new run starts.
- **Scoring (design values):** enemy `10 x its XP value`, boss 2,000 to 5,000 by zone, Count Faust 20,000, relic found 500, new zone entered 300, chest 100. A password stores `min(score, SCORE_CAP)`.
- **Lives:** 3 per run, extra life every 20,000 points (max 5) and from 1-up pickups. Dying in a boss room respawns the hero at the room door with the boss at full HP; elsewhere at the last Save Altar.
- **Password flow:** at each Save Altar, after each boss, on the `PASSWORD` tab and on victory, `progress` is rebuilt from the live run (`progress.score` from the live score) and encoded. On a valid `decodePassword`, `progress` replaces the run state; `onScore` and `onLevel` fire; stats are recomputed with `computeStats`.
- **Paste parsing (`parsePasswordText`):** accepts tokens `[A-L](1[0-2]|[1-9])`, case-insensitive, separated by spaces, commas, semicolons or newlines. Any other token returns `null` (`INVALID TEXT`, grid unchanged). Duplicate tokens are accepted. The text is only parsed, never evaluated. Clipboard read uses `navigator.clipboard.readText()` from a key or tap; if it is denied or missing the screen says `PRESS CTRL+V`, and the `paste` event on `window` is read while this screen is open. The `paste` listener is removed when the screen closes and on `destroy()`.
- **Input:** `keydown` and `keyup` on `window` using `e.code`, held set, `preventDefault` only for game keys while running and not paused. `P` and `Esc` do nothing. Held keys are cleared on `pause()`, `blur` and `visibilitychange`. The touch pad sends the same synthetic events (SPEC 10). The `MENU` tag uses `pointerdown` on the canvas.
- Entities receive `ctx` as argument; no module-level game state. The tile layer of each room is pre-rendered once and cached. No `mix-blend-mode`, no animated `mask-image`, no full-screen animated layers (SPEC 12); backgrounds are plain fills and a few rects. Dark rooms (without `lantern`) use plain alpha, not a blend mode.
- Canvas 768x576 is 4:3 and scaled by CSS. All text on the canvas is English.

## Implementation plan

Before step 1, read the relevant guides in `node_modules/next/dist/docs/` if a step touches pages or caching (normally not). Invoke `/frontend-design` for the cover and the zone palettes.

1. **Catalog entry.** Append `marcy-vampire-hunter` to `GAMES` (temporary existing cover). `npm run build` passes. This step is local only until step 12 (do not merge before the registry entry exists).
2. **Migration.** Write the migration file, apply it with `apply_migration`, rename the file to the version the tool assigns, confirm `select * from games where id = 'marcy-vampire-hunter'` matches `lib/games.ts`, run `get_advisors`. Types are not regenerated (schema unchanged).
3. **Cover.** `.cover-vampire-hunter` in `app/globals.css` (castle silhouette, moon, two hero silhouettes, different from the other covers); set `cover` in `lib/games.ts`.
4. **Password module.** `constants.ts` (masks, polynomial, physics), `password.ts`. Verify with a throwaway script (not committed): round trip over a large random sample of legal `Progress` values, every single-bit flip of a valid password is rejected, every impossible combination is rejected, paste parsing accepts `A1 l12, b3` and rejects `M1`, `A13`, `A0`, the cap at 40,950.
5. **Items and world.** `items.ts` tables and `world.ts` zone 1 and zone 2 rooms with the room helper. `npm run lint` and `npm run build` pass.
6. **Entities.** `entities.ts` sprites and draw functions for both heroes and zone 1 and 2 enemies.
7. **Engine, core.** Input, hero physics and tile collision, room camera and room changes, one hero attack (whip first), enemies, damage, lives, one Save Altar; public API with game over by `end()`. Folder imports nothing from `react` or `next`.
8. **Engine, RPG.** XP and levels, stats, drops, chests, equipment slots, the second hero (sword), special arts and MP, Vitality Crests.
9. **Engine, relics and bosses.** The 6 relics and their gates, boss rooms with boss HP and weaknesses, boss intro, `onMusic`.
10. **Engine, screens and password UI.** Title, hero-select, in-canvas menu (`MAP`, `EQUIP`, `STATUS`, `PASSWORD`), warp from the map, altar password display, entry screen with paste, `WRONG PASSWORD`, delete-progress confirm, `COPY`.
11. **World, remaining zones.** Zones 3 to 10 rooms, enemies and bosses, Count Faust 2 phases, victory screen and run end. Playtest and tune.
12. **Canvas wrapper and registry.** `components/vampire-hunter-canvas.tsx` mirroring `components/robo-vault-canvas.tsx`: Strict-Mode safe (one live loop), callbacks in a ref, `paused` and `endSignal`, `onSound`, `onMusic`. Registry entry without audio or touch yet. HUD shows Score, Lives, Level. Screenshot the HUD of another real game to confirm no change.
13. **Audio.** Generate the 17 `.wav` effects, `music.wav` and `music-boss.wav` into `public/game-assets/marcy-vampire-hunter/` with a one-off Node script that is not shipped. Add `music` (with `alt`), `sfx`, wire `onSound` and `onMusic`. Check by ear: gothic mood, effects differ, both tracks loop without a click, silent when muted.
14. **Touch and haptics.** Add `touch.pad` and `touch.hint`, wire `onHaptic`, check the `MENU` tag by tap. Check at 375px and with the GamePad menu at 1280px (cross skin and joystick skin).
15. **Walkthrough.** In `npm run dev` with Playwright (captures only in `.pwScreencaps/`): both heroes, defeat a boss and see the new password, reload the page and paste it, confirm hero, relics, level, gear and score came back; enter a wrong grid and invalid pasted text; delete progress; finish Count Faust; game over; SAVE SCORE as a signed-in user and confirm the `scores` row; check at 1280px and 375px.
16. **Performance.** Measure frame time with `references/perf/measure-fps.md`, log in `references/perf/perf-log.md`; fix the engine only if the target is missed.
17. **Docs.** Update `CLAUDE.md` (engine location, callbacks, canvas size, password format and reserved bits, audio, touch mapping, catalog sync, game count) and `references/GAMES.md` (with the `origin` column). Run `npm run lint` and `npm run build`.

## Acceptance criteria

Generic:

- [ ] `npm run lint` and `npm run build` finish without errors.
- [ ] `lib/games.ts` contains `marcy-vampire-hunter` as the last entry with `origin: "ai"`; all other entries unchanged.
- [ ] `select * from games where id = 'marcy-vampire-hunter'` matches `lib/games.ts` (including `cover`, `color`, `origin`); the migration file carries the applied version; `get_advisors` shows no new warning.
- [ ] `/library` lists 11 games; the card links to `/games/marcy-vampire-hunter`; PLAY goes to `/games/marcy-vampire-hunter/play`; the detail page shows `🤖 A.I MADE` first.
- [ ] The play page shows a real canvas with no mode picker; it starts on the title screen.
- [ ] PAUSE freezes everything and shows PAUSED; RESUME continues with no time jump; keys held during pause do not stay stuck.
- [ ] END opens the GAME OVER modal; `onGameOver` does not fire twice.
- [ ] Game keys do not scroll the page; typing a name in the modal input works.
- [ ] A signed-in user: SAVE SCORE inserts one row `{ game_id: "marcy-vampire-hunter", name, score }`; a guest sees `SIGN IN TO SAVE YOUR SCORE`. The score appears in `/games/marcy-vampire-hunter` and the Hall of Fame tab after a reload.
- [ ] PLAY AGAIN starts a fresh engine on the title screen (score 0, lives 3, level 1, no progress).
- [ ] EXIT or leaving the page stops the engine and the music: no rAF loop and no listener (including `paste`) remains. In dev (Strict Mode) only one loop runs.
- [ ] At 375px width the canvas fits the CRT frame without horizontal scroll.
- [ ] All 10 other games behave exactly as before.
- [ ] No `localStorage` key, cookie or Supabase table is written for progress; `lib/storage.ts` unchanged.
- [ ] `lib/vampire-hunter/` imports nothing from `react` or `next`.
- [ ] No text is in Spanish; no Konami asset, name or melody is used; the UI never says "Castlevania", "Symphony of the Night", "Dracula" or "Belmont".
- [ ] No React hydration warnings on reload; no `mix-blend-mode`, animated `mask-image` or full-screen animated layer was added; the frame time result is in `references/perf/perf-log.md`.

Game-specific:

- [ ] The canvas is 768x576; HUD start values are Score 0, Lives 3, Level 1; no Lines slot.
- [ ] The title offers `NEW GAME` and `PASSWORD`; `NEW GAME` opens the hero-select screen with Marcy Delrre and Frankford Delrre; choosing one starts at the Gate Court altar.
- [ ] Marcy attacks with a whip (reach about 144 px) and Frankford with a sword (reach about 72 px, faster combo); each special art costs its MP and does nothing without enough MP.
- [ ] Up plus attack attacks upward; down crouches (smaller hitbox, crouch attack); `↑` alone interacts and does not jump.
- [ ] Killing enemies gives XP; reaching the XP threshold raises the level (max 50), restores HP and MP, plays `levelUp` and fires `onLevel`.
- [ ] Each of the 5 equipment slots can hold tiers 0 to 10; equipping changes the stats shown on `STATUS`; weapon tiers are per hero.
- [ ] Each of the 6 relics is dropped by its zone boss and works as listed; each gated route stays blocked until its relic is owned.
- [ ] The castle has 10 zones; the `MAP` tab draws visited rooms; a zone with its map bit set shows all its rooms; warp works only to altars of zones whose map bit is set.
- [ ] Boss rooms play the boss track (`onMusic("boss")`) and return to the stage track when the boss dies; a death in the boss room restarts the fight at full boss HP at the room door.
- [ ] Count Faust has 2 phases; defeating him shows the victory screen with the final password, and `Space` ends the run with `onGameOver`.
- [ ] A Save Altar restores HP and MP, sets the respawn point and shows the password; losing a life returns the hero to the last altar with full HP and MP; 0 lives ends the run.
- [ ] The password screen shows a 12x12 grid and the list of filled cells (`A1`..`L12`); `COPY` puts the labels in the clipboard.
- [ ] `encodePassword` then `decodePassword` returns the same `Progress` for a large random sample of legal values; any single-cell change to a valid grid is rejected; every impossible combination listed in Data model is rejected.
- [ ] The password entry screen: pasting copied labels (`PASTE` option or `Ctrl+V`) fills the same grid as copying it from the altar screen; lower case and comma separators are accepted; text with an unknown token shows `INVALID TEXT` and leaves the grid unchanged.
- [ ] Entering a valid password on the title restores hero, relics, bosses, level, equipment, crests, map bits and score (`onScore` fires with the restored value, `onLevel` with the level), then starts at the Gate Court altar; the SAVE SCORE value after game over includes the restored score.
- [ ] A wrong grid shows `WRONG PASSWORD` and leaves state unchanged; the empty grid is rejected.
- [ ] The score stored in a password never exceeds 40,950 and is a multiple of 10; the live score can exceed it.
- [ ] `DELETE PROGRESS` asks for confirmation with `NO` as default; `NO` changes nothing; `YES` sets score 0 (`onScore(0)`), Level 1, clears relics, bosses, equipment, crests and map bits, and returns to the title.
- [ ] Both music tracks are gothic in style (organ, harpsichord, bells, choir pad), loop without a click, stop when paused or muted, and restart on PLAY AGAIN.
- [ ] The 17 effects play at the right events at volume 0.2 and are audibly different; nothing plays while muted, paused or after game over.
- [ ] On a phone-width viewport the pad shows; `left` / `right` / `up` / `down` work while held, `a` jumps (hold = higher), `b` attacks (hold = repeat), `x` uses the special, `y` dashes; the `MENU` tag opens the menu by tap; held buttons release at pause and game over.
- [ ] `death` haptic fires when a life is lost and `clear` when a boss is defeated, only when touch UI is active.
- [ ] The PAUSED overlay shows no level select and no sound button; asset URLs load through `withBasePath` (also under `/Arcade-Vault-Claude`).

## Decisions

- **Yes:** own title `MARCY THE VAMPIRE HUNTER` (the first draft used another name that echoed a character from another series; user decision to change it), own heroes, own villain **Count Faust** (user decision), own art and own generated audio; no Konami name in the UI (precedent of SPEC 17 and SPEC 20). **No:** reusing the original names or characters.
- **Yes:** two heroes with different moves (whip: long reach, slower; sword: short reach, fast combo) in the same castle (user decision). **No:** same moves with only a skin, or different routes per hero (too much level design).
- **Yes:** split into three specs: 21 main castle and RPG core, 22 inverted castle, 23 Credit Coin drop (the first plan for 23, spells and familiars, was replaced at the user's request). **No:** one huge spec; the user asked for a large castle and a full RPG, which do not fit a single implementation without a high risk of overrun.
- **Yes:** 12x12 dot-grid password of 144 bits with a CRC-12 and 58 reserved bits (user decision: grow the grid so the inverted castle and later specs need no format change). **No:** a 64-bit grid that would drop equipment or the map.
- **Yes:** paste support on the password screen (`PASTE` option and `Ctrl+V`), as the user asked, because 144 cells are slow to copy by hand. The text format is the same cell-label list that `COPY` produces.
- **Yes:** the password is the only persistence: no `localStorage`, no Supabase table, same as SPEC 20. Position, XP inside a level, loose items and unvisited rooms are not stored; a restore starts at the Gate Court altar and the player warps from the map.
- **Yes:** equipment stores one tier per slot and higher tiers are strict upgrades, so the password stays small. **No:** an inventory with free item choice (would not fit the grid).
- **Yes:** the score is stored in 12 bits and capped at 40,950, same as SPEC 20, so a forged password gains little. **No:** a server-side check; the site is static and the leaderboard already trusts the client.
- **Yes:** 3 lives per run and a platform game over, so `onGameOver` fires once per run and SAVE SCORE works like every other game. **No:** the original's no-lives design.
- **Yes:** hero level shown in the Level slot (1..50).
- **Yes:** the in-canvas menu opens with `Enter` and a canvas `MENU` tag for touch, because the pad has only 8 slots and `GamePlayer` stays unchanged.
- **Yes:** MP exists in this spec for one special art per hero; full spells and familiars are out of scope (no spec planned).
- **Yes:** two music tracks (stage and boss) through the existing `music.alt` registry field added in SPEC 20. **No:** per-zone music.
- **No:** skins, pins and boss credits for this game; each deserves its own spec.

## Risks

| Risk                                                                               | Mitigation                                                                                                                                                               |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The largest engine yet (about 80 rooms, 9 bosses, RPG, map, menu, two heroes).     | Steps 7 to 10 each leave a playable game with zones 1 and 2; if it overruns, ship fewer zones and move the rest to a follow-up spec (the password already has all bits). |
| Hand-authored rooms may be boring or confusing.                                    | Rooms are built with a helper and live in `world.ts` only; the walkthrough plays the full route and tunes gates.                                                         |
| Relic gates can soft-lock a player (for example, a dead-end behind a gate).        | Every gate has an exit, warp reaches any mapped zone, and the walkthrough checks the route order.                                                                        |
| Players can craft passwords with all gear and relics.                              | Score is capped and checksummed; progress forgery is accepted (single-player, no unlock beyond the game itself).                                                         |
| A 144-cell password is long to type.                                               | `COPY`, `PASTE`, the label list, and CRC-12 with a clear `WRONG PASSWORD` message.                                                                                       |
| The clipboard read API may be blocked (permissions, iframe, Safari).               | The `Ctrl+V` `paste` event path and a clear message; copy has a textarea fallback.                                                                                       |
| Frame time with large rooms and dark-room overlays.                                | Pre-rendered tile layers per room with a small cache, plain alpha for darkness, measured in step 16.                                                                     |
| Gothic music that is too close to a known piece or to Konami tunes.                | The spec requires original melodies; a criterion checks nothing is copied.                                                                                               |
| Strict Mode can leave two loops or duplicate listeners (including `paste`) in dev. | `start()` idempotent, `destroy()` removes everything; a criterion checks it.                                                                                             |
| `GAMES` and the `games` table drift apart.                                         | The migration inserts identical values including `origin`; documented in `CLAUDE.md`.                                                                                    |

## What is **not** in this spec

- The inverted castle (SPEC 22), the Credit Coin drop (SPEC 23), spells and familiars (out of scope, no spec planned).
- Konami sprites, music, maps, names or characters.
- Shops, gold, crafting, multiple save slots, hero switching inside a save, co-op.
- Skins, themes, per-zone music, level select in PAUSED, modes, difficulty.
- Saving progress outside the password; server-side password validation.
- Pins and boss credits for this game, changes to other games, `GamePlayer` or the registry types.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
