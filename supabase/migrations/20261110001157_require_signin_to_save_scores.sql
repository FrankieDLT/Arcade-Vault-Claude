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
