-- Coach Intel website — public download metadata.
-- Run once in the Supabase SQL editor (project -> SQL Editor -> New query).
-- Does not replace schema.sql; this only adds the releases table the site reads.
--
-- Installer files stay on GitHub Releases (or Storage). This table stores URLs.
-- Insert / update rows in Table Editor. The anon key can only SELECT.

create table if not exists public.app_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  notes text,
  mac_url text,
  windows_url text,
  published boolean not null default true,
  published_at timestamptz not null default now()
);

comment on table public.app_releases is
  'Latest Coach Intel installers shown on coach.championshipseries.eu';

alter table public.app_releases enable row level security;

drop policy if exists "anyone can read published releases" on public.app_releases;
create policy "anyone can read published releases"
  on public.app_releases for select
  to anon, authenticated
  using (published = true);

-- After a GitHub Release exists, add a row (edit the URLs to match the assets):
-- insert into public.app_releases (version, mac_url, windows_url)
-- values (
--   '1.5.4',
--   'https://github.com/naeviicod/coach-intel/releases/download/v1.5.4/Coach-Intel-1.5.4-mac.zip',
--   'https://github.com/naeviicod/coach-intel/releases/download/v1.5.4/Coach-Intel-Setup-1.5.4.exe'
-- );
