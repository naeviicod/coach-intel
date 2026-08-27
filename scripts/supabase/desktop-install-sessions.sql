-- Coach Intel macOS first-run setup authorization.
--
-- This migration is intentionally NOT applied by local tooling or CI. Review
-- and run it once in the Coach Intel Supabase SQL editor with an authorized
-- database owner. It creates short-lived, opaque session/code records only;
-- no email, profile name, Supabase JWT, or database ID reaches the desktop app.

create extension if not exists pgcrypto;

create table if not exists public.desktop_install_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('mac')),
  release_version text not null,
  source text not null check (source in ('settings-download', 'first-run-auth')),
  session_hash text not null unique,
  state_hash text,
  challenge_hash text,
  authorization_code_hash text unique,
  authorization_expires_at timestamptz,
  authorized_at timestamptz,
  authorization_consumed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists desktop_install_sessions_active_user_idx
  on public.desktop_install_sessions (user_id, platform, release_version, expires_at desc)
  where authorization_consumed_at is null;

alter table public.desktop_install_sessions enable row level security;
revoke all on table public.desktop_install_sessions from anon, authenticated;

-- Creates the server-side record when an authenticated member presses
-- Settings → CI Desktop → Download for Mac. The stable DMG URL carries none of
-- this state; its first use is bound later by authorize_desktop_setup.
create or replace function public.create_desktop_download_session(
  p_platform text,
  p_release_version text
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  selected_version text;
begin
  if uid is null or p_platform <> 'mac' then
    return json_build_object('ok', false);
  end if;

  select version into selected_version
    from public.app_releases
    where published = true and version = p_release_version and coalesce(nullif(btrim(mac_url), ''), '') <> ''
    limit 1;
  if selected_version is null then
    return json_build_object('ok', false);
  end if;

  insert into public.desktop_install_sessions (
    user_id, platform, release_version, source, session_hash, expires_at
  ) values (
    uid,
    'mac',
    selected_version,
    'settings-download',
    encode(digest(encode(gen_random_bytes(32), 'hex'), 'sha256'), 'hex'),
    now() + interval '10 minutes'
  );
  return json_build_object('ok', true);
end;
$$;

-- Invoked only after browser authentication. It binds an app-generated
-- challenge to the most recent active download session for this member and
-- returns a one-time authorization code. If the original web session expired,
-- a fresh authenticated setup is still useful and gets a first-run record.
create or replace function public.authorize_desktop_setup(
  p_platform text,
  p_release_version text,
  p_state text,
  p_challenge text
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  selected_id uuid;
  raw_code text;
begin
  if uid is null
    or p_platform <> 'mac'
    or p_state !~ '^[a-f0-9]{64}$'
    or p_challenge !~ '^[a-f0-9]{64}$'
    or p_release_version !~ '^[0-9]+\.[0-9]+\.[0-9]+([-+][A-Za-z0-9.-]+)?$' then
    return json_build_object('ok', false);
  end if;
  if not exists (
    select 1 from public.app_releases
    where published = true and version = p_release_version and coalesce(nullif(btrim(mac_url), ''), '') <> ''
  ) then
    return json_build_object('ok', false);
  end if;

  select id into selected_id
    from public.desktop_install_sessions
    where user_id = uid
      and platform = 'mac'
      and release_version = p_release_version
      and expires_at > now()
      and authorization_consumed_at is null
    order by created_at desc
    limit 1
    for update;

  if selected_id is null then
    insert into public.desktop_install_sessions (
      user_id, platform, release_version, source, session_hash, expires_at
    ) values (
      uid,
      'mac',
      p_release_version,
      'first-run-auth',
      encode(digest(encode(gen_random_bytes(32), 'hex'), 'sha256'), 'hex'),
      now() + interval '10 minutes'
    ) returning id into selected_id;
  end if;

  raw_code := encode(gen_random_bytes(32), 'hex');
  update public.desktop_install_sessions
    set state_hash = encode(digest(p_state, 'sha256'), 'hex'),
        challenge_hash = lower(p_challenge),
        authorization_code_hash = encode(digest(raw_code, 'sha256'), 'hex'),
        authorization_expires_at = now() + interval '2 minutes',
        authorized_at = now(),
        authorization_consumed_at = null
    where id = selected_id;

  return json_build_object('ok', true, 'code', raw_code);
end;
$$;

-- Redeems once from the Electron main process. The SHA-256 verifier check and
-- state check prevent a custom-protocol callback interceptor from using a code
-- alone. The UPDATE is atomic, so parallel replays cannot both succeed.
create or replace function public.redeem_desktop_setup_code(
  p_code text,
  p_verifier text,
  p_state text
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid;
  display_label text;
begin
  if p_code !~ '^[a-f0-9]{64}$'
    or p_verifier !~ '^[a-f0-9]{64}$'
    or p_state !~ '^[a-f0-9]{64}$' then
    return json_build_object('ok', false);
  end if;

  update public.desktop_install_sessions
    set authorization_consumed_at = now()
    where authorization_code_hash = encode(digest(lower(p_code), 'sha256'), 'hex')
      and state_hash = encode(digest(lower(p_state), 'sha256'), 'hex')
      and challenge_hash = encode(digest(lower(p_verifier), 'sha256'), 'hex')
      and authorization_expires_at > now()
      and authorization_consumed_at is null
    returning user_id into uid;

  if uid is null then
    return json_build_object('ok', false);
  end if;

  select coalesce(
    nullif(btrim(p.display_name), ''),
    (
      select nullif(btrim(m.gamertag), '')
      from public.members m
      where m.user_id = uid
      order by m.updated_at desc nulls last
      limit 1
    )
  ) into display_label
  from public.profiles p
  where p.id = uid;

  return json_build_object('ok', true, 'display_name', left(display_label, 80));
end;
$$;

revoke all on function public.create_desktop_download_session(text, text) from public;
revoke all on function public.authorize_desktop_setup(text, text, text, text) from public;
revoke all on function public.redeem_desktop_setup_code(text, text, text) from public;
grant execute on function public.create_desktop_download_session(text, text) to authenticated;
grant execute on function public.authorize_desktop_setup(text, text, text, text) to authenticated;
grant execute on function public.redeem_desktop_setup_code(text, text, text) to anon, authenticated;

comment on table public.desktop_install_sessions is
  'Short-lived opaque macOS setup records; retain only lifecycle hashes, no member contact data.';
