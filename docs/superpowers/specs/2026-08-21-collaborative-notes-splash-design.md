# Collaborative Notes, Attachments, and Refreshed App Look

## Goal

Make Team Notes a genuinely shared workspace: staff can attach tactical images,
teammates see updates promptly, and an active draft is never silently replaced
by someone else's save. Refresh the supplied wallpaper and splash branding at
the same time.

## Scope

- Add image attachments (PNG, JPEG, and WebP) to Team Notes. An image is copied
  into the team's data folder, stored as attachment metadata on the note, and
  uploaded through the existing `org-assets` backup path. Teammates resolve a
  missing local copy through the existing cloud fallback.
- Enrich notes with author, last editor, revision number, and a bounded change
  history. The composer auto-saves after a short pause and on explicit Save.
  Remote realtime updates refresh inactive notes; a note being edited instead
  receives a visible update notice and can reload the newer version rather than
  losing the local draft.
- Use the supplied splash background as splash-only art. Register supplied
  option backgrounds in the existing local profile wallpaper collection, and
  add a next-wallpaper action that cycles the complete collection.
- Replace the splash lockup/wordmark/slogan with the supplied transparent
  brand assets, preserving the current accessible image alternatives and the
  reduced-motion behaviour.
- Release as `1.5.0`.

## Approach

The implementation deliberately does not introduce a CRDT or cursor protocol.
The current desktop architecture has one shared JSON record per note and a
Supabase Realtime relay. It will use that foundation for collaborative drafting
with debounce saves, optimistic revisions, per-note remote-change notices, and
visible attribution. This supports practical collaborative editing without
silently clobbering a teammate's active draft.

Attachments reuse `copyImage`, `dataUrlForPath`, and storage backup. Note
records contain only small, relative-path metadata; binary files remain outside
the shared JSON payload and retain the existing download-on-miss behaviour.

## Components and Data Flow

1. The renderer opens the native image picker, copies selected files to
   `org/teams/<team>/data/note-images/<note>/`, and retains their relative
   paths in the composer.
2. Saving serializes the title, body, attachments, and expected revision over
   the existing note IPC channel. The data store increments the revision and
   stores a recent revision history. `main.js` backs up every attachment, then
   syncs the note through `shared_docs`.
3. Supabase Realtime triggers the existing renderer data refresh. The Notes
   section can distinguish its active local editor and surfaces a reload action
   when the remote revision is newer.
4. Background options remain local preferences. Splash art is bundled and
   never replaces a user-selected wallpaper after the splash exits.

## Failure Handling

- Cancelling a file picker does nothing; malformed or oversized attachment
  metadata is rejected in the data layer.
- Attachment cloud backup is best-effort, matching existing image behaviour;
  the local save remains usable offline.
- If a remote save races an active draft, the draft remains intact and the user
  explicitly chooses when to reload the newer copy.
- Missing supplied logo files never result in a blank splash: the existing
  bundled lockup remains as the safe fallback until an approved source is
  available.

## Verification

- Extend data-store and background tests for attachments, revision evolution,
  wallpaper registration/cycling, and asset validity.
- Run the full unit suite plus UI and interaction verification.
- Inspect the splash and Team Notes in the Electron app where available.
