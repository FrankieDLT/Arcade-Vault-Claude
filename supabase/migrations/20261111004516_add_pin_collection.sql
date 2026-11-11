-- SPEC 18: Pin Collection. Credits per account, a static `pins` catalog and the pins each user owns.
-- Clients only read their own rows; every change goes through the two security definer RPCs below.
-- `pins` is a manual copy of lib/pins/catalog.ts (same discipline as `games`): keep both identical.

create table public.pins (
  id      text primary key,
  number  int  not null unique,
  game_id text not null references public.games (id),
  name    text not null,
  kind    text not null check (kind in ('enemy', 'powerup', 'character')),
  rarity  text not null check (rarity in ('common', 'rare', 'super-rare', 'ultra-rare', 'epic'))
);

create table public.credits (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  balance       int  not null default 0 check (balance >= 0),
  last_award_at timestamptz
);

create table public.user_pins (
  user_id     uuid not null references auth.users (id) on delete cascade,
  pin_id      text not null references public.pins (id),
  obtained_at timestamptz not null default now(),
  primary key (user_id, pin_id)
);

alter table public.pins enable row level security;
alter table public.credits enable row level security;
alter table public.user_pins enable row level security;

create policy "pins are public" on public.pins
  for select to anon, authenticated using (true);
create policy "own credits are readable" on public.credits
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own pins are readable" on public.user_pins
  for select to authenticated using (user_id = (select auth.uid()));
-- No insert/update/delete policy on any of them: clients cannot write.

revoke all on public.pins, public.credits, public.user_pins from anon, authenticated;
grant select (id, number, game_id, name, kind, rarity) on public.pins to anon, authenticated;
grant select (user_id, balance) on public.credits to authenticated;
grant select (user_id, pin_id, obtained_at) on public.user_pins to authenticated;

-- Called at Game Over. Returns { awarded, balance, reason }.
-- reason: 'ok' | 'zero_score' | 'banned' | 'cooldown'
create function public.award_credit(p_game_id text, p_score int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_balance int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_score is null or p_score < 0 or p_score > 10000000 then
    raise exception 'invalid_score';
  end if;
  if not exists (select 1 from public.games g where g.id = p_game_id) then
    raise exception 'unknown_game';
  end if;

  select c.balance into v_balance from public.credits c where c.user_id = v_uid;
  v_balance := coalesce(v_balance, 0);

  if p_score = 0 then
    return jsonb_build_object('awarded', false, 'balance', v_balance, 'reason', 'zero_score');
  end if;
  if exists (select 1 from public.profiles p where p.id = v_uid and p.banned) then
    return jsonb_build_object('awarded', false, 'balance', v_balance, 'reason', 'banned');
  end if;

  -- The WHERE of the conflict branch is the 30 s cooldown: no row comes back while it is closed.
  insert into public.credits as c (user_id, balance, last_award_at)
  values (v_uid, 1, now())
  on conflict (user_id) do update
    set balance = c.balance + 1, last_award_at = now()
    where c.last_award_at is null or c.last_award_at <= now() - interval '30 seconds'
  returning c.balance into v_balance;

  if not found then
    select c.balance into v_balance from public.credits c where c.user_id = v_uid;
    return jsonb_build_object('awarded', false, 'balance', v_balance, 'reason', 'cooldown');
  end if;
  return jsonb_build_object('awarded', true, 'balance', v_balance, 'reason', 'ok');
end;
$$;

-- p_cost in (5, 10, 100). Locks the credits row, checks the balance, rolls, writes user_pins and applies the
-- duplicate refund in one transaction. Returns { pin_id, rarity, is_new, refund, balance }.
create function public.pull_pin(p_cost int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_balance int;
  v_pin     text;
  v_rarity  text := 'common';
  v_names   text[] := array['common', 'rare', 'super-rare', 'ultra-rare', 'epic'];
  v_weights numeric[];
  v_roll    numeric;
  v_acc     numeric;
  v_i       int;
  v_attempt int;
  v_is_new  boolean;
  v_refund  int := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_cost is null or p_cost not in (5, 10, 100) then
    raise exception 'invalid_cost';
  end if;

  select c.balance into v_balance from public.credits c where c.user_id = v_uid for update;
  if v_balance is null or v_balance < p_cost then
    raise exception 'insufficient';
  end if;

  if p_cost = 100 then
    -- Guaranteed new pin, lowest rarity that still has unowned pins first.
    select p.id, p.rarity into v_pin, v_rarity
    from public.pins p
    where not exists (select 1 from public.user_pins up where up.user_id = v_uid and up.pin_id = p.id)
    order by array_position(v_names, p.rarity), random()
    limit 1;
    if v_pin is null then
      raise exception 'collection_complete';
    end if;
  else
    v_weights := case when p_cost = 5 then array[60, 20, 15, 4, 1] else array[40, 25, 22, 10, 3] end;
    -- 10 credits rerolls once when the rolled pin is already owned and keeps the second result.
    for v_attempt in 1..(case when p_cost = 10 then 2 else 1 end) loop
      v_roll := random() * 100;
      v_acc := 0;
      for v_i in 1..5 loop
        v_acc := v_acc + v_weights[v_i];
        if v_roll < v_acc then
          v_rarity := v_names[v_i];
          exit;
        end if;
      end loop;
      select p.id into v_pin from public.pins p where p.rarity = v_rarity order by random() limit 1;
      exit when not exists (
        select 1 from public.user_pins up where up.user_id = v_uid and up.pin_id = v_pin
      );
    end loop;
  end if;

  v_is_new := not exists (select 1 from public.user_pins up where up.user_id = v_uid and up.pin_id = v_pin);
  if v_is_new then
    insert into public.user_pins (user_id, pin_id) values (v_uid, v_pin);
  else
    -- A duplicate is never stored: it turns into credits.
    v_refund := case v_rarity
      when 'common' then 1 when 'rare' then 2 when 'super-rare' then 3 when 'ultra-rare' then 5 else 10 end;
  end if;

  update public.credits c set balance = c.balance - p_cost + v_refund
  where c.user_id = v_uid
  returning c.balance into v_balance;

  return jsonb_build_object('pin_id', v_pin, 'rarity', v_rarity, 'is_new', v_is_new,
                            'refund', v_refund, 'balance', v_balance);
end;
$$;

revoke execute on function public.award_credit(text, int) from public, anon;
revoke execute on function public.pull_pin(int) from public, anon;
grant execute on function public.award_credit(text, int) to authenticated;
grant execute on function public.pull_pin(int) to authenticated;

insert into public.pins (id, number, game_id, name, kind, rarity) values
  ('asteroids-big-rock', 1, 'asteroids', 'Big Rock', 'enemy', 'common'),
  ('asteroids-mid-rock', 2, 'asteroids', 'Mid Rock', 'enemy', 'common'),
  ('asteroids-pebble', 3, 'asteroids', 'Pebble', 'enemy', 'common'),
  ('asteroids-bomb', 4, 'asteroids', 'Bomb', 'powerup', 'super-rare'),
  ('asteroids-comet', 5, 'asteroids', 'Comet', 'powerup', 'common'),
  ('asteroids-crescent-moon', 6, 'asteroids', 'Crescent Moon', 'powerup', 'common'),
  ('asteroids-hyperspace', 7, 'asteroids', 'Hyperspace', 'powerup', 'super-rare'),
  ('asteroids-lightning-bolt', 8, 'asteroids', 'Lightning Bolt', 'powerup', 'common'),
  ('asteroids-plasma-bolt', 9, 'asteroids', 'Plasma Bolt', 'powerup', 'rare'),
  ('asteroids-ringed-planet', 10, 'asteroids', 'Ringed Planet', 'powerup', 'common'),
  ('asteroids-rocket', 11, 'asteroids', 'Rocket', 'powerup', 'common'),
  ('asteroids-satellite', 12, 'asteroids', 'Satellite', 'powerup', 'common'),
  ('asteroids-shield', 13, 'asteroids', 'Shield', 'powerup', 'super-rare'),
  ('asteroids-slow-mo', 14, 'asteroids', 'Slow-Mo', 'powerup', 'super-rare'),
  ('asteroids-star', 15, 'asteroids', 'Star', 'powerup', 'common'),
  ('asteroids-sun', 16, 'asteroids', 'Sun', 'powerup', 'common'),
  ('asteroids-thruster-flame', 17, 'asteroids', 'Thruster Flame', 'powerup', 'rare'),
  ('asteroids-triple-shot', 18, 'asteroids', 'Triple Shot', 'powerup', 'super-rare'),
  ('asteroids-astronaut', 19, 'asteroids', 'Astronaut', 'character', 'common'),
  ('asteroids-robot', 20, 'asteroids', 'Robot', 'character', 'common'),
  ('asteroids-rocket-ship', 21, 'asteroids', 'Rocket Ship', 'character', 'super-rare'),
  ('arkanoid-cyan-brick', 22, 'arkanoid', 'Cyan Brick', 'enemy', 'rare'),
  ('arkanoid-green-brick', 23, 'arkanoid', 'Green Brick', 'enemy', 'rare'),
  ('arkanoid-hot-pink-brick', 24, 'arkanoid', 'Hot Pink Brick', 'enemy', 'rare'),
  ('arkanoid-magenta-brick', 25, 'arkanoid', 'Magenta Brick', 'enemy', 'rare'),
  ('arkanoid-red-brick', 26, 'arkanoid', 'Red Brick', 'enemy', 'common'),
  ('arkanoid-yellow-brick', 27, 'arkanoid', 'Yellow Brick', 'enemy', 'common'),
  ('arkanoid-balloon', 28, 'arkanoid', 'Balloon', 'powerup', 'common'),
  ('arkanoid-bell', 29, 'arkanoid', 'Bell', 'powerup', 'common'),
  ('arkanoid-cartridge', 30, 'arkanoid', 'Cartridge', 'powerup', 'common'),
  ('arkanoid-coin', 31, 'arkanoid', 'Coin', 'powerup', 'common'),
  ('arkanoid-complete-bar-capsule', 32, 'arkanoid', 'Complete Bar Capsule', 'powerup', 'super-rare'),
  ('arkanoid-dice', 33, 'arkanoid', 'Dice', 'powerup', 'common'),
  ('arkanoid-energy-ball', 34, 'arkanoid', 'Energy Ball', 'powerup', 'super-rare'),
  ('arkanoid-frenzy-capsule', 35, 'arkanoid', 'Frenzy Capsule', 'powerup', 'super-rare'),
  ('arkanoid-gift', 36, 'arkanoid', 'Gift', 'powerup', 'common'),
  ('arkanoid-joystick', 37, 'arkanoid', 'Joystick', 'powerup', 'common'),
  ('arkanoid-magic-wand', 38, 'arkanoid', 'Magic Wand', 'powerup', 'common'),
  ('arkanoid-music-note', 39, 'arkanoid', 'Music Note', 'powerup', 'common'),
  ('arkanoid-playing-card', 40, 'arkanoid', 'Playing Card', 'powerup', 'common'),
  ('arkanoid-triple-ball-capsule', 41, 'arkanoid', 'Triple Ball Capsule', 'powerup', 'super-rare'),
  ('arkanoid-vaus-paddle', 42, 'arkanoid', 'Vaus Paddle', 'character', 'super-rare'),
  ('snake-apple', 43, 'snake', 'Apple', 'powerup', 'common'),
  ('snake-banana', 44, 'snake', 'Banana', 'powerup', 'common'),
  ('snake-blue-berries', 45, 'snake', 'Blue Berries', 'powerup', 'super-rare'),
  ('snake-broccoli', 46, 'snake', 'Broccoli', 'powerup', 'rare'),
  ('snake-burger', 47, 'snake', 'Burger', 'powerup', 'common'),
  ('snake-cake-slice', 48, 'snake', 'Cake Slice', 'powerup', 'common'),
  ('snake-candy', 49, 'snake', 'Candy', 'powerup', 'common'),
  ('snake-carrot', 50, 'snake', 'Carrot', 'powerup', 'rare'),
  ('snake-cheese', 51, 'snake', 'Cheese', 'powerup', 'common'),
  ('snake-cherry', 52, 'snake', 'Cherry', 'powerup', 'rare'),
  ('snake-coffee-cup', 53, 'snake', 'Coffee Cup', 'powerup', 'common'),
  ('snake-cookie', 54, 'snake', 'Cookie', 'powerup', 'common'),
  ('snake-cupcake', 55, 'snake', 'Cupcake', 'powerup', 'common'),
  ('snake-donut', 56, 'snake', 'Donut', 'powerup', 'common'),
  ('snake-eggplant', 57, 'snake', 'Eggplant', 'powerup', 'rare'),
  ('snake-fried-egg', 58, 'snake', 'Fried Egg', 'powerup', 'common'),
  ('snake-fries', 59, 'snake', 'Fries', 'powerup', 'common'),
  ('snake-garlic', 60, 'snake', 'Garlic', 'powerup', 'rare'),
  ('snake-golden-pineapple', 61, 'snake', 'Golden Pineapple', 'powerup', 'ultra-rare'),
  ('snake-grape', 62, 'snake', 'Grape', 'powerup', 'rare'),
  ('snake-green-grapes', 63, 'snake', 'Green Grapes', 'powerup', 'super-rare'),
  ('snake-honeydew', 64, 'snake', 'Honeydew', 'powerup', 'super-rare'),
  ('snake-ice-cream', 65, 'snake', 'Ice Cream', 'powerup', 'common'),
  ('snake-kiwi', 66, 'snake', 'Kiwi', 'powerup', 'rare'),
  ('snake-lemon', 67, 'snake', 'Lemon', 'powerup', 'common'),
  ('snake-lollipop', 68, 'snake', 'Lollipop', 'powerup', 'common'),
  ('snake-mushroom', 69, 'snake', 'Mushroom', 'powerup', 'rare'),
  ('snake-orange', 70, 'snake', 'Orange', 'powerup', 'common'),
  ('snake-peach', 71, 'snake', 'Peach', 'powerup', 'rare'),
  ('snake-peanut', 72, 'snake', 'Peanut', 'powerup', 'rare'),
  ('snake-pepper', 73, 'snake', 'Pepper', 'powerup', 'rare'),
  ('snake-pizza-slice', 74, 'snake', 'Pizza Slice', 'powerup', 'common'),
  ('snake-popcorn', 75, 'snake', 'Popcorn', 'powerup', 'common'),
  ('snake-strawberry', 76, 'snake', 'Strawberry', 'powerup', 'rare'),
  ('snake-tomato', 77, 'snake', 'Tomato', 'powerup', 'rare'),
  ('snake-watermelon', 78, 'snake', 'Watermelon', 'powerup', 'super-rare'),
  ('snake-snake-body', 79, 'snake', 'Snake Body', 'character', 'common'),
  ('snake-snake-head', 80, 'snake', 'Snake Head', 'character', 'super-rare'),
  ('glowmaw-dazed-drifter', 81, 'glowmaw', 'Dazed Drifter', 'enemy', 'rare'),
  ('glowmaw-drifter-eyes', 82, 'glowmaw', 'Drifter Eyes', 'enemy', 'rare'),
  ('glowmaw-hunter-drifter', 83, 'glowmaw', 'Hunter Drifter', 'enemy', 'rare'),
  ('glowmaw-mirror-drifter', 84, 'glowmaw', 'Mirror Drifter', 'enemy', 'rare'),
  ('glowmaw-pacer-drifter', 85, 'glowmaw', 'Pacer Drifter', 'enemy', 'super-rare'),
  ('glowmaw-roamer-drifter', 86, 'glowmaw', 'Roamer Drifter', 'enemy', 'rare'),
  ('glowmaw-anchor', 87, 'glowmaw', 'Anchor', 'powerup', 'common'),
  ('glowmaw-bubble', 88, 'glowmaw', 'Bubble', 'powerup', 'common'),
  ('glowmaw-glow-mote', 89, 'glowmaw', 'Glow Mote', 'powerup', 'common'),
  ('glowmaw-pearl', 90, 'glowmaw', 'Pearl', 'powerup', 'super-rare'),
  ('glowmaw-seashell', 91, 'glowmaw', 'Seashell', 'powerup', 'common'),
  ('glowmaw-crab', 92, 'glowmaw', 'Crab', 'character', 'common'),
  ('glowmaw-fish', 93, 'glowmaw', 'Fish', 'character', 'common'),
  ('glowmaw-glowmaw', 94, 'glowmaw', 'Glowmaw', 'character', 'super-rare'),
  ('glowmaw-jellyfish', 95, 'glowmaw', 'Jellyfish', 'character', 'common'),
  ('glowmaw-octopus', 96, 'glowmaw', 'Octopus', 'character', 'common'),
  ('glowmaw-seahorse', 97, 'glowmaw', 'Seahorse', 'character', 'common'),
  ('glowmaw-starfish', 98, 'glowmaw', 'Starfish', 'character', 'common'),
  ('frogger-car', 99, 'frogger', 'Car', 'enemy', 'common'),
  ('frogger-truck', 100, 'frogger', 'Truck', 'enemy', 'common'),
  ('frogger-lily-pad', 101, 'frogger', 'Lily Pad', 'powerup', 'common'),
  ('frogger-log', 102, 'frogger', 'Log', 'powerup', 'common'),
  ('frogger-lotus-flower', 103, 'frogger', 'Lotus Flower', 'powerup', 'common'),
  ('frogger-raindrop', 104, 'frogger', 'Raindrop', 'powerup', 'common'),
  ('frogger-rubber-boot', 105, 'frogger', 'Rubber Boot', 'powerup', 'common'),
  ('frogger-sailboat', 106, 'frogger', 'Sailboat', 'powerup', 'common'),
  ('frogger-umbrella', 107, 'frogger', 'Umbrella', 'powerup', 'common'),
  ('frogger-diving-turtle', 108, 'frogger', 'Diving Turtle', 'character', 'super-rare'),
  ('frogger-dragonfly', 109, 'frogger', 'Dragonfly', 'character', 'common'),
  ('frogger-duck', 110, 'frogger', 'Duck', 'character', 'common'),
  ('frogger-frog', 111, 'frogger', 'Frog', 'character', 'super-rare'),
  ('frogger-frog-skull', 112, 'frogger', 'Frog Skull', 'character', 'rare'),
  ('frogger-ladybug', 113, 'frogger', 'Ladybug', 'character', 'common'),
  ('frogger-snail', 114, 'frogger', 'Snail', 'character', 'common'),
  ('frogger-turtle', 115, 'frogger', 'Turtle', 'character', 'rare'),
  ('space-invaders-invader', 116, 'space-invaders', 'Invader', 'enemy', 'common'),
  ('space-invaders-invader-bomb', 117, 'space-invaders', 'Invader Bomb', 'enemy', 'rare'),
  ('space-invaders-waving-invader', 118, 'space-invaders', 'Waving Invader', 'enemy', 'common'),
  ('space-invaders-cannon-shot', 119, 'space-invaders', 'Cannon Shot', 'powerup', 'rare'),
  ('space-invaders-cannonball', 120, 'space-invaders', 'Cannonball', 'powerup', 'common'),
  ('space-invaders-alien-head', 121, 'space-invaders', 'Alien Head', 'character', 'common'),
  ('space-invaders-bat', 122, 'space-invaders', 'Bat', 'character', 'common'),
  ('space-invaders-bear', 123, 'space-invaders', 'Bear', 'character', 'common'),
  ('space-invaders-bunny', 124, 'space-invaders', 'Bunny', 'character', 'common'),
  ('space-invaders-cat', 125, 'space-invaders', 'Cat', 'character', 'common'),
  ('space-invaders-ghost', 126, 'space-invaders', 'Ghost', 'character', 'common'),
  ('space-invaders-laser-cannon', 127, 'space-invaders', 'Laser Cannon', 'character', 'super-rare'),
  ('space-invaders-mystery-ship', 128, 'space-invaders', 'Mystery Ship', 'character', 'epic'),
  ('space-invaders-owl', 129, 'space-invaders', 'Owl', 'character', 'common'),
  ('space-invaders-skull', 130, 'space-invaders', 'Skull', 'character', 'common'),
  ('space-invaders-spider', 131, 'space-invaders', 'Spider', 'character', 'common'),
  ('galactic-dogfight-commander-boss', 132, 'galactic-dogfight', 'Commander Boss', 'enemy', 'ultra-rare'),
  ('galactic-dogfight-drone-bee', 133, 'galactic-dogfight', 'Drone Bee', 'enemy', 'common'),
  ('galactic-dogfight-enemy-shot', 134, 'galactic-dogfight', 'Enemy Shot', 'enemy', 'common'),
  ('galactic-dogfight-escort-butterfly', 135, 'galactic-dogfight', 'Escort Butterfly', 'enemy', 'rare'),
  ('galactic-dogfight-crown', 136, 'galactic-dogfight', 'Crown', 'powerup', 'common'),
  ('galactic-dogfight-feather', 137, 'galactic-dogfight', 'Feather', 'powerup', 'common'),
  ('galactic-dogfight-gem', 138, 'galactic-dogfight', 'Gem', 'powerup', 'common'),
  ('galactic-dogfight-heart', 139, 'galactic-dogfight', 'Heart', 'powerup', 'common'),
  ('galactic-dogfight-key', 140, 'galactic-dogfight', 'Key', 'powerup', 'common'),
  ('galactic-dogfight-medal', 141, 'galactic-dogfight', 'Medal', 'powerup', 'common'),
  ('galactic-dogfight-rescue-pod', 142, 'galactic-dogfight', 'Rescue Pod', 'powerup', 'ultra-rare'),
  ('galactic-dogfight-ring', 143, 'galactic-dogfight', 'Ring', 'powerup', 'common'),
  ('galactic-dogfight-round-shield', 144, 'galactic-dogfight', 'Round Shield', 'powerup', 'common'),
  ('galactic-dogfight-sword', 145, 'galactic-dogfight', 'Sword', 'powerup', 'common'),
  ('galactic-dogfight-tractor-beam', 146, 'galactic-dogfight', 'Tractor Beam', 'powerup', 'ultra-rare'),
  ('galactic-dogfight-trophy', 147, 'galactic-dogfight', 'Trophy', 'powerup', 'common'),
  ('galactic-dogfight-twin-blaster-shot', 148, 'galactic-dogfight', 'Twin Blaster Shot', 'powerup', 'rare'),
  ('galactic-dogfight-captured-fighter', 149, 'galactic-dogfight', 'Captured Fighter', 'character', 'ultra-rare'),
  ('galactic-dogfight-dual-fighter', 150, 'galactic-dogfight', 'Dual Fighter', 'character', 'ultra-rare'),
  ('galactic-dogfight-fighter', 151, 'galactic-dogfight', 'Fighter', 'character', 'super-rare');
