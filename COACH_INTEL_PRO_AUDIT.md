# Coach Intel — Professional Coaching Audit

**Scope:** Full repository inspection (committed + in-progress uncommitted work). No code was changed to produce this document. Every claim below is grounded in a specific file:line or a cited external source — nothing is assumed missing without being searched for, and no map/objective data is invented anywhere in this document.

---

## Executive Summary

Coach Intel is considerably more built than a first glance at the working tree suggests. Underneath an in-progress Supabase migration and a Strats→Playbooks refactor sits a genuinely mature Electron app: ~30 renderer pages, a real 4v4 tactical whiteboard, a security-hardened Discord integration with its own static-analysis test suite, and a codebase that repeatedly — and unusually — refuses to fabricate data when it doesn't have any (see §Existing Strengths). The visual identity is implemented almost to the hex value against the brand spec.

But the product has one structural hole that undermines everything downstream of it: **there is no way to get a completed match's result into the app.** `getMatches` exists; `saveMatch` does not, at any layer (renderer, IPC, main process, or disk). Match Log, Reports, Scouting head-to-head, and season form are all well-built *consumers* of data that currently has no *producer*. This single gap is why "competitive intelligence," "analytics," and "match preparation" score lower below than the quality of the surrounding code would suggest — the pipes are good, the well is dry.

The second structural theme is the tactical map system: the whiteboard editor (draw tools, player pieces, undo/redo, versioning) is real and good, but the data model underneath it has **zero fields for hill order, bombsite letters, bomb spawns, or Overload device/scoring zones** — not "unpopulated," but no field exists to hold them. Compounding this, the app's own two internal "knowledge" files about the current map pool actively disagree with each other, and both disagree with what independent research (below) suggests the real current CDL Black Ops 7 pool is — including the map pool list supplied in the request that produced this audit. This is exactly the situation the "do not guess map data" directive anticipates, so it's treated as `NEEDS_VERIFICATION` throughout rather than resolved by assumption.

Third, this audit surfaced several concrete, fixable defects while reading the code for feature-completeness — not hypothetical risks, but specific bugs: a hardcoded personal filesystem path that will throw on any machine but one, a team-deletion path that silently orphans local disk data since the Supabase migration, a dependency-safety check that now silently no-ops, and a Postgres RLS policy that lets a `team_leader` promote anyone (including themselves) to `owner`. These are called out individually with file:line evidence and folded into Phase 1 of the roadmap because they're cheap to fix and currently live in the default code path.

**OVERALL COACH INTEL SCORE: 53/100** (unweighted mean of the 12 category scores below — a genuinely well-engineered app that is roughly halfway to the "professional coaching operating system" it's aiming to be, held back less by code quality than by two missing foundations: match-data ingestion and tactical objective data.)

---

## Current Application Score

| Category | Score /100 | Why |
|---|---:|---|
| Product completeness | 60 | ~30 real pages, most fully wired to live data (confirmed page-by-page below). Undercut by the missing match-write path and several orphaned files. |
| Coaching usefulness | 48 | Roster, notes, objectives, and team overview are genuinely useful today. Most of the *analytical* usefulness (the reason a coach opens the app before a scrim) depends on match data that can't currently be entered. |
| Competitive intelligence | 40 | Real opponent-record CRUD and an automatic veto-history sync exist, but no confidence-level system, no source/date/VOD-timestamp per intel item, and no automated tendency detection (everything is hand-typed). |
| Tactical preparation | 38 | The whiteboard is mature; the tactical *data* underneath it (hills, sites, device spawns, per-hill strategy attachment) does not exist anywhere in the schema. |
| Scrim workflow | 55 | Real booking + per-map result CRUD, correctly kept separate from match data. Missing VOD/tag/side fields, no search/filter, and a modeled `lineup` field the UI never exposes. |
| Match preparation | 28 | No consolidated pre-match "war room" screen exists. Veto Lab gives explainable pick/ban *habit* hints but not the win-rate-based recommendation the product vision describes. Reports exist but render empty until match data exists. |
| Analytics | 45 | Dashboard/Insights/Rankings/Reports are real, live-computed, and honest about small samples in most (not all) places. None of the CoD-specific advanced metrics (hold %, break %, rotation %, opening-duel win %, plant/retake %) are implemented — all gated on the same missing match data. |
| Map/strategy tooling | 40 | Mirrors Tactical preparation: strong editor, empty tactical substrate, only 3 of 9 pool maps have real blueprint art. |
| UI/UX | 80 | Brand palette matches the spec almost to the hex value; consistent empty/loading/error states; accessible nav (aria-expanded, tooltips, keyboard support); genuinely disciplined "say we don't know" copy instead of fake numbers. |
| Architecture | 62 | The local-first JSON layer is disciplined and consistent (shared path-safety helpers, clean 1:1 IPC surface). The in-flight Supabase migration is a textbook partial migration, though, with real orphaned-code and data-drift bugs (detailed below). |
| Security | 70 | OS-keychain-encrypted secrets, a dedicated Discord security test suite doing static analysis of the actual source, minimal bot permissions, consistent path-traversal defenses. Held down by one real RLS privilege-escalation gap and a silent plaintext-session fallback. |
| Performance | 65 | No red flags found at the code level (sensible boot sequencing, no obvious unbounded loops), but this audit did not load-test with realistic data volumes — treat this score as a code-review indicator, not a benchmark. |

---

## Existing Strengths

Evidence the audit turned up repeatedly that the codebase *already* practices what the request explicitly demands ("do not fabricate data/statistics"):

- **Team Hub explicitly refuses to invent a schedule**: *"Scheduling has no data model yet, so this states that rather than inventing a countdown."* — [`teamHub/sections/overview.js:64-66`](src/renderer/pages/teamHub/sections/overview.js:64)
- **Veto History shows real match data instead of a fake bracket**: *"Veto sequences are not recorded anywhere yet. Rather than invent a tree, this shows the closest honest signal: which maps this team has actually played."* — [`teamHub/sections/veto.js:4-16`](src/renderer/pages/teamHub/sections/veto.js:4)
- **Opponent Intel context card** states "No head-to-head data" rather than a synthesized number when no matches are logged — [`teamHub/context.js:58-64`](src/renderer/pages/teamHub/context.js:58)
- **Discord role-mapping** is visibly labeled "Not Available Yet" with an in-code reason ("Coach Intel does not yet have staff permission roles… intentionally not implemented") rather than a silent stub — `discordConfig.js:227-250`
- **Breaking Point external-data integration** is shown as honestly "Not Connected," with the stated reason being unresolved ToS/API verification, rather than faked — `settings/sections/integrations.js`
- **Discord notification catalog** discloses which of its 21 event types actually have a producer today (5 do) and says "share manually for now" for the rest, in the UI itself.
- **Security discipline**: bot/session tokens are encrypted via Electron's OS-keychain-backed `safeStorage`, chmod 600, with a distinctly-named (`*.insecure.json`) and logged plaintext fallback only for keychain-unavailable dev builds; a dedicated `tests/discord/security.test.js` statically scans the actual `src/` tree for token-shaped literals, asserts the renderer never touches a stored credential or calls the Discord API directly, and asserts the preload bridge exposes no credential surface.
- **Discord bot permissions** are minimal by design and enforced by a test: the invite URL requests only `VIEW_CHANNEL | SEND_MESSAGES | EMBED_LINKS`, never `ADMINISTRATOR` — `guild.js:211-218`, asserted in `guild.test.js`.
- **Path-traversal defenses** (`safeSegment()`) are consistently reused across all three local stores (`dataStore.js`, `planningStore.js`, `screenshotStore.js`) and the custom `cci-asset://` protocol handler.
- **Brand fidelity**: `styles.css` custom properties match `Identity/Plans/Coach_Intel_Brand_Identity.md`'s documented palette almost exactly (`--bg-elevated:#101316` = Carbon `#101316`; `--accent:#b6f542` = Intel Green `#B6F542`; etc.).
- **A real smoke-test harness** (`scripts/_verify/main.js`) boots the actual `index.html`/preload against the real data store with Discord fixtures swapped in — a genuinely good practice most projects this size skip.
- **The Strategy Board editor** is a real 4v4 tactical whiteboard: draggable/rotatable player and opponent pieces with facing/FOV cones (capped at 4-per-side, matching CDL format), pen/arrow/line/rectangle/circle/text/erase tools, 40-deep undo/redo, and a 6-stage status pipeline (DRAFT → READY FOR REVIEW → APPROVED → IN PRACTICE → MATCH READY → ARCHIVED) — this is not a stub.
- **Map Management admin UI** (Settings → Game Rules) is wired end-to-end through real IPC to the real ruleset file: add/edit/deactivate/restore all work and deactivation correctly preserves history with a "RETIRED FROM CURRENT RULESET" label, matching the product's own prior spec.
- **The Scrim Hub / Match data separation** is clean — different storage directories, different IPC calls, different stat pipelines — matching the product principle that scrim data must stay private and distinct from official results.

## Existing Weaknesses

Concrete, evidenced defects — not stylistic opinions:

1. **No writer for match records exists anywhere.** `preload.js` exposes `getMatches` with no `saveMatch`/`addMatch`/`importMatch` counterpart; `main.js` registers only a read-only `cci:getMatches` handler; `dataStore.js` only reads `data/matches/*.json`, never writes it; the Supabase schema has no `matches` table (a code comment even notes matches "haven't [been] migrated yet"); the screenshot-import pipeline files raw images into an inbox but has no OCR/extraction step to turn one into a match record. Confirmed independently by two separate research passes.
2. **`saveMapArt()` hardcodes one developer's personal filesystem path**: `MAP_ART_DIR = '/Users/Ion/Library/Mobile Documents/com~apple~CloudDocs/Naevii/Artwork/maps/bo7'` — [`src/main/dataStore.js:665-667`](src/main/dataStore.js:665) — and copies every uploaded map picture there, uncaught, on top of the real save. This will throw on any machine other than that one. `screenshotStore.js:15`'s `DEFAULT_SCRIM_SB_DIR` has the same problem.
3. **Team deletion now silently orphans local disk state.** Since the Supabase migration, `cci:deleteTeam` routes only through `supabase/teams.js`'s Postgres delete (`main.js:317`) — the local `dataStore.deleteTeam()`, which actually removes the team's on-disk folder (members, screenshots, matches, strats, notes, tasks, vetoes), is never called anymore.
4. **A dependency-safety check now silently no-ops.** `removeCdlMap`'s "don't let you hard-delete a map with match history" guard still queries the *local* `getTeams()` list (`dataStore.js:608`) — which is empty for every team created after the Supabase migration, since nothing writes local `team-profile.json` files anymore.
5. **RLS privilege-escalation gap**: `profiles` table's UPDATE policy (`schema.sql:22-31`) grants any `owner`/`team_leader` the ability to update a profile row, but has no `WITH CHECK` clause constraining the *new* `role` value — meaning a `team_leader` can set anyone's role, including their own, to `owner`.
6. **Two internal "knowledge" files disagree with each other** on the current map pool: `data/knowledge/cdl-ruleset.json` lists Gridlock, Hacienda, and Sake in Hardpoint; `data/knowledge/meta-knowledge.json` lists neither Gridlock nor Sake anywhere and puts Exposure in Hardpoint instead. Neither is internally the "source of truth" the app claims to have (see the dedicated map-pool section below).
7. **`commandCenter.js` (13KB) is fully orphaned** — not imported by the router, not present in `app.js`'s `routes` table, unreachable except by accident via a legacy-redirect intercept. Two live call sites (`matchLog.js:84`, `teamsPage.js:76`) still `navigate('command-center', …)`, only working because the redirect happens to catch them.
8. **`comingSoon.js`**, the app's own honest-placeholder component, has zero call sites — dead code.
9. **Strategy Board has an orphaned drawing type**: `'pin'` is fully implemented in the paint/hit-test code (`stratBoard/draw.js:71-141`) but no toolbar tool ever creates one.
10. **`retired_modes[]`** is written by `updateCdlMapModes` but never read or displayed anywhere in the renderer — a silently accumulating field with no UI.
11. **Only 3 of 9 current-pool maps (Den, Raid, Scar) have real tactical blueprint art**; the other 6 fall back to an unannotated reference photo with **no warning surfaced to the coach** that they're looking at a photo, not a tactical diagram.
12. **Supabase session encryption has a silent regression risk**: the current diff changed `store.js` from *refusing* to persist a session when the OS keychain is unavailable, to *silently* writing it in plaintext (`*.insecure.json`, chmod 600) with only a `console.warn`.
13. **Intel Feed's sample-size protection is inconsistent**: performance signals correctly gate on `SAMPLE_MIN = 3` (`intelFeed.js:6-21`), but the map win-rate signal hardcodes a different, lower bar (`s.total >= 2`, `intelFeed.js:37`) instead of reusing the constant, and the "best player pair" signal has no minimum-sample gate at all.
14. **No test coverage exists for `dataStore.js` or any file under `src/main/supabase/`** — precisely the modules currently being rewritten by the in-progress migration. (`tests/` has dedicated suites for `planningStore`, `screenshotStore`, `events`, and all of `discord/`, but none for these.)
15. **Stray, untracked, near-duplicate files sit at the repo root** (`app.js`, `index.js`, `index.html`) — older, unreferenced copies of files under `src/`. Harmless today (nothing loads them) but violate the project's own "don't save working files to root" rule and are exactly the kind of file a broad `git add -A` would accidentally commit.

---

## Missing Features (Prioritized)

**P0 — Critical**
- A match-entry pipeline (manual entry form, at minimum) — the single highest-leverage gap; unblocks Reports, Scouting H2H, Standings/form, and all match-derived analytics.
- Fix the four data-integrity bugs above (hardcoded paths, orphaned team-delete cleanup, stale dependency check, RLS `WITH CHECK` clause).
- Reconcile the CDL map pool into one versioned source of truth (see below) — the app already has a design for this (`Coach_Intel_Map_Management_Add_On3.md`), it just isn't wired up as the sole source.
- Remove or properly re-route the two dead `command-center` navigation calls; delete or repurpose `commandCenter.js`.

**P1 — High value**
- Objective/tactical map data model — hill order, bombsite letters, bomb spawn, Overload device/scoring zones — stored separately from blueprint images (per the app's own prior Map Management spec), with every unverified value explicitly marked `NEEDS_VERIFICATION` rather than guessed.
- Tactical blueprint art for the 6 maps that currently only have a reference photo.
- A consolidated Pre-Match / "War Room" screen (opponent + map pool + expected veto + prepared strats + notes on one screen).
- Extend Veto Lab with a win-rate-based recommendation (our record vs. their record vs. recent form → BAN/PICK suggestion with a stated reason and sample size) — additive to, not a replacement for, the existing pick/ban habit-frequency hints, which are worth keeping.
- Opponent-intel confidence levels (CONFIRMED / LIKELY / OLD DATA / UNVERIFIED) plus source/date/VOD-timestamp per intel item.
- An explicit product decision on the Strats & Playbooks navigation question (see Information Architecture below), since the current state is a deliberate-looking but undocumented deviation from the app's own prior UI spec.
- Intel Feed sample-size gating consistency fix.
- CoD-specific advanced metrics (HP hold %/break %/rotation %, S&D opening-duel win %/plant %/retake %, Overload scoring efficiency) — naturally sequenced after match data exists.

**P2 — Useful**
- Per-hill / per-site / per-lane strategy attachment (e.g., `Den · HP · P3 · Hold`) instead of only map + mode.
- Strategy Board layer/overlay toggles (Objectives / Spawns / Callouts / Strategy / Players / Routes / Notes).
- Scrim Hub: VOD link, tags, side field, search/filter, and exposing the already-modeled but UI-absent `lineup` field.
- Discord Phase 2 completion (role mapping) and Phase 4 (slash commands) — both cleanly scoped as "not yet" in the existing code.
- Wire the orphaned `'pin'` marker type into an actual toolbar tool.
- OCR/auto-extraction from scoreboard screenshots into match records (the screenshot *inbox* already exists and is well-built; this is the next step after manual entry, not instead of it).

**P3 — Future**
- Slash-command set beyond the basics (`/coachintel strat`, `/coachintel player`, `/coachintel map`).
- Animated strategy playback (step-by-step positions) — the app's own BreakingPoint/GameCoach doc already designs the storage model for this, deliberately deferred to "later."
- Natural-language search/query, win-probability modeling, and cross-opponent pattern detection.

---

## Tactical Map Assessment

Based on the map pool currently encoded in `data/knowledge/cdl-ruleset.json`. **This pool itself needs verification — see the dedicated section immediately below before treating this table as final.**

| Map | Mode(s) in app's data | Blueprint available | Objectives verified | Strat support | Annotations |
|---|---|:---:|:---:|:---:|:---:|
| Colossus | Hardpoint | NO (photo only) | NO | YES | Freehand only |
| Den | Hardpoint, S&D, Overload | **YES** (all 3) | NO | YES | Freehand only |
| Exposure | Overload | NO (photo only) | NO | YES | Freehand only |
| Fringe | Search & Destroy | NO (photo only) | NO | YES | Freehand only |
| Gridlock | Hardpoint, S&D, Overload | NO (photo only) | NO | YES | Freehand only |
| Hacienda | Hardpoint, S&D | NO (photo only) | NO | YES | Freehand only |
| Raid | Search & Destroy | **YES** | NO | YES | Freehand only |
| Sake | Hardpoint, S&D | NO (photo only) | NO | YES | Freehand only |
| Scar | Hardpoint, Overload | **YES** (both) | NO | YES | Freehand only |

- **"Strat support: YES"** means the Strategy Board works generically for any map/mode (it isn't map-specific code) — not that per-hill/site tooling exists.
- **"Annotations: Freehand only"** means a coach can draw a zone or type a text label roughly where a hill sits, but nothing in the data model knows that shape represents "Hill 2" — there's no structured link between a drawing and an objective.
- **"Objectives verified: NO" is confirmed absent, not just unconfirmed** — an exhaustive repo-wide search for hill/bombsite/device-spawn terminology in `data/` and `src/` turned up zero real hits (only UI caption text and an unrelated code-comment example). No coordinates of any kind exist in this repository, so none are reported here, per the audit's own no-guessing rule.

### The map pool itself needs reconciliation before any of the above is finalized

Three sources inside this repository, plus this audit's own external research, do not agree:

| Source | Hardpoint | Search & Destroy | Overload |
|---|---|---|---|
| **This request's §5** (matches the app's `cdl-ruleset.json` almost exactly) | Colossus, Den, Gridlock, Hacienda, Sake, Scar | Den, Fringe, Gridlock, Hacienda, Raid, Sake | Den, Exposure, Gridlock, Scar |
| **`data/knowledge/meta-knowledge.json`** (a *second* file in the same repo) | Den, Exposure, Scar *("plus rotating season maps")* | Colossus, Den, Exposure, Raid, Scar | Den, Exposure, Scar |
| **External research — initial pool reveal, ~Nov 25 2025** (multiple outlets: dotesports, Esports Insider, Checkmate Gaming, STG Play, charlieINTEL) | Blackheart, Colossus, Den, Exposure, Scar | Colossus, Den, Exposure, Raid, Scar | Den, Exposure, Scar |
| **External research — maps actually played at the CDL Grand Finals, Jul 19 2026** (Wikipedia, partial/non-exhaustive — only what that one series used) | Colossus, Scar, Den, **Hacienda** | Raid, Scar, Den, **Hacienda** | Scar, Den |

Sources: [Esports Insider](https://esportsinsider.com/2025/11/call-of-duty-league-black-ops-7-map-pool), [Checkmate Gaming](https://www.checkmategaming.com/article/cdl-2026-black-ops-7-competitive-maps-1248.htm), [dotesports](https://dotesports.com/call-of-duty/news/cdl-2026-competitive-settings), [STG Play](https://www.shanethegamer.com/esports-news/cdl-black-ops-7-maps-modes-2026/), [2026 Call of Duty League season — Wikipedia](https://en.wikipedia.org/wiki/2026_Call_of_Duty_League_season).

Reading across these: `meta-knowledge.json` (the app's *less structured* file) is actually much closer to the real, externally-verified initial pool than `cdl-ruleset.json` (the app's *structured, authoritative-looking* file) is — Gridlock, Hacienda-in-that-context, and Sake don't appear in any externally-sourced list from this season, and Blackheart doesn't appear in the app's data at all. The Grand Finals result additionally shows Hacienda being played in both Hardpoint and Search & Destroy mid-season — neither the Nov 2025 reveal nor the app's files predicted that, which is a live illustration of exactly why the app's own prior planning doc (§16-17 of `Coach_Intel_BreakingPoint_GameCoach_Add_On2.md`) already calls for a *versioned* ruleset with a change-detection/review step, rather than a hardcoded pool: **the pool moved during the season, and nothing in the app would have caught it.**

**I could not obtain a clean primary-source confirmation** — the official `callofdutyleague.com/en-us/competitive-settings` page is JS-rendered and returned no content to a fetch, and `breakingpoint.gg` blocked the request (403). The table above is therefore multi-source-corroborated but not primary-source-verified. **Recommendation: before entering or correcting any map/mode data, have a coach confirm the live pool against in-game competitive settings or the CDL broadcast directly** — this audit deliberately stops short of picking a "winner" among these four lists.

---

## Recommended Information Architecture

The current architecture (as implemented in `app.js`'s `NAV_GROUPS`) is sound and shouldn't be restructured wholesale — it already matches most of the app's own prior UI/UX spec:

```
Main        Dashboard · Intel Feed · Calendar · Tasks
Analytics   Teams · Players · Matches · Statistics · Database · Reports · Rankings
Team        Team Hub · Strats & Playbooks · Scrim Hub · VOD Library · Needs Review · Veto Lab
Tools       Maps & Modes · Scouting
Integrations
Settings (bottom-anchored)
```

Team Hub's own internal rail: `Overview · Roster · Team Notes · Objectives · Veto History · Practice Planner · Team Settings`.

**One deliberate-looking but unresolved decision needs an explicit call:** the app's own prior spec (`Coach_Intel_Team_Hub_UI_UX_Layout.md` §6, §8, §31) is unambiguous that "Strats belong to the Team… not a disconnected global tool," with Strats & Playbooks nested as a sub-item *inside* the Team Hub rail. The current implementation instead promotes "Strats & Playbooks" to a top-level item in the global nav's "Team" group, requiring its own in-page team switcher. This is **not** a data-ownership regression — every strat is still strictly team-scoped, legacy `#/team-hub/:id/strats` links redirect cleanly to `#/playbooks/:id`, and Team Hub still deep-links into it from the Overview map-pool tiles and the "Needs Attention" panel — but it is a real deviation from the documented IA, and it isn't clear from the code whether that was a deliberate simplification or drift. Two reasonable paths, either is defensible:
- **Keep it top-level** — faster to reach (matches this request's "extremely fast access to information" priority), at the cost of diverging from the documented spec.
- **Re-nest it under Team Hub's rail** — restores the original design intent, at the cost of one more click during scrims.

This audit recommends making that call explicitly rather than leaving it as an undocumented byproduct of the refactor, and then updating `Coach_Intel_Team_Hub_UI_UX_Layout.md` to match whichever way it's decided, so the two don't keep drifting apart.

**Map Library** (this request's §11) doesn't exist as its own consolidated page yet — map data is currently split between `Maps & Modes` (pool/blueprint management) and per-team `Strats & Playbooks` (filtered by map). Given the "avoid duplicating map information across disconnected areas" instruction, the recommended shape is to enrich the existing `Maps & Modes` page into that single map-intelligence hub (Overview / Blueprint / Strats / Performance / Opponent Intel / Notes tabs per map) rather than create a third place maps live.

---

## Recommended Data Changes

Minimal, justified only by concrete gaps found above — not a rebuild:

1. **`matches` needs a write path** (new `saveMatch`/`deleteMatch` in `dataStore.js` + IPC handlers + a form) — the schema already implied by every *reader* of match data (`{date, opponent, mode, map, score, result, players[]}` with mode-specific objective stats) is reasonable; it just needs a producer.
2. **A new `objectives` structure**, stored separately from map art per the app's own Map Management design intent — e.g. `data/maps/<slug>/hardpoint.json`, `snd.json`, `overload.json` — so objective corrections never require replacing an image asset. Every field starts `NEEDS_VERIFICATION` until a coach confirms it.
3. **Reconcile `cdl-ruleset.json` and `meta-knowledge.json`** into one source (the ruleset file, since it's already the one the CRUD UI writes to) and either delete `meta-knowledge.json`'s conflicting `map_pool` block or regenerate it from the ruleset so two files can't disagree again.
4. **`coaches` is currently only a free-text name field plus an auth-role enum** — if per-coach profiles (bio, specialization, availability) matter, this needs a real entity; if not, this is fine as-is and shouldn't be over-built.
5. **Finish or explicitly pause the team migration**: either give `dataStore.js`'s orphaned local-team functions (`getTeams`/`getTeam`/`deleteTeam`) real callers again (fixing the two bugs above), or delete them outright now that Supabase is primary — right now they're a trap, not a fallback.
6. **Add a `WITH CHECK` clause** to the `profiles` UPDATE RLS policy constraining which `role` transitions are allowed.
7. Everything else the request's §19 checklist asks about (`teams`, `players`, `strategies`, `strategy_versions`, `player_assignments`, `notes`, `VOD`, `veto_history`, `scrims`) **already has a working representation** — see the Data Architecture findings folded into Existing Strengths/Weaknesses above. No rebuild is justified there.

---

## UI/UX Improvements

- Surface a visible "reference photo, not a tactical diagram" indicator when `resolveMapLayout` falls back from a mode-specific blueprint to the plain map photo (`lib/maps.js:76`), instead of silently substituting it — a coach should never mistake one for the other mid-prep.
- Typography is currently system-font (`-apple-system, SF Pro, Segoe UI`) rather than the brand spec's Space Grotesk/Inter/JetBrains Mono hierarchy (`Coach_Intel_Brand_Identity.md` §10) — a reasonable, low-risk pragmatic choice for bundle size, but worth a deliberate decision rather than a quiet drift, same as the Strats/Playbooks nav question.
- The Intel Feed and map win-rate tiles should show sample size next to every percentage consistently (mostly already true — just needs the one inconsistent code path fixed, see Weakness #13).
- Responsive behavior below 1024px is handled in code (`NAV_AUTO_COLLAPSE_PX`), but this audit was code-only and did not visually verify behavior across breakpoints in a running window — worth a live pass before relying on it.

---

## Professional Coaching Workflow — Current Support

| Stage | Current support | Evidence |
|---|---|---|
| **PRE-SCRIM** | Strong — Team Hub overview, roster, notes, objectives, map pool card | `teamHub/sections/overview.js`, `roster.js`, `objectives.js` |
| **SCRIM** | Real booking + per-map result logging; no in-scrim "live mode" quick-capture screen | `scrimHub.js`, `planningStore.js:158-212` |
| **POST-SCRIM** | Scrim results persist; no auto-summary/comparison against baseline yet | `scrimHub.js` block/win-rate KPIs |
| **VOD REVIEW** | Real VOD library with timestamped markers, filter by map/mode, links to matches/strats | `vodLibrary.js`, `planningStore.js:205-250` |
| **MATCH PREP** | Weakest stage — no consolidated war-room screen; Reports exist but render empty without match data | see Missing Features P0/P1 |
| **VETO** | Real, explainable pick/ban habit tracker with reasoning shown; no win-rate-based recommendation yet | `vetoLab.js`, `lib/vetoIntel.js` |
| **MATCH DAY** | No dedicated "scrim mode" quick-access screen exists | not found anywhere in the page inventory |
| **POST-MATCH** | Report generation is real and automatic once match data exists; currently blocked upstream | `lib/report.js:64-155` |

---

## Implementation Roadmap

**PHASE 1 — Critical Coaching Foundation**
*Features:* match-entry form + write path; fix the 4 concrete bugs (hardcoded paths, orphaned team-delete, stale dependency check, RLS `WITH CHECK`); delete/redirect `commandCenter.js` dead code; reconcile the two conflicting knowledge files into one ruleset source.
*Files:* `dataStore.js`, `main.js`, `preload.js`, a new match-entry UI, `schema.sql`, `commandCenter.js`, `matchLog.js`, `teamsPage.js`, `data/knowledge/*.json`.
*DB changes:* new `matches` write path (local first; Supabase table can follow the same pattern already used for teams/members). *Dependencies:* none new. *Risk:* low — additive, no existing behavior removed. *Benefit:* unblocks nearly every downstream analytics/reporting feature.

**PHASE 2 — Tactical Map System**
*Features:* versioned objective data model (`NEEDS_VERIFICATION`-first), blueprint art for the 6 missing maps, per-hill/site/lane strategy attachment, Strategy Board layer toggles, wire the orphaned `pin` tool.
*Files:* `data/maps/<slug>/*.json` (new), `lib/maps.js`, `strategyBoard.js`, `stratBoard/*.js`, `cdlRulesetSettings.js`.
*DB changes:* new objectives structure, stored apart from images per the app's own existing design intent. *Dependencies:* coach-confirmed source data (cannot be machine-generated, see Tactical Map Assessment). *Risk:* low-medium (new data, no schema conflicts). *Benefit:* directly enables everything in this request's §4/§8/§9/§10.

**PHASE 3 — Scrim + Match Intelligence**
*Features:* Scrim Hub VOD/tag/side fields + search/filter + expose `lineup`; Pre-Match War Room screen; CoD-specific advanced metrics (hold %/break %/rotation %, opening-duel win %, plant/retake %) once Phase 1's match data exists.
*Files:* `scrimHub.js`, new war-room page, `lib/report.js`, `utils.js` (aggregation functions).
*Dependencies:* Phase 1 (match data). *Risk:* low. *Benefit:* this is the phase that turns "the data exists" into "the coach can act on it fast."

**PHASE 4 — Opponent Intel + Veto**
*Features:* confidence-level system (CONFIRMED/LIKELY/OLD DATA/UNVERIFIED) + source/date/VOD-timestamp per intel item; win-rate-based Veto Lab recommendation layered onto the existing habit-frequency hints, with visible reasoning and a manual override (already implicit, since nothing auto-fills today).
*Files:* `scouting.js`, `planningStore.js`, `lib/veto.js`, `lib/vetoIntel.js`, `vetoLab.js`.
*Dependencies:* Phase 1 (own-team win rate needs match data; opponent side already has data). *Risk:* medium (recommendation logic needs careful, explainable design — never a black box, per the request's own §13). *Benefit:* this is the single highest-differentiation feature named in the app's own brand doc.

**PHASE 5 — Analytics**
*Features:* fix Intel Feed sample-gating inconsistency; add per-hill/per-site situation explorer once Phase 2/3 data exists; map/mode readiness scoring.
*Files:* `intelFeed.js`, `insights.js`, `databasePage.js`.
*Dependencies:* Phases 1-3. *Risk:* low. *Benefit:* moves the app from "shows stats" to "tells you what to review," matching the brand's stated differentiation.

**PHASE 6 — Advanced / AI Assistance**
*Features:* recurring-pattern detection across scrims (done — see Intel Feed); Discord Phase 4 slash commands; animated strategy playback (done). (Voice-note capture and LLM-based VOD/opponent summarization removed from scope by request — both need a third-party API/credential decision that wasn't worth making just to check a box.)
*Files:* `discord/` (new `interactions.js`) if slash commands proceed.
*Dependencies:* n/a. *Risk:* low now that the AI-summarization piece is out. *Benefit:* whatever's left is polish, not core functionality.

---

## Final Implementation Prompts

Two prompts, scoped to be independently approvable and executable. **Neither has been run. Both wait for explicit approval before any code is written.**

### Prompt 1 — Critical Foundation Fixes + Match Data Pipeline (Phase 1)

> Inspect `src/main/dataStore.js`, `src/main/main.js`, `src/main/preload.js`, and `scripts/supabase/schema.sql` before changing anything. Implement, in this order: (1) a `saveMatch`/`deleteMatch` local write path in `dataStore.js` mirroring the existing `saveScrim`/`saveNote` patterns (same `safeSegment`/`readJson`/`writeJson` helpers, same team-scoped directory convention), plus matching `ipcMain.handle` registrations in `main.js` and bridge methods in `preload.js`, plus a manual match-entry form in the renderer (new page or a modal from Match Log) capturing at minimum `{date, opponent, mode, map, score, result, players[]}` consistent with what `matchLog.js`/`lib/report.js`/`utils.js` already read. (2) Fix the hardcoded personal paths in `dataStore.js:665-667` (`saveMapArt`'s `MAP_ART_DIR`) and `screenshotStore.js:15` (`DEFAULT_SCRIM_SB_DIR`) — remove the machine-specific copy side effect entirely, or make it an opt-in, environment-configured path with a try/catch. (3) Fix team deletion so it cleans up local on-disk team state again (either restore a call to `dataStore.deleteTeam` alongside the Supabase delete in `main.js`, or make an explicit, documented decision to keep local data and surface that to the user). (4) Fix `removeCdlMap`'s dependency check (`dataStore.js:608`) so it reflects real current data instead of a permanently-empty local team list — likely needs to check Supabase-backed team/strat data instead. (5) Add a `WITH CHECK` clause to the `profiles` UPDATE policy in `schema.sql` that constrains which `role` values a `team_leader` (vs. an `owner`) may write. (6) Delete the orphaned `src/renderer/pages/commandCenter.js` and re-point its two remaining callers (`matchLog.js:84`, `teamsPage.js:76`) directly at `team-hub`. (7) Delete the three stray root-level files (`app.js`, `index.js`, `index.html`) after confirming (they are already confirmed in this audit) that nothing references them. Do not touch Discord, do not touch the Strategy Board, do not redesign any UI beyond what's needed for the new match-entry form to match existing patterns. Run `npm test` after each numbered step and report pass/fail per step, not just at the end.

### Prompt 2 — Tactical Map Data Model + Map Pool Reconciliation (Phase 2)

> Inspect `data/knowledge/cdl-ruleset.json`, `data/knowledge/meta-knowledge.json`, `src/renderer/lib/maps.js`, `src/renderer/pages/cdlRulesetSettings.js`, and `src/renderer/pages/strategyBoard.js` before changing anything. (1) Reconcile the two knowledge files into a single source of truth: `cdl-ruleset.json` should remain authoritative (it's the one the existing CRUD UI already writes to); either delete `meta-knowledge.json`'s conflicting `map_pool` block or regenerate it from the ruleset on every ruleset change so the two cannot drift apart again. Do **not** change which maps are marked active/inactive as part of this step — that requires a coach's sign-off against the current real CDL settings (this audit could not obtain primary-source confirmation; see the Tactical Map Assessment section of `COACH_INTEL_PRO_AUDIT.md` for what's already known and unresolved). (2) Add a new objectives data structure stored separately from map art — e.g. `data/maps/<slug>/hardpoint.json`, `snd.json`, `overload.json` — per the map, with every hill/bombsite/device-spawn field defaulting to a literal `"NEEDS_VERIFICATION"` value rather than a guess, and build the minimal Settings UI needed for a coach to fill these in by hand. Do not invent or infer any coordinate, hill order, bombsite letter, or spawn location — every value either comes from the coach or stays `NEEDS_VERIFICATION`. (3) Add an optional hill/site/lane field to a saved Strategy Board strat (e.g. `objective_key: "P3"` / `"A"` / `"carry-route"`) so a strat can be filtered/attached at that granularity in `playbooks.js`, without breaking any existing strat that doesn't set it. (4) Add layer/overlay visibility toggles to the Strategy Board (Objectives / Spawns / Callouts / Players / Routes / Notes) — additive UI over the existing draw/piece system, no changes to how drawings are stored. (5) Wire the already-implemented-but-orphaned `'pin'` drawing type (`stratBoard/draw.js:71-141`) into an actual toolbar tool. (6) When a mode-specific blueprint is unavailable and the board falls back to a plain reference photo (`lib/maps.js:76`), surface a visible "reference photo — not a tactical diagram" indicator instead of a silent substitution. Preserve every existing saved strat's `map`/`mode`/`drawings`/`player_positions` exactly as-is — this is additive schema, not a migration. Run `npm test` after each numbered step.

---

*This audit inspected the repository as of the working tree described in the initial git status (main branch, one commit, with the uncommitted Supabase/Playbooks migration in progress). It does not reflect any changes made after that point.*
