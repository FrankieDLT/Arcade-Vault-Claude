-- Arcade Vault: prod setup. Run ONCE on an EMPTY prod project (Dashboard > SQL Editor).
-- Source: supabase/migrations/ 20261104154201 .. 20261110001157 (same as dev).
-- One transaction: if any statement fails, nothing is applied.
-- Structure only: no users, no scores copied from dev.
begin;

-- 20261104154201_games_and_scores
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

create policy "games are public"    on public.games  for select to anon, authenticated using (true);
create policy "scores are public"   on public.scores for select to anon, authenticated using (true);
create policy "scores can be added" on public.scores for insert to anon, authenticated with check (true);
-- No insert/update/delete policy on games. No update/delete policy on scores.

insert into public.games (id, title, short, long, cat, cover, color) values
  ('brick-buster', 'BRICK BUSTER', 'Bounce the ball and smash neon walls.',
   'Pilot a paddle-ship and bounce a plasma core to pulverize walls of chromatic bricks. Every level rearranges the grid into impossible patterns. How far will your streak go?',
   'ARCADE', 'cover-bricks', 'cyan'),
  ('drop', 'DROP', 'Fit the pieces before the ceiling crushes you.',
   'Geometric pieces fall from the darkness. Rotate them, lock them in and clear lines to survive. The speed ramps up mercilessly every 10 lines.',
   'PUZZLE', 'cover-tetro', 'magenta'),
  ('serpentine', 'SERPENTINE', 'Grow without biting your own tail.',
   'A snake of light roams the grid hunting magenta cores. Every bite makes it longer and faster. One wrong move and it devours itself.',
   'ARCADE', 'cover-snake', 'green'),
  ('chomper', 'CHOMPER', 'Gobble dots and escape the ghosts.',
   'A hungry circle patrols a maze collecting glowing dots. Four specters chase it, but every so often a power pill appears and turns the tables.',
   'ARCADE', 'cover-glot', 'yellow'),
  ('invaders', 'INVADERS', 'Defend the planet from rows of aliens.',
   'Waves of hostile pixels descend, formation after formation. Slide your cannon sideways and fire with precision before they touch the surface.',
   'SHOOTER', 'cover-invaders', 'green'),
  ('rocks', 'ROCKS', 'Pulverize asteroids in zero gravity.',
   'Your triangular ship drifts in absolute vacuum. Shoot and rotate to split rocks into ever smaller fragments. Watch out for UFOs on the horizon.',
   'SHOOTER', 'cover-rocas', 'yellow'),
  ('hopper', 'HOPPER', 'Cross the pixel highway.',
   'Leap between lanes of speeding cars and drifting logs on the river. Reach the lily pads before time runs out.',
   'ARCADE', 'cover-rana', 'green'),
  ('pixel-duel', 'PIXEL DUEL', 'Two paddles. One ball. Maximum reflexes.',
   'The purest duel: two vertical paddles fight over a glowing ball. Play solo against the CPU or local two-player.',
   'VERSUS', 'cover-duelo', 'cyan'),
  ('asteroids', 'ASTEROIDS', 'Split rocks in zero gravity and survive the field.',
   'Your ship drifts in open space. Rotate, thrust and fire to break big asteroids into smaller ones before they hit you. Grab power-ups: Bomb, Hyper, Shield, SlowMo and Triple shot.',
   'SHOOTER', 'cover-asteroids', 'cyan');

-- 20261105002355_add_tetris_game
insert into public.games (id, title, short, long, cat, cover, color) values
  ('tetris', 'TETRIS', 'Stack, rotate and clear lines before the stack hits the top.',
   'Seven classic pieces fall into a ten-column well. Slide, rotate and drop them to clear lines, stash one piece on hold for later and follow the ghost to aim. Gravity speeds up every 10 lines.',
   'PUZZLE', 'cover-tetris', 'green');

-- 20261105012449_add_arkanoid_game
insert into public.games (id, title, short, long, cat, cover, color) values
  ('arkanoid', 'ARKANOID', 'Break the wall, catch the power-ups and keep the ball alive.',
   'Slide the paddle, bounce the ball and smash a wall of colored bricks. Falling capsules split the ball, add a safety bar or send it into a frenzy. Every level builds a new wall and the ball gets faster.',
   'ARCADE', 'cover-arkanoid', 'magenta');

-- 20261105020551_add_snake_game
insert into public.games (id, title, short, long, cat, cover, color) values
  ('snake', 'SNAKE', 'Eat the fruit, grow longer and never touch the wall or yourself.',
   'Steer a hungry snake across the grid and eat the fruit to grow. Golden fruit is worth five times more but vanishes fast. The snake speeds up with every bite, and one wrong turn into a wall or your own tail ends the run.',
   'ARCADE', 'cover-snake-game', 'yellow');

-- 20261109154513_add_glowmaw_game
insert into public.games (id, title, short, long, cat, cover, color) values
  ('glowmaw', 'GLOWMAW', 'Gulp the glowing motes and outswim the jelly drifters.',
   'Guide Glowmaw, a luminous orb with a big hungry mouth, through a coral maze and gulp every glowing mote. Jelly drifters hunt you down the corridors, but a pearl leaves them dazed and good to eat. Clear the reef to dive into a faster one.',
   'ARCADE', 'cover-glowmaw', 'cyan');

-- 20261109165203_add_frogger_game
insert into public.games (id, title, short, long, cat, cover, color) values
  ('frogger', 'FROGGER', 'Cross the road and the river without becoming roadkill.',
   'Guide your frog across a road packed with cars and a river of floating logs and turtles. Fill the five goal slots on the far side to complete the round; each level speeds up the traffic and shortens the time. Three lives and plenty of asphalt ahead.',
   'ARCADE', 'cover-frogger', 'green');

-- 20261109221549_add_profiles_and_score_user_id
-- SPEC 13, migration A (additive): ban state in profiles, owner column on scores.

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  banned     boolean not null default false,
  ban_reason text,                 -- admin note, never readable by clients
  banned_at  timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "own profile is readable" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

revoke all on public.profiles from anon, authenticated;
grant select (id, banned) on public.profiles to authenticated;
-- No insert/update/delete policy: clients cannot change a profile.

-- One profile row per auth user.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill for users that already exist.
insert into public.profiles (id)
select id from auth.users
on conflict do nothing;

-- Owner of a score. Old rows keep null. Filled by the column default for signed-in inserts.
alter table public.scores
  add column user_id uuid default auth.uid() references auth.users (id) on delete set null;

-- user_id must not be readable through the public API.
revoke select on public.scores from anon, authenticated;
grant select (id, game_id, name, score, created_at) on public.scores to anon, authenticated;

-- 20261110001157_require_signin_to_save_scores
-- SPEC 13 migration B (cutover), applied by SPEC 14.
drop policy "scores can be added" on public.scores;

create policy "signed-in users can add their own scores" on public.scores
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    and not exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.banned
    )
  );

-- Explicit grants (harmless if the project already grants them by default).
-- Not in the migrations; added so a fresh prod project works even without default grants.
grant usage on schema public to anon, authenticated;
grant select on public.games to anon, authenticated;
grant insert on public.scores to authenticated;
grant usage, select on all sequences in schema public to authenticated;

commit;

-- Optional: tell the Supabase CLI these 8 migrations are already applied,
-- so a later `supabase db push` to prod does not run them again.
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version    text primary key,
  statements text[],
  name       text
);
insert into supabase_migrations.schema_migrations (version, name) values
  ('20261104154201', 'games_and_scores'),
  ('20261105002355', 'add_tetris_game'),
  ('20261105012449', 'add_arkanoid_game'),
  ('20261105020551', 'add_snake_game'),
  ('20261109154513', 'add_glowmaw_game'),
  ('20261109165203', 'add_frogger_game'),
  ('20261109221549', 'add_profiles_and_score_user_id'),
  ('20261110001157', 'require_signin_to_save_scores')
on conflict (version) do nothing;

-- Checks (run after):
--   select count(*) from public.games;                                   -- 14
--   select policyname from pg_policies where tablename = 'scores';       -- 2 rows
--   select tgname from pg_trigger where tgname = 'on_auth_user_created'; -- 1 row
