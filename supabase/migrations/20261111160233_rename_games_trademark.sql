-- SPEC 26 step 2: full trademark rename (ids, url, scores, pins, credits). No row is deleted.
-- Foreign keys found by query: scores.game_id, pins.game_id, boss_awards.game_id -> games(id); user_pins.pin_id -> pins(id).
-- No function body names an old game id (checked in pg_proc).
do $$
declare
  c_games int; c_scores int; c_pins int; c_user_pins int; c_boss int;
begin
  select count(*) into c_games from public.games;
  select count(*) into c_scores from public.scores;
  select count(*) into c_pins from public.pins;
  select count(*) into c_user_pins from public.user_pins;
  select count(*) into c_boss from public.boss_awards;

  alter table public.scores      drop constraint scores_game_id_fkey;
  alter table public.pins        drop constraint pins_game_id_fkey;
  alter table public.boss_awards drop constraint boss_awards_game_id_fkey;
  alter table public.user_pins   drop constraint user_pins_pin_id_fkey;

  create temp table _map (old_id text primary key, new_id text not null) on commit drop;
  insert into _map values
    ('tetris','block-rain'), ('pong','super-tennis'), ('asteroids','space-voyage'),
    ('frogger','street-jumper'), ('space-invaders','alien-attack'), ('arkanoid','wall-wrecker');

  create temp table _pin_map on commit drop as
    select p.id as old_pin, m.new_id || substr(p.id, length(m.old_id) + 1) as new_pin
    from public.pins p join _map m on p.game_id = m.old_id;

  -- the five pins named after the originals' own terms
  update _pin_map set new_pin = 'wall-wrecker-wrecker-paddle'   where old_pin = 'arkanoid-vaus-paddle';
  update _pin_map set new_pin = 'alien-attack-alien'            where old_pin = 'space-invaders-invader';
  update _pin_map set new_pin = 'alien-attack-alien-bomb'       where old_pin = 'space-invaders-invader-bomb';
  update _pin_map set new_pin = 'alien-attack-waving-alien'     where old_pin = 'space-invaders-waving-invader';
  update _pin_map set new_pin = 'alien-attack-bonus-saucer'     where old_pin = 'space-invaders-mystery-ship';

  update public.user_pins u set pin_id = pm.new_pin from _pin_map pm where u.pin_id = pm.old_pin;
  update public.pins p set id = pm.new_pin from _pin_map pm where p.id = pm.old_pin;
  update public.pins set name = 'Wrecker Paddle' where id = 'wall-wrecker-wrecker-paddle';
  update public.pins set name = 'Alien'          where id = 'alien-attack-alien';
  update public.pins set name = 'Alien Bomb'     where id = 'alien-attack-alien-bomb';
  update public.pins set name = 'Waving Alien'   where id = 'alien-attack-waving-alien';
  update public.pins set name = 'Bonus Saucer'   where id = 'alien-attack-bonus-saucer';

  update public.scores      s set game_id = m.new_id from _map m where s.game_id = m.old_id;
  update public.pins        p set game_id = m.new_id from _map m where p.game_id = m.old_id;
  update public.boss_awards b set game_id = m.new_id from _map m where b.game_id = m.old_id;

  update public.games g set id = m.new_id, cover = 'cover-' || m.new_id from _map m where g.id = m.old_id;

  alter table public.scores      add constraint scores_game_id_fkey      foreign key (game_id) references public.games(id);
  alter table public.pins        add constraint pins_game_id_fkey        foreign key (game_id) references public.games(id);
  alter table public.boss_awards add constraint boss_awards_game_id_fkey foreign key (game_id) references public.games(id);
  alter table public.user_pins   add constraint user_pins_pin_id_fkey    foreign key (pin_id)  references public.pins(id);

  if (select count(*) from public.games) <> c_games or (select count(*) from public.scores) <> c_scores
     or (select count(*) from public.pins) <> c_pins or (select count(*) from public.user_pins) <> c_user_pins
     or (select count(*) from public.boss_awards) <> c_boss then
    raise exception 'row counts changed';
  end if;
end $$;
