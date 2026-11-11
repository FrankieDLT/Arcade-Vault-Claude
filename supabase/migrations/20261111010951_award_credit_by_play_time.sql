-- SPEC 18 change: credits come from play time, 1 per 30 s played, at most 5 per game.
-- The client reports the active play seconds of the run (paused time excluded). The server never trusts
-- more time than really passed since the last award, so a forged value cannot beat real time.
drop function public.award_credit(text, int);

create function public.award_credit(p_game_id text, p_score int, p_seconds int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_balance int;
  v_last    timestamptz;
  v_secs    int;
  v_credits int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_score is null or p_score < 0 or p_score > 10000000 then
    raise exception 'invalid_score';
  end if;
  if p_seconds is null or p_seconds < 0 then
    raise exception 'invalid_seconds';
  end if;
  if not exists (select 1 from public.games g where g.id = p_game_id) then
    raise exception 'unknown_game';
  end if;

  select c.balance, c.last_award_at into v_balance, v_last
  from public.credits c where c.user_id = v_uid for update;
  v_balance := coalesce(v_balance, 0);

  if p_score = 0 then
    return jsonb_build_object('awarded', false, 'credits', 0, 'balance', v_balance, 'reason', 'zero_score');
  end if;
  if exists (select 1 from public.profiles p where p.id = v_uid and p.banned) then
    return jsonb_build_object('awarded', false, 'credits', 0, 'balance', v_balance, 'reason', 'banned');
  end if;

  v_secs := least(p_seconds, 3600);
  if v_last is not null then
    v_secs := least(v_secs, greatest(0, floor(extract(epoch from (now() - v_last)))::int));
  end if;
  v_credits := least(5, v_secs / 30);

  if v_credits < 1 then
    return jsonb_build_object('awarded', false, 'credits', 0, 'balance', v_balance, 'reason', 'too_short');
  end if;

  insert into public.credits as c (user_id, balance, last_award_at)
  values (v_uid, v_credits, now())
  on conflict (user_id) do update
    set balance = c.balance + v_credits, last_award_at = now()
  returning c.balance into v_balance;

  return jsonb_build_object('awarded', true, 'credits', v_credits, 'balance', v_balance, 'reason', 'ok');
end;
$$;

revoke execute on function public.award_credit(text, int, int) from public, anon;
grant execute on function public.award_credit(text, int, int) to authenticated;
