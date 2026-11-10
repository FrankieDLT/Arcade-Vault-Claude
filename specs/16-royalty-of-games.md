# SPEC 16: Royalty of Games (Hall of Fame)

## Goal

First tab of `/hall-of-fame`, default on load: an overall ranking of players across all games.

## Rules

- Score of a player = sum of their best score in each game (one best per game, so replaying one game does not inflate the total).
- Only scores with a `user_id` count. Old anonymous rows are excluded.
- Name shown = account username (`user_metadata.username`, then `full_name`, `name`, `user_name`, cleaned like `sanitizeName` in `lib/auth.ts`; then the latest score name; then `PLAYER1`). Email is never used.
- Ties: the player who reached the total first ranks higher.

## Data

- Migration `add_royalty_of_games`: `public.royalty_of_games(p_limit int default 12)`, `security definer`, `search_path = ''`, executable by `anon` and `authenticated`. Returns `rank, name, total, games, last_at`. No user id or email leaves the DB. Limit clamped 1..100.
- Needed because clients cannot read `scores.user_id` or `auth.users`. The Supabase advisor warns `*_security_definer_function_executable` for it: accepted, the function is a public leaderboard.
- Client: `fetchRoyalty` in `lib/scores-db.ts`, `useRoyalty` in `components/leaderboard.tsx`, `RoyaltyRow` in `lib/types.ts`.

## UI

- `components/hall-of-fame.tsx`: gold `ROYALTY OF GAMES` chip (`.chip.royal`) before the game chips, same podium and table as the game boards (columns RANK, PLAYER, TOTAL, GAMES).
- Game boards unchanged.

## Verify

- `select * from public.royalty_of_games(12);`
- `/hall-of-fame/` opens on Royalty of Games; switching to a game tab and back works; 375px wide layout holds.
