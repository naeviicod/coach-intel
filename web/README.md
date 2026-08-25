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

Authentication → URL Configuration. Redirect URLs must match exactly (no `?next=` query). Add:

- `https://coach.championshipseries.eu/auth/callback`
- `https://coach-intel.vercel.app/auth/callback`
- `http://localhost:3000/auth/callback`

Keep the existing `coachintel://auth-callback` URL for the desktop app.

Invite links copied in the desktop app now open `https://coach.championshipseries.eu/invite/<token>`. Teammates sign in with Discord in the browser.

Local preview: `cd web && npm install && npm run dev`.
