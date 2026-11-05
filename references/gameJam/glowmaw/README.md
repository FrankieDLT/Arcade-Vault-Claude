# Game jam: Glowmaw

- **Game id:** `glowmaw` (cover class `cover-glowmaw`, category ARCADE, accent `cyan`)
- **Theme:** Pac-man. A character that opens and closes its mouth eating pellets in a simple maze while being chased by ghosts.
- **Date:** 2026-11-05

## Concept pitch

Glowmaw is a luminous deep-sea orb with a big hungry mouth. It swims a coral maze gulping glowing motes while jelly drifters hunt it down the corridors. A pearl turns the drifters dazed and edible, then they race back to their den as a pair of eyes. Clear the reef and dive into a faster one. Sessions are two to six minutes; the score loop rewards clean routes and a nerve for chasing drifters.

Original design, not a clone: a cyan glowing orb instead of a yellow disc, jelly drifters with distinct rules (Hunter chases directly, Mirror targets the tile opposite to you through the maze center, Roamer wanders, Pacer follows walls), linear chain scoring for dazed drifters, a gulp-streak multiplier (v2, v3), treasure shells and Feast levels (v3). No names, characters, art, music or levels from any existing game.

## How it fits the theme

- Mouth opening and closing: the wedge mouth oscillates while moving.
- Eating pellets: 135 motes and 4 pearls per reef (141 and 4 in Reef B).
- Simple maze: one symmetric 19x15 maze with a den and a side warp (v3 adds a second).
- Chased by ghosts: three to four jelly drifters, each with its own chase rule.

## Variants

| | v1 lean | v2 standard | v3 deluxe |
| --- | --- | --- | --- |
| Effort | S | M | L |
| Core loop (maze, motes, pearls, 3 drifters, daze, lives, levels, warp) | yes | yes | yes |
| Gulp-streak multiplier (x1 to x5) | no | yes | yes |
| Fourth drifter (Pacer, level 4+) and extra lives | no | yes | yes |
| Skins (`abyss`, `neon`, `coral`) | no | yes | yes |
| Level select while paused | no | yes | yes |
| Second maze, treasure shells, Surge and Shield, Feast bonus levels | no | no | yes |
| Sound effects and music | no | no | yes, files to be supplied by the user |
| HUD stats | Score, Lives, Level | Score, Lives, Level | Score, Lives, Level |
| Platform features used | none | `appearance`, `levelSelect` | `appearance`, `levelSelect`, `sfx`, `music` |
| Assets | none (canvas shapes) | none | audio only (user supplied) |
| New platform extensions needed | none | none | none |
| Max score estimate | about 490,000 | about 1,100,000 | about 1,300,000 |
| Main risks | untested tuning of speeds and release times; tile-center movement and warp bugs | adds streak balance, Pacer loops, level select skips | needs audio files (and their license); more states to get right (shells, Shield, Feast, two mazes) |

All three stay far below the 10,000,000 cap, and `clampScore` caps anyway.

## Recommended variant

**v2 standard.** The gulp-streak twist is what makes a replay worth it (route planning beats raw speed), skins and level select reuse existing platform features with no code outside the registry, and it needs no audio or art assets. v1 is the safe fallback if the engine budget is tight; v3 is worth it only once the user has the sound files and wants more variety per run.

## Open questions for the user

1. Should Glowmaw replace the catalog-only `chomper` placeholder (same maze-chase idea) instead of living beside it? The specs add a new entry and leave `chomper` untouched, as SPEC 09 did for `serpentine`. Replacing it would need an `update` migration and a different Decisions line.
2. Accent color: `cyan` was chosen (deep-sea look), shared with Asteroids. `yellow` is used by Snake, `magenta` by Arkanoid, `green` by Tetris. Any preference?
3. v3 only: can you supply the audio (`gulp.mp3`, `pearl.mp3`, `bite.mp3`, `shell.mp3`, `death.mp3`, `reef-loop.mp3`) and confirm their license? Without them v3 ships silent.
4. Is a single maze with a side warp enough for v1 and v2, or should Reef B join v2?
5. Should the drifters be able to reverse at any time (more chaotic) or keep the no-reverse rule used here?

## Promotion steps

1. Pick one variant file (`v1-lean.md`, `v2-standard.md` or `v3-deluxe.md`).
2. Copy it to `specs/NN-glowmaw-game.md`, where `NN` is the next spec number (highest in `specs/` plus one).
3. Replace the literal `NN` in the title line (`# SPEC NN — Glowmaw game (...)`) with that number and remove the variant suffix if wanted.
4. Check that the migration timestamp (`20261105180000`) is still later than the latest file in `supabase/migrations/`; if not, bump it everywhere it appears.
5. Run `/spec-impl NN-glowmaw-game`.
