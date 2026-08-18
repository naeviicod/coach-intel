const fs = require('fs');
const path = require('path');

const NEEDS_VERIFICATION = 'NEEDS_VERIFICATION';
let cache = null;

function isUnverified(value) {
  return !value || String(value).trim().toUpperCase() === 'NEEDS_VERIFICATION';
}

function bundledPath() {
  const candidates = [
    path.join(__dirname, '..', '..', 'data', 'knowledge', 'map-objectives.json'),
  ];
  try {
    const { app } = require('electron');
    if (app) {
      candidates.unshift(path.join(app.getPath('userData'), 'data', 'knowledge', 'map-objectives.json'));
      if (app.isPackaged) {
        candidates.unshift(path.join(process.resourcesPath, 'data', 'knowledge', 'map-objectives.json'));
      }
    }
  } catch {
    // Tests load this file without Electron.
  }
  return candidates.find((p) => fs.existsSync(p)) || candidates[candidates.length - 1];
}

function loadBundled() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(bundledPath(), 'utf-8'));
  } catch {
    cache = { maps: {} };
  }
  return cache;
}

function slugOf(mapSlug, mapName) {
  return String(mapSlug || mapName || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function bundledFor(mapSlug, mapName, modeKey) {
  const pack = loadBundled();
  const entry = pack.maps?.[slugOf(mapSlug, mapName)]?.[modeKey];
  if (!entry) return null;
  return {
    ...entry,
    source: pack.source,
    verified_by: 'bundled-research',
  };
}

function mergeItem(existing, bundled) {
  if (!existing) return bundled ? { ...bundled } : existing;
  const out = { ...bundled, ...existing };
  if (isUnverified(existing.location) && bundled?.location) out.location = bundled.location;
  if (existing.x == null && bundled?.x != null) out.x = bundled.x;
  if (existing.y == null && bundled?.y != null) out.y = bundled.y;
  return out;
}

function mergeList(existing, bundled) {
  const empty = !existing?.length || existing.every((item) => isUnverified(item.location));
  if (empty) return bundled ? bundled.map((item) => ({ ...item })) : existing || [];
  return existing.map((item, i) => mergeItem(item, bundled?.[i]));
}

function mergeObjectives(bundled, existing, fallback) {
  const base = bundled ? { ...fallback, ...bundled } : fallback;
  if (!existing) return { ...base, bundled: Boolean(bundled) };
  const out = { ...base, ...existing, source: existing.source || base.source };
  if (base.hills) out.hills = mergeList(existing.hills, base.hills);
  if (base.bombsites) out.bombsites = mergeList(existing.bombsites, base.bombsites);
  if (base.device_spawns) out.device_spawns = mergeList(existing.device_spawns, base.device_spawns);
  for (const field of ['bomb_spawn', 'offense_spawn', 'defense_spawn', 'team_a_zone', 'team_b_zone']) {
    if (isUnverified(existing[field]) && base[field]) out[field] = base[field];
  }
  if (!existing.keys && base.keys) out.keys = base.keys;
  if (!existing.spawns && base.spawns) out.spawns = base.spawns;
  out.bundled = Boolean(bundled) && (!existing.updated_at || isUnverified(existing.team_a_zone) || isUnverified(existing.bomb_spawn) || !(existing.hills || []).length);
  return out;
}

module.exports = {
  NEEDS_VERIFICATION,
  isUnverified,
  bundledFor,
  mergeObjectives,
  loadBundled,
};
