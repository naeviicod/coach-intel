-- Coach Intel — Supabase schema for team sign-in + roles.
-- Run once in the Supabase SQL editor (project -> SQL Editor -> New query)
-- after Discord sign-in is enabled under Authentication -> Providers.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  discord_username text,
  avatar_url text,
  role text not null default 'member'
    check (role in ('owner', 'team_leader', 'coach', 'analyst', 'member')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Any signed-in teammate can see the roster.
create policy "profiles are readable by any signed-in teammate"
  on public.profiles for select
  to authenticated
  using (true);

-- Only an owner or team leader can change someone's role.
create policy "only owner or team_leader can edit roles"
  on public.profiles for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'team_leader')
    )
  );

-- Creates a profile row the first time someone signs in via Discord. The very
-- first person to ever sign in becomes owner automatically, since nobody would
-- otherwise be able to grant that role. Everyone after starts as a plain member.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, discord_username, avatar_url, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    case when (select count(*) from public.profiles) = 0 then 'owner' else 'member' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
