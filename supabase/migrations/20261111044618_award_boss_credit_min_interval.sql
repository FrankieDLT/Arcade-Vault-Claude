-- A rematch boss can really be beaten a few seconds after the previous one (1.2 s intro + the fight),
-- so the minimum gap between boss awards drops from 10 s to 3 s. The daily cap of 30 stays.
create or replace function public.award_boss_credit(p_game_id text, p_boss text)
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

  if v_last is not null and now() - v_last < interval '3 seconds' then
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
