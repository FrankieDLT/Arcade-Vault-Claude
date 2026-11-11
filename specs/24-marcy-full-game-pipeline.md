# SPEC 24 — Marcy the Vampire Hunter: one /full-game-impl run for SPEC 21, 22 and 23 (no skins)

> **Status:** Implemented
> **Depends on:** SPEC 20, SPEC 21, SPEC 22, SPEC 23
> **Date:** 2026-11-10
> **Objective:** Define one merged implementation plan that builds SPEC 21 (main castle), SPEC 22 (Turned Castle) and SPEC 23 (Credit Coin) of Marcy the Vampire Hunter in a single `/full-game-impl` run, with the skin-designer stage skipped for this game only.

## Why this spec exists

SPEC 21, SPEC 22 and SPEC 23 are one game, but each is written as its own contract. `/full-game-impl` takes a single spec name, runs `/spec-impl` once, then `mobile-porter`, `skin-designer` and `game-perf-booster`. Running it three times would repeat the agents and redo shared work (the password module, the audio script, the walkthrough, the docs). This spec is the **umbrella**: it holds no new game rules. It lists the order in which the steps of the three specs run, which work is merged, and the one pipeline change the user asked for: **no skins for this game**.

Run it with `/full-game-impl 24-marcy-full-game-pipeline` after SPEC 24 is `Approved`.

## Pipeline overrides

```yaml
skip: skin-designer
```

This section is machine-read by `/full-game-impl` (see step 1 of the plan). The `skip` key lists stages the pipeline does not run for this spec. The only allowed value today is `skin-designer`.

Consequences, stated here so the first run follows them even though the skill text was loaded before step 1 edits it:

- **Stage 3 (skin-designer) is not launched.** Neither phase A (mandatory skins and fresh proposals) nor phase B runs, and the user is not asked to approve skins.
- The registry entry has **no `appearance`** (as SPEC 21 already says). The five mandatory skins of the catalog convention are deliberately not built for this game. A later spec can add skins.
- The gate question before the agents lists only `mobile-porter` and `game-perf-booster`.
- Stage 4 (`game-perf-booster`) runs after Stage 2 and is told that no skins exist by design.
- Stage 2 (`mobile-porter`) still runs. The touch pad is already in the plan (step 20), so the agent finds a `touch` entry, verifies it and changes nothing unless it finds a defect.

## Scope

**In:**

- A merged plan of 22 steps (below) that implements SPEC 21, SPEC 22 and SPEC 23 and leaves the game runnable after each step.
- A precedence rule for the three specs (below).
- One small edit of `.claude/skills/full-game-impl/SKILL.md` so any spec can declare `## Pipeline overrides` with `skip: skin-designer`.
- The Pipeline overrides section of this spec.
- One walkthrough, one audio pass, one docs pass and one performance run for the whole game.

**Out of scope (for future specs):**

- New game rules, content, numbers or screens: everything is defined in SPEC 21, 22 and 23. If this spec and one of them disagree, the other spec wins (except Pipeline overrides and step order, which this spec owns).
- Skins and themes for Marcy the Vampire Hunter (the skin-designer stage is skipped by decision).
- Skipping any other pipeline stage, or a `--no-skins` command-line flag.
- Changes to `/spec-impl`, to `mobile-porter`, `skin-designer` or `game-perf-booster` agent definitions.
- Spells and familiars (out of scope in SPEC 21, 22 and 23).
- Automated tests, committing, pushing or opening a pull request on the user's behalf.

## Data model

This spec introduces no new data structures. All structures are defined in the three specs:

- Catalog entry, `Progress`, the 144-bit password layout, `VampireHunterCallbacks` and the registry entry: SPEC 21 (Data model), extended by SPEC 22 (`turned` block, victory flow, `turn` sound) and SPEC 23 (`credit` sound, `onCreditDrop`, `canDropCredit`, `GameCanvasProps` additions).
- The `games` row migration: SPEC 21. The `award_boss_credit` replacement migration: SPEC 23.
- The new catalog entry keeps `origin: "ai"` (SPEC 21), which the pipeline gate checks.

Merge rules for the final forms (each is implemented once, in its final shape):

- **Password.** `Progress` includes `turned` from the start; the layout is the 144-bit layout of SPEC 21 with the 32 SPEC 22 bits filled in and 26 spare bits; `decodePassword` carries every rule of SPEC 21 and SPEC 22 (level above 50 and tier above 10 only with Count Faust defeated).
- **Items and level.** Tiers 0 to 15 and level cap 63 exist in `items.ts` and `utils.ts` from the start; tiers 11 to 15 and level above 50 become reachable only through the Turned Castle content (SPEC 22).
- **Sounds.** The registry `sfx` has 19 effects (17 from SPEC 21, `turn`, `credit`). `VampireHunterSound` lists all of them.
- **Callbacks.** `VampireHunterCallbacks` has `onScore`, `onLives`, `onLevel`, `onGameOver`, `onSound`, `onHaptic`, `onMusic`, `onCreditDrop` and `canDropCredit`.

Precedence where the specs differ: SPEC 23 over SPEC 22 over SPEC 21 (each later spec explicitly amends the earlier ones). Examples: Faust's victory screen offers `ENTER THE TURNED CASTLE` and `END RUN` (SPEC 22) instead of SPEC 21's `Space` to end; boss credits stay out of this game (SPEC 23 gives credits only through the coin).

## Implementation plan

Run through `/full-game-impl 24-marcy-full-game-pipeline`. `/spec-impl` pauses for diff review after each step. Before step 2, read the relevant guides in `node_modules/next/dist/docs/` if a step touches pages or caching (normally not). Invoke `/frontend-design` for the cover, zone palettes, turn scene, map switch, coin sprite and notice, as the three specs say. Each step lists the steps of the source specs it carries out; the verification of each step is the one written in the source step.

1. **Pipeline override in the skill.** Edit `.claude/skills/full-game-impl/SKILL.md`: after Stage 1, read the spec's `## Pipeline overrides` section if present; honor `skip: skin-designer` by not running Stage 3, removing `skin-designer` from the gate question, telling `game-perf-booster` that skins are absent by design, and saying in the final report that the stage was skipped by the spec. Add the same note to the skill's front matter description. A spec without the section keeps the full pipeline unchanged. No other file changes.
2. **Catalog entry.** SPEC 21 step 1.
3. **Game migration.** SPEC 21 step 2 (apply, rename file to the assigned version, compare with `lib/games.ts`, `get_advisors`).
4. **Cover.** SPEC 21 step 3.
5. **Password module, final form.** SPEC 21 step 4 and SPEC 22 step 1 together: `constants.ts` and `password.ts` with the `turned` block, 144 bits, CRC-12, all decode rules, paste parsing. One throwaway verification script (not committed) covering both specs' checks.
6. **Items, XP and main world, zones 1 and 2.** SPEC 21 step 5, with item tiers 0 to 15 and the level cap 63 curve from SPEC 22 step 2 already in the tables.
7. **Entities.** SPEC 21 step 6.
8. **Engine, core.** SPEC 21 step 7.
9. **Engine, RPG.** SPEC 21 step 8.
10. **Engine, relics and bosses.** SPEC 21 step 9.
11. **Engine, screens and password UI.** SPEC 21 step 10.
12. **Canvas wrapper and registry.** SPEC 21 step 12 (no audio, no touch yet). The game is now playable from the library.
13. **Main castle, remaining zones and Count Faust.** SPEC 21 step 11. The victory screen ends the run for now; step 15 replaces it with the SPEC 22 flow.
14. **Turned Castle, first zones.** SPEC 22 steps 3 and 4 (T1 and T2 rooms, flipped decor, palettes, new enemies and the first two Turned bosses), reachable through a temporary dev hook that step 15 removes.
15. **Victory flow, turn scene and map switch.** SPEC 22 step 5. Remove the temporary hook of step 14.
16. **Turned Castle, remaining zones and Hollow Throne.** SPEC 22 steps 6 and 7.
17. **Credit Coin, server.** SPEC 23 step 1 (migration for `award_boss_credit`, applied with `apply_migration`, file renamed to the assigned version, `get_advisors`, rollback-safe checks).
18. **Credit Coin, client and engine.** SPEC 23 steps 2 to 5 (`awardDropCredit`, engine roll and pickup, drop opportunities, wrapper and `GamePlayer` props).
19. **Audio.** SPEC 21 step 13, SPEC 22 step 8 and SPEC 23 step 6 in one pass: one throwaway Node script (not shipped) generates both gothic tracks and all 19 effects into `public/game-assets/marcy-vampire-hunter/`; add `music` with `alt` and `sfx` (19 sounds) to the registry; wire `onSound` and `onMusic`.
20. **Touch and haptics.** SPEC 21 step 14 and the touch checks of SPEC 22 step 9 (turn scene skip, map switch).
21. **Walkthrough.** One Playwright run (captures only in `.pwScreencaps/`) that covers SPEC 21 step 15, SPEC 22 step 9 and SPEC 23 step 7 in a single route: both heroes, password copy and paste, delete progress, Count Faust, the Turned Castle, the Hollow King, the Credit Coin with `CREDIT_DROP_CHANCE` set to `1` locally (never committed, restored to `0.001`), SAVE SCORE, 1280px and 375px.
22. **Docs.** SPEC 21 step 17, SPEC 22 step 11 and SPEC 23 step 8 in one pass: update `CLAUDE.md` once for the whole game (including Pipeline overrides and the 19 sounds) and `references/GAMES.md`. Run `npm run lint` and `npm run build`.

The performance steps of the source specs (SPEC 21 step 16, SPEC 22 step 10) are not plan steps here: they are Stage 4 of the pipeline. The `game-perf-booster` agent measures the game with the Turned Castle and the Credit Coin in place and writes the entry in `references/perf/perf-log.md`.

After the plan, `/full-game-impl` runs Stage 2 (`mobile-porter`) and Stage 4 (`game-perf-booster`); Stage 3 is skipped by the override.

## Acceptance criteria

Pipeline:

- [ ] `.claude/skills/full-game-impl/SKILL.md` reads `## Pipeline overrides` and honors `skip: skin-designer`; it is the only skill or agent file changed.
- [ ] A spec without a Pipeline overrides section still gets all four stages (the skill text for that path is unchanged).
- [ ] In the run for this spec, the `skin-designer` agent is never launched and no skin approval question is asked.
- [ ] The gate question names only `mobile-porter` and `game-perf-booster`.
- [ ] `mobile-porter` ran and reported the existing `touch` entry (or a documented fix); `game-perf-booster` ran last and its section is in `references/perf/perf-log.md`.
- [ ] The final report says that the skin-designer stage was skipped by the spec.
- [ ] The run used one branch, `spec-24-marcy-full-game-pipeline` (or the name `/spec-impl` derives), and nothing was committed, stashed or pushed by the pipeline.

Game (all by reference; each item is checked against the source spec's own criteria):

- [ ] Every acceptance criterion of SPEC 21 passes (using SPEC 22 and SPEC 23 amendments where they override it).
- [ ] Every acceptance criterion of SPEC 22 passes.
- [ ] Every acceptance criterion of SPEC 23 passes.
- [ ] `lib/games.ts` has `marcy-vampire-hunter` as the last entry with `origin: "ai"` and the `games` row matches it.
- [ ] The registry entry has no `appearance`, no `levelSelect`, no `modes` and no `difficultySelect`; `lib/vampire-hunter/` has no skin or palette-switching code.
- [ ] The password is the 144-bit, 12x12 layout with the SPEC 22 fields; a password saved after Count Faust and the Turned Castle restores with the Turned data, level above 50 and tier above 10.
- [ ] The registry `sfx` has 19 effects and the two music tracks; each file loads through `withBasePath`.
- [ ] `npm run lint` and `npm run build` finish without errors.
- [ ] The migrations are exactly two new files: the game row (SPEC 21) and the `award_boss_credit` replacement (SPEC 23), both with applied versions.

## Decisions

- **Yes:** one umbrella spec so `/full-game-impl` runs once for the whole game (user request). **No:** three separate pipeline runs (repeats the agents and shared work).
- **Yes:** merged plan of 22 steps with the password, audio, walkthrough and docs done once in their final form (user choice). **No:** sequential 21, then 22, then 23 (about 36 steps with repeated shared work and many review pauses).
- **Yes:** skip the skin-designer stage for this game, declared in a `Pipeline overrides` section and supported by a small edit of the skill (user choice). **No:** a spec-only note without a skill edit (the pipeline would not know), a `--no-skins` flag (not chosen).
- **Yes:** the override mechanism is generic (`skip:` in a spec section), so the skip is per spec, not per game id, and other games keep the full pipeline.
- **Yes:** the spec text repeats the skip directive, because the running skill instance read its text before step 1 edited it.
- **Yes:** `mobile-porter` still runs; the touch pad is in the plan (SPEC 21 step 14) so the agent only verifies it. **No:** leaving touch to the agent alone (it could pick a layout different from the spec).
- **Yes:** performance is Stage 4 of the pipeline, not a plan step; its result is the perf-log entry. **No:** running the SPEC 21 and SPEC 22 perf steps in addition.
- **Yes:** SPEC 23 over SPEC 22 over SPEC 21 where they differ. This spec does not change any game rule.
- **Yes:** the catalog convention of five mandatory skins is knowingly broken for this game. Robo Vault's skins were added after its spec, so a later skins spec is the way back.

## Risks

| Risk                                                                                     | Mitigation                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| This is the largest build in the repository (about 120 rooms, 3 specs, 22 steps).        | Each step leaves a playable build; step 12 makes the game playable early; if it overruns, ship the main castle and move the Turned Castle to a follow-up (the password already has all bits). |
| The skill instance already running read its text before step 1 changes it.               | The spec text states the skip directly and says Stage 3 must not run; the skill edit protects later runs.                                                                                     |
| The skill edit could change the behavior of other specs.                                 | The new path only triggers when a spec has the section; the skill text for specs without it is unchanged and an acceptance criterion checks it.                                               |
| The three specs drift apart while this plan is running (an edit in one is not mirrored). | The precedence rule (SPEC 23 over 22 over 21) and the "other spec wins" rule; a spec edit during the run is made in the source spec first.                                                    |
| SPEC 21, 22 or 23 is still `Draft` when the run starts.                                  | Set the three specs to `Approved` after re-reading them and before `/full-game-impl`; the pipeline does not change spec states.                                                               |
| Temporary pieces (dev hook in step 14, `CREDIT_DROP_CHANCE = 1`) reach the final code.   | Step 15 removes the hook; step 21 restores the constant; the SPEC 23 criteria check `0.001` and the walkthrough greps for the hook.                                                           |
| Many `/spec-impl` review pauses.                                                         | Merged milestones keep the count at 22 instead of about 36.                                                                                                                                   |
| No skins breaks a rule that every real game has skins.                                   | Accepted by decision; documented in `CLAUDE.md` in step 22.                                                                                                                                   |

## What is **not** in this spec

- New game rules, content or numbers (they live in SPEC 21, 22 and 23).
- Skins and themes for Marcy the Vampire Hunter.
- Skipping any other pipeline stage, or a `--no-skins` flag.
- Changes to `/spec-impl` or to the three agents.
- Spells and familiars.
- Automated tests, commits, pushes or pull requests made by the pipeline.

Each one of those, if it lands, goes in its own spec.
