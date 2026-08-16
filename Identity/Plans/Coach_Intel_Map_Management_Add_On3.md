# Coach Intel — Map Management Add-On

**Brand:** Coach Intel  
**Descriptor:** Competitive Intelligence for Call of Duty  
**Scope:** Add-on for Maps & Modes management only

---

## 1. Objective

Coach Intel must allow authorized users to manage the active Call of Duty map pool without requiring a code change.

Users should be able to:

- Add maps
- Edit maps
- Activate maps
- Deactivate maps
- Remove maps
- Restore maps
- Add or remove supported modes per map

The current CDL map pool remains the default source of truth, but Coach Intel must remain flexible when the competitive pool changes.

---

## 2. Map Management Location

Add:

`SETTINGS → CDL RULESET → MAPS & MODES`

Primary actions:

`+ ADD MAP`  
`EDIT MAP`  
`DEACTIVATE MAP`  
`REMOVE MAP`  
`RESTORE MAP`

Only authorized roles should be able to change the active map pool.

---

## 3. Add Map

Required fields:

- Map name
- Supported mode(s)
- Active / inactive
- CDL competitive status
- Ruleset version
- Optional map image
- Optional callouts
- Optional notes

Example:

```text
ADD MAP

Map Name        [____________]

Modes
[✓] Hardpoint
[✓] Search & Destroy
[ ] Overload

CDL Pool        [✓]
Status          ACTIVE
Ruleset         Current

[CANCEL] [ADD MAP]
```

---

## 4. Edit Map

Authorized users can edit:

- Map name
- Supported modes
- Competitive status
- Active/inactive state
- Map image
- Callouts
- Notes
- Ruleset version

Editing map metadata must not erase existing historical data.

---

## 5. Deactivate Map

**Deactivate** should be the preferred action when a map leaves the current competitive pool.

Deactivating a map:

- Removes it from current match preparation
- Removes it from normal active-map selectors
- Preserves historical matches
- Preserves saved Strats
- Preserves player positions
- Preserves VOD
- Preserves notes
- Preserves Intel
- Preserves statistics
- Allows the map to be restored later

Display:

`RETIRED FROM CURRENT RULESET`

for historical map/mode combinations that are no longer active.

---

## 6. Remove Map

Hard removal should only be available to authorized admins.

Before removing a map, Coach Intel must check dependencies.

Example:

```text
REMOVE MAP?

This map contains:

14 Saved Strats
23 Matches
8 VOD References
5 Intel Items

Removing this map may affect historical data.

[DEACTIVATE INSTEAD]
[CANCEL]
[REMOVE ANYWAY]
```

If linked data exists, Coach Intel should recommend **Deactivate** instead of hard deletion.

---

## 7. Restore Map

A previously deactivated map can be restored.

Action:

`RESTORE TO ACTIVE MAPS`

Restoring the map should immediately make its existing:

- Strats
- Setups
- Player positions
- Notes
- VOD
- Intel
- Statistics

available again.

No data should need to be recreated.

---

## 8. Manage Modes Per Map

Supported modes should be editable independently from the map itself.

Example:

```text
DEN

Hardpoint            ACTIVE
Search & Destroy     ACTIVE
Overload             ACTIVE

[EDIT MODES]
```

Users can enable or disable each mode.

If a mode is removed from the active ruleset:

- Historical data remains available
- Saved Strats remain available
- Existing match history remains intact
- The combination is marked as retired

Example:

`DEN / OVERLOAD — RETIRED FROM CURRENT RULESET`

---

## 9. CDL Ruleset Sync Protection

When Coach Intel detects an official CDL map-pool update, it should propose the change instead of silently applying it.

Example:

```text
CDL MAP POOL CHANGE DETECTED

REMOVED
- Map A / Hardpoint

ADDED
+ Map B / Search & Destroy

Affected Saved Strats: 6

[REVIEW]
[APPLY UPDATE]
```

When an official map or mode is removed, Coach Intel should **deactivate it**, not delete it.

---

## 10. Data Model

Each map should contain:

```text
map_id
name
game_title
ruleset_version
active
competitive_pool
supported_modes[]
map_asset
callouts
notes
created_at
updated_at
deactivated_at
```

Each map/mode relationship should be stored independently so one mode can be retired without removing the entire map.

---

## 11. Permissions

Recommended permissions:

### Owner / Admin
- Add maps
- Edit maps
- Activate/deactivate maps
- Remove maps
- Restore maps
- Change supported modes

### Head Coach
- Activate/deactivate maps
- Edit notes/callouts
- Request map changes

### Coach / Analyst
- View maps
- Use maps
- Create Strats
- Cannot hard-delete maps

---

## 12. Acceptance Criteria

The feature is complete when an authorized user can:

1. Add a new map.
2. Assign one or more modes.
3. Edit map metadata.
4. Deactivate a map without losing linked data.
5. Restore a deactivated map.
6. Remove a map with dependency warnings.
7. Add/remove individual modes from a map.
8. Preserve historical Strats and matches after ruleset changes.
9. Review CDL map-pool changes before applying them.

---

## Product Rule

**Never delete competitive history just because the active CDL map pool changes.**

Coach Intel should preserve historical maps, modes, matches, Strats, notes, VOD, and Intel while keeping the current active pool clean and accurate.
