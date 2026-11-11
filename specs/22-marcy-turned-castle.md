# SPEC 22 — Marcy the Vampire Hunter: the Turned Castle (upside-down castle)

> **Status:** Approved
> **Depends on:** SPEC 20, SPEC 21
> **Date:** 2026-11-10
> **Objective:** Add the Turned Castle (the main castle turned upside down: 8 new zones, a harder bestiary, 8 new bosses, equipment tiers 11 to 15, level cap 63 and a final boss called the Hollow King) to Marcy the Vampire Hunter, unlocked when Count Faust is defeated and saved in the same 12x12 password.

## Why this spec exists

SPEC 21 ships the main castle and the RPG core and reserves 32 password bits for this spec. The user asked for an inverted castle like the second half of the original game: after the villain falls, the castle turns over and the player explores it again, stronger and facing harder enemies.

The user chose the following (see Decisions): the castle map is rotated 180 degrees with **new rooms** (not flipped copies), it opens **after Count Faust**, it brings a **harder tier** of content, and the password grid grows to **12x12 (144 bits)** so this spec and later specs fit without more format changes. SPEC 21 was amended in the same change (grid 10x10 to 12x12, CRC-12, 32 bits reserved here and 26 spare).

Same rules as SPEC 21 for IP and audio: own art, own names, own generated audio, no Konami asset, name or melody; the UI never says "Castlevania", "Symphony of the Night", "Dracula" or "Belmont".

## Amendments to SPEC 21

These override SPEC 21 where they conflict.

- **Victory flow.** Defeating Count Faust no longer ends the run on `Space`. The victory screen shows the password and two options: `ENTER THE TURNED CASTLE` (default) and `END RUN`. `END RUN` calls `onGameOver` as before. Defeating the Hollow King shows a second victory screen (the true ending) where `Space` ends the run.
- **Level cap and gear tiers.** The level cap becomes 63 (the 6 level bits already allow it) and equipment tiers become 0 to 15 (the 4 bits already allow it). `decodePassword` rejects level above 50 and tier above 10 **unless Count Faust is defeated** (SPEC 21 rejects them unconditionally).
- **Map tab.** The `MAP` tab gets a `MAIN` / `TURNED` switch (`Space` on the tab header). `TURNED` shows only after Count Faust is defeated.
- **Sounds.** One new effect, `turn` (18 sounds in total).
- **Reserved bits.** The 32 bits reserved for SPEC 22 get the layout below; the 26 spare bits stay zero.

## Scope

**In:**

- **Unlock:** the Turned Castle opens when Count Faust is defeated (`bosses[8]` of SPEC 21). After the first victory the player sees the `turn` scene (castle rotating, 3 s, skippable with `Space`) and starts at the altar of Turned zone 1. On a restored password with Faust defeated, the Turned Castle is reachable from the map switch and by warp.
- **8 Turned zones and one arena.** Each Turned zone mirrors the place of a main zone (zones 2 to 9) on the rotated map. Rooms are new tile maps, about 5 rooms per zone (about 40 rooms), 1 to 4 screens wide and 12 tiles tall. Gravity stays normal and the heroes are drawn upright. Tile decor (chandeliers, pillars, roots, stalactites) is drawn flipped vertically and zone palettes are inverted, so the castle reads as upside down.

  | Turned zone | Name             | Mirrors (main zone)   | Boss                       |
  | ----------- | ---------------- | --------------------- | -------------------------- |
  | T1          | Sunken Chapel    | 2 Chapel of Ash       | Cinder Cantor              |
  | T2          | Ossuary Sky      | 3 Catacombs           | Marrow Titan               |
  | T3          | Rising Cellars   | 4 Flooded Cellars     | Brine Matron               |
  | T4          | Clockwork Abyss  | 5 Clockwork Tower     | Pendulum Reaper            |
  | T5          | Silent Library   | 6 Library of Whispers | Inkbound Scribe            |
  | T6          | Gravewood Garden | 7 Garden of Thorns    | Briar Empress              |
  | T7          | Deep Spire       | 8 Bell Spire          | Gargoyle Tyrant            |
  | T8          | Crimson Zenith   | 9 Blood Cistern       | Crimson Regent             |
  | Arena       | Hollow Throne    | 10 Faust's Keep       | The Hollow King (3 phases) |

  The Hollow Throne opens when the 8 Turned bosses are defeated. Zone entry order is free except T8 (needs T1 to T7 bosses) and the arena (needs all 8). Boss HP, damage and weakness are design values, higher than their main counterparts (about 1.6x HP).

- **Harder bestiary:** about 14 new enemy kinds, at least 1 per Turned zone, plus palette variants of main-castle enemies with higher HP, damage and XP. New attack patterns, not only stat changes (for example: a bell wraith that leaves a damaging zone, a book swarm that homes, a root grabber).
- **Equipment tiers 11 to 15** for all 5 slots (and 5 more whips and 5 more swords). They drop only in the Turned Castle (chests, boss drops and rare enemy drops). Higher tier is still a strict upgrade.
- **Level cap 63.** `xpToNext` is extended with a steeper curve; Turned enemies give more XP.
- **Vitality Crests:** one hidden in each Turned zone (8 more), raising max HP.
- **Turned altars:** one per zone and one in the Hollow Throne antechamber, with the same save and password behavior as SPEC 21.
- **Map and warp:** the `MAP` tab draws the Turned Castle with the same rules (visited rooms plus rooms of zones marked in the password). Warp works to Turned altars of mapped zones. `MAIN` altars stay reachable.
- **Final boss:** the Hollow King, 3 phases (throne with summons, floating blades, collapsing floor with a dash gate), defeated shows the true-ending victory screen with the final password. It uses the boss track (`onMusic("boss")`).
- **Scoring (design values):** Turned enemy `15 x its XP value`, Turned boss 6,000 to 10,000 by zone, the Hollow King 50,000, Turned crest 100, new Turned zone entered 500. The score stored in a password stays capped at 40,950.
- **Lives and death:** same as SPEC 21 (3 lives per run, return to the last altar, boss room death restarts the fight at the room door).
- **Audio:** the two gothic tracks of SPEC 21 are reused for both castles. One new effect `turn.wav` (a low organ swell and a heavy stone grind). Original, no copied tune.
- **Art:** gothic only, own pixel run tables; Turned palettes are inverted counterparts of the SPEC 21 zone palettes, defined in `constants.ts`.
- **Password:** the 32 reserved bits get a layout (Data model). `Progress` gains an optional `turned` block. The `PASSWORD` tab, the altar screens and the paste entry work unchanged.
- **Docs:** update `CLAUDE.md` and `references/GAMES.md`.
- UI changes (turn scene, map switch, victory options) designed with `/frontend-design`.

**Out of scope (for future specs):**

- Spells and familiars (out of scope, no spec planned); the Credit Coin drop is SPEC 23. The 26 spare bits stay reserved.
- A 7th relic or any new relic; all relics come from SPEC 21.
- A new music track for the Turned Castle, per-zone music.
- Flipping the canvas, upside-down hero physics or ceiling walking.
- New heroes, hero switching, shops, gold, co-op.
- Boss credits, pins, skins, new registry fields, changes to `GamePlayer` or other games.
- Automated tests.

## Data model

Password layout. The 144-bit grid of SPEC 21 keeps its first 74 payload bits unchanged; the 32 bits after them become:

| Bits | Field                                                                         |
| ---- | ----------------------------------------------------------------------------- |
| 8    | Turned zone bosses defeated (T1..T8)                                          |
| 1    | the Hollow King defeated                                                      |
| 8    | Turned Vitality Crests (T1..T8)                                               |
| 8    | Turned map revealed (T1..T8)                                                  |
| 7    | still reserved (must be 0)                                                    |
| 26   | spare, reserved (must be 0), then the 12-bit CRC-12 checksum (unchanged) |

`Progress` extension (`lib/vampire-hunter/password.ts`):

```ts
export interface TurnedProgress {
  bosses: boolean[]; // length 9: T1..T8 bosses, then the Hollow King
  crests: boolean[]; // length 8
  mapped: boolean[]; // length 8
}

export interface Progress {
  // ...fields of SPEC 21...
  turned: TurnedProgress; // all false until Count Faust is defeated
}
```

`decodePassword` returns `null` (in addition to the SPEC 21 rules) when: any `turned` bit is set without Count Faust defeated; a Turned boss is defeated in a zone whose map bit is not set; T8 boss defeated without the T1 to T7 bosses; the Hollow King defeated without the 8 Turned bosses; level above 63; tier above 15; level above 50 or tier above 10 without Count Faust defeated; the 7 spare bits or the 26 spare bits not zero. CRC-12 still detects every single-bit error. The unlock itself needs no bit: it is `bosses[8]` (Count Faust).

World data (`lib/vampire-hunter/world-turned.ts`):

```ts
export interface TurnedZone {
  id: "T1" | "T2" | "T3" | "T4" | "T5" | "T6" | "T7" | "T8" | "ARENA";
  name: string;
  mirrors: number; // main zone id 2..10
  rooms: Room[]; // Room type of world.ts
  palette: ZonePalette; // inverted counterpart
  boss: BossId;
}
export const TURNED_ZONES: TurnedZone[];
```

Engine API: unchanged. `VampireHunterSound` gains `"turn"`. Internal `screen` gains `"turn-scene"`, and `castle: "main" | "turned"` selects the active zone list. `onLevel` fires up to 63.

Rules and conventions:

- Everything of SPEC 21 holds (coordinates, `MAX_DT`, `MAX_STEP`, callbacks only on change, input by `e.code`, no `mix-blend-mode`, `paste` listener cleanup, English text).
- The Turned rooms use the same tile legend as `world.ts`; vertical flip applies only to decor sprites, never to collision.
- The `turn` scene runs on the engine clock, freezes in pause and fires no callback except `onSound("turn")`.
- Restore from a password always starts at the Gate Court altar, as in SPEC 21; the player warps from the map.

## Implementation plan

Before step 1, read the relevant guides in `node_modules/next/dist/docs/` if a step touches pages or caching (normally not). Invoke `/frontend-design` for the turn scene, the map switch and the Turned palettes.

1. **Password layout.** Extend `password.ts` with the `turned` block and the new decode rules. Throwaway script (not committed): round trip over a large random sample of legal `Progress` values (including Turned data), every single-bit flip rejected, each impossible combination in Data model rejected, SPEC 21 passwords with all `turned` bits zero still decode.
2. **Items and XP.** Equipment tiers 11 to 15 in `items.ts` (5 slots plus whips and swords), level cap 63 and the extended `xpToNext` in `utils.ts`. `npm run lint` and `npm run build` pass; the main castle still plays.
3. **Turned world, zones T1 and T2.** `world-turned.ts` with the room helper, palettes in `constants.ts`, flipped decor drawing, a debug-free way to reach them (temporary dev hook removed before the final step).
4. **Enemies and bosses T1 and T2.** New sprites and AI in `entities.ts` and `engine.ts`; bosses Cinder Cantor and Marrow Titan.
5. **Victory flow, turn scene and map switch.** Victory screen options, `turn-scene`, `turn` sound id, `MAIN` / `TURNED` map switch, warp to Turned altars, restore-from-password path.
6. **Zones T3 to T8.** Rooms, enemies, Vitality Crests, six more bosses. Playtest and tune relic gates and HP values.
7. **Hollow Throne.** Arena, the Hollow King with 3 phases, true-ending victory screen and run end.
8. **Audio.** One-off Node script (not shipped) generates `turn.wav` into `public/game-assets/marcy-vampire-hunter/`; add `turn` to the registry `sfx` and wire `onSound`. Check by ear: it differs from the other effects and fits the gothic mood.
9. **Touch and walkthrough.** Check the turn scene skip and the map switch with the touch pad (375px and GamePad menu at 1280px). In `npm run dev` with Playwright (captures only in `.pwScreencaps/`): beat Count Faust, enter the Turned Castle, save, reload and paste the password, confirm Turned progress, level above 50 and tier above 10 return; reject a Turned bit without Faust; finish the Hollow King; SAVE SCORE as a signed-in user.
10. **Performance.** Measure frame time with `references/perf/measure-fps.md` on a Turned room with many enemies, log in `references/perf/perf-log.md`; fix the engine only if the target is missed.
11. **Docs.** Update `CLAUDE.md` (Turned Castle files, password layout, level cap and tier range, victory flow, `turn` sound) and `references/GAMES.md`. Run `npm run lint` and `npm run build`.

## Acceptance criteria

Generic:

- [ ] `npm run lint` and `npm run build` finish without errors.
- [ ] No new catalog entry, no migration and no database change; `lib/games.ts` unchanged.
- [ ] All 10 other games behave exactly as before; SPEC 21 behavior outside the amendments is unchanged.
- [ ] No `localStorage` key, cookie or Supabase table is written for progress; `lib/storage.ts` unchanged.
- [ ] `lib/vampire-hunter/` imports nothing from `react` or `next`.
- [ ] No text is in Spanish; no Konami asset, name or melody is used; the UI never says "Castlevania", "Symphony of the Night", "Dracula" or "Belmont".
- [ ] No React hydration warnings on reload; no `mix-blend-mode`, animated `mask-image` or full-screen animated layer was added; the frame time result is in `references/perf/perf-log.md`.
- [ ] EXIT or leaving the page stops the engine and the music: no rAF loop and no listener remains. `onGameOver` never fires twice.

Game-specific:

- [ ] Before Count Faust is defeated, the `TURNED` map switch is hidden and no Turned zone is reachable.
- [ ] Defeating Count Faust shows the victory screen with the password and the options `ENTER THE TURNED CASTLE` (default) and `END RUN`; `END RUN` ends the run with `onGameOver`.
- [ ] `ENTER THE TURNED CASTLE` plays the `turn` scene (skippable with `Space`, frozen in pause) and starts at the Turned zone 1 altar.
- [ ] The Turned Castle has 8 zones plus the Hollow Throne arena; each zone has its listed boss and one Vitality Crest; the arena opens only after the 8 Turned bosses.
- [ ] Turned rooms use new tile maps (not flipped copies of main rooms) with flipped decor and inverted palettes; heroes are drawn upright and gravity is normal.
- [ ] Turned enemies include at least 14 new kinds with new attack patterns; Turned bosses have about 1.6x the HP of their main counterparts.
- [ ] Equipment tiers 11 to 15 drop only in the Turned Castle; equipping one raises the stats on `STATUS`.
- [ ] The level cap is 63 and `onLevel` fires up to 63.
- [ ] The Hollow King has 3 phases; defeating him shows the true-ending victory screen with the final password, and `Space` ends the run with `onGameOver`.
- [ ] The `MAP` tab switches between `MAIN` and `TURNED` and draws visited rooms of the chosen castle; warp works to the altars of mapped Turned zones.
- [ ] Altars and the `PASSWORD` tab show the password including Turned data; `COPY` and `PASTE` work with the 144-cell grid.
- [ ] A SPEC 21 password (no Turned data) still decodes after this spec.
- [ ] Entering a valid password with Turned progress restores Turned bosses, crests, map bits, level above 50 and gear above tier 10, then starts at the Gate Court altar.
- [ ] A password with any Turned bit set but Count Faust not defeated shows `WRONG PASSWORD`; so does any single-cell change of a valid grid.
- [ ] `DELETE PROGRESS` also clears all Turned data, Level 1 and score 0.
- [ ] The score stored in a password never exceeds 40,950; the live score can exceed it.
- [ ] The `turn` sound plays at volume 0.2 and is audibly different from the other effects; nothing plays while muted, paused or after game over.
- [ ] Boss fights in the Turned Castle play the boss track and return to the stage track when the boss dies.

## Decisions

- **Yes:** rotated map with **new rooms** per zone, about 5 rooms per zone (user choice). **No:** auto-flipped copies of main rooms (platforms and gates make no sense when flipped) and a fully separate castle (most work).
- **Yes:** the Turned Castle opens after Count Faust (user choice), and the victory screen continues into it. **No:** extra unlock conditions (all crests, a new relic).
- **Yes:** harder tier: new enemies and bosses, gear tiers 11 to 15, level cap 63, new final boss the Hollow King (user choice). **No:** a new relic or a new hero.
- **Yes:** grow the grid to 12x12 and 144 bits so this spec fits (user choice), and amend SPEC 21, which is still Draft, so the format never shipped at 10x10. **No:** keeping 10x10 and shrinking Turned data.
- **Yes:** upright heroes and normal gravity; only decor is flipped and palettes inverted. **No:** flipping the canvas or walking on ceilings (control and collision risk).
- **Yes:** reuse the two gothic music tracks and add one effect (`turn`). **No:** new tracks or per-zone music (registry supports one track plus one alternate).
- **Yes:** the unlock needs no password bit (Count Faust's bit is enough), which keeps 7 spare bits.
- **Yes:** passwords of SPEC 21 stay valid. If SPEC 21 was already shipped at 10x10, those passwords stop working because the grid changed; the game was a Draft when this was decided.

## Risks

| Risk                                                               | Mitigation                                                                                                                                              |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| About 40 new rooms, 14 enemy kinds and 9 bosses on top of SPEC 21. | Steps 3 to 7 each leave a playable build; if it overruns, ship fewer zones and move the rest to a follow-up spec (the password already holds all bits). |
| SPEC 21 may already be implemented at 10x10 when this spec lands.  | Step 1 changes the format in place; the amendment note in SPEC 21 states the new grid, and the walkthrough checks a fresh password.                     |
| Players can craft passwords with Turned progress and tier 15 gear. | Score capped and checksummed; progress forgery is accepted (single-player, no unlock beyond the game itself).                                           |
| Rotated layouts may confuse players about where Turned zones are.  | The `TURNED` map shows the same grid positions as the main map, and the zone name table pairs each Turned zone with its main zone.                      |
| Level 63 and tier 15 can trivialize the game or break balance.     | Turned damage and HP values are tuned in step 6; `xpToNext` is steeper above level 50.                                                                  |
| Longer passwords (144 cells) are hard to type.                     | `COPY`, `PASTE`, the label list and CRC-12 with a clear `WRONG PASSWORD` message (SPEC 21).                                                             |
| Frame time in busy Turned rooms with flipped decor.                | Tile layers pre-rendered with the flipped decor (no per-frame flip), measured in step 10.                                                               |
| The new `turn` effect is too close to a known sound.               | Generated from scratch by a one-off script; checked by ear.                                                                                             |

## What is **not** in this spec

- Spells and familiars (out of scope, no spec planned); the Credit Coin drop is SPEC 23.
- New relics, new heroes, hero switching, shops, gold, co-op.
- New music tracks or per-zone music.
- Flipped canvas, ceiling walking or any change to hero physics.
- New catalog entry, migration, boss credits, pins, skins, changes to `GamePlayer`, the registry types or other games.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
