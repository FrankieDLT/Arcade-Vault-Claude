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
- Database: tables `games` (seeded with the 9 catalog games) and `scores` (`game_id` FK to `games`, `name` 1-10 chars, `score` 0-10,000,000). RLS is on: public select on both, anonymous insert on `scores`, no update/delete. The schema lives in `supabase/migrations/` (file name = applied version); apply new migrations with MCP `apply_migration` and regenerate the types.
- Catalog sync: `GAMES` in `lib/games.ts` is still the UI source and the `games` table is a manual copy. A new game needs a migration that inserts its `games` row, otherwise its score insert fails on the foreign key.
- Score flow: `lib/scores-db.ts` has `fetchTopScores` and `insertScore` (client only). SAVE SCORE in `components/game-player.tsx` calls `insertScore` (anonymous, free-text name). `useMergedScores` in `components/leaderboard.tsx` fetches after mount and merges the rows with the seeded mock rows; if the fetch fails it keeps the seeded rows. `lib/storage.ts` (`av_scores`) is no longer called for scores.
- `GET /api/health/supabase` checks the URL and key against the Auth API (`200` ok, `500` missing_env, `503` unreachable, `401` invalid_key). It returns `404` in production.

## Games

- Only `asteroids` is a real game. Every other catalog game still runs the fake simulation (random score timer and a fake arena) inside `components/game-player.tsx`.
- Engine: `lib/asteroids/` (`constants.ts`, `utils.ts`, `entities.ts`, `engine.ts`). It is framework-free: no `react` or `next` imports, and no module-level game state. `AsteroidsEngine` draws on an 800x600 canvas, scaled by CSS.
- Engine contract: `new AsteroidsEngine(canvas, { onScore, onLives, onLevel, onGameOver })`, then `start()`, `pause()`, `resume()`, `end()`, `destroy()`. `onScore`, `onLives` and `onLevel` fire only when the value changes (`start()` fires 0, 3, 1). `onGameOver` fires once per run, and the engine then stops its loop and key listeners. The canvas draws only the playfield and power-up timers; score, lives, level and GAME OVER belong to the platform HUD and modal.
- `components/asteroids-canvas.tsx` is the thin client wrapper: it creates the engine once in an effect and destroys it on cleanup. Props: `paused`, `endSignal` (increment to call `end()`), and the four callbacks.
- Dispatch: `GamePlayer` checks `gameId === "asteroids"` and renders `<AsteroidsCanvas key={runId} />` instead of `.game-arena`. PLAY AGAIN bumps `runId` to remount the canvas with a fresh engine. There is no game registry yet; add one when a second real game lands.

## Design reference

`resources/templates/` holds the UI prototype to implement, not app code: `Arcade Vault.html` plus `.jsx` files (`app`, `auth`, `biblioteca`, `data`, `detalle`, `nav`, `reproductor`, `salon`) and `styles.css`. These map to the intended screens: auth, game library, game detail, player, and leaderboard ("salón"). Mock data is in `data.jsx`. Port these into the Next.js `app/` router as TypeScript components.

## Skills

Always use /frontend-design when developing user interfaces.

When using Playwright, always leave all screen captures taken in the same ".pwScreencaps" folder in the root directory
