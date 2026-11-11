-- SPEC 19: who made the game. Catalog copy of GAMES.origin (manual-copy rule).
-- Default 'ai' only fills the existing rows; it is dropped so future game inserts must set it.
alter table public.games
  add column origin text not null default 'ai'
  check (origin in ('ai','human','assisted'));
alter table public.games alter column origin drop default;
