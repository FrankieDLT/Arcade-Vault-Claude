-- Robo Vault: every boss defeated rewards 1 credit.
-- The client reports the boss; the server cannot verify a fight, so it rate-limits:
-- at least 10 s between boss awards and at most 30 per rolling 24 hours per user.
-- boss_awards is the audit and rate-limit log. It has RLS on and no policy: only this definer RPC touches it.
create table public.boss_awards (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  game_id    text not null references public.games (id),
  boss       text not null,
  awarded_at timestamptz not null default now()
);
create index boss_awards_user_time_idx on public.boss_awards (user_id, awarded_at desc);
alter table public.boss_awards enable row level security;
revoke all on public.boss_awards from anon, authenticated;

create function public.award_boss_credit(p_game_id text, p_boss text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_balance int;
  v_last    timestamptz;
  v_count   int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_game_id is distinct from 'robo-vault' then
    raise exception 'unknown_game';
  end if;
  if p_boss is null
     or not (p_boss ~ '^(rematch:)?(frostbyte|embercore|galeforce|tidebreaker)$' or p_boss = 'sam') then
    raise exception 'invalid_boss';
  end if;

  -- One award at a time per user (the credits row may not exist yet, so lock on the user id).
  perform pg_advisory_xact_lock(hashtext(v_uid::text));

  select c.balance into v_balance from public.credits c where c.user_id = v_uid;
  v_balance := coalesce(v_balance, 0);

  if exists (select 1 from public.profiles p where p.id = v_uid and p.banned) then
    return jsonb_build_object('awarded', false, 'credits', 0, 'balance', v_balance, 'reason', 'banned');
  end if;

  select max(b.awarded_at), count(*) into v_last, v_count
  from public.boss_awards b
  where b.user_id = v_uid and b.awarded_at > now() - interval '24 hours';

  if v_last is not null and now() - v_last < interval '10 seconds' then
    return jsonb_build_object('awarded', false, 'credits', 0, 'balance', v_balance, 'reason', 'too_soon');
  end if;
  if v_count >= 30 then
    return jsonb_build_object('awarded', false, 'credits', 0, 'balance', v_balance, 'reason', 'daily_cap');
  end if;

  insert into public.boss_awards (user_id, game_id, boss) values (v_uid, p_game_id, p_boss);

  -- last_award_at belongs to the play-time award, so it is left alone here.
  insert into public.credits as c (user_id, balance)
  values (v_uid, 1)
  on conflict (user_id) do update set balance = c.balance + 1
  returning c.balance into v_balance;

  return jsonb_build_object('awarded', true, 'credits', 1, 'balance', v_balance, 'reason', 'ok');
end;
$$;

revoke execute on function public.award_boss_credit(text, text) from public, anon;
grant execute on function public.award_boss_credit(text, text) to authenticated;
