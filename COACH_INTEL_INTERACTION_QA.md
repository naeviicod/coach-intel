# Coach Intel — Interaction QA

Date: 2026-08-17  
Method: Live Electron pass (`npm run verify:interaction`) plus UI smoke (`npm run verify:ui`). Isolated QA data only. Production roster/strats were not touched.

## Final Status

**Interaction Health: 92/100**

Every reachable control that was clicked performed its action after the fixes below. Remaining points are intentional placeholders and OS-native dialogs that cannot be completed in a headless harness.

## Coverage

### Screens tested (21)

Dashboard, Intel Feed, Calendar, Tasks, Teams, Players, Matches, Statistics, Database, Reports, Rankings, Team Hub (Overview / Roster / Notes / Objectives / Veto / Practice / Settings), Strats & Playbooks, Scrim Hub, VOD Library, Needs Review, Veto Lab, Maps & Modes, Scouting, Integrations, Settings (Organization / Game Rules / Integrations / Team Access / Data / About), Teach, Sign-in.

### Controls tested (~724 visible on the pass)

Nav items, sidebar collapse, bell, help, profile chip, global search, settings rail, hub rail, filter chips, mode chips, database search, Discord connect/cancel, Delete All Data confirm/cancel, CRUD buttons, modal save/cancel, strat save/delete, veto save.

### Workflows tested

Authentication gate, full navigation, search, sidebar collapse, Tasks / Notes / Objectives CRUD, Team CRUD, Player CRUD, Calendar event, Scrim, VOD, Scouting, Rankings, Match log, Strat create/delete, Veto save, filters/search empty states, Settings sections, Discord setup, destructive-action gating.

## Issues Found

### 1. Match Log hid the opponent
- **Location:** Matches
- **Control:** Match table
- **Expected:** Logged opponent is visible in the list
- **Actual:** Table had Date / Team / Mode / Map / Score / Result only
- **Severity:** Major
- **Root cause:** List columns never included `opponent`
- **Fix:** Added an Opponent column. Retested: create/read/delete of `QA_AUDIT_MatchOpp` passed.

### 2. Empty team name failed silently
- **Location:** Teams → Add/Edit Team
- **Control:** Save
- **Expected:** Validation feedback
- **Actual:** Modal stayed open with no message
- **Severity:** Minor
- **Root cause:** `if (!name) return` with no toast
- **Fix:** Error toast + focus. Retested: empty save keeps the modal open.

### 3. Empty player gamertag failed silently
- **Location:** Players → Add/Edit Player
- **Control:** Save
- **Expected:** Validation feedback
- **Actual:** Same silent return
- **Severity:** Minor
- **Root cause:** `if (!gamertag) return`
- **Fix:** Error toast + focus. Retested.

### 4. Task / note / objective Add could double-submit
- **Location:** Tasks, Team Notes, Objectives
- **Control:** Add / Save
- **Expected:** One record per click
- **Actual:** Two saves a few ms apart created two records
- **Severity:** Major
- **Root cause:** Composer save did not disable the button; store ids include `Date.now()`
- **Fix:** Disable the button for the in-flight save and surface errors. Store contract covered by `tests/dataStore-crud.test.js`.

### 5. UI smoke harness stuck on sign-in
- **Location:** `npm run verify:ui`
- **Control:** App boot
- **Expected:** Smoke reaches the shell
- **Actual:** Missing `cci:authGetState` made the app treat boot as a Discord gate
- **Severity:** Major (test-only)
- **Root cause:** Harness IPC lagged the auth boot path
- **Fix:** Stub auth, isolate QA data, stub `setTrafficLights`, assert current Team Hub / Game Rules copy. Smoke now passes.

## Remaining Issues

- **Teach Coach Intel** (help button): reachable Phase 2 placeholder. Not a dead button; the page honestly says it is not built.
- **Discord Role Mapping:** labeled “Not Available Yet” on purpose.
- **Breaking Point:** shown as not connected, with no fake Set Up button.
- **Native file pickers** (logo, photo, scoreboard import): open the OS dialog. Not completable in headless QA; handlers are wired.
- **Live Discord OAuth / Sign out:** Sign-in button was proven to report success/failure. A real Discord session was not used, so live guild connect and Sign out were not exercised against production auth.

## Verification

- Build: **N/A** (no compile step; app is Electron + vanilla JS). Electron load: **PASS** via `verify:ui` and `verify:interaction`.
- Tests: **PASS** (175/175)
- Typecheck: **N/A** (no TypeScript / `tsc`)
- Lint: **N/A** (no lint script)
- Console: **CLEAN** on the interaction pass (no renderer errors after harness IPC stubs)
- Critical buttons: **PASS**
- CRUD: **PASS** (QA records created, updated, deleted, cleaned up)
- Navigation: **PASS** (21 routes + hub rail + settings rail)
