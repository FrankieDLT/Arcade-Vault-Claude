-- Royalty of Games: per-player ranking = sum of each player's best score per game.
-- Clients cannot read scores.user_id or auth.users, so the grouping runs here (security definer)
-- and only aggregate columns leave: no user id, no email.
create function public.royalty_of_games(p_limit int default 12)
returns table (rank int, name text, total bigint, games int, last_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with best as (
    select s.user_id, s.game_id, max(s.score) as best, max(s.created_at) as last_at
    from public.scores s
    where s.user_id is not null
    group by s.user_id, s.game_id
  ), totals as (
    select b.user_id, sum(b.best)::bigint as total, count(*)::int as games, max(b.last_at) as last_at
    from best b
    group by b.user_id
  )
  select
    (row_number() over (order by t.total desc, t.last_at asc))::int as rank,
    coalesce(
      nullif(left(regexp_replace(upper(u.raw_user_meta_data ->> 'username'),  '[^A-Z0-9_-]', '', 'g'), 20), ''),
      nullif(left(regexp_replace(upper(u.raw_user_meta_data ->> 'full_name'), '[^A-Z0-9_-]', '', 'g'), 20), ''),
      nullif(left(regexp_replace(upper(u.raw_user_meta_data ->> 'name'),      '[^A-Z0-9_-]', '', 'g'), 20), ''),
      nullif(left(regexp_replace(upper(u.raw_user_meta_data ->> 'user_name'), '[^A-Z0-9_-]', '', 'g'), 20), ''),
      (select s2.name from public.scores s2 where s2.user_id = t.user_id order by s2.created_at desc limit 1),
      'PLAYER1'
    ) as name,
    t.total,
    t.games,
    t.last_at
  from totals t
  join auth.users u on u.id = t.user_id
  order by 1
  limit least(greatest(coalesce(p_limit, 12), 1), 100);
$$;

revoke execute on function public.royalty_of_games(int) from public;
grant execute on function public.royalty_of_games(int) to anon, authenticated;
