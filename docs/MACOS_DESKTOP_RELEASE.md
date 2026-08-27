# Coach Intel macOS desktop release

Coach Intel packages its existing Electron desktop app for macOS; it does not reimplement the separate Next.js web app. The signed universal release contains the same local renderer, Supabase services, Discord integration, realtime subscriptions, and system-browser OAuth used by the Windows desktop app.

## Artifacts and install flow

- `Coach-Intel-{version}-macOS.dmg` — branded member download.
- `Coach-Intel-{version}-macOS.zip` — signed updater payload.
- `latest-mac.yml` and `Coach-Intel-{version}-macOS.SHA256` — updater metadata and checksums.

The root `package.json` is authoritative, currently `3.9.0`. Release artifacts are immutable and never personalized per member.

1. A signed-in member chooses **Settings → CI Desktop → Download for Mac**.
2. The site creates a short-lived, server-side installation session, then downloads the standard DMG. Its filename, contents, URL, and Finder metadata contain no name or token.
3. The member drags **Coach Intel** to **Applications** from the branded Finder volume. The volume provides the official icon, Coach Intel artwork, an Applications alias, and `Install Coach Intel.txt`.
4. On first launch from Applications, the signed app shows a clearly labelled **Coach Intel setup** page; it is not represented as an Apple Installer page.
5. Setup opens a brief HTTPS Coach Intel/Discord authorization in the default browser. It receives a one-time `coachintel://setup` callback and redeems it only in the Electron main process.

Personalized setup after the app is copied uses:

```
Welcome to Coach Intel, {memberName}

Thank you for downloading Coach Intel, {memberName}. Prepare smarter, improve your strategy and take your game to the next level.

Click Continue to complete setup and get started.
```

Offline, expired, replayed, or malformed setup authorization remains usable with:

```
Welcome to Coach Intel

Thank you for downloading Coach Intel. Prepare smarter, improve your strategy and take your game to the next level.

Click Continue to complete setup and get started.
```

Only a local completion preference is stored. The name, code, verifier, Supabase session, and refresh token are not persisted. Existing `userData` stays outside the app bundle, preserving local data and preferences through upgrades.

## Secure personalization contract

Implementation: `web/app/api/desktop-download-sessions/route.js`, `web/app/desktop/setup/route.js`, `web/app/api/desktop-setup/redeem/route.js`, `src/main/desktopSetup.js`, and `scripts/supabase/desktop-install-sessions.sql`.

The SQL migration is additive but deliberately un-applied. A human must review and apply it in the Coach Intel Supabase SQL editor, never in the Championship Series project.

The website creates a session from authenticated `auth.uid()` and server-selected release metadata. The app keeps fresh 32-byte state/verifier values in memory and sends only a SHA-256 challenge to the existing Coach Intel HTTPS origin. The backend binds the member, returns a 32-byte one-time code, and the main process validates the exact callback host/parameters plus a constant-time state match before HTTPS redemption.

The atomic database redemption returns only `profiles.display_name`, falling back to linked `members.gamertag`. It returns no email, Discord username, database ID, release URL, JWT, or refresh token. Sessions expire after 10 minutes, authorization codes after 2 minutes, and the table stores hashes rather than raw secrets. Finder attributes, DMG query strings, and filenames are deliberately not token channels.

## OAuth and Electron security

Keep the existing `coachintel://auth-callback` desktop redirect in Supabase Authentication → URL Configuration. The new `coachintel://setup` is a one-time app callback, not a Supabase redirect.

Electron uses `contextIsolation: true`, `nodeIntegration: false`, renderer sandboxing, an allowlisted preload bridge, no webviews, denied renderer navigations/popups, system-browser external links, and a native macOS app menu. Auth IPC exposes only an authenticated boolean. Tokens stay in the main process and use Electron `safeStorage`/macOS Keychain. Packaged builds refuse plaintext fallback when Keychain is unavailable; the 0600 fallback is explicitly unsigned-development-only.

Coach Intel has no microphone capture feature today, so it requests no runtime microphone permission and denies renderer permission requests. The app Info description is present for a future explicitly reviewed audio coaching feature.

## Development, signing, and release

```sh
npm ci
cd web && npm ci

npm test
npm run verify:version
cd web && npm run build
npm run dist:mac:dev
```

`npm run dist:mac:dev` creates unsigned universal DMG/ZIP artifacts in `dist/` and never copies an app to `/Applications`. It is not an official installer. A signed release uses `npm run release:mac`; CI then runs `npm run verify:mac:release -- "dist/mac-universal/Coach Intel.app" "dist/Coach-Intel-{version}-macOS.dmg"`. This verifies signing, Gatekeeper, stapling, and a DMG mount without installing the app; it intentionally fails for unsigned builds.

`.github/workflows/release.yml` runs on macOS and publishes only after tests, production web build, signing, notarization, stapling, Gatekeeper assessment, DMG mount verification, and checksum generation. The Windows NSIS release remains coordinated with it.

Required protected GitHub secrets: `CSC_LINK` (Developer ID Application certificate/P12), `CSC_KEY_PASSWORD`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, and `APPLE_API_KEY_P8`. The private API key is written only to runner temporary storage. The existing bundle ID is `com.naevii.coachintel`; Apple Team ID and certificate subject are intentionally not invented and must come from the Coach Intel Apple Developer account.

CI uses hardened-runtime entitlements, App Store Connect API-key notarization, app/DMG stapling, `codesign --verify --deep --strict --verbose=2`, and `spctl --assess --type execute --verbose=4`. After GitHub publication, an authorized release manager must add the published DMG URL to the matching Coach Intel `app_releases` row; that database publication is manual and gated.

## Architectures, updates, and uninstall

The universal macOS artifact supports Apple Silicon (`arm64`) and Intel (`x64`) on macOS 11+. Its signed ZIP and `latest-mac.yml` support `electron-updater`, which checks only in packaged Windows/macOS apps.

To uninstall, quit Coach Intel, move `Coach Intel.app` from Applications to Trash, and empty Trash if desired. Cloud data remains untouched. Delete the Coach Intel directory under `~/Library/Application Support/` only after backup if local offline data must also be removed.
