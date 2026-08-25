-- Coach Intel — Supabase schema for team sign-in + roles.
-- Run once in the Supabase SQL editor (project -> SQL Editor -> New query)
-- after Discord sign-in is enabled under Authentication -> Providers.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  discord_username text,
  avatar_url text,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'developer', 'team_leader', 'coach', 'analyst', 'member', 'user', 'creative')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Any signed-in teammate can see the roster.
drop policy if exists "profiles are readable by any signed-in teammate" on public.profiles;
create policy "profiles are readable by any signed-in teammate"
  on public.profiles for select
  to authenticated
  using (true);

-- Only an owner or team leader can change someone's role. The `using` clause
-- alone only gates who may attempt an update — without a matching `with check`,
-- a team_leader could set anyone's (including their own) role to 'owner',
-- since nothing constrained the *new* value being written. The check below
-- requires the actor to already be an owner before a row can end up as 'owner'.
drop policy if exists "only owner or team_leader can edit roles" on public.profiles;
create policy "only owner or team_leader can edit roles"
  on public.profiles for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'admin', 'developer', 'team_leader')
    )
  )
  with check (
    role <> 'owner'
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
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
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- If Discord created an auth user but no profiles row (or the only account is a
-- plain member), roster writes fail with RLS on `members`. Safe to call before
-- every write; promotes the caller to owner when nobody else is staff.
drop function if exists public.ensure_profile();
create function public.ensure_profile()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rec public.profiles%rowtype;
  meta jsonb;
begin
  if uid is null then
    return json_build_object('ok', false, 'error', 'Not signed in');
  end if;

  select * into rec from public.profiles where id = uid;
  if not found then
    select raw_user_meta_data into meta from auth.users where id = uid;
    insert into public.profiles (id, discord_username, avatar_url, role)
    values (
      uid,
      coalesce(meta ->> 'full_name', meta ->> 'name'),
      meta ->> 'avatar_url',
      case
        when not exists (
          select 1 from public.profiles p where p.role in ('owner', 'admin', 'developer', 'team_leader', 'coach')
        ) then 'owner'
        else 'member'
      end
    )
    returning * into rec;
  elsif rec.role not in ('owner', 'admin', 'developer', 'team_leader', 'coach')
    and not exists (
      select 1 from public.profiles p
      where p.id <> uid and p.role in ('owner', 'admin', 'developer', 'team_leader', 'coach')
    ) then
    update public.profiles set role = 'owner' where id = uid returning * into rec;
  end if;

  return json_build_object(
    'ok', true,
    'id', rec.id,
    'role', rec.role,
    'discord_username', rec.discord_username,
    'avatar_url', rec.avatar_url
  );
end;
$$;

revoke all on function public.ensure_profile() from public;
grant execute on function public.ensure_profile() to authenticated;

-- Discord accounts that signed in before handle_new_user existed have no
-- profiles row. Without one, every teams/members write dies on RLS and the
-- roster stays on that one Mac. First auth user becomes owner when nobody
-- else is staff.
insert into public.profiles (id, discord_username, avatar_url, role)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
  u.raw_user_meta_data ->> 'avatar_url',
  case
    when exists (
      select 1 from public.profiles p where p.role in ('owner', 'admin', 'developer', 'team_leader', 'coach')
    ) then 'member'
    when u.id = (select id from auth.users order by created_at asc limit 1) then 'owner'
    else 'member'
  end
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ---------- Teams & roster ----------
-- Shared replacement for data/org/teams/<id>/team-profile.json and members/*.json.
-- Local files stay as the per-machine cache for everything not migrated yet
-- (matches, strats, notes, tasks); teams/members are the first slice to move
-- so every signed-in teammate sees the same roster, live.

create table if not exists public.teams (
  id text primary key,
  name text not null,
  tag text,
  logo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.members (
  id text primary key,
  team_id text not null references public.teams (id) on delete cascade,
  gamertag text not null,
  name text,
  role text,
  aliases text[] not null default '{}',
  photo text,
  slot text not null default 'starter',
  title text,
  handles jsonb not null default '{}'::jsonb,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.teams enable row level security;
alter table public.members enable row level security;

-- Any signed-in teammate can read the roster.
drop policy if exists "teams are readable by any signed-in teammate" on public.teams;
create policy "teams are readable by any signed-in teammate"
  on public.teams for select to authenticated using (true);
drop policy if exists "members are readable by any signed-in teammate" on public.members;
create policy "members are readable by any signed-in teammate"
  on public.members for select to authenticated using (true);

-- Only owner/team_leader/coach can add, edit or remove teams and players.
drop policy if exists "owner/team_leader/coach can manage teams" on public.teams;
create policy "owner/team_leader/coach can manage teams"
  on public.teams for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'developer', 'team_leader', 'coach')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'developer', 'team_leader', 'coach')));

drop policy if exists "owner/team_leader/coach can manage members" on public.members;
create policy "owner/team_leader/coach can manage members"
  on public.members for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'developer', 'team_leader', 'coach')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'developer', 'team_leader', 'coach')));

-- Lets every signed-in client subscribe to live changes on these tables.
-- `alter publication ... add table` has no `if not exists` form, so this is
-- wrapped in an existence check to stay safe to re-run.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'teams'
  ) then
    alter publication supabase_realtime add table public.teams;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'members'
  ) then
    alter publication supabase_realtime add table public.members;
  end if;
end $$;

alter table public.teams replica identity full;
alter table public.members replica identity full;

-- Existing projects already have profiles.role check without admin/user.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('owner', 'admin', 'developer', 'team_leader', 'coach', 'analyst', 'member', 'user', 'creative'));

alter table public.members add column if not exists slot text not null default 'starter';
alter table public.members add column if not exists title text;
alter table public.members add column if not exists handles jsonb not null default '{}'::jsonb;
alter table public.members add column if not exists user_id uuid references auth.users (id) on delete set null;
alter table public.teams add column if not exists accent text;

create unique index if not exists members_user_id_unique
  on public.members (user_id)
  where user_id is not null;

-- Invite a roster member to sign in with Discord and bind that account to this
-- player + team. The token is the web path: https://coach.championshipseries.eu/join/<id>
create table if not exists public.invites (
  id text primary key,
  team_id text not null references public.teams (id) on delete cascade,
  member_id text not null references public.members (id) on delete cascade,
  access_role text not null default 'user'
    check (access_role in ('owner', 'admin', 'developer', 'team_leader', 'coach', 'analyst', 'user', 'creative')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_user_id uuid references auth.users (id) on delete set null,
  invitee_email text
);

alter table public.invites add column if not exists invitee_email text;

alter table public.invites enable row level security;

-- Existing projects already have invites.access_role without owner/admin/creative.
alter table public.invites drop constraint if exists invites_access_role_check;
alter table public.invites add constraint invites_access_role_check
  check (access_role in ('owner', 'admin', 'developer', 'team_leader', 'coach', 'analyst', 'user', 'creative'));

drop policy if exists "staff can manage invites" on public.invites;
create policy "staff can manage invites"
  on public.invites for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'developer', 'team_leader', 'coach')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'developer', 'team_leader', 'coach')));

-- Preview is callable while signed out so the sign-in screen can name the player.
create or replace function public.invite_preview(invite_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invites%rowtype;
  mem public.members%rowtype;
  tm public.teams%rowtype;
  org_name text;
begin
  if invite_token is null or length(invite_token) < 16 then
    return json_build_object('ok', false, 'error', 'Invalid invite');
  end if;
  select * into inv from public.invites where id = invite_token;
  if not found then
    return json_build_object('ok', false, 'error', 'Invite not found');
  end if;
  if inv.accepted_at is not null then
    return json_build_object('ok', false, 'error', 'This invite was already used');
  end if;
  if inv.expires_at < now() then
    return json_build_object('ok', false, 'error', 'This invite has expired');
  end if;
  select * into mem from public.members where id = inv.member_id and team_id = inv.team_id;
  select * into tm from public.teams where id = inv.team_id;
  select coalesce(nullif(trim(payload->>'name'), ''), nullif(trim(payload->>'tag'), ''))
    into org_name
    from public.shared_docs
    where kind = 'org' and id = 'profile' and deleted_at is null
    limit 1;
  return json_build_object(
    'ok', true,
    'gamertag', coalesce(mem.gamertag, 'Player'),
    'member_name', mem.name,
    'invitee_email', nullif(to_jsonb(inv)->>'invitee_email', ''),
    'org_name', coalesce(org_name, tm.name, 'the organization'),
    'team_name', coalesce(tm.name, 'Team'),
    'team_id', inv.team_id,
    'member_id', inv.member_id,
    'access_role', inv.access_role,
    'accent', tm.accent
  );
end;
$$;

-- Signed-in Discord user claims the roster slot and receives the invite's access role.
create or replace function public.redeem_invite(invite_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invites%rowtype;
  uid uuid := auth.uid();
  existing_id text;
  current_role text;
begin
  if uid is null then
    return json_build_object('ok', false, 'error', 'Sign in first');
  end if;
  select * into inv from public.invites where id = invite_token for update;
  if not found then
    return json_build_object('ok', false, 'error', 'Invite not found');
  end if;
  if inv.accepted_at is not null then
    return json_build_object('ok', false, 'error', 'This invite was already used');
  end if;
  if inv.expires_at < now() then
    return json_build_object('ok', false, 'error', 'This invite has expired');
  end if;

  select role into current_role from public.profiles where id = uid;
  if current_role in ('owner', 'admin', 'developer', 'coach', 'team_leader', 'analyst') then
    return json_build_object('ok', false, 'error', 'Staff accounts cannot accept a player invite. The player should open this link and sign in with their Discord.');
  end if;

  select id into existing_id from public.members where user_id = uid and id <> inv.member_id limit 1;
  if existing_id is not null then
    return json_build_object('ok', false, 'error', 'That Discord account is already linked to another player');
  end if;

  update public.members
    set user_id = uid, updated_at = now()
    where id = inv.member_id and team_id = inv.team_id;

  if current_role is distinct from 'owner' then
    update public.profiles set role = inv.access_role where id = uid;
  end if;

  update public.invites
    set accepted_at = now(), accepted_user_id = uid
    where id = invite_token;

  return json_build_object(
    'ok', true,
    'team_id', inv.team_id,
    'member_id', inv.member_id,
    'access_role', inv.access_role
  );
end;
$$;

revoke all on function public.invite_preview(text) from public;
revoke all on function public.redeem_invite(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated;
grant execute on function public.redeem_invite(text) to authenticated;

-- ---------- Team-scoped visibility & writes ----------
-- Until now, "teams are readable by any signed-in teammate" and "owner/team_leader/
-- coach can manage teams" used `using (true)` / a role-only check with no team_id
-- condition — any authenticated user could read every team's roster, and any
-- team_leader could write to a team they have nothing to do with. Org-wide staff
-- (owner/admin/coach/analyst — matches ALL_TEAMS_ROLES in src/renderer/lib/
-- access.js) keep full visibility by design; everyone else (team_leader/user/
-- creative/member) is now scoped to the one team they're linked to via
-- members.user_id.

-- Returns the caller's own team_id via their linked roster slot, or null if they
-- have none (org-wide staff, or not yet linked to a roster slot). security definer
-- + fixed search_path so this can be used inside a `members` RLS policy itself
-- without the self-referencing query getting filtered by the very policy it's
-- evaluating (which would either recurse or silently return nothing).
create or replace function public.my_team_id()
returns text
language sql
stable
security definer set search_path = public
as $$
  select team_id from public.members where user_id = auth.uid() limit 1;
$$;

revoke all on function public.my_team_id() from public;
grant execute on function public.my_team_id() to authenticated;

drop policy if exists "teams are readable by any signed-in teammate" on public.teams;
drop policy if exists "teams are readable by org-wide staff or your own team" on public.teams;
create policy "teams are readable by any signed-in teammate"
  on public.teams for select
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()));

drop policy if exists "members are readable by any signed-in teammate" on public.members;
drop policy if exists "members are readable by org-wide staff or your own team" on public.members;
create policy "members are readable by any signed-in teammate"
  on public.members for select
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()));

drop policy if exists "owner/team_leader/coach can manage teams" on public.teams;
drop policy if exists "owner/coach manage all teams, team_leader manages their own" on public.teams;
create policy "owner/coach manage all teams, team_leader manages their own"
  on public.teams for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'developer', 'coach'))
    or (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'team_leader')
      and id = public.my_team_id()
    )
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'developer', 'coach'))
    or (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'team_leader')
      and id = public.my_team_id()
    )
  );

drop policy if exists "owner/team_leader/coach can manage members" on public.members;
drop policy if exists "owner/coach manage all members, team_leader manages their own team" on public.members;
create policy "owner/coach manage all members, team_leader manages their own team"
  on public.members for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'developer', 'coach'))
    or (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'team_leader')
      and team_id = public.my_team_id()
    )
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'developer', 'coach'))
    or (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'team_leader')
      and team_id = public.my_team_id()
    )
  );

-- ---------- Discord guild -> team mapping ----------
-- Replaces the Discord Worker's TEAM_GUILD_MAP secret (a hand-edited JSON blob)
-- with a live table, so mapping a new Discord server to a team never requires
-- touching a Cloudflare secret again. The Worker reads this with the service-role
-- key (bypasses RLS by design — same trust boundary as
-- scripts/supabase/migrate-teams.js and scripts/supabase/link-guild.js); RLS here
-- only gates the small number of org-wide staff who manage the mapping directly
-- from the app or the SQL editor.

create table if not exists public.discord_guild_links (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null unique,
  team_id text not null references public.teams (id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists discord_guild_links_team_id_idx on public.discord_guild_links (team_id);

alter table public.discord_guild_links enable row level security;

drop policy if exists "org-wide staff can read guild links" on public.discord_guild_links;
create policy "org-wide staff can read guild links"
  on public.discord_guild_links for select
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'developer', 'coach')));

drop policy if exists "org-wide staff can manage guild links" on public.discord_guild_links;
create policy "org-wide staff can manage guild links"
  on public.discord_guild_links for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'developer', 'coach')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'developer', 'coach')));

-- ---------- Shared org/team documents (K/D, match history, strats, …) ----------
-- One row per record. Local JSON is the working copy; this table is what every
-- signed-in device hydrates from. team_id = '' is org-level (opponents, rankings,
-- org profile, CDL ruleset, map objectives).

create table if not exists public.shared_docs (
  kind text not null,
  team_id text not null default '',
  id text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (kind, team_id, id)
);

create index if not exists shared_docs_team_kind_idx on public.shared_docs (team_id, kind);

alter table public.shared_docs enable row level security;
alter table public.shared_docs replica identity full;

drop policy if exists "shared docs readable by staff, own team, or org-level" on public.shared_docs;
create policy "shared docs readable by staff, own team, or org-level"
  on public.shared_docs for select
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'developer', 'coach', 'analyst'))
    or team_id = public.my_team_id()
    or team_id = ''
  );

drop policy if exists "shared docs writable by staff" on public.shared_docs;
create policy "shared docs writable by staff"
  on public.shared_docs for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'developer', 'coach'))
    or (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'team_leader')
      and (team_id = public.my_team_id() or team_id = '')
    )
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'developer', 'coach'))
    or (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'team_leader')
      and (team_id = public.my_team_id() or team_id = '')
    )
  );

grant select, insert, update, delete on public.shared_docs to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.shared_docs;
exception
  when duplicate_object then null;
end $$;

-- ---------- User feedback ----------
-- Bug reports, feature requests, and other feedback from any signed-in user —
-- not routed through shared_docs, since that table is staff-write-only and
-- globally readable by every signed-in teammate once team_id = '' (see above),
-- neither of which is right for feedback: any role must be able to submit, and
-- one user's feedback must not be readable by another user who isn't staff.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  team_id text references public.teams (id) on delete set null,
  category text not null default 'other'
    check (category in ('bug', 'incorrect_data', 'ui_ux', 'feature_request', 'performance', 'strategy_map_data', 'other')),
  subject text not null,
  description text not null,
  contact_email text,
  page text,
  app_version text,
  platform text,
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'resolved', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists feedback_user_id_idx on public.feedback (user_id);
create index if not exists feedback_status_idx on public.feedback (status);

alter table public.feedback enable row level security;

-- Any signed-in user may submit feedback, but only attributed to themselves.
drop policy if exists "users can submit their own feedback" on public.feedback;
create policy "users can submit their own feedback"
  on public.feedback for insert
  to authenticated
  with check (user_id = auth.uid());

-- A user reads only their own submissions; org-wide staff can read all of them
-- to triage, mirroring the role set already used to gate shared_docs writes.
drop policy if exists "users read own feedback, staff reads all" on public.feedback;
create policy "users read own feedback, staff reads all"
  on public.feedback for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'developer', 'coach'))
  );

-- No UI reads or writes `status` yet — this policy exists so a future triage
-- screen doesn't need another migration, not because one exists today.
drop policy if exists "staff can update feedback status" on public.feedback;
create policy "staff can update feedback status"
  on public.feedback for update
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'developer', 'coach')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'developer', 'coach')));

-- ---------- Cloud asset storage (member photos, team/org logos, map art) ----------
-- teams.logo and members.photo already sync as relative-path strings, but the
-- image bytes those paths point to only ever lived on whichever one machine did
-- the upload — a second machine had the path and nothing at the end of it. This
-- bucket is what a fresh install (or scripts/supabase/migrate-images.js, for
-- images uploaded before this existed) actually resolves those paths against.
-- Private, not public: readable by any signed-in teammate, writable only by the
-- same staff roles already allowed to edit teams/members/org (RLS here backs up
-- the requireEdit() gate the app already enforces on every upload IPC call).

insert into storage.buckets (id, name, public)
values ('org-assets', 'org-assets', false)
on conflict (id) do nothing;

drop policy if exists "org-assets readable by any signed-in teammate" on storage.objects;
create policy "org-assets readable by any signed-in teammate"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'org-assets');

drop policy if exists "org-assets writable by staff" on storage.objects;
create policy "org-assets writable by staff"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'org-assets'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'developer', 'team_leader', 'coach'))
  );

drop policy if exists "org-assets updatable by staff" on storage.objects;
create policy "org-assets updatable by staff"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'org-assets'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'developer', 'team_leader', 'coach'))
  );

drop policy if exists "org-assets deletable by staff" on storage.objects;
create policy "org-assets deletable by staff"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'org-assets'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'developer', 'team_leader', 'coach'))
  );
