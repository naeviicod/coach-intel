# Coach Intel — Team Hub UI/UX Layout Specification

**Product:** Coach Intel  
**Descriptor:** Competitive Intelligence for Call of Duty  
**Purpose:** Implementation-ready UI/UX specification based on the approved Team Hub mockup  
**Scope:** Layout, information architecture, navigation, team-owned Strats/Playbooks, responsive behavior, and visual consistency  
**Important:** Keep the existing Coach Intel brand colors. Do **not** introduce a new palette from the mockup.

---

# 1. Design Direction

The approved direction is a **premium competitive intelligence command interface**:

- Dark, focused, technical
- Dense enough for professional coaching
- Clear visual hierarchy
- Minimal decorative UI
- Data first
- Fast navigation
- Strong team context
- Compact cards
- Consistent spacing
- Subtle borders/elevation
- Coach Intel green used intentionally for active states, important positive signals, selected navigation, and primary actions

The interface should feel like a professional esports operations product rather than a generic SaaS dashboard.

---

# 2. Brand Color Rule

**Use the existing Coach Intel colors already implemented in the application.**

Do not replace the current palette simply to match the mockup.

Apply the existing Coach Intel green to:

- Active navigation
- Primary buttons
- Selected tabs
- Positive indicators
- Active filters
- Small status accents
- Progress indicators
- Important labels

Use existing application colors for:

- Main background
- Elevated surfaces
- Borders
- Primary text
- Secondary text
- Muted text
- Warning
- Error
- Success

## Green Usage Rule

Green should remain an **accent**, not become the background of every card.

Prefer:

`dark surface + thin border + white text + green state`

instead of:

`large bright-green surfaces`

This preserves the premium intelligence aesthetic.

---

# 3. Primary Application Shell

Use a persistent application shell:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ HEADER                                                                      │
├───────────────┬───────────────────────────────────────────────┬─────────────┤
│               │                                               │             │
│ GLOBAL        │                 WORKSPACE                     │ CONTEXT     │
│ NAVIGATION    │                                               │ PANEL       │
│               │                                               │             │
│               │                                               │             │
│               │                                               │             │
├───────────────┴───────────────────────────────────────────────┴─────────────┤
│ STATUS / RULESET / DATA SOURCES                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

Desktop should prioritize a three-column working environment:

1. **Global Navigation**
2. **Main Workspace**
3. **Context Panel**

Inside team pages, the main workspace gains a compact **Team Navigation Rail**.

---

# 4. Global Header

Persistent header.

## Left

```text
COACH INTEL
Competitive Intelligence for Call of Duty
```

Use the existing Coach Intel logo/wordmark.

Keep the descriptor subtle.

## Center

Global search:

```text
Search players, teams, maps, matches, intel...
```

Search should eventually cover:

- Organizations
- Teams
- Players
- Matches
- Maps
- Modes
- Strats
- Notes
- Intel
- VOD
- Reports

## Right

Recommended:

- Notifications
- Help
- Theme/display control if currently supported
- User avatar
- User name
- Current Coach Intel role
- Account menu

Keep this area compact.

---

# 5. Global Navigation

The left navigation is for **cross-team/global product areas**.

Recommended structure:

```text
MAIN
Dashboard
Intel Feed
Calendar
Tasks

ANALYTICS
Teams
Players
Matches
Statistics
VOD Library

TEAM
Team Hub
Scrim Hub

TOOLS
Maps & Modes
Veto Lab
Reports
Rankings

SETTINGS
Integrations
Settings
```

Do not duplicate every Team Hub function in the global navigation.

---

# 6. Team Hub — Core UX Decision

**Strats belong to the Team.**

They should not primarily live as a disconnected global tool.

Correct hierarchy:

```text
Organization
   └── Team
        ├── Overview
        ├── Roster
        ├── Team Notes
        ├── Objectives
        ├── Strats & Playbooks
        ├── Veto History
        ├── Practice Planner
        └── Team Settings
```

Why:

- A Strat belongs to a roster/team context.
- Player positions depend on the roster.
- Playbooks are team-specific.
- Opponent-specific Strats are prepared by a team.
- Practice links directly to team Strats.
- VOD review relates back to team execution.
- Team changes should not pollute another team's playbook.

Global search may find Strats, but the canonical location remains:

`Team Hub → Strats & Playbooks`

---

# 7. Team Selector

At the top of the Team Hub secondary rail:

```text
[ TEAM LOGO ]

IK Esports
Call of Duty Team

⌄
```

Selecting it opens the team switcher.

Example:

```text
IK Esports
Academy
Team B
```

Changing team should update the entire Team Hub context.

Do not require navigation back to the Teams directory merely to switch teams.

---

# 8. Team Navigation Rail

Within Team Hub:

```text
OVERVIEW

ROSTER

TEAM NOTES

OBJECTIVES

STRATS & PLAYBOOKS
    All Strats
    Hardpoint
    Search & Destroy
    Overload

VETO HISTORY

PRACTICE PLANNER

TEAM SETTINGS
```

When **Strats & Playbooks** is selected, expand its mode filters.

This provides fast access without making Strats a separate global module.

---

# 9. Team Hub Overview

Header:

```text
Team Hub

Everything about your team in one place.
```

Top KPI row:

```text
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│ STRATS     │ │ MAPS       │ │ MATCHES    │ │ NEXT MATCH │
│ 28         │ │ 9          │ │ 25         │ │ 2d 4h      │
│ Active     │ │ CDL Pool   │ │ Season     │ │ vs Elevate │
└────────────┘ └────────────┘ └────────────┘ └────────────┘
```

These cards should be clickable.

Examples:

- STRATS → Team Strats
- MAPS → Maps & Modes filtered to team
- MATCHES → Team matches
- NEXT MATCH → Match Prep

---

# 10. Team Season Summary

Keep a compact summary card in the Team Hub rail or overview.

Example:

```text
SEASON SUMMARY

Win Rate          72%     ↑ 8%
Map Win Rate      68%     ↑ 6%
Avg K/D           1.18    ↑ 0.07
Record            18W–7L
```

Below:

- Small trend chart
- W1–W8 or recent match sequence

Avoid oversized charts.

The purpose is fast context.

---

# 11. Strats & Playbooks — Main Team Workspace

This is one of Coach Intel's most important screens.

Header:

```text
STRATS & PLAYBOOKS
```

Controls:

```text
[All Maps ▾]   [Sort: Recent ▾]               [+ NEW STRAT]
```

Tabs:

```text
ALL STRATS | HARDPOINT | SEARCH & DESTROY | OVERLOAD
```

---

# 12. Strat List Layout

Use compact horizontal rows instead of large cards.

Example:

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ [MAP] Den — P2 → P3 Rotation                          ACTIVE             │
│       HARDPOINT                                                         │
│                                                                          │
│       [Player] [Player] [Player] [Player]        Updated Today 14:32  … │
└──────────────────────────────────────────────────────────────────────────┘
```

Each row contains:

- Map thumbnail
- Strat name
- Mode
- Status
- Assigned/current roster players
- Last updated
- More menu

Possible statuses:

- DRAFT
- READY FOR REVIEW
- APPROVED
- ACTIVE
- MATCH READY
- ARCHIVED

---

# 13. Example Team Strat Library

```text
Den — P2 → P3 Rotation
HARDPOINT
ACTIVE

Scar — A Fast Hit
SEARCH & DESTROY
ACTIVE

Sake — P1 Anchor Setup
HARDPOINT
DRAFT

Gridlock — Ticket Control
SEARCH & DESTROY
APPROVED

Raid — A Split Push
SEARCH & DESTROY
ACTIVE

Den — OVL Opening
OVERLOAD
ACTIVE
```

The actual application should use the current configured CDL map/mode combinations.

---

# 14. New Strat Flow

Primary button:

`+ NEW STRAT`

Flow:

```text
New Strat
   ↓
Select Map
   ↓
Select Valid Mode
   ↓
Choose Blank / Duplicate Existing
   ↓
Load Current Team Roster
   ↓
Place Players
   ↓
Draw Routes / Positions / Notes
   ↓
Save
```

Default name:

`Strat 1`

Then:

`Strat 2`

`Strat 3`

Allow immediate rename.

---

# 15. Strat Editor Layout

Recommended desktop layout:

```text
┌────────────────────────────────────────────────────────────────────┐
│ Den / Hardpoint                  Strat: P2 → P3 Rotation            │
│ [Back]                              [Save] [Review] [More]          │
├───────────────┬───────────────────────────────────────┬────────────┤
│ TOOLS         │                                       │ DETAILS    │
│               │                                       │            │
│ Players       │              MAP BOARD                │ Status     │
│ Routes        │                                       │ Players    │
│ Arrow         │                                       │ Notes      │
│ Marker        │                                       │ Tags       │
│ Draw          │                                       │ VOD        │
│ Text          │                                       │ Opponent   │
│ Erase         │                                       │ History    │
└───────────────┴───────────────────────────────────────┴────────────┘
```

The map board should receive the majority of the available space.

---

# 16. Player Placement

Team roster appears as draggable markers.

Example:

```text
TEAM

[ION]
[VEX]
[KIRA]
[DASH]
```

Drag onto the map.

Player marker should display:

- Avatar or initials
- Gamer tag
- Team color/accent
- Selected state

Store positions as normalized coordinates.

---

# 17. Saved Setups

Inside a Strat, allow multiple saved setups.

Example:

```text
P2 → P3 Rotation

SETUPS

1. Standard Rotation
2. Early Anchor
3. Aggressive Pinch
4. vs Elevate
```

Actions:

```text
+ ADD SETUP
DUPLICATE
RENAME
ARCHIVE
```

This prevents coaches from creating completely separate Strats for every tiny variation.

Recommended hierarchy:

```text
TEAM
  └── STRAT
       ├── Setup 1
       ├── Setup 2
       └── Setup 3
```

---

# 18. Map Pool Panel

On Team Hub Overview, show a compact **Map Pool** card.

Tabs:

```text
HARDPOINT | SEARCH & DESTROY | OVERLOAD
```

Then current maps as visual tiles.

Example:

```text
[Colossus] [Den] [Gridlock] [Hacienda] [Sake] [Scar]
```

Each tile can show:

- Map image
- Map name
- Team win %
- Confidence
- Number of Strats

Click:

`Team Hub → Strats & Playbooks → selected map/mode`

---

# 19. Manage Maps

Button:

`MANAGE MAPS`

This connects to the existing map-management functionality.

Do not put destructive map controls directly on the Team Hub overview.

Map management belongs under configuration/settings.

---

# 20. Team Notes

Overview card:

```text
TEAM NOTES
RECENT
```

Rows:

```text
Practice focus this week
Ion Kokkinas · Today 10:12

Scrim vs Elevate — Key takeaways
Vex · Yesterday 21:30

Hacienda HP — Late rotation issue
Kira · Nov 8
```

Action:

`+ NEW NOTE`

Notes should link to:

- Team
- Player
- Map
- Mode
- Match
- Strat
- VOD
- Opponent

where applicable.

---

# 21. Upcoming Match Context Panel

Right-side context panel:

```text
UPCOMING MATCH

IK Esports       VS       Elevate

November 12 · 20:00
CDL — Regular Season

[MATCH PREP →]
```

This should remain visible on the Team Hub overview because it gives the page immediate purpose.

---

# 22. Opponent Intel Panel

Under Upcoming Match:

```text
OPPONENT INTEL

Elevate
Last 10 Matches

6W – 4L

HP Win Rate      64%
S&D Win Rate     58%
OVL Win Rate     62%
```

Then:

```text
STRONG MAPS
Den          76%
Scar         72%
Gridlock     68%

WEAK MAPS
Hacienda     38%
Sake         42%
Colossus     45%
```

Action:

`FULL OPPONENT REPORT →`

Use actual available data; never fabricate values.

---

# 23. Tasks Panel

Right-side lower card:

```text
TASKS
THIS WEEK
```

Examples:

```text
○ Review Elevate VODs
  Due Nov 9

○ Finalize Den HP strats
  Due Nov 10

○ Scrim vs Elevate
  Due Nov 11
```

Action:

`VIEW ALL TASKS →`

Tasks should be able to link to:

- Match
- Strat
- VOD
- Review item
- Player
- Practice session

---

# 24. Context Panel Logic

The right panel should be contextual rather than permanently identical.

## Team Overview

Show:

- Upcoming Match
- Opponent Intel
- Tasks

## Strats

Show:

- Strat status
- Review
- Assigned players
- Linked match
- VOD

## Player

Show:

- Recent form
- Team role
- Current objectives
- Review items

## Match

Show:

- Match readiness
- Opponent
- Open preparation tasks
- Veto status

This makes the third column genuinely useful.

---

# 25. Bottom Status Bar

Desktop can use a thin bottom information bar.

Left:

```text
CDL Ruleset
BO7 — Current Season
```

Center:

```text
● All systems operational
Last data update: 2 min ago
```

Right:

```text
DATA SOURCES

BREAKING POINT
CDL
GAMECOACH
```

Only show sources actually configured in the application.

Do not let this become a large footer.

---

# 26. Information Density

Target:

**High information density without visual noise.**

Rules:

- Reduce unnecessary card padding.
- Avoid huge headings.
- Avoid oversized KPI numbers.
- Keep repeated labels small.
- Use compact status pills.
- Align numbers consistently.
- Use whitespace to group, not to waste space.
- Prefer one strong workspace over many floating cards.

---

# 27. Card System

Standardize cards.

## Primary Card

Used for:

- Strats
- Match
- Opponent Intel
- Map Pool
- Notes

## KPI Card

Used for:

- Win rate
- Maps
- Matches
- Strats
- K/D

## Compact Row

Used for:

- Strat list
- Notes
- Tasks
- Players
- Reviews

## Context Card

Used in right panel.

All cards should share:

- Border radius
- Border treatment
- Surface color
- Header spacing
- Hover behavior
- Internal padding system

---

# 28. Interaction States

Every interactive element needs:

- Default
- Hover
- Active
- Focus
- Disabled
- Loading
- Error

Do not rely on green alone for state.

Use:

- Icon
- Border
- Label
- Shape
- Text

for accessibility.

---

# 29. Selected Navigation

Selected global/team navigation:

- Existing Coach Intel green accent
- Subtle tinted background
- Clear icon state
- Stronger text

Avoid glowing neon effects.

---

# 30. Tables vs Cards

Use cards for summary.

Use rows/tables for repeated operational information.

Correct:

```text
28 Strats → KPI card

Strat Library → compact rows
```

Incorrect:

```text
28 individual giant Strat cards
```

This is critical for scaling the product.

---

# 31. Team-Owned Data Hierarchy

Enforce the following logic:

```text
ORGANIZATION
│
├── TEAM
│   │
│   ├── ROSTER
│   ├── MATCHES
│   ├── NOTES
│   ├── OBJECTIVES
│   │
│   ├── STRATS & PLAYBOOKS
│   │   ├── HARDPOINT
│   │   ├── SEARCH & DESTROY
│   │   └── OVERLOAD
│   │
│   ├── VETO HISTORY
│   ├── PRACTICE
│   └── TEAM SETTINGS
│
└── OTHER TEAMS
```

Global tools can aggregate this information, but should not become the canonical owner.

---

# 32. Organization vs Team

Organization pages answer:

> How is the organization performing?

Team Hub answers:

> What does this team need to know and do?

Do not mix those purposes.

Organization:

- Cross-team summary
- Org record
- Team comparison
- Organization Intel

Team:

- Roster
- Team performance
- Strats
- Practice
- Notes
- Match prep
- Veto
- Opponent Intel

---

# 33. Dashboard vs Team Hub

Avoid duplicating the Team Hub on the global Dashboard.

## Dashboard

Personal/global operational view:

- Items requiring attention
- Upcoming events
- Recent Intel
- Assigned reviews
- Organization-level signals

## Team Hub

Deep team workspace:

- Team KPIs
- Strats
- Map pool
- Notes
- Match prep
- Opponent Intel
- Tasks

---

# 34. Responsive Behavior

## Large Desktop

Use:

```text
Global Nav | Team Rail | Workspace | Context Panel
```

## Standard Desktop

Collapse Team Rail width slightly.

## Small Laptop

Context panel becomes a slide-out/right drawer.

## Tablet

Global navigation collapses to icon rail.

Team navigation becomes horizontal/sub-navigation.

## Mobile

Do not attempt to reproduce the desktop command center exactly.

Prioritize:

- Team selector
- KPIs
- Upcoming match
- Tasks
- Strat list
- Notes

Strategy-board editing can be desktop/tablet-first if precision would be poor on mobile.

---

# 35. Empty States

Example:

```text
NO STRATS YET

Create your first team strategy and place your roster directly on the map.

[+ CREATE STRAT]
```

Map:

```text
NO ACTIVE MAPS

Configure the current CDL map pool.

[MANAGE MAPS]
```

Notes:

```text
NO TEAM NOTES

Capture coaching observations, scrim takeaways and preparation notes.

[+ NEW NOTE]
```

---

# 36. Loading States

Use skeletons matching the actual layout.

Do not replace the whole workspace with a spinner.

Example:

- KPI skeleton
- Strat-row skeleton
- Opponent-card skeleton
- Map-tile skeleton

Keep navigation usable while content loads.

---

# 37. Error States

Errors should remain local where possible.

Example:

Breaking Point unavailable:

```text
OPPONENT INTEL

External opponent data could not be refreshed.

Cached data from 2h ago is shown.

[RETRY]
```

Do not blank the entire Team Hub because one provider fails.

---

# 38. UX Priority Hierarchy

The Team Hub should visually prioritize:

### Priority 1
Next match / match preparation

### Priority 2
Current team performance

### Priority 3
Strats & Playbooks

### Priority 4
Opponent Intel

### Priority 5
Map Pool

### Priority 6
Team Notes / Tasks

This keeps the interface aligned with competitive preparation.

---

# 39. Micro-Interactions

Use restrained animation:

- 120–180 ms hover
- 180–240 ms panel transition
- Subtle row highlight
- Smooth tab indicator
- Small status transitions
- No excessive glow/pulse

Animations should communicate state, not decorate the screen.

---

# 40. Iconography

Use one consistent icon family.

Icons should be:

- Simple
- Thin/medium weight
- Recognizable
- Consistent size

Avoid mixing multiple icon styles.

---

# 41. Typography

Keep the typography already selected/implemented for Coach Intel.

Hierarchy:

```text
Page Title
Section Title
Card Title
Primary Metric
Body
Metadata
Status / Label
```

Stats should use tabular numerals where supported.

Avoid all-caps for long text.

Use uppercase mainly for:

- Section labels
- Status
- Small metadata
- Mode labels

---

# 42. Team Hub Mockup — Structural Reference

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ COACH INTEL            Search...                       User / Notifications │
├────────────┬──────────────┬───────────────────────────────┬────────────────┤
│ GLOBAL NAV │ TEAM NAV     │ TEAM HUB                      │ UPCOMING MATCH │
│            │              │                               │                │
│ Dashboard  │ IK Esports   │ STRATS MAPS MATCHES NEXT     │ Team vs Opp.  │
│ Intel      │              │ [28] [9] [25] [2d 4h]        │                │
│ Calendar   │ Overview     │                               │ Match Prep →   │
│ Tasks      │ Roster       │ STRATS & PLAYBOOKS            ├────────────────┤
│            │ Notes        │                               │ OPPONENT INTEL │
│ Teams      │ Objectives   │ Den — P2→P3 Rotation         │                │
│ Players    │              │ Scar — A Fast Hit            │ Strong Maps    │
│ Matches    │ STRATS       │ Sake — P1 Anchor             │ Weak Maps      │
│ Stats      │  All         │ Gridlock — Ticket Control    │                │
│ VOD        │  HP          │ Raid — A Split               │ Report →       │
│            │  S&D         │ Den — OVL Opening            ├────────────────┤
│ Team Hub   │  OVL         │                               │ TASKS          │
│            │              │ [VIEW ALL STRATS]             │                │
│ Maps       │ Veto History ├───────────────┬───────────────┤ ○ Review VOD  │
│ Veto Lab   │ Practice     │ MAP POOL      │ TEAM NOTES    │ ○ Finalize HP │
│ Reports    │ Settings     │               │               │ ○ Scrim       │
│            │              │ map tiles     │ recent notes  │                │
├────────────┴──────────────┴───────────────┴───────────────┴────────────────┤
│ CDL RULESET       ● SYSTEMS OK       DATA UPDATED       DATA SOURCES       │
└────────────────────────────────────────────────────────────────────────────┘
```

---

# 43. Implementation Rules for Claude Code

When implementing this layout:

1. Inspect the existing application before changing components.
2. Preserve all existing working logic.
3. Use existing Coach Intel colors and tokens.
4. Reuse existing components where possible.
5. Do not redesign authentication.
6. Do not alter data models unnecessarily.
7. Move/represent Strats under Team Hub without breaking existing Strat IDs/data.
8. Preserve deep links where possible.
9. Add redirects for obsolete routes if needed.
10. Do not duplicate Strat data.
11. Keep global search capable of finding team Strats.
12. Ensure team context is explicit in every Strat.
13. Test switching teams.
14. Test users belonging to multiple teams.
15. Test empty/no-team state.
16. Test desktop and smaller laptop widths.
17. Keep all existing external integrations functioning.
18. Do not implement Discord as part of this task.

---

# 44. Strat Migration Rule

If Strats currently exist outside Team Hub:

**Do not recreate them.**

Instead:

1. Inspect current ownership fields.
2. Associate each Strat with its existing team.
3. Update navigation/routes.
4. Preserve IDs.
5. Preserve timestamps.
6. Preserve notes.
7. Preserve map/mode relationships.
8. Preserve player positions.
9. Preserve versions.
10. Preserve VOD links.
11. Preserve review states.

If a Strat has no team:

`NEEDS TEAM ASSIGNMENT`

Do not guess ownership.

---

# 45. Acceptance Criteria

The layout improvement is complete when:

- [ ] Existing Coach Intel colors are preserved.
- [ ] Team Hub has a clear dedicated secondary navigation.
- [ ] Strats & Playbooks live canonically inside Team Hub.
- [ ] Team switching updates the Team Hub correctly.
- [ ] Team Overview shows performance, Strats, map pool, notes and next match.
- [ ] Upcoming Match is immediately visible.
- [ ] Opponent Intel is contextual and actionable.
- [ ] Strat list is compact and scalable.
- [ ] New Strat uses current team roster.
- [ ] Saved setups remain inside their Strat.
- [ ] Maps & Modes remain accessible globally as a tool/configuration surface.
- [ ] Existing Strat data is preserved.
- [ ] Existing integrations continue working.
- [ ] Layout works at standard desktop/laptop sizes.
- [ ] Context panel collapses appropriately on smaller screens.
- [ ] Loading/error/empty states are implemented.
- [ ] UI uses one consistent component system.
- [ ] No Discord integration is added by this task.

---

# 46. Final UX Principle

Coach Intel should feel like the team's **competitive operating room**.

The Team Hub should answer:

**WHO ARE WE? → HOW ARE WE PERFORMING? → WHAT ARE WE PLAYING NEXT? → WHAT DO WE KNOW? → WHAT IS THE PLAN?**

And Strats should follow:

**TEAM → MAP → MODE → STRAT → SETUP → PLAYERS → REVIEW → MATCH**

That hierarchy should remain consistent throughout the application.

---

# 47. Official Coach Intel Logo Assets

The UI must use the **actual approved Coach Intel brand assets supplied for this project**. Do not recreate, redraw, approximate, or substitute the logo with generated monograms, generic esports marks, or placeholder initials.

## Required Brand Assets

Use the existing project assets for:

1. **Primary Coach Intel logo**
   - CI symbol + COACH INTEL wordmark
   - Use in the main application header / expanded navigation state where space permits.

2. **Coach Intel wordmark**
   - `COACH` in white
   - `INTEL` in the approved Coach Intel green
   - Use where the icon is not required or the available width is tighter.

3. **CI icon mark**
   - Use for compact navigation, favicon/app-icon contexts, loading states, or when the global navigation is collapsed.

4. **Descriptor**
   - `COMPETITIVE INTELLIGENCE FOR CALL OF DUTY`
   - White lettering with the approved Coach Intel green side stripes where the full brand lockup is used.
   - Do not recreate the descriptor with a different font treatment when the approved asset is available.

## Asset Rule

Claude Code must first inspect the existing repository for the supplied logo files and reuse them.

Search likely locations such as:

```text
/public
/public/assets
/assets
/src/assets
/src/images
/static
```

If multiple Coach Intel logo variants exist, identify and document which asset is used for:

```text
FULL LOGO
WORDMARK
ICON
DESCRIPTOR
```

Do not modify the original files.

If an approved asset is missing from the repository, create a clear asset placeholder/reference path and report the missing file instead of designing a replacement.

## Header Usage

Expanded global navigation/header:

```text
[ CI LOGO ]  COACH INTEL
             Competitive Intelligence for Call of Duty
```

Collapsed global navigation:

```text
[ CI ICON ]
```

The actual supplied CI icon must be used.

---

# 48. Global Left Navigation — Hide / Show

The **Global Navigation panel** containing:

```text
Dashboard
Intel Feed
Calendar
Tasks

Teams
Players
Matches
Statistics
VOD Library

Team Hub
Scrim Hub

Maps & Modes
Veto Lab
Reports
Rankings

Integrations
Settings
```

must be collapsible by the user.

This is the **outermost left navigation only**.

The Team Hub secondary rail remains independent.

## Expanded State

Default desktop state:

```text
┌──────────────────────┐
│ [CI] COACH INTEL     │
│                      │
│ Dashboard            │
│ Intel Feed           │
│ Calendar             │
│ Tasks                │
│ ...                  │
│ Settings             │
│                      │
│ [‹ Collapse]         │
└──────────────────────┘
```

Recommended width:

```text
220–248 px
```

Use the width already closest to the existing application layout rather than forcing an arbitrary exact value.

## Collapsed State

When collapsed:

```text
┌──────┐
│ [CI] │
│      │
│  ⌂   │
│  ◉   │
│  □   │
│  ✓   │
│ ...  │
│  ⚙   │
│      │
│  ›   │
└──────┘
```

Recommended width:

```text
56–72 px
```

Show:

- Official CI icon at the top
- Navigation icons only
- Active-state indicator
- Expand control
- Tooltips on hover/focus containing the full navigation label

Do not show truncated navigation text.

## Collapse Control

Place a clear control:

```text
‹ COLLAPSE
```

at the bottom of the expanded navigation or as a subtle chevron control on its boundary.

Collapsed:

```text
›
```

Clicking toggles the panel instantly.

The control should remain visually subtle and must not compete with primary navigation.

## Behavior

When the global navigation collapses:

```text
Global Nav width decreases
        ↓
Team Rail moves left
        ↓
Main Workspace gains width
        ↓
Context Panel remains unchanged where viewport permits
```

No page reload.

No route change.

No loss of current team/page/filter state.

## Persistence

Remember the user's preference.

Preferred behavior:

```text
Desktop:
Persist expanded/collapsed state between sessions.

Small laptop:
May default to collapsed.

Tablet/mobile:
Use responsive navigation behavior rather than forcing the desktop rail.
```

Use the application's existing preference/storage architecture. Do not create a new persistence system solely for this toggle.

## Keyboard / Accessibility

The toggle must:

- Be a semantic button.
- Have an accessible name:
  - `Collapse navigation`
  - `Expand navigation`
- Be keyboard reachable.
- Preserve visible focus state.
- Update `aria-expanded`.
- Provide tooltips for icon-only navigation in collapsed mode.

## Hover Behavior

When collapsed, hovering over an icon displays:

```text
[ icon ]  Dashboard
```

as a small tooltip.

Do not temporarily expand the entire navigation on hover; expansion should require deliberate user action.

## Active Navigation

Collapsed state must still make the current route unmistakable using:

- Approved Coach Intel green accent
- Subtle active background or edge indicator
- Active icon treatment

Do not rely solely on color.

---

# 49. Team Rail Independence

The Global Navigation collapse control must **not automatically hide the Team Hub rail**.

Correct behavior:

```text
EXPANDED
Global Nav | Team Rail | Workspace | Context

COLLAPSED
Icon Rail  | Team Rail | Wider Workspace | Context
```

This preserves quick access to:

```text
Overview
Roster
Team Notes
Objectives
Strats & Playbooks
Veto History
Practice Planner
Team Settings
```

A separate Team Rail collapse can be considered later if necessary, but it should not be coupled to the global navigation toggle.

---

# 50. Updated Responsive Layout

## Large Desktop — Expanded

```text
Global Navigation
      +
Team Rail
      +
Main Workspace
      +
Context Panel
```

## Large Desktop — Collapsed

```text
Global Icon Rail
      +
Team Rail
      +
Expanded Main Workspace
      +
Context Panel
```

## Small Laptop

Preferred:

```text
Global Icon Rail | Team Rail | Main Workspace
```

Context panel may become a drawer as already specified.

## Tablet

Global navigation becomes a compact drawer/icon control.

## Mobile

Use a mobile navigation pattern. Do not preserve four desktop columns.

---

# 51. Updated Claude Code Requirements

In addition to the existing implementation rules:

1. Locate and use the **actual supplied Coach Intel logo assets**.
2. Do not create substitute logos.
3. Use the official CI icon when the global navigation is collapsed.
4. Add a user-controlled expanded/collapsed state to the global left navigation.
5. Preserve all routes and permissions.
6. Preserve the currently selected Team Hub page while toggling.
7. Preserve filters, open Strat, selected team, and unsaved editor state.
8. Use the application's existing preferences mechanism for persistence.
9. Add tooltips to icon-only navigation.
10. Verify keyboard and screen-reader accessibility.
11. Do not automatically collapse the Team Hub rail with the global navigation.
12. Ensure the expanded workspace uses the recovered horizontal space cleanly.
13. Test at all target desktop/laptop widths already supported by the application.
14. No unrelated redesign.

---

# 52. Additional Acceptance Criteria

- [ ] Actual Coach Intel full logo/wordmark is used in the expanded navigation/header.
- [ ] Actual Coach Intel CI icon is used in the collapsed navigation.
- [ ] No generated/placeholder brand logo remains in production UI.
- [ ] Global navigation can be collapsed.
- [ ] Global navigation can be expanded.
- [ ] Collapsed state shows icons only.
- [ ] Icon labels are accessible through tooltips and accessible names.
- [ ] Active route is clearly visible in both states.
- [ ] Current page/team/filters remain unchanged after toggle.
- [ ] User preference persists using the existing application preference mechanism.
- [ ] Team Hub rail remains visible and independent.
- [ ] Main workspace expands when the global navigation collapses.
- [ ] Small-laptop responsive behavior remains usable.

---

# 53. Settings Placement — Bottom Anchored

The **Settings** entry in the global left navigation must be anchored at the very bottom of the panel.

This applies in both expanded and collapsed states.

## Expanded State

The navigation should visually separate normal product navigation from settings:

```text
Dashboard
Intel Feed
Calendar
Tasks

Teams
Players
Matches
Statistics
VOD Library

Team Hub
Scrim Hub

Maps & Modes
Veto Lab
Reports
Rankings

────────────────────

Integrations

[flex spacer]

Settings
```

`Settings` must remain pinned to the bottom edge of the navigation panel regardless of the number of items above it.

Recommended implementation pattern:

```text
nav = flex column
main navigation groups = normal flow
bottom section = margin-top: auto
```

Do not achieve this with hard-coded pixel positioning.

## Collapsed State

When the global navigation is collapsed to icon-only mode:

```text
[CI]
...
[Integrations]

[flex spacer]

[Settings]
```

The Settings icon stays anchored at the bottom.

A tooltip must show:

`Settings`

## Integrations Placement

Keep **Integrations** near the lower navigation area, but above Settings.

Settings is the final item.

Recommended:

```text
TOOLS / ADMIN
Integrations

BOTTOM ANCHORED
Settings
```

## Bottom-Area Collision Protection

If the viewport height is too small:

- Main navigation area may scroll.
- Settings remains accessible.
- Do not allow Settings to disappear below the viewport.
- Do not overlap the bottom status/footer.
- Preserve the collapse/expand control.

If necessary, structure the sidebar as:

```text
Header / Brand
Scrollable Navigation
Bottom Utility Area
```

where the bottom utility area contains:

```text
Collapse / Expand
Settings
```

or, if visually cleaner:

```text
Settings
Collapse / Expand
```

The exact order may follow the existing application pattern, but **Settings must remain bottom anchored**.

---

# 54. Final Global Navigation Order

Use this final order:

```text
MAIN
Dashboard
Intel Feed
Calendar
Tasks

ANALYTICS
Teams
Players
Matches
Statistics
VOD Library

TEAM
Team Hub
Scrim Hub

TOOLS
Maps & Modes
Veto Lab
Reports
Rankings

INTEGRATIONS
Integrations

[SPACER]

SETTINGS
Settings
```

The global panel is collapsible.

The Team Hub rail remains separate.

The actual Coach Intel logo/wordmark and CI icon assets must be used as already specified.

---

# 55. Additional Acceptance Criteria — Navigation Bottom Area

- [ ] Settings is visually the final global navigation item.
- [ ] Settings remains pinned to the bottom in expanded mode.
- [ ] Settings remains pinned to the bottom in collapsed mode.
- [ ] Settings remains visible on shorter desktop/laptop heights.
- [ ] Main navigation can scroll independently if required.
- [ ] Integrations remains above Settings.
- [ ] Collapse/expand control does not hide Settings.
- [ ] Team Hub secondary navigation is unaffected.
- [ ] Actual Coach Intel logo assets are used in both expanded and collapsed navigation.

