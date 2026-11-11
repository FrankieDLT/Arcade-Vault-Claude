---
name: add-game
description: Writes a full spec to port a vanilla-JS game folder (by default one under references/StarterGames/) into Arcade Vault as a real game, covering the TypeScript engine, canvas wrapper, GamePlayer wiring, catalog entry, Supabase games row, and scoreboard handling. Use when the user asks to add, port, implement or spec a game, or names a folder in references/StarterGames/. Produces the spec only; /spec-impl implements it.
argument-hint: <game-folder, e.g. 03-tetris>
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*), Bash(git status:*)
---

# /add-game: spec writer for porting a game

Produces `specs/NN-<id>-game.md` in the format of `specs/05-asteroids-game.md` (engine, player, catalog) plus the score handling of `specs/06-leaderboard-and-games-table.md` (Supabase `games` row, `scores`, leaderboard). It never writes app code. After approval the user runs `/spec-impl NN-<id>-game`.

## Session context

Specs:
!`ls specs/ 2>/dev/null`

Starter games:
!`ls references/StarterGames/ 2>/dev/null`

Catalog ids and covers:
!`grep -n "id:\|cover:\|cat:" lib/games.ts`

Migrations:
!`ls supabase/migrations/ 2>/dev/null`

Existing engines, registry, components:
!`ls lib/ components/ 2>/dev/null`

Today:
!`date +%Y-%m-%d`

## Instructions

Follow the phases in order. Do not skip ahead.

### Phase 1: Resolve the game folder

The argument is: `$ARGUMENTS`

- Empty: show the starter games above and ask which one.
- A bare name: look in `references/StarterGames/<name>`. A path: use it as given. By default assume the game comes from `references/StarterGames/`; the user may name another folder.
- Source of truth is the script that `index.html` loads. Ignore merge leftovers (`*_BACKUP_*`, `*_BASE_*`, `*_LOCAL_*`, `*_REMOTE_*`, `*.swp`) and embedded git internals (`HEAD`, `config`, `description`, `hooks/`, `info/`, `objects/`, `refs/`).
- Stop with a clear message if the folder has no `index.html` or script.

### Phase 2: Analyze the game

Read `analysis-checklist.md` (same folder as this file). Then read the game's README, CLAUDE.md, its own `specs/` if any, `index.html`, every script and stylesheet, and list its assets. Build the inventory from the checklist. When README and code disagree, the code wins; record the difference in the spec's Risks.

### Phase 3: Analyze the platform

Read the current state, never assume it from this file:

- `lib/games.ts`, `components/game-player.tsx`, `components/asteroids-canvas.tsx`, `lib/asteroids/engine.ts` (the engine contract), `lib/scores-db.ts`, `components/leaderboard.tsx`, the latest migration, `CLAUDE.md`.
- Next spec number: highest `NN` in `specs/` plus one.
- Registry: does a game registry exist yet? If `GamePlayer` still dispatches with `gameId === "asteroids"`, the new spec must introduce the registry and move asteroids into it. If a registry exists, the spec only adds an entry.
- Duplicate check: catalog games with the same genre or a similar title or description. The catalog has no placeholder or mock games, so a match means the game already exists: tell the user instead of adding it again.
- Score range: estimate the maximum reachable score and compare with the database cap of 10,000,000 (`scores.score`). Flag it in Risks if it can be exceeded.
- Read the relevant guides in `node_modules/next/dist/docs/` as `AGENTS.md` requires, only if the spec touches pages or caching (normally it does not).

### Phase 4: Ask the user

Use AskUserQuestion, at most 4 questions per call, only for decisions you cannot settle from the code. Always ask:

1. **Origin**: who made the game: `ai` (A.I Made), `human` (Human Made) or `assisted` (A.I. Assisted). Every game must set `origin`. Confirm the id if it is not obvious. The game is always a new entry (new id, new cover, new `games` row via migration).
2. **HUD mapping**: the platform HUD has Score, Lives and Level. Say what the game offers (for example Tetris has lines and no lives) and ask how to map or hide stats.
3. **Optional features** the game has beyond the core loop (skins, themes, sounds, power-ups, level select, extra modes): keep or drop each. Default is drop, and sound is out of scope unless the user opts in.
4. **Extra panels** (for example a next-piece canvas): draw them inside the main canvas, or let the engine own a second canvas.

Skip questions the inventory already answers.

### Phase 5: Write the spec

Copy the structure of `template.md` (same folder) into `specs/NN-<id>-game.md`. Fill every section from the inventory and the answers. Rules:

- Header: `Status: Draft`, `Depends on: SPEC 05, SPEC 06` (plus any other spec it needs), today's date, one-sentence Objective.
- Values: constants, formulas, scoring, timings and speeds are copied from the source unchanged. Quote file and line when a value is non-obvious.
- No placeholder text may remain. Run `grep -n "{{" specs/NN-<id>-game.md` and fix any hit.
- Acceptance criteria: keep every generic criterion from the template, then add game-specific ones (each rule, score value, power-up, level rule and input from the inventory gets one).
- Decisions: Yes/No bullets with a reason, naming what the user decided in phase 4.
- Implementation plan: numbered, each step ends with a checkable result, as in SPEC 05.

Then show the user a short summary (id, catalog mode, engine folder, number of steps, open risks) and ask for review. Apply requested edits. When the user approves, set `Status: Approved` and tell them to run `/spec-impl NN-<id>-game`.

## Fixed platform rules (put them in every spec)

Engine:

- Folder `lib/<id>/` with `constants.ts`, `utils.ts`, `entities.ts` (or the game's equivalent), `engine.ts`. No `react` or `next` imports. No module-level game state: it lives in the engine instance, so two instances never share state.
- API: `new <Name>Engine(canvas, callbacks)`, `start()` (idempotent), `pause()`, `resume()` (no time jump), `end()` (calls `onGameOver` once), `destroy()` (cancels rAF, removes every listener).
- Callbacks: `onScore` and `onGameOver(finalScore)` always; `onLives`, `onLevel` or a game-specific stat (for example `onLines`) only if the HUD mapping uses it. They fire only when the value changes; `start()` fires the initial values. `onGameOver` fires at most once per run, then the loop and key listeners stop.
- Input: keyboard listeners on `window`; `preventDefault` for game keys only while running and not paused; held keys cleared on `pause()`, window `blur` and `visibilitychange` (hidden). Mouse input, if kept, listens on the canvas and maps CSS pixels to logical coordinates.
- Loop: `requestAnimationFrame` with `dt` clamped as in the source.
- Canvas draws the playfield and in-game timers only. Score, lives, level, PAUSED and GAME OVER belong to the platform. Logical size is fixed (copy the source size), scaled by CSS to fit `.crt-screen` while keeping the aspect ratio; say in the spec if the ratio is not 4:3. No `devicePixelRatio` work.
- All in-game text in English. Remove the game's own score screen, game-over screen and restart key (restart is PLAY AGAIN).
- Remove the game's own `localStorage` use (high score, theme, skin). No new `localStorage` keys. `lib/storage.ts` stays unchanged.
- Assets (images, spritesheets) go to `public/game-assets/<id>/`, never `public/games/` (it would sit beside the `/games/[id]` routes). Sound is out of scope unless the user opted in.

React side:

- `components/<id>-canvas.tsx`, a thin client wrapper mirroring `components/asteroids-canvas.tsx`: engine created once in an effect and destroyed on cleanup, latest callbacks in a ref, props `paused` and `endSignal`, safe under React Strict Mode (one live loop).
- Registry: `components/game-registry.tsx` (or the name already used) maps `gameId` to the canvas component, its controls hint and the HUD stats it uses. `GamePlayer` dispatches through it; every catalog game must be in the registry (there is no fake simulation). Include the refactor of asteroids into the registry when no registry exists yet, and require that asteroids behaves exactly as before.
- PLAY AGAIN bumps `runId`, the `key` of the canvas, to remount a fresh engine.
- Controls hint near the CRT, designed with `/frontend-design`.

Catalog and scores:

- `GAMES` in `lib/games.ts` is still the UI source and the `games` table is a manual copy. A new entry needs a migration `supabase/migrations/<timestamp>_add_<id>_game.sql` that inserts its `games` row with values identical to `lib/games.ts`, including `origin` (the column has no default, so the insert fails without it); otherwise SAVE SCORE fails on the foreign key. Apply it with MCP `apply_migration`, verify with `execute_sql`, run `get_advisors`. Regenerate `lib/supabase/database.types.ts` only if the schema changed (a data-only migration does not need it).
- New entries are appended at the end of `GAMES` (the Home uses `GAMES.slice(0, 6)`), start with `plays: "0"` and a required `origin`, and get a `cover-<id>` class in `app/globals.css` designed with `/frontend-design`.
- SAVE SCORE keeps calling `insertScore` from `lib/scores-db.ts` and the leaderboard and Hall of Fame keep using `useMergedScores`. The spec must not change them; it only verifies the new game's score is saved, listed on `/games/<id>` and in the Hall of Fame tab after a reload.
- Scores are integers within 0 to 10,000,000. If the game's score can be fractional or larger, the spec says how the engine rounds or clamps it.

Process:

- The last plan step updates `CLAUDE.md` (engine location, callbacks, registry, catalog sync).
- Manual checks use Playwright with screenshots saved only in `.pwScreencaps/` at the repo root. No automated tests (no runner is configured). `npm run lint` and `npm run build` must pass.
- Out of scope in every spec: sound (unless opted in), touch and gamepad, high-DPI scaling, auth, real stats, Supabase server client, changes to other games.
