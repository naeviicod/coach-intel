const fs = require('fs/promises');
const fss = require('fs');
const path = require('path');

function resolveDataRoot() {
  if (process.env.CCI_DATA_ROOT) return process.env.CCI_DATA_ROOT;
  try {
    const { app } = require('electron');
    if (app?.isPackaged) return path.join(app.getPath('userData'), 'data');
  } catch {
    // Tests and scripts load this file without Electron.
  }
  return path.join(__dirname, '..', '..', 'data');
}

const DATA_ROOT = resolveDataRoot();
const ORG_DIR = path.join(DATA_ROOT, 'org');
const TEAMS_DIR = path.join(ORG_DIR, 'teams');
const TEMPLATES_DIR = path.join(DATA_ROOT, 'templates');
const KNOWLEDGE_DIR = path.join(DATA_ROOT, 'knowledge');
const CDL_RULESET_PATH = path.join(KNOWLEDGE_DIR, 'cdl-ruleset.json');

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Notes/tasks render as "Today 14:32", so they keep the time component that
// todayIso() drops.
function nowIso() {
  return new Date().toISOString();
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// IDs arrive over IPC and become path segments. They are slugs by construction,
// so anything with a separator or traversal in it is a bug or an attack, never a
// real record.
function safeSegment(value, label) {
  const id = String(value ?? '');
  if (!id || id === '.' || id === '..' || /[/\\]/.test(id) || id.startsWith('.')) {
    throw new Error(`Invalid ${label}: ${id}`);
  }
  return id;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function readJson(filePath, fallback = null) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function writeJson(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

async function ensureDirectories() {
  await ensureDir(ORG_DIR);
  await ensureDir(TEAMS_DIR);
  await ensureDir(path.join(ORG_DIR, 'logos', 'teams'));
  await ensureDir(TEMPLATES_DIR);
  await ensureDir(KNOWLEDGE_DIR);
}

function teamDirFor(teamId) {
  return path.join(TEAMS_DIR, safeSegment(teamId, 'team id'));
}

// Wipes org identity + every team's roster/matches/strats/screenshots.
// Leaves templates/ and knowledge/ (CDL ruleset, meta-knowledge) intact —
// those are bundled reference data, not user data.
async function deleteAllData() {
  await fs.rm(ORG_DIR, { recursive: true, force: true });
  await ensureDirectories();
}

// ---------- Org ----------

async function getOrg() {
  const profile = (await readJson(path.join(ORG_DIR, 'org-profile.json'))) || {
    name: 'My Organization',
    logo: null,
  };
  let teamIds = [];
  try {
    const entries = await fs.readdir(TEAMS_DIR, { withFileTypes: true });
    teamIds = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  return { ...profile, teamIds };
}

async function saveOrg(org) {
  const existing = await readJson(path.join(ORG_DIR, 'org-profile.json'));
  await writeJson(path.join(ORG_DIR, 'org-profile.json'), {
    name: org.name,
    tag: org.tag !== undefined ? org.tag : existing?.tag || null,
    logo: org.logo !== undefined ? org.logo : existing?.logo || null,
    coachName: org.coachName !== undefined ? org.coachName : existing?.coachName || 'Coach',
    accent: org.accent !== undefined ? org.accent : existing?.accent || null,
  });
  return getOrg();
}

// ---------- Teams ----------

async function getTeams() {
  let teamIds = [];
  try {
    const entries = await fs.readdir(TEAMS_DIR, { withFileTypes: true });
    teamIds = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  const teams = [];
  for (const id of teamIds) {
    const team = await getTeam(id);
    if (team) teams.push(team);
  }
  return teams;
}

async function getTeam(teamId) {
  const profile = await readJson(path.join(teamDirFor(teamId), 'team-profile.json'));
  if (!profile) return null;
  return { id: teamId, ...profile };
}

async function saveTeam(team) {
  const id = team.id || slugify(team.name);
  const dir = teamDirFor(id);
  await ensureDir(path.join(dir, 'members'));
  await ensureDir(path.join(dir, 'screenshots', 'inbox'));
  await ensureDir(path.join(dir, 'screenshots', 'needs-review'));
  await ensureDir(path.join(dir, 'screenshots', 'processed'));
  await ensureDir(path.join(dir, 'data', 'matches'));
  await ensureDir(path.join(dir, 'data', 'strats'));
  await ensureDir(path.join(dir, 'data', 'notes'));
  await ensureDir(path.join(dir, 'data', 'tasks'));
  await ensureDir(path.join(dir, 'data', 'vetoes'));

  const existing = (await readJson(path.join(dir, 'team-profile.json'))) || {};
  const profile = {
    name: team.name,
    tag: team.tag !== undefined ? team.tag : existing.tag || null,
    logo: team.logo !== undefined ? team.logo : existing.logo || null,
    members: existing.members || [],
  };
  await writeJson(path.join(dir, 'team-profile.json'), profile);
  return getTeam(id);
}

async function deleteTeam(teamId) {
  await fs.rm(teamDirFor(teamId), { recursive: true, force: true });
}

// ---------- Members ----------

async function getMembers(teamId) {
  const dir = path.join(teamDirFor(teamId), 'members');
  let files = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    return [];
  }
  const members = [];
  for (const file of files) {
    const data = await readJson(path.join(dir, file));
    if (data) members.push({ id: path.basename(file, '.json'), ...data });
  }
  return members.sort((a, b) => a.gamertag.localeCompare(b.gamertag));
}

async function getMember(teamId, memberId) {
  const data = await readJson(path.join(teamDirFor(teamId), 'members', `${memberId}.json`));
  if (!data) return null;
  return { id: memberId, ...data };
}

async function saveMember(teamId, member) {
  const id = member.id || slugify(member.gamertag);
  const dir = teamDirFor(teamId);
  const filePath = path.join(dir, 'members', `${id}.json`);
  const record = {
    name: member.name || member.gamertag,
    gamertag: member.gamertag,
    aliases: member.aliases || [],
    role: member.role || 'Flex',
    photo: member.photo || null,
  };
  await writeJson(filePath, record);

  // keep team-profile.json's member list in sync
  const teamProfilePath = path.join(dir, 'team-profile.json');
  const profile = (await readJson(teamProfilePath)) || { name: teamId, logo: null, members: [] };
  if (!profile.members.includes(id)) {
    profile.members = [...profile.members, id];
    await writeJson(teamProfilePath, profile);
  }
  return { id, ...record };
}

async function deleteMember(teamId, memberId) {
  const dir = teamDirFor(teamId);
  await fs.rm(path.join(dir, 'members', `${memberId}.json`), { force: true });
  const teamProfilePath = path.join(dir, 'team-profile.json');
  const profile = await readJson(teamProfilePath);
  if (profile) {
    profile.members = (profile.members || []).filter((m) => m !== memberId);
    await writeJson(teamProfilePath, profile);
  }
}

// ---------- Matches ----------

async function getMatches(teamId) {
  const dir = path.join(teamDirFor(teamId), 'data', 'matches');
  let files = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    return [];
  }
  const matches = [];
  for (const file of files) {
    const data = await readJson(path.join(dir, file));
    if (data) matches.push(data);
  }
  return matches.sort((a, b) => (a.date < b.date ? 1 : -1));
}

// ---------- Strats (Strategy Board) ----------

function stratsDirFor(teamId) {
  return path.join(teamDirFor(teamId), 'data', 'strats');
}

async function getStrats(teamId) {
  const dir = stratsDirFor(teamId);
  let files = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    return [];
  }
  const strats = [];
  for (const file of files) {
    const data = await readJson(path.join(dir, file));
    if (data) strats.push(data);
  }
  return strats.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

async function getStrat(teamId, stratId) {
  return readJson(path.join(stratsDirFor(teamId), `${safeSegment(stratId, 'strat id')}.json`));
}

async function nextStratName(teamId) {
  const strats = await getStrats(teamId);
  let n = strats.length + 1;
  const names = new Set(strats.map((s) => s.strategy_name));
  while (names.has(`Strat ${n}`)) n += 1;
  return `Strat ${n}`;
}

async function saveStrat(teamId, strat) {
  const dir = stratsDirFor(teamId);
  await ensureDir(dir);
  const now = todayIso();
  const isNew = !strat.strategy_id;
  const id = strat.strategy_id || slugify(`${strat.strategy_name || 'strat'}-${Date.now()}`);
  const existing = isNew ? null : await getStrat(teamId, id);

  const record = {
    strategy_id: id,
    strategy_name: strat.strategy_name || (existing ? existing.strategy_name : await nextStratName(teamId)),
    map: strat.map,
    mode: strat.mode,
    team_id: teamId,
    player_positions: strat.player_positions || [],
    drawings: strat.drawings || [],
    notes: strat.notes || '',
    status: strat.status || existing?.status || 'DRAFT',
    versions: existing?.versions || [],
    created_at: existing?.created_at || now,
    updated_at: now,
  };

  const nextVersion = (record.versions[record.versions.length - 1]?.version || 0) + 1;
  record.versions = [
    ...record.versions,
    {
      version: nextVersion,
      label: strat.versionLabel || `Saved ${now}`,
      player_positions: record.player_positions,
      drawings: record.drawings,
      notes: record.notes,
      created_at: now,
    },
  ];

  await writeJson(path.join(dir, `${id}.json`), record);
  return record;
}

async function deleteStrat(teamId, stratId) {
  await fs.rm(path.join(stratsDirFor(teamId), `${safeSegment(stratId, 'strat id')}.json`), { force: true });
}

async function duplicateStrat(teamId, stratId) {
  const original = await getStrat(teamId, stratId);
  if (!original) throw new Error('Strat not found');
  const newId = slugify(`${original.strategy_name}-copy-${Date.now()}`);
  const now = todayIso();
  const copy = {
    ...original,
    strategy_id: newId,
    strategy_name: `${original.strategy_name} Copy`,
    versions: [{ version: 1, label: `Duplicated from ${original.strategy_name}`, player_positions: original.player_positions, drawings: original.drawings, notes: original.notes, created_at: now }],
    created_at: now,
    updated_at: now,
  };
  await writeJson(path.join(stratsDirFor(teamId), `${newId}.json`), copy);
  return copy;
}

async function restoreStratVersion(teamId, stratId, versionNumber) {
  const strat = await getStrat(teamId, stratId);
  if (!strat) throw new Error('Strat not found');
  const version = strat.versions.find((v) => v.version === versionNumber);
  if (!version) throw new Error('Version not found');
  return saveStrat(teamId, {
    strategy_id: stratId,
    strategy_name: strat.strategy_name,
    map: strat.map,
    mode: strat.mode,
    player_positions: version.player_positions,
    drawings: version.drawings,
    notes: version.notes,
    status: strat.status,
    versionLabel: `Restored v${versionNumber}`,
  });
}

// ---------- Notes & Tasks ----------

// Both entities share the same optional link targets so a note and a task can
// point at the same member/map/match/strat/VOD.
const LINK_KEYS = ['member_id', 'map', 'mode', 'match_id', 'strategy_id', 'vod_url', 'opponent'];

function normalizeLinks(links, existing) {
  const incoming = links || {};
  const previous = existing || {};
  const result = {};
  for (const key of LINK_KEYS) {
    result[key] = incoming[key] !== undefined ? incoming[key] : previous[key] ?? null;
  }
  return result;
}

function notesDirFor(teamId) {
  return path.join(teamDirFor(teamId), 'data', 'notes');
}

function tasksDirFor(teamId) {
  return path.join(teamDirFor(teamId), 'data', 'tasks');
}

async function getNotes(teamId) {
  const dir = notesDirFor(teamId);
  let files = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    return [];
  }
  const notes = [];
  for (const file of files) {
    const data = await readJson(path.join(dir, file));
    if (data) notes.push(data);
  }
  return notes.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

async function saveNote(teamId, note) {
  const dir = notesDirFor(teamId);
  await ensureDir(dir);
  const now = nowIso();
  const id = safeSegment(note.note_id || slugify(`${note.title || 'Untitled note'}-${Date.now()}`), 'note id');
  const existing = note.note_id ? await readJson(path.join(dir, `${id}.json`)) : null;

  const record = {
    note_id: id,
    title: note.title || existing?.title || 'Untitled note',
    body: note.body !== undefined ? note.body : existing?.body || '',
    tag: String(note.tag || existing?.tag || 'General').slice(0, 40),
    author: note.author || existing?.author || 'Coach',
    team_id: teamId,
    links: normalizeLinks(note.links, existing?.links),
    created_at: existing?.created_at || now,
    updated_at: now,
  };

  await writeJson(path.join(dir, `${id}.json`), record);
  return record;
}

async function deleteNote(teamId, noteId) {
  await fs.rm(path.join(notesDirFor(teamId), `${safeSegment(noteId, 'note id')}.json`), { force: true });
}

// Open tasks first, then soonest due date (undated last), then oldest first.
function compareTasks(a, b) {
  const aDone = !!a.done;
  const bDone = !!b.done;
  if (aDone !== bDone) return aDone ? 1 : -1;
  const aDue = a.due || null;
  const bDue = b.due || null;
  if (aDue !== bDue) {
    if (!aDue) return 1;
    if (!bDue) return -1;
    return aDue < bDue ? -1 : 1;
  }
  if (a.created_at === b.created_at) return 0;
  return a.created_at < b.created_at ? -1 : 1;
}

async function getTasks(teamId) {
  const dir = tasksDirFor(teamId);
  let files = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    return [];
  }
  const tasks = [];
  for (const file of files) {
    const data = await readJson(path.join(dir, file));
    if (data) tasks.push(data);
  }
  return tasks.sort(compareTasks);
}

async function saveTask(teamId, task) {
  const dir = tasksDirFor(teamId);
  await ensureDir(dir);
  const now = nowIso();
  const id = safeSegment(task.task_id || slugify(`${task.title || 'Untitled task'}-${Date.now()}`), 'task id');
  const existing = task.task_id ? await readJson(path.join(dir, `${id}.json`)) : null;

  const wasDone = !!existing?.done;
  const done = task.done !== undefined ? !!task.done : wasDone;
  let completedAt = null;
  if (done) completedAt = wasDone ? existing?.completed_at || now : now;

  const record = {
    task_id: id,
    title: task.title || existing?.title || 'Untitled task',
    done,
    due: task.due !== undefined ? task.due || null : existing?.due || null,
    notes: task.notes !== undefined ? task.notes : existing?.notes || '',
    team_id: teamId,
    links: normalizeLinks(task.links, existing?.links),
    created_at: existing?.created_at || now,
    updated_at: now,
    completed_at: completedAt,
  };

  await writeJson(path.join(dir, `${id}.json`), record);
  return record;
}

async function deleteTask(teamId, taskId) {
  await fs.rm(path.join(tasksDirFor(teamId), `${safeSegment(taskId, 'task id')}.json`), { force: true });
}

// ---------- Needs review (screenshots) ----------

async function getNeedsReview(teamId) {
  return require('./screenshotStore').listPending(teamId);
}

// ---------- Knowledge ----------

async function getMetaKnowledge() {
  return readJson(path.join(KNOWLEDGE_DIR, 'meta-knowledge.json'), null);
}

async function getCdlRuleset() {
  return readJson(CDL_RULESET_PATH, null);
}

async function updateCdlRulesetMeta(updates) {
  const ruleset = await getCdlRuleset();
  if (!ruleset) throw new Error('CDL ruleset not found');
  const next = updates || {};
  if (next.label !== undefined) ruleset.label = String(next.label || '').trim();
  if (next.game !== undefined) ruleset.game = String(next.game || '').trim();
  if (next.season !== undefined) ruleset.season = String(next.season || '').trim();
  if (next.version !== undefined) ruleset.version = String(next.version || '').trim();
  if (next.source !== undefined) ruleset.source = String(next.source || '').trim();
  if (next.show_in_status !== undefined) ruleset.show_in_status = Boolean(next.show_in_status);
  ruleset.last_checked = todayIso();
  await writeJson(CDL_RULESET_PATH, ruleset);
  return ruleset;
}

// ---------- CDL Ruleset — map pool management ----------

async function addCdlMap(map) {
  const ruleset = await getCdlRuleset();
  if (!ruleset) throw new Error('CDL ruleset not found');
  const now = todayIso();
  const record = {
    map_id: slugify(map.name),
    name: map.name,
    modes: map.modes || [],
    retired_modes: [],
    active: true,
    competitive_pool: map.competitive_pool !== undefined ? map.competitive_pool : true,
    notes: map.notes || '',
    created_at: now,
    updated_at: now,
    deactivated_at: null,
  };
  ruleset.maps = [...ruleset.maps, record];
  await writeJson(CDL_RULESET_PATH, ruleset);
  return record;
}

async function updateCdlMap(mapId, updates) {
  const ruleset = await getCdlRuleset();
  if (!ruleset) throw new Error('CDL ruleset not found');
  const map = ruleset.maps.find((m) => m.map_id === mapId);
  if (!map) return null;
  if (updates.name !== undefined) map.name = updates.name;
  if (updates.modes !== undefined) map.modes = updates.modes;
  if (updates.notes !== undefined) map.notes = updates.notes;
  if (updates.competitive_pool !== undefined) map.competitive_pool = updates.competitive_pool;
  map.updated_at = todayIso();
  await writeJson(CDL_RULESET_PATH, ruleset);
  return map;
}

async function deactivateCdlMap(mapId) {
  const ruleset = await getCdlRuleset();
  if (!ruleset) throw new Error('CDL ruleset not found');
  const map = ruleset.maps.find((m) => m.map_id === mapId);
  if (!map) return null;
  map.active = false;
  map.deactivated_at = todayIso();
  await writeJson(CDL_RULESET_PATH, ruleset);
  return map;
}

async function restoreCdlMap(mapId) {
  const ruleset = await getCdlRuleset();
  if (!ruleset) throw new Error('CDL ruleset not found');
  const map = ruleset.maps.find((m) => m.map_id === mapId);
  if (!map) return null;
  map.active = true;
  map.deactivated_at = null;
  await writeJson(CDL_RULESET_PATH, ruleset);
  return map;
}

// Blocks removal when matches reference this map, unless force is set — never
// touches match history itself, just counts it so the UI can warn.
async function removeCdlMap(mapId, { force = false } = {}) {
  const ruleset = await getCdlRuleset();
  if (!ruleset) throw new Error('CDL ruleset not found');
  const map = ruleset.maps.find((m) => m.map_id === mapId);
  if (!map) return { blocked: false };

  let matchCount = 0;
  const teams = await getTeams();
  for (const team of teams) {
    const matches = await getMatches(team.id);
    matchCount += matches.filter((mt) => mt.map === map.name).length;
  }

  if (matchCount > 0 && !force) {
    return { blocked: true, matchCount };
  }

  ruleset.maps = ruleset.maps.filter((m) => m.map_id !== mapId);
  await writeJson(CDL_RULESET_PATH, ruleset);
  return { blocked: false };
}

async function updateCdlMapModes(mapId, activeModes) {
  const ruleset = await getCdlRuleset();
  if (!ruleset) throw new Error('CDL ruleset not found');
  const map = ruleset.maps.find((m) => m.map_id === mapId);
  if (!map) return null;
  const retired = new Set(map.retired_modes || []);
  for (const mode of map.modes || []) {
    if (!activeModes.includes(mode)) retired.add(mode);
  }
  for (const mode of activeModes) retired.delete(mode);
  map.modes = activeModes;
  map.retired_modes = [...retired];
  map.updated_at = todayIso();
  await writeJson(CDL_RULESET_PATH, ruleset);
  return map;
}

// ---------- Files (logos / photos) ----------

const MAP_ART_DIR = path.join(
  '/Users/Ion/Library/Mobile Documents/com~apple~CloudDocs/Naevii/Artwork/maps/bo7'
);

function mapArtFileName(mapName, ext) {
  const base = String(mapName || 'map')
    .trim()
    .replace(/[^\w]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'map';
  return `${base}_MenuScreen_BO7${ext}`;
}

async function copyImage(sourcePath, destRelative) {
  const dest = path.join(DATA_ROOT, destRelative);
  await ensureDir(path.dirname(dest));
  await fs.copyFile(sourcePath, dest);
  return destRelative;
}

async function saveMapArt(sourcePath, mapName, layoutKey) {
  const rawExt = path.extname(String(sourcePath || '')).toLowerCase();
  const ext = ['.jpg', '.jpeg', '.png', '.webp'].includes(rawExt) ? rawExt : '.jpg';
  const slug = slugify(mapName);
  if (!slug) throw new Error('Invalid map name');
  const key = String(layoutKey || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const rel = key ? `maps/${slug}-${key}${ext}` : `maps/${slug}${ext}`;
  await copyImage(sourcePath, rel);
  await fs.mkdir(MAP_ART_DIR, { recursive: true });
  const artName = key
    ? `${String(mapName || slug).trim().replace(/[^\w]+/g, '_')}_${key.toUpperCase()}_Layout${ext}`
    : mapArtFileName(mapName, ext);
  await fs.copyFile(sourcePath, path.join(MAP_ART_DIR, artName));
  return rel;
}

function resolveDataPath(relative) {
  if (!relative) return null;
  const root = path.resolve(DATA_ROOT);
  const dest = path.resolve(root, String(relative));
  if (dest !== root && !dest.startsWith(root + path.sep)) return null;
  return dest;
}

module.exports = {
  DATA_ROOT,
  ensureDirectories,
  deleteAllData,
  slugify,
  getOrg,
  saveOrg,
  getTeams,
  getTeam,
  saveTeam,
  deleteTeam,
  getMembers,
  getMember,
  saveMember,
  deleteMember,
  getMatches,
  getStrats,
  getStrat,
  saveStrat,
  deleteStrat,
  duplicateStrat,
  restoreStratVersion,
  getNotes,
  saveNote,
  deleteNote,
  getTasks,
  saveTask,
  deleteTask,
  getNeedsReview,
  getMetaKnowledge,
  getCdlRuleset,
  updateCdlRulesetMeta,
  addCdlMap,
  updateCdlMap,
  deactivateCdlMap,
  restoreCdlMap,
  removeCdlMap,
  updateCdlMapModes,
  copyImage,
  saveMapArt,
  resolveDataPath,
};
