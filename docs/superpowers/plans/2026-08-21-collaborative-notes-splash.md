# Collaborative Notes and Splash Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship shared Team Note image attachments and safe collaborative drafting, then apply the supplied wallpapers and Coach Intel splash assets in release `0.9.6`.

**Architecture:** Note JSON remains the local working copy and `shared_docs` remains the shared metadata source. Attachments use team-scoped relative paths and the existing asset bucket fallback. A note renderer keeps an active draft in place when Supabase reports a remote change, while other note screens refresh normally. Splash-only art is a separate static layer so profile wallpaper preferences remain intact after boot.

**Tech Stack:** Electron 33, vanilla ES modules, CommonJS main process, Node test runner, Supabase Realtime and Storage, CSS.

## Global Constraints

- Preserve existing user changes, including `Identity/ChatGPT Image Aug 19, 2026 at 02_50_48 PM.png`, which is already deleted in the worktree.
- Do not add a CRDT, a dependency, or online-only storage; offline note saves must continue to work.
- Accept only PNG, JPG/JPEG, and WebP note attachments; metadata stores relative paths, never image bytes.
- Keep the app splash background fixed to `splash_bg.png`; wallpaper selection and cycling remain local per Mac.
- Use the supplied `ci_logo_styled.png`, `ci_wordmark_styled.png`, and `slogan_styled1.png` unmodified as the splash brand assets.
- Set `package.json` and the static splash fallback to version `0.9.6`.

---

### Task 1: Persist note attachment and collaboration metadata

**Files:**
- Modify: `src/main/dataStore.js:585-625`
- Modify: `src/main/main.js:702-710,929-950`
- Modify: `src/main/preload.js:33-35`
- Test: `tests/dataStore-crud.test.js`

**Interfaces:**
- Consumes: `copyImage(sourcePath, destRelative) -> Promise<string>`, `syncAssetToCloud(relative) -> Promise<void>`.
- Produces: `saveNote(teamId, note) -> Promise<NoteRecord>` and `window.cci.attachNoteImage(teamId, noteId, sourcePath) -> Promise<Attachment>`.
- `NoteRecord` gains `attachments: Attachment[]`, `revision: number`, `updated_by: string`, and `history: NoteRevision[]`.
- `Attachment` is `{ id: string, path: string, name: string, mime: string }`.
- A stale `expected_revision` rejects with `NOTE_CONFLICT` and leaves the stored note unchanged.

- [ ] **Step 1: Write the failing data-store tests**

  Add these tests to `tests/dataStore-crud.test.js` after the existing note CRUD assertion:

  ```js
  const attachmentPath = `org/teams/${team.id}/data/note-images/note/map.png`;
  const first = await store.saveNote(team.id, {
    title: 'Attachment note', body: 'v1', author: 'Naevii',
    attachments: [{ id: 'map-1', path: attachmentPath, name: 'map.png', mime: 'image/png' }],
  });
  assert.equal(first.revision, 1);
  assert.equal(first.updated_by, 'Naevii');
  assert.deepEqual(first.attachments.map((item) => item.name), ['map.png']);

  const revised = await store.saveNote(team.id, {
    note_id: first.note_id, title: first.title, body: 'v2', author: 'Coach', expected_revision: 1,
  });
  assert.equal(revised.revision, 2);
  assert.equal(revised.updated_by, 'Coach');
  assert.equal(revised.history.length, 1);
  await assert.rejects(
    () => store.saveNote(team.id, { note_id: first.note_id, title: first.title, body: 'stale', expected_revision: 1 }),
    (err) => err.code === 'NOTE_CONFLICT'
  );
  ```

- [ ] **Step 2: Run the focused test and verify the missing fields fail**

  Run: `node --test tests/dataStore-crud.test.js`

  Expected: FAIL because `revision` and `updated_by` are undefined and the stale save does not reject.

- [ ] **Step 3: Implement sanitizers and optimistic note records**

  In `src/main/dataStore.js`, define `NOTE_IMAGE_EXTENSIONS`, `sanitizeNoteAttachments`, and `sanitizeNoteHistory` directly above `getNotes`. Keep at most six history rows, accept only paths under `org/teams/<teamId>/data/note-images/`, cap attachments at eight, and preserve attachment data when an edit does not pass `attachments`. Replace the save body with the following shape:

  ```js
  const expected = note.expected_revision;
  if (existing && expected !== undefined && Number(expected) !== Number(existing.revision || 1)) {
    const err = new Error('This note changed while you were editing it. Reload the newer version before saving.');
    err.code = 'NOTE_CONFLICT';
    throw err;
  }
  const revision = Number(existing?.revision || 0) + 1;
  const history = existing
    ? [{ revision: existing.revision || 1, title: existing.title, body: existing.body, updated_by: existing.updated_by || existing.author || 'Coach', updated_at: existing.updated_at }, ...(existing.history || [])].slice(0, 6)
    : [];
  const record = {
    note_id: id,
    title: String(note.title || existing?.title || 'Untitled note').slice(0, 160),
    body: String(note.body !== undefined ? note.body : existing?.body || '').slice(0, 12000),
    tag: String(note.tag || existing?.tag || 'General').slice(0, 40),
    author: String(existing?.author || note.author || 'Coach').slice(0, 120),
    updated_by: String(note.author || existing?.updated_by || existing?.author || 'Coach').slice(0, 120),
    attachments: sanitizeNoteAttachments(teamId, note.attachments, existing?.attachments),
    revision,
    history,
    team_id: teamId,
    links: normalizeLinks(note.links, existing?.links),
    created_at: existing?.created_at || now,
    updated_at: now,
  };
  ```

- [ ] **Step 4: Add a note-attachment IPC operation**

  In `src/main/main.js`, add `cci:attachNoteImage` beside `cci:copyImage`. It must accept `(teamId, noteId, sourcePath)`, validate both IDs with the data-store save path, copy to `org/teams/${teamId}/data/note-images/${noteId}/${crypto.randomUUID()}${path.extname(sourcePath).toLowerCase()}`, start `syncAssetToCloud(relative)` without awaiting it, and return `{ id, path: relative, name: path.basename(sourcePath).slice(0, 160), mime }`. Expose it in `src/main/preload.js` as `attachNoteImage(teamId, noteId, sourcePath)`.

- [ ] **Step 5: Run the focused test and commit the persistence slice**

  Run: `node --test tests/dataStore-crud.test.js`

  Expected: PASS.

  ```bash
  git add src/main/dataStore.js src/main/main.js src/main/preload.js tests/dataStore-crud.test.js
  git commit -m "feat: persist shared note attachments and revisions"
  ```

### Task 2: Build Team Notes attachment and collaboration UI

**Files:**
- Modify: `src/renderer/pages/teamHub/sections/notes.js`
- Modify: `src/renderer/app.js:223-236`
- Modify: `src/renderer/styles.css` (note card and composer classes)

**Interfaces:**
- Consumes: `window.cci.attachNoteImage(teamId, noteId, sourcePath)`, `window.cci.saveNote(teamId, payload)`, `window.cci.dataUrlForPath(relative)`, and the cancelable `cci:remote-data-change` DOM event.
- Produces: a composer with debounced saves, removeable attachment thumbnails, `Reload newer version`, and visible author/revision attribution.
- The app-level realtime handler dispatches `new CustomEvent('cci:remote-data-change', { cancelable: true, detail: payload })` before rebuilding the current route. When the event is prevented, it must still reload shell and notification data but not call `renderContent()`.

- [ ] **Step 1: Write a renderer-contract test**

  Create `tests/notesSource.test.js` that reads `notes.js` and `app.js`, and asserts these durable contracts:

  ```js
  assert.match(notes, /attachNoteImage/);
  assert.match(notes, /Reload newer version/);
  assert.match(notes, /updated_by/);
  assert.match(notes, /debounceSave/);
  assert.match(app, /cci:remote-data-change/);
  assert.match(app, /event\.defaultPrevented/);
  ```

- [ ] **Step 2: Run the test and verify it fails**

  Run: `node --test tests/notesSource.test.js`

  Expected: FAIL because the current Notes section has none of the attachment or remote-draft behavior.

- [ ] **Step 3: Update the realtime refresh boundary**

  In `src/renderer/app.js`, replace the unconditional `onDataChanged` body with a handler that dispatches the cancelable event immediately, stores `const deferContent = event.defaultPrevented`, then calls `loadShellData()`. Preserve `renderSidebar()` and `renderStatusBar()`; call `renderContent()` only when `!deferContent`. Keep the existing notification refresh unchanged.

- [ ] **Step 4: Replace the note composer with an attachment-aware live draft**

  In `notes.js`, retain one `AbortController` per rendered section. On each composer open:

  ```js
  const editor = { note: note ? { ...note } : null, attachments: [...(note?.attachments || [])], dirty: false, saving: false, remote: null, timer: 0 };
  const debounceSave = () => {
    clearTimeout(editor.timer);
    if (!title.value.trim()) return;
    editor.timer = setTimeout(() => persist({ quiet: true }), 900);
  };
  ```

  Add an `Attach image` button. It calls `pickImage()`, generates a temporary note ID with `crypto.randomUUID()` for new notes, invokes `attachNoteImage`, appends an image preview created through `dataUrlForPath`, and calls `debounceSave()`. Add a remove button per attachment that only changes the pending metadata; copied files may remain as harmless local cache.

  Send `{ note_id, title, body, tag, attachments, author: chipIdentity(hub.org, hub.access).name, expected_revision: editor.note?.revision }` to `saveNote`. After any successful save, replace `editor.note` with the returned note, clear `dirty`, update the autosave status, and refresh the list and rail. On `NOTE_CONFLICT`, retain all local fields and display the error with a `Reload newer version` button that repopulates title, tag, body, and attachment thumbnails from `editor.remote`.

  Listen for `cci:remote-data-change` while the editor is open. For `detail.table === 'shared_docs'`, fetch the latest notes, find the same note ID, and, when its revision is higher, assign `editor.remote`, reveal the reload button, and call `event.preventDefault()` while `editor.dirty` is true. Do not suppress refresh when no active dirty editor exists. Abort this listener before each new section render.

  In the note list, load attachment thumbnails with `dataUrlForPath`, display `Updated by ${note.updated_by || note.author || 'Coach'} · v${note.revision || 1} · ${fmtStamp(note.updated_at)}`, and use text alternatives for any failed image.

- [ ] **Step 5: Add scoped presentation styles**

  Add `.note-composer-status`, `.note-remote-notice`, `.note-attachments`, `.note-attachment`, `.note-attachment img`, and `.note-byline` to `styles.css`. The attachment grid must use `grid-template-columns:repeat(auto-fill,minmax(124px,1fr))`; thumbnails must be `aspect-ratio:16/10`, `object-fit:cover`, and retain the existing panel border/radius variables. Ensure the status and reload control wrap at narrow widths.

- [ ] **Step 6: Run the renderer-contract test and commit**

  Run: `node --test tests/notesSource.test.js`

  Expected: PASS.

  ```bash
  git add src/renderer/app.js src/renderer/pages/teamHub/sections/notes.js src/renderer/styles.css tests/notesSource.test.js
  git commit -m "feat: add collaborative team note drafting"
  ```

### Task 3: Install and register supplied wallpaper art

**Files:**
- Create: `src/renderer/assets/backgrounds/command-ring.png`
- Create: `src/renderer/assets/backgrounds/blackout.png`
- Create: `src/renderer/assets/backgrounds/prism.png`
- Create: `src/renderer/assets/backgrounds/vector.png`
- Create: `src/renderer/assets/backgrounds/strata.png`
- Create: `src/renderer/assets/backgrounds/hex-front.png`
- Create: `src/renderer/assets/backgrounds/orbit.png`
- Modify: `src/renderer/lib/background.js`
- Modify: `src/renderer/pages/settings/sections/profile.js`
- Modify: `tests/background.test.js`

**Interfaces:**
- Consumes: background image sources `bg_ci_option3.png` through `bg_ci_option9.png` supplied in `/Users/Ion/Downloads/`.
- Produces: `nextBackground(id) -> string`, with each accepted option registered in `BACKGROUND_OPTIONS`.

- [ ] **Step 1: Extend the wallpaper tests**

  In `tests/background.test.js`, assert that all IDs are registered and cycling wraps:

  ```js
  const { BACKGROUND_OPTIONS, nextBackground } = await import(libUrl);
  assert.deepEqual(BACKGROUND_OPTIONS.map((opt) => opt.id), ['pit', 'hex', 'lattice', 'command-ring', 'blackout', 'prism', 'vector', 'strata', 'hex-front', 'orbit']);
  assert.equal(nextBackground('pit'), 'hex');
  assert.equal(nextBackground('orbit'), 'pit');
  ```

  Extend the PNG validation loop so every non-`pit` option resolves to a real asset.

- [ ] **Step 2: Run the test and verify it fails**

  Run: `node --test tests/background.test.js`

  Expected: FAIL because the new wallpaper IDs and `nextBackground` do not exist.

- [ ] **Step 3: Copy the supplied assets without re-encoding them**

  Run:

  ```bash
  cp /Users/Ion/Downloads/bg_ci_option3.png src/renderer/assets/backgrounds/command-ring.png
  cp /Users/Ion/Downloads/bg_ci_option4.png src/renderer/assets/backgrounds/blackout.png
  cp /Users/Ion/Downloads/bg_ci_option5.png src/renderer/assets/backgrounds/prism.png
  cp /Users/Ion/Downloads/bg_ci_option6.png src/renderer/assets/backgrounds/vector.png
  cp /Users/Ion/Downloads/bg_ci_option7.png src/renderer/assets/backgrounds/strata.png
  cp /Users/Ion/Downloads/bg_ci_option8.png src/renderer/assets/backgrounds/hex-front.png
  cp /Users/Ion/Downloads/bg_ci_option9.png src/renderer/assets/backgrounds/orbit.png
  ```

- [ ] **Step 4: Register backgrounds and add a next-wallpaper control**

  In `background.js`, add the seven named options after `lattice`, with `zoom` values in `[1.08, 1.32]`, then export:

  ```js
  export function nextBackground(id) {
    const current = resolveBackground(id);
    const index = BACKGROUND_OPTIONS.findIndex((option) => option.id === current);
    return BACKGROUND_OPTIONS[(index + 1) % BACKGROUND_OPTIONS.length].id;
  }
  ```

  In `profile.js`, import `nextBackground` and add a `Next background` subtle button above the existing `.bg-picker`. Its handler calls existing `pick(nextBackground(applyBackground(getPref('background', DEFAULT_BACKGROUND))))`, so it persists locally and updates the active card.

- [ ] **Step 5: Run the background test and commit**

  Run: `node --test tests/background.test.js`

  Expected: PASS.

  ```bash
  git add src/renderer/assets/backgrounds src/renderer/lib/background.js src/renderer/pages/settings/sections/profile.js tests/background.test.js
  git commit -m "feat: add supplied wallpapers to the background cycle"
  ```

### Task 4: Replace splash art and brand lockup

**Files:**
- Create: `src/renderer/assets/splash-background.png`
- Create: `src/renderer/assets/splash-logo.png`
- Create: `src/renderer/assets/splash-wordmark.png`
- Create: `src/renderer/assets/splash-slogan.png`
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/styles.css:181-610`
- Test: `tests/splashAssets.test.js`

**Interfaces:**
- Consumes: `Identity/ci_logo_styled.png`, `Identity/ci_wordmark_styled.png`, `Identity/slogan_styled1.png`, and the supplied `/Users/Ion/Downloads/splash_bg.png`.
- Produces: a semantic splash group containing the CI logo, Coach Intel wordmark, and slogan; the existing `.splash-logo` remains the handoff animation target.

- [ ] **Step 1: Write the splash asset contract test**

  Create `tests/splashAssets.test.js` to assert all four PNGs use the PNG magic bytes and that the HTML references `splash-background.png`, `splash-logo.png`, `splash-wordmark.png`, and `splash-slogan.png`. It must also assert the splash image alternatives are `Coach Intel logo`, `Coach Intel`, and `Competitive Intelligence for Call of Duty`.

- [ ] **Step 2: Run the test and verify it fails**

  Run: `node --test tests/splashAssets.test.js`

  Expected: FAIL because the new asset files and markup are missing.

- [ ] **Step 3: Copy supplied splash assets into the packaged renderer**

  Run:

  ```bash
  cp /Users/Ion/Downloads/splash_bg.png src/renderer/assets/splash-background.png
  cp Identity/ci_logo_styled.png src/renderer/assets/splash-logo.png
  cp Identity/ci_wordmark_styled.png src/renderer/assets/splash-wordmark.png
  cp Identity/slogan_styled1.png src/renderer/assets/splash-slogan.png
  ```

- [ ] **Step 4: Render the new splash composition**

  In `index.html`, add a `.splash-background` image inside `#splash` and make `.splash-stage` contain:

  ```html
  <div class="splash-logo" aria-label="Coach Intel">
    <img class="splash-logo-mark" src="cci-asset://static/splash-logo.png" alt="Coach Intel logo" draggable="false" />
    <img class="splash-wordmark" src="cci-asset://static/splash-wordmark.png" alt="Coach Intel" draggable="false" />
    <img class="splash-slogan" src="cci-asset://static/splash-slogan.png" alt="Competitive Intelligence for Call of Duty" draggable="false" />
  </div>
  ```

  Keep `.splash-logo` as the direct animated handoff element in `app.js`; the individual images are children only. Update splash CSS so the fixed background covers the viewport with a dark `linear-gradient` overlay, the 1:1 CI mark is above the wordmark, and the slogan is constrained to `min(520px, 72vw)`. Apply `object-fit:contain`, preserve reduced motion, and avoid filters that change supplied art colors.

- [ ] **Step 5: Run the splash asset test and commit**

  Run: `node --test tests/splashAssets.test.js`

  Expected: PASS.

  ```bash
  git add src/renderer/assets/splash-background.png src/renderer/assets/splash-logo.png src/renderer/assets/splash-wordmark.png src/renderer/assets/splash-slogan.png src/renderer/index.html src/renderer/styles.css tests/splashAssets.test.js
  git commit -m "feat: refresh splash background and branding"
  ```

### Task 5: Bump release metadata and verify the complete bundle

**Files:**
- Modify: `package.json:4`
- Modify: `src/renderer/index.html:7,36`
- Modify: `src/renderer/pages/settings/sections/about.js:18`
- Test: `tests/version.test.js`

**Interfaces:**
- Consumes: `package.json.version`.
- Produces: Electron `app.getVersion()`, the static splash fallback, and the About fallback all presenting `0.9.6`.

- [ ] **Step 1: Write a version consistency test**

  Create `tests/version.test.js`:

  ```js
  const pkg = require('../package.json');
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
  const about = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'pages', 'settings', 'sections', 'about.js'), 'utf8');
  assert.equal(pkg.version, '0.9.6');
  assert.match(html, /Version 0\.9\.6/);
  assert.match(about, /0\.9\.6/);
  ```

- [ ] **Step 2: Run the test and verify it fails**

  Run: `node --test tests/version.test.js`

  Expected: FAIL because the project still declares `0.9.5`.

- [ ] **Step 3: Bump package and renderer fallbacks**

  Set `package.json.version` to `0.9.6`, update the static splash fallback to `Version 0.9.6`, update the About fallback to `0.9.6`, and change the styles query string in `index.html` to `styles.css?v=20260821-v096`.

- [ ] **Step 4: Run targeted and full automated verification**

  Run:

  ```bash
  node --test tests/dataStore-crud.test.js tests/notesSource.test.js tests/background.test.js tests/splashAssets.test.js tests/version.test.js
  npm test
  npm run verify:ui
  npm run verify:interaction
  ```

  Expected: all commands exit `0`.

- [ ] **Step 5: Commit the release metadata**

  ```bash
  git add package.json src/renderer/index.html src/renderer/pages/settings/sections/about.js tests/version.test.js
  git commit -m "chore: release coach intel 0.9.6"
  ```

## Self-Review

- **Spec coverage:** Task 1 stores and synchronizes attachment data, Task 2 provides the collaborative draft/remote-conflict workflow, Task 3 covers backgrounds and a cycle control, Task 4 covers all supplied splash assets, and Task 5 covers the version and complete verification.
- **Placeholder scan:** Every task names exact files, interfaces, code shape, commands, and expected outcome; no deferred work or ambiguous implementation language remains.
- **Type consistency:** Task 1 defines `Attachment`, `NoteRecord`, `expected_revision`, and `attachNoteImage`; Task 2 uses the same names and expected revision behavior. Tasks 3–5 use only exported functions and static file paths introduced within their respective tasks.
