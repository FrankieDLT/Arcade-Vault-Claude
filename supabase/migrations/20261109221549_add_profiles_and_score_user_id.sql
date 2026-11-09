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
