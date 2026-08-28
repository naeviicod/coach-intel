# Changelog

## Current Version: 3.9.2

## 3.9.2 — 2026-08-28

- Fixed the Settings screen loading slowly: Profile, About, and Team Access were awaiting independent backend calls one after another instead of together, and the Team Access roster query made three sequential Supabase round trips where two would do.
- Rebuilt Members Add/Edit on the web as a real popup matching the desktop app's layout: photo picker, Org Role, In-Game Role, Lineup, OCR aliases, and Socials & Gaming IDs, instead of a bare inline form.
- Fixed the "Bench" tag showing on every player regardless of their actual lineup slot.
- Added the ability to disable a member without deleting them.
- Cached member and team photos instead of re-reading them on every render.
- Fixed the splash screen's loading bar pulsing its size instead of just its brightness.

## 3.9.1 — 2026-08-27

- Added a personalized Welcome page to the Windows installer: it greets whoever is installing by their actual Windows account name and carries Coach Intel branding in the wizard sidebar, instead of jumping straight to the installation-options screen.

## 3.9.0 — 2026-08-27

- Added universal macOS packaging for the existing Coach Intel Electron app: branded DMG, signed update ZIP, hardened runtime, entitlements, notarization configuration, Gatekeeper validation, and release checksums.
- Added a native macOS-first install path: drag the immutable Coach Intel app to Applications, then complete a clearly labelled Coach Intel first-run setup screen.
- Added a short-lived, single-use browser-to-app setup authorization contract that returns only the member display name and has generic offline/expired-session fallback.
- Hardened Electron navigation, popup, permission, sandbox, auth IPC, and production Keychain behavior.

## 3.8.0 — Existing release

- Previous Coach Intel desktop and web release.
