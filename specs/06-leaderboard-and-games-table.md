# SPEC 06 — Leaderboard and games table

> **Status:** Implemented
> **Depends on:** SPEC 01, SPEC 04, SPEC 05
> **Date:** 2026-11-04
> **Objective:** Create the `games` and `scores` tables in Supabase, make SAVE SCORE insert into `scores`, and make the game detail leaderboard and the Hall of Fame read real scores merged with the existing mock rows.

## Why this spec exists

SPEC 04 wired the Supabase browser client but left the project with no tables. Scores still live in `localStorage` (`av_scores`), so they are private to one browser and no one else can see them. This spec is the first real use of Supabase: two tables, a score insert path and a score read path. Auth, real stats and the Home data stay for later specs.

The catalog (`GAMES` in `lib/games.ts`) stays the source for the UI. The `games` table exists so `scores.game_id` has a real foreign key and so later specs can move the catalog to the database without a schema change.

## Scope

**In:**

- Migration file `supabase/migrations/<timestamp>_games_and_scores.sql` that creates `games` and `scores`, enables RLS, adds the policies and CHECK constraints below, and seeds the 9 games currently in `GAMES`.
- Apply the migration to the Supabase project with the MCP `apply_migration`, and check it with `list_tables` and `get_advisors`.
- Generated types in `lib/supabase/database.types.ts` (MCP `generate_typescript_types`); `getSupabase()` returns `SupabaseClient<Database>`.
- SAVE SCORE in `components/game-player.tsx` inserts into `scores` through `getSupabase()` and no longer calls `addScore`. A failed insert shows an error and keeps the form so the player can retry.
- `useMergedScores` in `components/leaderboard.tsx` fetches the top rows for the game from `scores` after mount and merges them with the seeded mock rows, as it merges `localStorage` rows today.
- Both consumers of `useMergedScores` get real scores: the game detail leaderboard and the Hall of Fame tab.
- If the fetch fails, the leaderboard shows the seeded rows only and the page does not break.
- Note in `CLAUDE.md` about the tables, the migration folder, the types file and the score flow.

**Out of scope (for future specs):**

- Supabase Auth, user ids on scores, and ownership rules. Scores are anonymous with a free-text name.
- Moving the catalog reads to the database. Screens keep importing `GAMES`; `best` and `plays` stay mock fields and are not columns of `games`.
- Home `ACTIVITY` and `TOP_PLAYERS` stay mock.
- The Hall of Fame "YOUR BEST" row stays the mock row it is today.
- Server-side Supabase client, `proxy.ts`, RPC or Edge Function validation, rate limiting and anti-cheat.
- Migrating existing `av_scores` rows to Supabase. `lib/storage.ts` keeps `readScores` and `addScore` but nothing calls them after this spec.
- Realtime updates of the leaderboard, pagination and per-user history.
- Removing mock rows or the `seededScores` generator.
- Automated tests.

## Data model

```sql
-- supabase/migrations/<timestamp>_games_and_scores.sql
create table public.games (
  id         text primary key,                       -- URL slug, same as Game.id
  title      text not null,
  short      text not null,
  long       text not null,
  cat        text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover      text not null,                          -- CSS class, e.g. 'cover-asteroids'
  color      text not null check (color in ('cyan','magenta','yellow','green')),
  created_at timestamptz not null default now()
);

create table public.scores (
  id         bigint generated always as identity primary key,
  game_id    text not null references public.games (id),
  name       text not null check (char_length(name) between 1 and 10),
  score      integer not null check (score >= 0 and score <= 10000000),
  created_at timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc);

alter table public.games  enable row level security;
alter table public.scores enable row level security;

create policy "games are public"   on public.games  for select to anon, authenticated using (true);
create policy "scores are public"  on public.scores for select to anon, authenticated using (true);
create policy "scores can be added" on public.scores for insert to anon, authenticated with check (true);
-- No insert/update/delete policy on games. No update/delete policy on scores.
```

The migration then inserts the 9 rows of `GAMES` (`brick-buster`, `drop`, `serpentine`, `chomper`, `invaders`, `rocks`, `hopper`, `pixel-duel`, `asteroids`) into `games`, with the same `id`, `title`, `short`, `long`, `cat`, `cover` and `color` as `lib/games.ts`.

App-side shapes:

```ts
// lib/supabase/database.types.ts — generated, do not edit by hand
export type Database = { public: { Tables: { games: {...}; scores: {...} } } };

// lib/scores-db.ts (new, plain module, client use only)
import type { ScoreRow } from "./types";

export async function fetchTopScores(gameId: string, count: number): Promise<ScoreRow[]>;
export async function insertScore(input: { gameId: string; name: string; score: number }): Promise<void>; // throws on error
```

Conventions:

- `fetchTopScores` selects `name, score, created_at` where `game_id = gameId`, ordered by `score` descending, limited to `count`. It returns `ScoreRow` with `rank: 0` and `date` formatted `DD/MM/YYYY` from `created_at` (same format as `formatDate` in `components/leaderboard.tsx`; reuse it, do not duplicate it).
- `insertScore` trims `name` and slices it to 10 characters before inserting; it throws when the Supabase response has an `error`.
- Both functions call `getSupabase()` inside the function body, never at import time, so the build passes without env vars.
- The first render (server and client) still returns the seeded rows only. DB rows are merged after mount to avoid hydration mismatches, as in SPEC 01.
- Merge rule is unchanged: seeded rows plus DB rows, sorted by score descending, cut to the top N, ranks reassigned from 1.
- `SavedScore` stays in `lib/types.ts` because `lib/storage.ts` still uses it.
- The score is an integer in the database; the engine already produces integer scores.
- No new `localStorage` keys.

## Implementation plan

Before step 1, read the relevant guides in `node_modules/next/dist/docs/` (client components and `cacheComponents`) as required by `AGENTS.md`. Check the Supabase docs (`search_docs`) for RLS policy syntax and the `@supabase/supabase-js` insert and select signatures. No new screens are created; use `/frontend-design` only for the save-error message in step 6, per `CLAUDE.md`.

1. **Migration file.** Create `supabase/migrations/<timestamp>_games_and_scores.sql` with the tables, index, RLS, policies and the 9 seed rows from the data model. Compare the seed values against `lib/games.ts` by reading both. `npm run build` still passes (nothing consumes the file).
2. **Apply the migration.** Run it with the MCP `apply_migration`. Check with `list_tables` (both tables, RLS on) and `execute_sql` (`select count(*) from games` returns 9). Run `get_advisors` for security and fix any warning that comes from this migration.
3. **Types.** Generate the types with `generate_typescript_types` into `lib/supabase/database.types.ts`. Type `getSupabase()` in `lib/supabase/client.ts` with `Database`. `npm run lint` and `npm run build` pass.
4. **Score functions.** Create `lib/scores-db.ts` with `fetchTopScores` and `insertScore` as described. Export `formatDate` from `components/leaderboard.tsx`, or move it to a small shared helper, and reuse it. Nothing calls the new functions yet; `npm run build` passes.
5. **Read path.** Change `useMergedScores` to call `fetchTopScores(gameId, count)` in its effect instead of `readScores()`. Handle a rejected promise by keeping the seeded rows. Ignore a stale response if `gameId` changed before it resolved (Hall of Fame tab switching). Manual check: insert a row with `execute_sql` for `asteroids` with a score above the mocks and see it on `/games/asteroids` and in the Hall of Fame tab.
6. **Write path.** In `components/game-player.tsx`, replace `addScore(...)` with `insertScore(...)`. Keep `saved` false until the insert resolves; disable SAVE SCORE while it is pending; on failure show `COULD NOT SAVE SCORE. TRY AGAIN.` and keep the name input. Remove the `addScore` import.
7. **Docs and walkthrough.** Add the Supabase section to `CLAUDE.md` (tables, migration folder, types file, `lib/scores-db.ts`, anonymous insert policy). Run `npm run lint` and `npm run build`. In `npm run dev`, play `asteroids` to game over, save a score, and confirm it on the detail page and in the Hall of Fame after a reload. Save captures in `.pwScreencaps/`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish without errors, with and without the Supabase env vars set.
- [ ] `list_tables` shows `games` and `scores` in `public`, both with RLS enabled.
- [ ] `select count(*) from games` returns 9, and each row matches `id`, `title`, `short`, `long`, `cat`, `cover` and `color` in `lib/games.ts`.
- [ ] `supabase/migrations/` contains the migration file and its content matches what was applied.
- [ ] `get_advisors` (security) reports no warning about `games` or `scores`, apart from the intentional public insert policy on `scores`.
- [ ] With the publishable key, inserting into `scores` with an unknown `game_id` fails.
- [ ] With the publishable key, inserting a name of 0 or 11 characters, or a negative score, or a score above 10,000,000, fails.
- [ ] With the publishable key, `update` and `delete` on `scores` affect 0 rows, and `insert`, `update` and `delete` on `games` are rejected.
- [ ] `lib/supabase/database.types.ts` exists and `getSupabase()` is typed with `Database`.
- [ ] In the GAME OVER modal, SAVE SCORE inserts one row `{ game_id, name, score }` into `scores`; the row is visible in the Supabase table.
- [ ] After a successful insert the modal shows `SCORE SAVED_` and the SAVE SCORE button is gone, as today.
- [ ] While the insert is pending, SAVE SCORE is disabled, so a double click inserts one row.
- [ ] With the network blocked or a wrong key, SAVE SCORE shows `COULD NOT SAVE SCORE. TRY AGAIN.`, keeps the name input and lets the player retry.
- [ ] No `localStorage` write to `av_scores` happens when saving a score.
- [ ] A saved score above the mock rows for its game appears in the `/games/<id>` leaderboard after a reload, with rank, name, score and `DD/MM/YYYY` date.
- [ ] The same score appears in the Hall of Fame tab of that game.
- [ ] A score below the lowest mock row of a full leaderboard does not appear (merge cut to the top N).
- [ ] Switching Hall of Fame tabs quickly never shows scores of the previous game.
- [ ] With the fetch failing (network blocked), both screens render the seeded rows and no error is thrown to the page.
- [ ] Reloading `/games/asteroids`, `/hall-of-fame` and `/games/asteroids/play` shows no React hydration warnings in the browser console.
- [ ] Home `ACTIVITY` and `TOP_PLAYERS`, the Hall of Fame "YOUR BEST" row, and the `best` and `plays` values in the library are unchanged.
- [ ] `lib/storage.ts` and `lib/games.ts` are unchanged.
- [ ] `lib/supabase/client.ts` still throws a clear error when an env var is missing, and `GET /api/health/supabase` still behaves as in SPEC 04.

## Decisions

- **Yes:** `games` and `scores` tables in Supabase. Decided by the user. Scores need a shared store to be a real leaderboard.
- **Yes:** `GAMES` in `lib/games.ts` stays the UI source; `games` is seeded and used for the foreign key. Decided by the user. It avoids an async refactor of six screens and the `cacheComponents` work that comes with it.
- **No:** reading the catalog from the database in this spec. The two copies must be kept in sync by hand until a later spec removes one.
- **No:** `best` and `plays` as columns. They are mock fields; real stats need aggregation and belong in their own spec.
- **Yes:** anonymous insert through RLS with a free-text name. Decided by the user. Auth is not available yet (SPEC 04 left it out).
- **Yes:** CHECK constraints (`name` 1–10 chars, `score` 0–10,000,000) and the foreign key. They block junk rows at no extra code cost. The cap matches the mock scale (largest mock is ~312,840) with a wide margin.
- **No:** rate limiting, RPC or Edge Function validation. A public key can still submit fake scores; accepted until Auth lands.
- **No:** update and delete policies on `scores`. Scores are append-only for clients.
- **Yes:** public SELECT on `games` and `scores`. A leaderboard has to be readable by guests.
- **Yes:** keep the mock rows and merge as today. Decided by the user. Leaderboards stay full while there are few real scores.
- **Yes:** detail leaderboard and Hall of Fame both read the database. Both already share `useMergedScores`, so it is one change.
- **No:** Home `ACTIVITY` and `TOP_PLAYERS` from the database. They need cross-game queries and "time ago" formatting; separate spec.
- **Yes:** SAVE SCORE writes to Supabase only. Decided by the user. A local fallback would add a second merge path and duplicate rows.
- **No:** migrating existing `av_scores`. Those rows are test data from one browser; they are left in place and unread.
- **Yes:** fetch client-side in `useMergedScores` through `getSupabase()`. Decided by the user. It fits the existing client components and keeps the first render identical on server and client. A server client and `cacheComponents` handling stay deferred.
- **Yes:** SQL migration file in `supabase/migrations/` and applied through the MCP. Decided by the user. The schema is versioned in git.
- **Yes:** generated types in `lib/supabase/database.types.ts`. SPEC 04 deferred them until the first table existed.
- **Yes:** on fetch failure, show the seeded rows silently. The leaderboard is secondary; the page must not break.

## Risks

| Risk                                                                                  | Mitigation                                                                                                                         |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Anyone with the publishable key can insert fake scores or spam rows.                  | Accepted for this spec; CHECK constraints cap the damage per row. Auth and server validation come later.                           |
| `GAMES` and the `games` table drift apart (new game added in code but not in the DB). | A new game needs a migration that inserts its row, otherwise its score insert fails on the foreign key. Documented in `CLAUDE.md`. |
| The foreign key makes SAVE SCORE fail for a game missing from `games`.                | The save error message is shown and nothing breaks; acceptance criteria check all 9 seeds.                                         |
| Hydration mismatch if DB rows are merged during the first render.                     | Fetch only in an effect after mount, as the `localStorage` merge did.                                                              |
| Stale response overwrites the current tab in Hall of Fame.                            | Step 5 ignores responses for a `gameId` that is no longer current.                                                                 |
| Seeded mock rows hide real scores that are lower than the mocks.                      | Accepted as the mock-merge decision; removing mocks is a future spec.                                                              |
| The player name in the modal may exceed 10 characters or be empty.                    | `insertScore` trims and slices to 10; the CHECK constraint rejects an empty name and the error path is shown.                      |
| Two migration copies (file and applied) diverge.                                      | The file is written first and applied unchanged; acceptance criteria compare them.                                                 |

## What is **not** in this spec

- Supabase Auth, user ids or ownership of scores.
- Reading the game catalog from the database, or real `best` and `plays` stats.
- Home activity feed and top players from the database.
- Server-side Supabase client, `proxy.ts`, RPC or Edge Function validation, rate limiting.
- Migration of existing `localStorage` scores.
- Realtime, pagination or per-user score history.
- Removing the mock leaderboard rows.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
