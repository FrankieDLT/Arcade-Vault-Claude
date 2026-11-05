# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault: an online platform to play games and compete for the highest score. The project follows spec-driven development (`/spec` and `/spec-impl`, skills from `Klerith/fernando-skills`, installed with `npx skills@latest add Klerith/fernando-skills`). The README is written in Spanish.

The repo is currently the untouched Create Next App scaffold (`app/page.tsx` is the default starter page). No game, auth, or scoring code exists yet.

## Commands

No test runner is configured.

## Next.js version warning

Next 16.4.4 / React 19.3 — APIs differ from what you may know. Per `AGENTS.md`, read the relevant guide in `node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`, `04-community`) before writing Next.js code, and heed deprecation notices. `next dev` re-adds the AGENTS.md block itself.

## Configuration notes

- `next.config.ts` enables `cacheComponents`, `partialPrefetching`, and `experimental.agentFeedback`. `cacheComponents` changes caching/rendering semantics for the App Router, so check the docs before using data fetching or dynamic APIs.
- Tailwind v4 is wired through a Turbopack rule (`@tailwindcss/turbopack` on `*.css`), not PostCSS.
- Path alias: `@/*` maps to the repo root (not `src/`). Routes live in `app/` at the root.
- Supabase: the browser client is `getSupabase()` in `lib/supabase/client.ts` (lazy singleton built with `createBrowserClient` from `@supabase/ssr`). Import it from client components only. It throws, naming the variable, when `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is empty. Both live in `.env` (documented in `.env.example`) and are inlined at build time, so restart `npm run dev` after editing. There is no server client, `proxy.ts` or service role key yet. `getSupabase()` returns `SupabaseClient<Database>`; the types in `lib/supabase/database.types.ts` are generated (MCP `generate_typescript_types`), never edited by hand.
- Database: tables `games` (seeded with the 9 original catalog games; `tetris` was added by the `add_tetris_game` migration, so 10 rows) and `scores` (`game_id` FK to `games`, `name` 1-10 chars, `score` 0-10,000,000). RLS is on: public select on both, anonymous insert on `scores`, no update/delete. The schema lives in `supabase/migrations/` (file name = applied version); apply new migrations with MCP `apply_migration` and regenerate the types.
- Catalog sync: `GAMES` in `lib/games.ts` is still the UI source and the `games` table is a manual copy. A new game needs a migration that inserts its `games` row, otherwise its score insert fails on the foreign key. Both `asteroids` and `tetris` follow this (the latter via `supabase/migrations/20261105002355_add_tetris_game.sql`). Keep every field of the row identical to the `GAMES` entry, including `cover`.
- Score flow: `lib/scores-db.ts` has `fetchTopScores` and `insertScore` (client only). SAVE SCORE in `components/game-player.tsx` calls `insertScore` (anonymous, free-text name). `useMergedScores` in `components/leaderboard.tsx` fetches after mount and merges the rows with the seeded mock rows; if the fetch fails it keeps the seeded rows. `lib/storage.ts` (`av_scores`) is no longer called for scores.
- `GET /api/health/supabase` checks the URL and key against the Auth API (`200` ok, `500` missing_env, `503` unreachable, `401` invalid_key). It returns `404` in production.

## Games

- `asteroids` and `tetris` are real games. Every other catalog game (including the placeholder `drop`) still runs the fake simulation (random score timer and a fake arena) inside `components/game-player.tsx`.
- Registry: `components/game-registry.tsx` maps a `gameId` to a `GameDefinition` (`Canvas`, `controls` for the hint under the CRT, `stats` = which of lives / lines / level the HUD shows, optional `music`, optional `appearance`). `getGameDefinition(gameId)` returns `undefined` for fake games. `GamePlayer` renders `<Canvas key={runId} />` from it instead of `.game-arena`, passes only the callbacks of the stats the definition uses (`GameCanvasProps`: `paused`, `endSignal`, `onScore`, `onGameOver`, optional `onLives`, `onLevel`, `onLines`, `skin`, `theme`), and shows LINES or LIVES in the same HUD slot. PLAY AGAIN bumps `runId` to remount the canvas with a fresh engine. A new real game = an engine under `lib/<game>/`, a canvas wrapper, a registry entry and a `games` migration.
- Asteroids engine: `lib/asteroids/` (`constants.ts`, `utils.ts`, `entities.ts`, `engine.ts`). It is framework-free: no `react` or `next` imports, and no module-level game state. `AsteroidsEngine` draws on an 800x600 canvas, scaled by CSS.
- Engine contract: `new AsteroidsEngine(canvas, { onScore, onLives, onLevel, onGameOver })`, then `start()`, `pause()`, `resume()`, `end()`, `destroy()`. `onScore`, `onLives` and `onLevel` fire only when the value changes (`start()` fires 0, 3, 1). `onGameOver` fires once per run, and the engine then stops its loop and key listeners. The canvas draws only the playfield and power-up timers; score, lives, level and GAME OVER belong to the platform HUD and modal.
- `components/asteroids-canvas.tsx` is the thin client wrapper: it creates the engine once in an effect and destroys it on cleanup. Props: `paused`, `endSignal` (increment to call `end()`), and the callbacks (`onLives` and `onLevel` are optional).
- Tetris engine: `lib/tetris/` (`constants.ts`, `utils.ts`, `entities.ts`, `engine.ts`), same rules as asteroids (framework-free, no module-level state). `TetrisEngine` draws on a 440x600 canvas (board 300x600 on the left, a 120-wide column with NEXT and HOLD boxes on the right), shown with `object-fit: contain` so it letterboxes inside the 4:3 CRT. Pieces I O T S Z J L at random (no bag), hold (`S`), slow fall (hold `C`), ghost, scoring `[0,100,300,500,800] * level`, level = `1 + floor(lines / 10)`. Keys use `e.code`; `Space` and `S` ignore `e.repeat`; `P` and `Esc` do nothing (pause is the platform button).
- Tetris contract: `new TetrisEngine(canvas, { onScore, onLines, onLevel, onGameOver }, { skin?, theme? })`, then `start()`, `pause()`, `resume()`, `end()`, `destroy()`, plus `setSkin()` and `setTheme()` (redraw at once, also while paused or after game over). Callbacks fire only on change (`start()` fires 0, 0, 1); `onGameOver` fires once per run, then the key listeners are removed. Score is clamped to 10,000,000. The canvas draws the playfield and the NEXT / HOLD boxes only; score, lines, level, PAUSED and GAME OVER belong to the platform.
- Skins and theme: skins `retro`, `neon`, `pastel`, `pixel` (the `neon` colors are the page tokens `--cyan --yellow --magenta --green --bronze --silver --gold`) and themes `dark` / `light`, applied to the canvas only. A registry entry opts in with `appearance: { skins, themes }`; `GamePlayer` then owns `skin` and `theme` state (defaults `retro` / `dark`, in memory only, never in `localStorage`) and renders the SKIN and THEME buttons (`.appearance-row`) under the CRT.
- Music: a registry entry can set `music: { src, volume }`. `components/use-background-music.ts` (`useBackgroundMusic(music, { active, muted, restartKey })`) owns one looping `HTMLAudioElement` per mount; `GamePlayer` plays it while a run is active and not muted, and shows a `MUSIC ON` / `MUSIC OFF` button only for entries with `music`. Mute is in memory only. A blocked autoplay is retried once on the first key press or click. Tetris plays `public/game-assets/tetris/korobeiniki.mp3` at volume 0.2 (third-party recording: confirm its license before a public release). The engines stay silent.

## Design reference

`resources/templates/` holds the UI prototype to implement, not app code: `Arcade Vault.html` plus `.jsx` files (`app`, `auth`, `biblioteca`, `data`, `detalle`, `nav`, `reproductor`, `salon`) and `styles.css`. These map to the intended screens: auth, game library, game detail, player, and leaderboard ("salón"). Mock data is in `data.jsx`. Port these into the Next.js `app/` router as TypeScript components.

## Skills

Always use /frontend-design when developing user interfaces.

When using Playwright, always leave all screen captures taken in the same ".pwScreencaps" folder in the root directory
