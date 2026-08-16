# Coach Intel — Product Intelligence Add-On

**Brand:** Coach Intel  
**Descriptor:** Competitive Intelligence for Call of Duty  
**Purpose:** Add-on specification for the existing Coach Intel Brand Identity & Product Plan  
**Scope:** Call of Duty only. No multi-game architecture or game selector.

---

## 1. Product Objective

Coach Intel should become the **working intelligence environment for a competitive Call of Duty organization** — not just a statistics dashboard.

The platform should combine:

**MATCH DATA + PLAYER DATA + TEAM DATA + COACH INPUT + VOD CONTEXT + OPPONENT DATA → INTEL → REVIEW → ACTION**

Every major screen should help answer at least one of these questions:

1. What is happening?
2. Why is it happening?
3. Is it improving or getting worse?
4. Where is the biggest competitive advantage?
5. What should the coach review?
6. What should the team practice?
7. What should we prepare against this opponent?
8. Which maps/modes should we favor or avoid?
9. Which player/team trend needs attention?
10. How confident are we in this conclusion?

Coach Intel should **never reduce competitive analysis to K/D alone**.

---

# 2. Core Product Structure

Recommended primary navigation:

**Command Center → Organization → Teams → Players → Matches → Maps & Modes → Performance → Scouting → Veto Lab → Intel → Notes/VOD → Review → Reports**

Utility areas:

**Global Search · Data Import · Data Quality · Settings · Access**

---

# 3. Organization Intelligence

The Organization page should provide a high-level competitive view across all teams belonging to the organization.

## Organization Overview

Show:

- Organization identity
- Current Call of Duty title / season
- Active teams
- Current rosters
- Coaches / analysts
- Overall series record
- Overall map record
- Organization win rate
- Recent form
- Current competition/stage
- Team-by-team performance
- Upcoming matches
- Recent results
- Most important Intel signals
- Items needing review
- Recent coaching notes
- Top improving player
- Largest declining metric
- Strongest map/mode
- Weakest map/mode
- Current organization priorities

## Organization Comparisons

Allow:

- Team vs team
- Current roster vs previous roster
- Current stage vs previous stage
- LAN vs online
- Qualifiers vs tournament
- Last 5 / 10 / 20 maps
- Custom date range

Never mix incompatible samples without clearly showing the selected scope.

---

# 4. Team Intelligence Pages

Every team should have its own complete performance workspace.

## Team Header

Display:

- Team name
- Organization
- Team logo
- Active roster
- Coach
- Analyst
- Current series record
- Current map record
- Series win rate
- Map win rate
- Current form
- Stage/event
- Next opponent

## Team Tabs

**OVERVIEW · ROSTER · MATCHES · MODES · MAPS · TRENDS · MATCHUPS · NOTES · INTEL**

## Team Overview Cards

Recommended cards:

- Series Win %
- Map Win %
- Hardpoint Win %
- Search & Destroy Win %
- Current third competitive mode Win %
- Last 5 Series
- Last 10 Maps
- Score differential
- Team K/D
- Damage differential
- Strongest map
- Weakest map
- Best recent trend
- Largest performance risk

---

# 5. Player Intelligence Profiles

Player pages should combine raw production with context, role, form, team impact, and coaching observations.

## Player Header

- Gamer tag
- Full name — optional/internal
- Team
- Current roster status
- Role / playstyle label
- Active since
- Current form
- Team rank
- League/database percentile
- Last match
- Next match

## Overall Metrics

Where data is available:

- K/D
- Adjusted/normalized K/D
- Kills
- Deaths
- Damage
- Damage per 10 minutes
- Kills per 10 minutes
- Engagements
- Objective contribution
- Mode-specific metrics
- Online vs LAN splits
- Wins/losses while active
- Recent form delta

## Player Trend Windows

Every major metric should support:

- Last map
- Last series
- Last 5 maps
- Last 10 maps
- Last 5 series
- Current stage
- Current event
- Season
- Career/title history where available
- Custom range

Show both the value and the change against the player's own baseline.

Example:

`HP K/D 1.12  ↑ 0.08 vs 30-map baseline`

---

# 6. Player Role & Playstyle Profiles

K/D alone cannot explain what a player contributes.

Create a **Player Profile Radar / Role Card** based on measurable behavior where data supports it.

Potential dimensions:

- Slaying
- Damage output
- Pace / engagements
- Objective presence
- Opening engagement frequency
- Opening engagement success
- Trading
- Survival
- Rotation involvement
- Hill presence
- Search impact
- Clutch impact

Do not label a player with a role purely from one statistic. Allow coach confirmation or manual override.

Example:

**SYSTEM PROFILE:** High-Pace Entry  
**COACH PROFILE:** Entry SMG  
**CONFIDENCE:** High

---

# 7. Form & Momentum Engine

Coach Intel should distinguish **season strength** from **current form**.

## Form Status

Possible states:

- HOT
- IMPROVING
- STABLE
- VOLATILE
- DECLINING
- COLD
- INSUFFICIENT SAMPLE

## Form Calculation Principles

Use multiple indicators rather than one metric:

- Recent vs baseline K/D
- Damage output
- Mode-specific performance
- Opening duels
- Objective metrics
- Win contribution
- Opponent strength
- LAN/online context
- Sample size

Always display why a form label was assigned.

---

# 8. Hardpoint Intelligence

Public Call of Duty analytics already go beyond basic K/D into metrics such as kills/damage per 10 minutes, holding, breaking, rotations, hill time, average margin, and points per hold opportunity. Coach Intel should make these metrics actionable.

## Team Hardpoint Metrics

Where source data permits:

- Hardpoint Win %
- Map record
- Average score
- Average opponent score
- Average score differential
- Team K/D
- Damage differential
- Kills per 10 minutes
- Damage per 10 minutes
- Hill time
- Hold %
- Break %
- Rotation %
- Points per hold opportunity
- First hill performance
- Individual hill performance
- Hill sequence performance
- Winning vs losing map splits
- Close-map record
- Comeback record

## Hill-by-Hill Intelligence

For each Hardpoint map:

- P1–Pn win contribution
- Average points won per hill
- Average points allowed
- Hold success
- Break success
- Rotation success
- Entry kills around hill
- Hill deaths
- Player hill involvement
- Repeat weak hills
- Best/worst rotations

Example Intel:

> **HP SIGNAL — DEN P3**  
> Team loses first setup on P3 in 64% of tracked maps. Opponents average +21 points from this hill sequence.

## Rotation Intel

Surface:

- Rotations won/lost
- Rotation timing where known
- First player to rotate
- Kill differential during transition
- Old-time vs rotation balance
- Hills repeatedly lost from poor setup

---

# 9. Search & Destroy Intelligence

Search & Destroy requires its own analysis system.

## Player S&D Metrics

Where available:

- S&D K/D
- Kills per round
- Average damage per round
- Opening duel attempts
- Opening duel wins
- Opening duel win %
- First bloods
- First deaths
- Plants
- Defuses
- Clutches
- 1v1 record
- 1v2+ record
- Trade kills
- Untraded deaths

## Team S&D Metrics

- Map win %
- Round win %
- Offensive round win %
- Defensive round win %
- First blood %
- Round win after first blood
- Round win after first death
- Plant conversion
- Post-plant conversion
- Retake success
- Site A / B preference
- Site A / B success
- Round 11 / deciding-round record
- Man-advantage conversion
- Man-disadvantage recovery
- Opening route tendencies
- Repeat opponent tendencies

## S&D Situation Explorer

Allow filters such as:

`Map → Offense/Defense → Bomb Site → First Blood State → Round Number → Opponent`

Example:

> **S&D SIGNAL**  
> On offense, Team A attacks B on 71% of opening rounds but wins only 38% of those rounds.

---

# 10. Current / Historical Third-Mode Intelligence

Coach Intel is Call of Duty-only, but the competitive third mode can change by title or season.

The data model should therefore use **mode templates**, not assume one permanent mode.

Support the active competitive ruleset and historical modes where relevant, including metrics appropriate to the mode.

Examples of mode-aware data:

- Win %
- K/D
- Kills per 10
- Damage per 10
- Offensive success
- Defensive success
- Objective progress
- Objective conversions
- Round/map differential
- Player objective contribution

The UI should only show metrics that actually apply to the selected title, season, and mode.

---

# 11. Map Intelligence

Each map should have a dedicated intelligence page.

## Map Overview

- Overall record
- Mode-specific record
- Win %
- Last played
- Recent form
- LAN record
- Online record
- Average score/margin
- Player performance
- Opponent performance
- Side performance where relevant
- Recent coaching notes
- Current confidence rating

## Map Confidence

Allow both:

**DATA CONFIDENCE** — derived from results/sample  
**COACH CONFIDENCE** — manually entered

Example:

`DEN HARDPOINT`
- Data confidence: 82/100
- Coach confidence: 65/100
- Status: REVIEW

This difference itself can create useful Intel.

---

# 12. Map Pool Matrix

Create a fast visual matrix:

| Map / Mode | Record | Win % | Last 5 | Org Rank | Opponent Rank | Intel |
|---|---:|---:|---|---|---|---|
| Den HP | 8–3 | 72.7% | 4–1 | Strong | Weak | FAVOR |
| Raid S&D | 3–6 | 33.3% | 1–4 | Weak | Strong | AVOID |
| ... | ... | ... | ... | ... | ... | ... |

Use this as the basis for preparation and veto recommendations.

---

# 13. Veto Lab

The current CDL competitive process includes map veto/pick decisions and side selection. This makes a **Veto Lab** one of the most valuable Coach Intel features.

## Veto Lab Inputs

- Your team's map records
- Opponent map records
- Recent form
- LAN/online context
- Map sample size
- Head-to-head
- Side preference
- Current map pool
- Historical veto behavior
- Opponent pick frequency
- Opponent ban frequency
- Your coach's confidence
- Opponent strength by mode

## Veto Lab Output

Show:

- Recommended ban
- Recommended pick
- Expected opponent ban
- Expected opponent pick
- Best likely series path
- Dangerous map outcomes
- Side preference
- Confidence score
- Reasons supporting each recommendation

Example:

> **RECOMMENDED HP BAN — RAID**  
> Confidence: 87%  
> Your record: 2–5  
> Opponent record: 7–2  
> Opponent recent form: 4–1  
> Your average margin: -31

Recommendations must be explainable, never black-box instructions.

---

# 14. Veto History & Opponent Tendencies

Track what teams actually do during vetoes.

For each opponent:

- Most banned HP map
- Most picked HP map
- Most banned S&D map
- Most picked S&D map
- Side preferences
- Changes by stage/event
- Veto behavior after roster changes
- Veto behavior against specific team styles

Flag meaningful pattern changes.

Example:

> **VETO CHANGE**  
> Opponent stopped banning Den HP after its roster change and has picked it in 3 of its last 4 series.

---

# 15. Opponent Scouting Hub

Every opponent should have an automatically assembled scouting page.

## Scouting Overview

- Current roster
- Recent roster changes
- Series record
- Map record
- Current form
- Mode win rates
- Strongest maps
- Weakest maps
- Player form
- Veto tendencies
- Head-to-head
- Recent opponents
- LAN/online split
- Recent coaching notes
- Key Intel

## "How They Win"

Automatically identify recurring strengths, for example:

- Strong HP holds
- High break success
- Dominant S&D offense
- Strong opening-duel player
- High map-4 win rate
- Consistent close-map wins

## "How They Lose"

Identify recurring vulnerabilities:

- Weak specific hill
- Poor defensive S&D
- Low first-blood conversion
- Weak map
- Poor record after losing map 1
- Struggles against high-pace teams

---

# 16. Head-to-Head Intelligence

Dedicated matchup view:

**OUR TEAM vs OPPONENT**

Show:

- Series H2H
- Map H2H
- Mode H2H
- Current roster H2H
- Previous roster H2H
- Player matchup
- Map pool comparison
- Recent form comparison
- Veto history
- LAN-only comparison
- Shared-opponent comparison

### Shared Opponent Analysis

Compare both teams against the same recent opponents.

This helps reduce misleading conclusions created by different strength-of-schedule samples.

---

# 17. Strength of Schedule / Opponent Quality

A 1.10 K/D against weak opposition is not necessarily equivalent to a 1.10 against the best teams.

Coach Intel should support:

- Opponent quality rating
- Strength of schedule
- Performance vs top teams
- Performance vs lower-ranked teams
- Adjusted form indicator

Use this as context, not as an absolute truth.

---

# 18. Clutch & Pressure Intelligence

Add pressure-specific filters.

Potential scenarios:

- Game 5
- Deciding map
- Final round
- Round 11 / deciding round
- Close Hardpoints
- Maps decided by ≤10 / ≤20 points
- Elimination matches
- LAN elimination matches
- Match point situations
- Down 0–2 in series
- Up 2–0 in series

Show team and player performance with a **minimum sample warning**.

Avoid assigning psychological labels from tiny samples.

---

# 19. Roster & Lineup Intelligence

Roster changes can invalidate older comparisons.

Every statistic should know:

- Which roster played
- Start/end date
- Substitute appearances
- Coach change
- Event/stage
- Active title

## Roster Timeline

Show:

`Roster A → Roster B → Roster C`

Allow analysis to be scoped to:

- Current roster only
- Selected roster
- Entire season

## Before / After Comparison

When a roster changes:

- Team K/D delta
- Map win % delta
- Mode delta
- Pace delta
- S&D delta
- HP fundamentals delta
- Player role changes

Never imply causation solely from the change.

---

# 20. Player Synergy & Pair Intelligence

Analyze combinations where data supports it.

Potential insights:

- Best-performing player pair
- Entry/trade pair
- AR/SMG pairing
- Pair survival
- Pair kill differential
- Pair win rate
- Pair performance by mode
- Lineup performance

Coach Intel should present this as **association**, not proof that the pair caused the result.

---

# 21. Trade & Teamwork Intelligence

Where event-level data is available, include:

- Trade kills
- Trade deaths
- Trade %
- Untraded kills
- Untraded deaths
- Team-shot involvement
- First kill follow-up
- Man-advantage conversion
- Multi-kill frequency
- Death isolation

Example:

> **TEAMWORK RISK**  
> Untraded deaths have increased 18% across the last 10 Hardpoint maps.

---

# 22. Performance Baselines & Percentiles

Every player/team should have meaningful benchmarks.

Compare against:

- Own season average
- Own last 30 maps
- Team average
- League/database average
- Role peer average
- Top-quartile players
- Opponent equivalent

Example:

`S&D Opening Duel Win %: 61.2`
`League percentile: 86th`

Use percentiles only when the comparison population is valid and sufficiently large.

---

# 23. Practice / Scrim Intelligence

Public match performance and scrim performance should be **separate datasets**.

## Scrim Entry

Allow coaches to record:

- Date
- Opponent
- Map
- Mode
- Score
- Result
- Roster
- Notes
- Objectives
- VOD link
- Confidence
- Tags

## Scrim Dashboard

- Scrim map record
- Practice volume
- Map repetitions
- Recent practice results
- Frequent practice opponents
- Practice priorities
- Coach confidence
- Public match vs scrim comparison

Scrim data should be private by default.

---

# 24. Practice Planner

Turn Intel into preparation.

Example workflow:

**Intel Signal → Review → Practice Task**

Example:

> Weak P3 setup on Den HP  
> → Add to Review  
> → Create Practice Task  
> → 5 repetitions of P2→P3 rotation setup  
> → Assign to Main Roster  
> → Review after next scrim

Practice tasks can contain:

- Priority
- Map/mode
- Objective
- Assigned players
- Coach
- Notes
- Due date
- Review status
- Linked Intel
- Linked VOD

---

# 25. Coaching Notes Workspace

Maintain the previously defined collaborative text system.

## Note Types

- Team note
- Player note
- Match note
- Map note
- Mode note
- Opponent note
- Veto note
- Scrim note
- Practice note
- General organization note

## Required Features

- Shared editing
- Autosave
- Author
- Timestamp
- Tags
- Search
- Pin
- Link to relevant entity
- Needs Review state
- Resolved state
- Note history

---

# 26. Voice Intelligence Capture

Keep the microphone input as a first-class coaching tool.

Flow:

**MIC → RECORD → TRANSCRIBE → REVIEW → LINK → SAVE**

Before saving, allow the coach to link the transcript to:

- Team
- Player
- Match
- Map
- Mode
- Opponent
- VOD timestamp
- Practice task

Optional future processing:

- Summarize
- Extract action items
- Detect player names
- Detect maps/modes
- Suggest tags
- Create Intel candidates

AI-generated interpretation must remain reviewable.

---

# 27. VOD & Clip Intelligence

Video review is fundamental to esports coaching, so Coach Intel should connect observations to video instead of keeping notes isolated.

## VOD Item

Store:

- URL/file reference
- Match
- Map
- Mode
- Opponent
- Date
- Start timestamp
- End timestamp
- Players involved
- Tags
- Coach note
- Intel link
- Review state

## VOD Tags

Examples:

- GOOD ROTATION
- BAD ROTATION
- BREAK
- HOLD
- SPAWN
- OPENING DUEL
- TRADE
- CLUTCH
- SETUP
- COMMS
- POSITIONING
- TIMING
- VETO REVIEW

## Clip Collections

Create collections such as:

- Review with team
- Player A development
- Opponent tendencies
- Den HP setups
- S&D opening routes
- Major preparation

---

# 28. Timeline / Match Story

A match should not just be a final score.

Create a chronological **Match Story**:

- Series start
- Veto result
- Map results
- Key stat changes
- Coach notes
- Voice notes
- VOD clips
- Intel signals
- Review decisions

This becomes the permanent historical record of why a match mattered.

---

# 29. Pre-Match Intelligence Pack

Generate one focused preparation screen/report before a match.

## Pre-Match Pack

**Opponent**
- Current record
- Current roster
- Recent form

**Map Pool**
- Their strongest maps
- Their weakest maps
- Our strongest matchup
- Risk maps

**Veto**
- Expected bans
- Expected picks
- Recommended strategy

**Players**
- Hottest player
- Opening-duel threat
- Most impactful mode player
- Player currently declining

**Tendencies**
- S&D sites/routes
- HP hold/break profile
- Pressure tendencies

**Coach Notes**
- Manual priorities

**Top 3 Intel**
- Only the three most actionable items

The goal is fast match preparation, not information overload.

---

# 30. Post-Match Review

Automatically prepare a structured review after each series.

## Post-Match Summary

- Series result
- Map-by-map result
- Expected vs actual
- Biggest positive
- Biggest problem
- Player performance
- Team fundamentals
- Veto outcome
- Key turning points
- New Intel
- Coach notes
- Items needing review
- Practice actions

## "What Changed?"

Compare the match with the team's established baseline.

Example:

> Break success fell from 28% baseline to 17% in this series.

---

# 31. Intel Feed 2.0

The Intel Feed should be the product's signature feature.

## Intel Types

- PERFORMANCE
- TREND
- MAP
- MODE
- PLAYER
- TEAM
- OPPONENT
- VETO
- ROSTER
- FORM
- PRESSURE
- PRACTICE
- DATA QUALITY
- COACH NOTE

## Intel Card

Every Intel card should contain:

**WHAT HAPPENED**  
Clear statement.

**WHY IT MATTERS**  
Competitive context.

**EVIDENCE**  
Relevant stats/samples.

**CONFIDENCE**  
High / Medium / Low.

**SCOPE**  
Example: Last 10 HP maps.

**ACTION**  
Review / Watch VOD / Add Practice Task / Compare / Dismiss.

Example:

> **MAP INTEL — HIGH CONFIDENCE**  
> Den HP has improved from 42% to 67% win rate across the current roster's last 12 maps. The improvement is driven primarily by stronger P2 and P4 holds.  
> **Action:** Review · Open Den HP · Add to Veto Lab

---

# 32. Intel Confidence System

Every automated insight needs a confidence indicator.

Consider:

- Sample size
- Data completeness
- Recency
- Opponent quality
- Current roster relevance
- LAN/online mix
- Metric consistency

Statuses:

- HIGH CONFIDENCE
- MEDIUM CONFIDENCE
- LOW CONFIDENCE
- INSUFFICIENT DATA

Do not hide uncertainty.

---

# 33. Sample Size Protection

Prevent misleading conclusions.

Examples:

`72% WIN RATE · 5 MAPS`

should never visually look as certain as:

`72% WIN RATE · 50 MAPS`

Add:

- Sample count beside every percentage
- Minimum sample warning
- Confidence reduction
- Optional statistical interval
- "Insufficient sample" state

---

# 34. Data Provenance & Reliability

Every imported statistic should know where it came from.

Store:

- Source
- Import date
- Match/event ID
- Manual/imported status
- Verified/unverified
- Last updated
- Confidence
- Edited by

Example:

`SOURCE: MANUAL · VERIFIED BY COACH · 16 AUG 2026`

This is critical if Coach Intel combines public, manual, scrim, and generated information.

---

# 35. Data Quality Center

Add a dedicated place to resolve bad or incomplete data.

Detect:

- Missing player
- Duplicate match
- Wrong roster
- Missing map
- Invalid score
- Impossible stat
- Unknown source
- Unverified import
- Conflicting result
- Missing VOD
- Incomplete scrim entry

Statuses:

**VALID · NEEDS REVIEW · CONFLICT · INCOMPLETE · RESOLVED**

---

# 36. Import & Manual Entry

Do not make Coach Intel dependent on one external source.

Support:

- Manual match entry
- CSV import
- Structured paste
- Future API integration
- Match URL/reference
- Bulk import

Keep an import preview before committing data.

### Important

Do not silently scrape or republish third-party statistics unless the organization has the right/API permission to use that data.

---

# 37. Title / Season / Patch Awareness

Competitive Call of Duty changes frequently.

Every relevant record should carry:

- Game title
- Season
- Stage
- Event
- Ruleset version
- Map pool version where relevant
- Patch/build period if available

Do not compare across materially different rulesets without warning.

Example:

> **COMPARISON WARNING**  
> These samples span two competitive map-pool versions.

---

# 38. LAN vs Online Intelligence

Make LAN/online a standard filter.

Show:

- LAN K/D
- Online K/D
- LAN team win %
- Online team win %
- Map differences
- Mode differences
- Player deltas

Avoid psychological conclusions; show the measurable difference only.

---

# 39. Event / Stage Intelligence

Filters should support:

- Season
- Stage
- Major qualifiers
- Minor
- Major
- Championship
- LAN
- Online
- Scrim
- Custom event

Allow quick comparison:

`MAJOR 3 vs SEASON BASELINE`

---

# 40. Series Sequence Intelligence

Analyze performance based on map position in a series.

Examples:

- Map 1 record
- Map 2 record
- Map 3 record
- Map 4 record
- Map 5 record
- After winning map 1
- After losing map 1
- When leading 2–0
- When trailing 0–2

This can expose preparation, adaptation, and closing patterns.

---

# 41. Adaptation Intelligence

Measure whether a team improves against the same opponent or map after repeated exposure.

Examples:

- First meeting vs rematch
- First map attempt vs later attempt
- Pre-roster change vs post-roster change
- Before coaching review vs after review

Label as correlation unless causal evidence exists.

---

# 42. Search & Query

Global search should search:

- Players
- Teams
- Matches
- Maps
- Modes
- Opponents
- Notes
- VOD
- Intel
- Reports
- Tags

Future natural-language query examples:

- "Show our last 10 Den HPs."
- "Where are we losing most on S&D defense?"
- "Compare Player A's LAN and online HP."
- "What does this opponent usually ban?"
- "Show all clips tagged BAD ROTATION."

Generated answers should always link back to evidence.

---

# 43. Comparison Lab

Allow side-by-side comparison of:

- Player vs player
- Team vs team
- Current vs previous roster
- Current stage vs previous stage
- LAN vs online
- Map vs map
- Opponent vs opponent
- Last 10 vs season

Comparison should normalize units and use the same sample definition on both sides.

---

# 44. Custom Coach Metrics

Teams may track ideas that public data sources do not.

Allow organizations to define custom fields such as:

- Setup grade
- Comms grade
- Rotation grade
- Discipline grade
- Practice intensity
- VOD review rating
- Coach confidence

Each custom metric must identify whether it is:

- Objective data
- Coach rating
- Player self-rating

Never visually mix subjective ratings with measured statistics without labeling them.

---

# 45. Goals & Benchmarks

Create internal performance targets.

Examples:

- HP break rate target ≥ 28%
- S&D first-blood conversion ≥ 75%
- Reduce untraded deaths by 10%
- Den HP win rate ≥ 60%

Show progress over time.

Link goals to:

- Team
- Player
- Map
- Mode
- Practice task
- Intel

---

# 46. Review Center

Expand the existing **Needs Review** concept into the operational queue.

## Review Sources

- AI/automated Intel
- Voice transcript
- Imported match
- Data conflict
- Player note
- VOD clip
- Scouting observation
- Veto recommendation
- Practice result

## States

- NEEDS REVIEW
- REVIEWED
- ACTION REQUIRED
- ASSIGNED
- RESOLVED
- DISMISSED

## Review Ownership

Allow:

- Assigned coach
- Assigned analyst
- Due date
- Priority
- Comments
- Linked action

---

# 47. Daily Coach Brief

The Command Center can generate a compact daily brief.

Example:

**TODAY**

- Next match: Team B — Friday
- 3 new opponent matches added
- 2 Intel signals changed
- 4 items need review
- Den HP moved from 58% → 64%
- Player A S&D opening-duel form declining
- 2 practice tasks unresolved
- New VOD note from Analyst

The brief should prioritize changes, not repeat static information.

---

# 48. Alerts & Signals

Optional alerts:

- Significant player decline
- Significant player improvement
- Map drops below target
- Opponent roster change
- New opponent result
- Map pool/ruleset change
- New veto pattern
- Data conflict
- Upcoming match preparation incomplete
- Review item overdue

Avoid excessive notifications.

---

# 49. Reports & Export

Generate clean internal reports.

Types:

- Pre-Match Report
- Post-Match Report
- Player Development Report
- Team Performance Report
- Map Pool Report
- Veto Report
- Opponent Scouting Report
- Stage Report
- Organization Overview

Export:

- PDF
- CSV for raw data
- Shareable internal link
- Copy summary

Respect private/internal note permissions.

---

# 50. Permissions & Privacy

Even with lightweight signup, team intelligence can be sensitive.

Recommended roles:

### Owner / Admin
Full workspace control.

### Head Coach
Team data, notes, reports, review, assignments.

### Analyst
Data, scouting, Intel, notes, VOD.

### Coach
Team/player notes, review, performance.

### Player
Limited own/team view based on organization setting.

### Viewer
Read-only selected areas.

Keep:

- Scrim data private
- Opponent scouting private
- Sensitive player notes restricted
- Voice transcripts controlled
- Audit trail for important edits

---

# 51. Audit History

Track changes to important intelligence.

Examples:

- Match result corrected
- Roster changed
- Coach note edited
- Intel dismissed
- Veto recommendation reviewed
- Data source changed

Record:

- Who
- What
- When
- Previous value
- New value

---

# 52. Command Center — Recommended Final Layout

## Top Strip

- Current Team
- Current Season/Stage
- Next Match
- Last Match
- Current Form
- Needs Review

## Performance Row

- Series Win %
- Map Win %
- HP Win %
- S&D Win %
- Third Mode Win %
- Team K/D

## Competitive Advantage

- Strongest map
- Weakest map
- Biggest improving metric
- Biggest risk
- Best veto opportunity

## Intel Feed

Top prioritized insights.

## Opponent Preparation

Next opponent + scouting readiness.

## Player Form

Roster with form indicators.

## Coaching Workspace

Recent notes + `+ NOTE` + `MIC`

## Practice

Open tasks and priorities.

## Review

Items requiring human confirmation.

---

# 53. "One Click Deeper" UX Rule

Every number should lead somewhere useful.

Example:

`HP WIN % 64%`

Click →

`Hardpoint overview`

Click `Den` →

`Den HP`

Click `P3` →

`P3 history + clips + notes + player involvement`

This prevents Coach Intel from becoming a dashboard full of dead-end cards.

---

# 54. Evidence-First AI / Intel Rules

Coach Intel should never produce an insight without evidence.

Every generated insight must include:

- Metric
- Sample
- Time range
- Relevant roster
- Source
- Confidence
- Link to supporting matches/data

Never:

- Invent missing stats
- Claim causation from correlation
- Diagnose mentality
- Judge player effort from stats
- Hide small samples
- Mix scrim/public data without labeling it

---

# 55. Priority Implementation Plan

## Phase A — Foundation / Essential

1. Organization setup
2. Team pages
3. Player pages
4. Roster history
5. Match entry/import
6. Map & mode records
7. Win rates
8. LAN/online + date/stage filters
9. Notes
10. Voice-to-text input
11. Needs Review
12. Data provenance
13. Global search
14. Command Center

## Phase B — Competitive Intelligence

1. Hardpoint intelligence
2. S&D intelligence
3. Third-mode template
4. Map Pool Matrix
5. Opponent Scouting
6. H2H
7. Veto Lab
8. Veto history
9. Player form
10. Intel Feed 2.0
11. Pre-Match Pack
12. Post-Match Review

## Phase C — Coaching Workflow

1. VOD links/timestamps
2. Clip tags
3. Practice tasks
4. Goals/benchmarks
5. Player development
6. Custom coach metrics
7. Daily Coach Brief
8. Reports/export

## Phase D — Advanced

1. Trade/teamwork metrics
2. Player synergy
3. Strength-of-schedule adjustment
4. Pressure situations
5. Adaptation intelligence
6. Natural-language querying
7. Advanced recommendation models
8. Win probability / scenario modelling where data quality supports it

---

# 56. Highest-Value Features to Differentiate Coach Intel

If development resources are limited, prioritize these differentiators:

### 1. Veto Lab
Transforms stats directly into match preparation.

### 2. Intel Feed
Finds changes coaches might otherwise miss.

### 3. Coach Notes + Voice
Combines human context with quantitative data.

### 4. VOD-linked Intel
Connects statistics to reviewable game situations.

### 5. Map/Hill/S&D Situation Intelligence
Moves beyond generic K/D dashboards.

### 6. Pre-Match Pack
Makes opponent preparation fast.

### 7. Post-Match Review
Turns every series into structured learning.

### 8. Data Confidence
Makes Coach Intel trustworthy instead of merely impressive.

---

# 57. Product North Star

Coach Intel should not try to be the place with the **most statistics**.

It should become the place that best answers:

> **What does our Call of Duty team need to know next?**

The final product loop should be:

**COLLECT → UNDERSTAND → PREPARE → COMPETE → REVIEW → IMPROVE**

with Coach Intel acting as the team's permanent competitive memory.

---

# 58. Research Basis

This add-on was informed by current public Call of Duty competitive products and official competitive structures, plus established sports/esports analysis practices.

Key observations used in the specification:

- The official Call of Duty League ecosystem exposes schedules, scores, standings, player statistics, competitive settings, maps/modes, and map-veto rules.
- Breaking Point currently exposes player and advanced mode statistics including K/D, kills/damage rates, S&D opening-duel measures, and team advanced statistics.
- Published Breaking Point analysis has used team-level Hardpoint measures such as hold percentage, break percentage, rotation percentage, average margin, and points per hold opportunity.
- Competitive Call of Duty changes maps, modes, settings, and rules over time, so analytics must be ruleset/title aware.
- Esports analysis research emphasizes video review and context-rich querying rather than relying only on aggregate statistics.
- Professional sports intelligence platforms commonly combine team management, training, scouting, performance insights, and shared workflows.

Coach Intel should use these as inspiration while building its own evidence-first coaching workflow and should verify data licensing/API rights before integrating external sources.

---

## Final Brand Lock

**COACH INTEL**

**Competitive Intelligence for Call of Duty**

**Know More. Win More.**
