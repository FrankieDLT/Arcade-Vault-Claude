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
