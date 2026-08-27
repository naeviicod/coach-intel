# Coach Intel site

Next.js app for `https://coach.championshipseries.eu/`.

## Vercel

1. Import the `naeviicod/coach-intel` GitHub repo.
2. Framework Preset: **Next.js**
3. Root Directory: **web** (not `./`)
4. Add the two variables from `.env.example`.
5. Deploy, then add domain `coach.championshipseries.eu`.

Commits must be authored as **naeviicod** or Hobby will block the deploy.

## Supabase (Coach Intel project only)

Use the **Coach Intel** Supabase project (`buzqhwoaoiyeqkvmsghm`) — the same one the desktop app uses. Do **not** point this site at the Championship Series / ECS database.

Authentication → URL Configuration. **Site URL** must be `https://coach.championshipseries.eu` (not localhost). Redirect URLs must match exactly (no `?next=` query). Add:

- `https://coach.championshipseries.eu/auth/callback`
- `https://coach-intel.vercel.app/auth/callback`
- `http://localhost:3000/auth/callback`

Keep the existing `coachintel://auth-callback` URL for the desktop app.

Org sign-in alias: `https://coach.championshipseries.eu/join`. Per-player invites are `https://coach.championshipseries.eu/join/<gamertag>/<token>` (old `/join/<token>` and `/invite/<token>` URLs still work). Copy them from a team roster on the site, or Players → Invite in the desktop app.

Local preview: `cd web && npm install && npm run dev`.

## Desktop downloads

The authenticated **Settings → CI Desktop** section reads published release
metadata from `app_releases`. macOS downloads use a stable, signed DMG filename;
they are never rebuilt or renamed per member. Before using the personalized
first-run flow in production, an authorized database owner must review and
apply `../scripts/supabase/desktop-install-sessions.sql`. See
`../docs/MACOS_DESKTOP_RELEASE.md` for the browser-to-app authorization
contract, release setup, and required CI secrets.
