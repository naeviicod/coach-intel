# Coach Intel — Breaking Point + GameCoach Integration Add-On

**Brand:** Coach Intel  
**Descriptor:** Competitive Intelligence for Call of Duty  
**Scope:** Call of Duty only  
**Purpose:** Add-on implementation plan for external competitive data ingestion and map/mode strategy workflows.

---

## 1. Objective

Coach Intel should gain two external intelligence layers:

1. **Breaking Point Intelligence Connector**  
   Pull or inspect current competitive Call of Duty data from Breaking Point for players, teams, matches, events, season stats, advanced stats, roster context, and map/mode performance.

2. **GameCoach-Inspired Map & Mode Workspace**  
   Add a dedicated Maps & Modes section using the BO7 map inventory and strategy-board workflow visible on GameCoach, but implemented natively inside Coach Intel with Coach Intel styling, data, notes, Intel, review, and team collaboration.

The result should be:

**BREAKING POINT DATA + COACH INTEL INTERNAL DATA + MAP/MODE CONTEXT + COACH INPUT → ACTIONABLE INTEL**

---

# 2. Breaking Point Connector

## 2.1 Integration Strategy

Use this priority order:

### Preferred: Breaking Point API

Breaking Point visibly exposes an **API** entry in its current site navigation/footer.

Before building any scraper:

- Determine whether an official/public/partner API is available.
- Request or configure API credentials if required.
- Read and comply with API terms, rate limits, attribution rules, and commercial-use requirements.
- Use the API as the primary source whenever available.

Do **not** assume undocumented endpoints are stable or approved.

### Fallback: Controlled Web Inspection

If a suitable official API is unavailable, implement a read-only **Breaking Point Web Inspector**.

The inspector should:

- Request only public Breaking Point pages.
- Parse public structured information.
- Respect robots.txt, rate limits, terms, copyright, and access restrictions.
- Cache responses.
- Never bypass login, anti-bot systems, paywalls, or protected endpoints.
- Never scrape aggressively.
- Store source URL + retrieval time with every imported record.

### Manual Fallback

Always keep:

- Manual entry
- CSV import
- Structured paste
- URL-reference import

Coach Intel must remain usable even if Breaking Point changes its website.

---

# 3. Breaking Point Sources to Inspect

Initial connector targets:

## Player Statistics

Breaking Point currently exposes a BO7 player stats view containing fields such as:

- Overall K/D
- Slayer Rating
- BP Rating
- Hardpoint K/D
- Hardpoint KP10M
- Hardpoint DMG/10M
- S&D K/D
- S&D KPR
- S&D Opening Duel Win %
- Overload K/D
- Overload KP10M
- Overload DMG/10M

Coach Intel should import only fields that can be reliably identified and mapped.

## Advanced Statistics

Breaking Point currently exposes advanced mode sections for:

- Hardpoint
- Search & Destroy
- Overload
- Historical/other modes where present

Do not hard-code one permanent third mode into the overall data model.

## Player Pages

Player pages can contribute:

- Player ID
- Gamer tag
- Name
- Current team
- Position/role if available
- Season stats
- Leaderboard rank
- Recent matches
- Event stats
- Event history

## Team Pages

Team pages can contribute:

- Team identity
- Current roster
- Recent form
- Matches
- Team stats
- Events
- Map-related performance where available

## Matches

Breaking Point match pages/listings can contribute:

- Teams
- Event
- Date/time
- Series format
- Series score
- Match status
- Individual map results when available
- Box score reference

## Events

Use event information for:

- Event names
- Stage/tournament context
- Date ranges
- Match grouping
- LAN/online categorization if explicitly available

---

# 4. Connector Architecture

Recommended internal architecture:

```text
Breaking Point
      │
      ▼
BP Source Adapter
      │
      ├── API Adapter
      ├── Web Inspector Adapter
      └── Manual Import Adapter
      │
      ▼
Normalization Layer
      │
      ▼
Validation / Data Quality
      │
      ▼
Coach Intel Data Models
      │
      ├── Players
      ├── Teams
      ├── Matches
      ├── Maps
      ├── Modes
      ├── Events
      └── Stats
      │
      ▼
Intel Engine
```

External source logic must remain isolated from Coach Intel business logic.

If Breaking Point changes, only the adapter should need modification.

---

# 5. Breaking Point Normalized Data Model

Every imported record should include:

```text
source_provider
source_url
source_external_id
source_retrieved_at
source_last_checked_at
source_method
verification_status
raw_source_reference
```

`source_method`:

- API
- WEB_INSPECTION
- MANUAL
- CSV

`verification_status`:

- VERIFIED
- AUTO_MATCHED
- NEEDS_REVIEW
- CONFLICT
- STALE

---

# 6. Player Identity Matching

External player names must not silently create duplicates.

Matching process:

1. External provider ID
2. Exact gamer tag
3. Known alias
4. Team + gamer tag
5. Manual review

Example:

```text
Breaking Point: Shotzzy
Coach Intel: Shotzzy
Confidence: 100%
Status: LINKED
```

Ambiguous matches go to **Needs Review**.

---

# 7. Team Identity Matching

Maintain an alias table.

Example:

```text
Canonical: OpTic Gaming
Aliases:
- OpTic Texas
- OpTic
- OPTIC
```

The historical team name must remain attached to historical matches where relevant.

Do not rewrite history when a brand/team changes name.

---

# 8. Scheduled Breaking Point Inspection

Add configurable sync actions:

- Check Now
- Refresh Player
- Refresh Team
- Refresh Match
- Refresh Event

Optional automatic cadence:

- Upcoming match day: more frequent
- Normal days: less frequent
- Completed historical data: cache aggressively

Never overload the source.

Display:

`Breaking Point · Last checked 12 min ago`

---

# 9. Breaking Point Change Detection

Do not only import current values.

Detect meaningful change.

Examples:

- New match
- Match completed
- Series score changed
- Roster changed
- Player switched team
- New event
- Player stat changed
- Player ranking changed
- Team recent form changed

Create Coach Intel signals only for relevant changes.

Example:

> **EXTERNAL DATA SIGNAL**  
> Opponent roster changed since the last scouting report.

---

# 10. Breaking Point Data Browser

Add a dedicated source panel under:

**DATA → EXTERNAL SOURCES → BREAKING POINT**

Show:

- Connection status
- API / Web Inspector status
- Last successful sync
- Last failed sync
- Imported players
- Imported teams
- Imported matches
- Conflicts
- Needs Review
- Source health

Actions:

`SYNC NOW · REVIEW CHANGES · VIEW SOURCE · DISCONNECT`

---

# 11. Breaking Point Search

Add an internal search action:

**Search Breaking Point**

Possible queries:

- Player name
- Team name
- Event
- Match
- Current season

Results should be previewed before import.

Example:

```text
BREAKING POINT RESULTS

Shotzzy
OpTic Gaming
2026 Season

Overall K/D      1.03
HP K/D           1.01
S&D K/D          1.05
OVL K/D          1.05

[LINK PLAYER] [VIEW SOURCE]
```

---

# 12. Source Attribution

Coach Intel must clearly distinguish:

**COACH INTEL DATA**  
Internal/manual/private data.

**BREAKING POINT DATA**  
Externally sourced public data.

Example:

`SOURCE · Breaking Point · Checked 16 Aug 2026`

Never present imported Breaking Point data as Coach Intel's own measurement.

---

# 13. Data Rights / Safety Rule

Breaking Point's current terms state that it owns rights in its site/app content and requires consent for use of its material.

Therefore:

- Prefer official API/licensed access.
- Do not build uncontrolled scraping.
- Do not reproduce articles or large copyrighted content.
- Import only permitted factual/statistical data required for the product.
- Retain source attribution.
- Verify commercial usage rights before production rollout.
- Build the connector so it can be disabled instantly if access rules change.

---

# 14. Maps & Modes — CDL-Only Scope

Coach Intel is **Call of Duty only** and, for the current implementation, should contain **only the current official CDL maps, modes, and competitive settings**.

Do not load every public/ranked/launch map into the production workspace yet.

The Maps & Modes module should be driven by a versioned **CDL Ruleset Profile** sourced from the official Call of Duty League competitive settings.

Current official CDL modes:

- Hardpoint
- Search & Destroy
- Overload

The application must support the complete current CDL map pool across those modes.

---

# 15. Current Official CDL Map/Mode Matrix

Seed Coach Intel with the current CDL competitive map/mode combinations:

| Map | Hardpoint | Search & Destroy | Overload |
|---|:---:|:---:|:---:|
| Colossus | ✓ | — | — |
| Den | ✓ | ✓ | ✓ |
| Exposure | — | — | ✓ |
| Fringe | — | ✓ | — |
| Gridlock | ✓ | ✓ | ✓ |
| Hacienda | ✓ | ✓ | — |
| Raid | — | ✓ | — |
| Sake | ✓ | ✓ | — |
| Scar | ✓ | — | ✓ |

### Hardpoint
- Colossus
- Den
- Gridlock
- Hacienda
- Sake
- Scar

### Search & Destroy
- Den
- Fringe
- Gridlock
- Hacienda
- Raid
- Sake

### Overload
- Den
- Exposure
- Gridlock
- Scar

This matrix should be the source of truth for the current Coach Intel map selector.

Do not expose unsupported map/mode combinations in normal coaching workflows.

---

# 16. CDL Ruleset Profile

Create a versioned ruleset object:

```text
CDL RULESET
Game            Black Ops 7
Season          2026
Version         Current official CDL profile
Source          Call of Duty League Competitive Settings
Last Checked    <timestamp>
Status          CURRENT
```

The profile should contain:

- Current modes
- Current map pool per mode
- Current CDL game settings
- Current restricted items
- Ruleset/source version
- Last verified timestamp

The application should not scatter hard-coded CDL rules throughout components.

Use:

`CDL Ruleset → Maps & Modes → Match Setup → Strategy Board → Veto Lab`

so a future official rules update can be applied centrally.

---

# 17. Official CDL Settings Sync

Implement a **CDL Settings Inspector** for the official competitive-settings page.

Purpose:

- Check the official CDL page for changes.
- Maintain the current Maps & Modes matrix.
- Maintain game-mode settings.
- Maintain restricted items/settings required for competitive preparation.
- Record when the rules were last checked.

Preferred behavior:

```text
CDL SETTINGS
Current Profile     2026 / BO7
Last Checked        16 Aug 2026
Changes             NONE
Source              OFFICIAL CDL

[CHECK FOR UPDATE]
```

If a change is detected:

```text
CDL RULESET UPDATE DETECTED

Gridlock added to:
✓ Hardpoint
✓ Search & Destroy
✓ Overload

[REVIEW UPDATE] [APPLY]
```

Do not silently alter saved strategies or historical matches after a rules update.

Historical records must retain the ruleset version under which they were played.

---

# 18. Mode Selector

The Maps & Modes workspace begins with the current CDL modes:

```text
[ HARDPOINT ] [ SEARCH & DESTROY ] [ OVERLOAD ]
```

Selecting a mode immediately filters the map cards to only valid current CDL maps for that mode.

Example:

```text
HARDPOINT

Colossus
Den
Gridlock
Hacienda
Sake
Scar
```

Selecting **Den** can expose all supported CDL modes for Den:

```text
DEN

[ HARDPOINT ] [ SEARCH & DESTROY ] [ OVERLOAD ]
```

Therefore users can navigate either:

`Mode → Map`

or:

`Map → Supported Mode`

---

# 19. Map Library

For now, the Coach Intel production map library should contain the **union of all current CDL maps only**:

- Colossus
- Den
- Exposure
- Fringe
- Gridlock
- Hacienda
- Raid
- Sake
- Scar

Each map record should contain:

```text
map_id
name
game_title
season
ruleset_version
supported_cdl_modes[]
active
map_asset
callouts
created_at
updated_at
```

A map can support one, two, or all three current CDL modes.

Example:

```text
DEN
supported_cdl_modes:
- HARDPOINT
- SEARCH_AND_DESTROY
- OVERLOAD
```

---

# 20. Map Cards

Each map card should show:

- Map image
- Map name
- Supported CDL modes
- Team record
- Win %
- Last 5
- Coach confidence
- Data confidence
- Current form
- Saved Strategies count
- Needs Review count

Example:

```text
DEN

HP      8–3      72.7%
S&D     4–4      50.0%
OVL     5–2      71.4%

SAVED STRATS       12
COACH CONFIDENCE   HIGH
RECENT TREND       ↑
```

---

# 21. Map Detail Page

Opening a map should show only modes that the current CDL ruleset supports for that map.

Example:

```text
DEN

OVERVIEW
HARDPOINT
SEARCH & DESTROY
OVERLOAD
STRATS & SETUPS
POSITIONS
VOD
NOTES
INTEL
```

For Raid:

```text
RAID

OVERVIEW
SEARCH & DESTROY
STRATS & SETUPS
POSITIONS
VOD
NOTES
INTEL
```

Do not show empty unsupported mode tabs.

---

# 22. Strategy Board — Core Requirement

The Coach Intel Strategy Board must allow coaches to place the **actual team players directly onto the selected map** and save the arrangement as a reusable setup/strategy.

This is not just a drawing canvas.

It is a structured tactical workspace connected to the team roster.

Core tools:

- Add team player
- Add opponent marker
- Drag player position
- Rotate/facing indicator — optional
- Player role label
- Draw
- Arrow
- Route
- Area highlight
- Objective marker
- Spawn marker
- Text label
- Numbered sequence
- Eraser
- Undo / redo
- Voice note
- Written note

---

# 23. Place Real Roster Players on the Map

When the coach opens a strategy board:

```text
TEAM ROSTER

Shotzzy
Dashy
Huke
Ghosty

[DRAG PLAYER TO MAP]
```

Each player becomes a tactical marker using:

- Gamer tag
- Initials/avatar
- Team identity
- Optional role

Example board:

```text
              [DASHY]

       [GHOSTY]      → route

          P3

[SHOTZZY] ---------> [HUKE]
```

Player positions must be stored as structured coordinates rather than baked into an image.

Example:

```json
{
  "player_id": "player_01",
  "x": 0.42,
  "y": 0.61,
  "label": "Shotzzy"
}
```

Normalized coordinates allow the setup to scale with different screen sizes.

---

# 24. Save Setup / Strat

The coach must be able to save the current board.

Primary action:

`SAVE STRAT`

Default naming:

`Strat 1`

Then:

`Strat 2`

`Strat 3`

etc.

The coach can immediately rename it.

Examples:

- Strat 1
- P1 Opening
- P2 Break
- P2 → P3 Rotation
- A Fast Hit
- B Retake
- Round 1 Defense
- Den OVL Opening
- vs OpTic Setup

Save:

```text
strategy_id
strategy_name
map
mode
team
roster
opponent_optional
ruleset_version
player_positions
opponent_positions
routes
drawings
markers
notes
voice_notes
tags
status
created_by
created_at
updated_at
```

---

# 25. Saved Strats & Setups Library

Each map/mode gets its own saved tactical library.

Example:

```text
DEN / HARDPOINT

SAVED STRATS

01  P1 Opening                 APPROVED
02  P1 Break                   DRAFT
03  P1 → P2 Rotation           MATCH READY
04  P2 Hold                    APPROVED
05  P2 Break                   NEEDS REVIEW
06  vs OpTic P3 Setup          OPPONENT SPECIFIC

[+ NEW STRAT]
```

Filters:

- All
- General
- Opponent-specific
- Draft
- Approved
- Match Ready
- Archived

Sort by:

- Name
- Last updated
- Created
- Opponent
- Hill/site
- Status

---

# 26. Duplicate Strategy

Support:

`DUPLICATE`

Example:

`P1 Opening`

→

`P1 Opening Copy`

This is important because coaches often need minor variations of the same setup.

Allow:

`SAVE AS NEW STRAT`

so changes do not overwrite the original.

---

# 27. Strategy Versions

Each saved strategy should support version history.

Example:

```text
P2 → P3 Rotation

v1  Initial setup
v2  Changed Shotzzy route
v3  Adjusted Dashy position
v4  Major III version
```

Actions:

- View version
- Restore version
- Duplicate version
- Compare changes

This prevents valuable setups from being lost.

---

# 28. Player Position Presets

In addition to full strategies, allow saving **position-only setups**.

Example:

```text
SAVE AS

(•) Full Strat
( ) Player Setup Only
```

Player Setup Only stores:

- Player positions
- Roles
- Facing/assignment
- Map
- Mode
- Optional hill/site

Examples:

- Standard P3 Setup
- A Defense Setup
- B Retake Positions
- OVL Defensive Shape

This is useful when the coach wants a reusable formation without routes/drawings.

---

# 29. Mode-Specific Strategy Context

## Hardpoint

Allow strategies to be attached to:

- P1
- P2
- P3
- P4
- etc. according to official map hill sequence
- Opening
- Hold
- Break
- Rotation
- Spawn setup

Examples:

`DEN / HP / P3 / HOLD / Strat 1`

## Search & Destroy

Attach to:

- Offense
- Defense
- A
- B
- Opening
- Default
- Execute
- Fake
- Retake
- Post-plant
- Man advantage
- Man disadvantage

Example:

`RAID / S&D / OFFENSE / A EXECUTE / Strat 3`

## Overload

Attach to:

- Opening
- Attack
- Defense
- Carry route
- Escort
- Reset
- Transition
- Spawn setup

Example:

`GRIDLOCK / OVL / OPENING / Strat 2`

---

# 30. Strategy Board Layers

Toggleable layers:

```text
MAP
CALLOUTS
OBJECTIVES
SPAWNS
TEAM PLAYERS
OPPONENTS
ROUTES
DRAWINGS
NOTES
VOD
INTEL
```

Mode-specific tactical overlays should use the currently active official CDL settings/map configuration.

---

# 31. Strategy Status

Use:

- DRAFT
- READY FOR REVIEW
- APPROVED
- IN PRACTICE
- MATCH READY
- ARCHIVED

Add:

- Approved by
- Last reviewed
- Ruleset version

If a CDL map/mode/settings change impacts a saved strategy:

`RULESET CHANGED · REVIEW REQUIRED`

Do not delete it.

---

# 32. Strategy Collaboration

Coaches/analysts should be able to:

- Edit
- Comment
- Add written notes
- Add voice notes
- Reposition players
- Draw revisions
- Duplicate strategy
- Save as new
- Approve
- Assign for review
- Assign to practice
- Link VOD
- Link match
- Link opponent

Players can receive read-only or review access based on permissions.

---

# 33. Strategy Animation — Later Enhancement

Prepare the model for steps:

```text
STEP 1   SPAWN
STEP 2   OPENING ROUTES
STEP 3   FIRST ENGAGEMENT
STEP 4   SETUP
STEP 5   ROTATION
```

Each step stores player positions.

This allows future animated playback without redesigning the strategy storage model.

For the first implementation, **static saved setups/strats are the priority**.


# 34. External Data + Map Intel

When Breaking Point provides external data relevant to a selected map/mode, surface it alongside internal data.

Example:

```text
DEN HARDPOINT

OUR TEAM
8–3 · 72.7%

OPPONENT
6–5 · 54.5%
Source: Breaking Point

MATCHUP EDGE
+18.2 pts
```

Never combine public and private datasets without labeling the source.

---

# 35. Breaking Point Opponent Auto-Build

When a coach selects an opponent:

1. Search linked Breaking Point team.
2. Refresh current roster.
3. Fetch recent matches.
4. Fetch available player stats.
5. Fetch team/map stats where available.
6. Normalize.
7. Flag conflicts.
8. Build opponent scouting page.

Button:

`REFRESH OPPONENT INTEL`

---

# 36. Map Selection for Match Preparation

Pre-match workflow:

```text
MATCH
→ OPPONENT
→ MAPS & MODES
→ MAP POOL
→ VETO LAB
→ STRATEGY
→ MATCH READY
```

For every probable map:

- Open map detail
- Review own performance
- Review opponent performance
- Open playbook
- Review relevant VOD
- Review Intel
- Confirm strategy

Readiness indicator:

`DEN HP · 92% READY`

---

# 37. Map Readiness Score

Calculate from workflow completion, not just win rate.

Possible inputs:

- Approved strategy
- Current roster reviewed
- Opponent reviewed
- VOD reviewed
- Practice completed
- Open review items
- Data freshness

Example:

```text
DEN HP

Performance Confidence    82
Strategy Ready            YES
VOD Reviewed              YES
Opponent Reviewed         YES
Practice Complete         NO
Open Review Items         2

MATCH READINESS            74/100
```

---

# 38. Data Freshness

Add freshness badges:

- LIVE / JUST UPDATED
- < 24H
- < 7D
- STALE
- UNKNOWN

Breaking Point-derived scouting must display freshness.

Example:

`Opponent stats · Breaking Point · updated 3h ago`

---

# 39. Source Failure Handling

If Breaking Point becomes unavailable:

Do not break Coach Intel.

Display:

> Breaking Point is temporarily unavailable. Existing cached data remains available.

Keep:

- Manual data
- Internal Coach Intel data
- Cached external data
- Notes
- Strategies
- VOD
- Review

---

# 40. No Silent Overwrite

External sync must never overwrite internal coach edits.

Example:

```text
Breaking Point team roster differs from Coach Intel.

[REVIEW DIFFERENCE]
BP: Player A / B / C / D
CI: Player A / B / C / Player E
```

Coach confirms the change.

---

# 41. Recommended Implementation Components

```text
/services/breakingPoint/
  adapter
  apiClient
  webInspector
  parser
  mapper
  validator
  cache

/modules/mapsModes/
  mapLibrary
  modeLibrary
  strategyBoard
  playbooks
  mapIntel
  mapReadiness

/modules/dataQuality/
  conflicts
  provenance
  externalReview
```

Adapt naming to the existing repository rather than forcing this exact structure.

---

# 42. Admin Controls

Settings:

**External Data**
- Enable Breaking Point
- API mode
- Web Inspector fallback
- Sync frequency
- Cache duration
- Attribution
- Disable connector

**Maps & Modes**
- Current title: BO7
- Current season
- Active maps
- Active modes
- Competitive pool
- Custom callouts
- Upload internal tactical map asset
- Archive retired maps

---

# 43. Do Not Copy GameCoach Assets

GameCoach should be treated as product/workflow inspiration.

Do not copy:

- Proprietary map images
- UI assets
- Source code
- Paid board assets
- Animations
- Icons
- Exact layouts

Coach Intel should use properly licensed/original map assets and its own design system.

---

# 44. Current CDL Initial Setup

Coach Intel should ship with the current official CDL BO7 configuration only.

## Modes

- Hardpoint
- Search & Destroy
- Overload

## CDL Map Library

- Colossus
- Den
- Exposure
- Fringe
- Gridlock
- Hacienda
- Raid
- Sake
- Scar

## Hardpoint

- Colossus
- Den
- Gridlock
- Hacienda
- Sake
- Scar

## Search & Destroy

- Den
- Fringe
- Gridlock
- Hacienda
- Raid
- Sake

## Overload

- Den
- Exposure
- Gridlock
- Scar

The official CDL Competitive Settings profile is the source of truth.

Do not include non-CDL BO7 maps in the initial production selector.


# 45. Command Center Additions

Add:

### External Data
`Breaking Point · Synced`

### Match Preparation
`5 Maps Reviewed · 2 Need Attention`

### Map Intel
`Den HP ↑`

### Strategy Review
`3 Strategies Need Approval`

### Data Freshness
`Opponent updated 2h ago`

---

# 46. New Navigation

Recommended updated navigation:

**Command Center → Organization → Teams → Players → Matches → Maps & Modes → Strategies → Performance → Scouting → Veto Lab → Intel → Notes/VOD → Review → Reports → Data**

---

# 47. Implementation Priority

## Phase 1 — Breaking Point Foundation

1. Source adapter interface
2. Breaking Point player search
3. Team search
4. Match import
5. Player stats import
6. Source attribution
7. Cache
8. Data quality review
9. Manual fallback

## Phase 2 — Maps & Modes

1. BO7 map library
2. Mode selector
3. Competitive pool controls
4. Map pages
5. Map stats
6. Notes / Intel
7. Strategy records

## Phase 3 — Strategy Board

1. Map canvas
2. Markers
3. Drawing
4. Arrows/routes
5. Player assignment
6. Voice notes
7. Collaboration
8. Review
9. Playbooks

## Phase 4 — Intelligence

1. Breaking Point opponent auto-build
2. Matchup comparison
3. Map matchup
4. Strategy vs reality
5. Map readiness
6. Pre-match integration
7. Veto Lab integration

---

# 48. Acceptance Criteria

The feature is complete when a coach can:

1. Search a player/team on Breaking Point from Coach Intel.
2. Preview data before linking/importing.
3. See when and where the external data came from.
4. Refresh opponent information safely.
5. Resolve conflicting player/team records.
6. Select BO7 mode.
7. Select a map.
8. See team performance for that map/mode.
9. Create a strategy.
10. Draw routes and positions.
11. Add written or microphone notes.
12. Link a strategy to an opponent/match.
13. Mark the strategy for review.
14. Add the strategy to a playbook.
15. Use external opponent data within map preparation.
16. Continue using Coach Intel if Breaking Point is unavailable.

---

# 49. Product Rule

Breaking Point should act as an **external intelligence source**, not as the foundation of Coach Intel.

GameCoach should act as **strategy-workflow inspiration**, not as a dependency.

Coach Intel owns the final workflow:

**SOURCE → VERIFY → ORGANIZE → ANALYZE → PLAN → REVIEW → COMPETE**

---

# 50. Sources Reviewed

Research for this add-on reviewed the current public Breaking Point player stats, advanced stats, player/team/match structures, BO7 competitive map coverage, and GameCoach's BO7 strategy-board map library and collaboration workflow.

Important current observations:

- Breaking Point currently exposes BO7 player stats including overall K/D, Slayer Rating, BP Rating, Hardpoint K/D/KP10M/DMG10M, S&D K/D/KPR/opening-duel win %, and Overload K/D/KP10M/DMG10M.
- Breaking Point currently exposes advanced-stat sections for Hardpoint, Search & Destroy, Overload and historical mode categories.
- Breaking Point visibly presents an API link, but public search did not expose usable API documentation; therefore official API access must be verified before implementation.
- GameCoach's current BO7 strategy area lists 16 strategy-board maps and supports real-time collaboration, animated executes/rotations, and playbooks.
- Breaking Point's published BO7 competitive map-set coverage identifies Blackheart, Colossus, Den, Exposure and Scar for Hardpoint, and Den, Exposure and Scar for Overload.
- Breaking Point's Terms of Service state that content/material rights remain with Breaking Point, so production use must verify API/data licensing rather than relying on unrestricted scraping.

---

## Brand Lock

**COACH INTEL**

**Competitive Intelligence for Call of Duty**

**Know More. Win More.**
