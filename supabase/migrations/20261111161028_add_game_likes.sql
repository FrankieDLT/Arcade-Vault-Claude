-- SPEC 26 step 5: game likes (table without client access + two definer RPCs).
create table public.game_likes (
  user_id    uuid not null references auth.users (id) on delete cascade,
  game_id    text not null references public.games (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);
create index game_likes_game_idx on public.game_likes (game_id);
alter table public.game_likes enable row level security;
revoke all on public.game_likes from anon, authenticated;

-- anon and authenticated. Returns { count, liked }; liked is false without a session.
create function public.get_game_likes(p_game_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_count int;
  v_liked boolean := false;
begin
  select count(*) into v_count from public.game_likes l where l.game_id = p_game_id;
  if v_uid is not null then
    v_liked := exists (select 1 from public.game_likes l where l.game_id = p_game_id and l.user_id = v_uid);
  end if;
  return jsonb_build_object('count', v_count, 'liked', v_liked);
end;
$$;

-- authenticated only. Inserts the row if absent, deletes it if present, atomically.
create function public.toggle_game_like(p_game_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_count int;
  v_liked boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.games g where g.id = p_game_id) then
    raise exception 'unknown_game';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_uid::text || ':' || p_game_id));

  if exists (select 1 from public.game_likes l where l.user_id = v_uid and l.game_id = p_game_id) then
    delete from public.game_likes l where l.user_id = v_uid and l.game_id = p_game_id;
    v_liked := false;
  else
    insert into public.game_likes (user_id, game_id) values (v_uid, p_game_id);
    v_liked := true;
  end if;

  select count(*) into v_count from public.game_likes l where l.game_id = p_game_id;
  return jsonb_build_object('count', v_count, 'liked', v_liked);
end;
$$;

revoke execute on function public.get_game_likes(text) from public;
grant  execute on function public.get_game_likes(text) to anon, authenticated;
revoke execute on function public.toggle_game_like(text) from public, anon;
grant  execute on function public.toggle_game_like(text) to authenticated;
