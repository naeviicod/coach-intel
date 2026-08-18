// Planning & prep data — the entities behind Calendar, Scrim Hub, VOD Library,
// Veto Lab, Scouting and Rankings.
//
// Kept separate from dataStore.js so neither file grows unwieldy. It reuses the
// same on-disk root and the same safety rules: IDs become path segments, so
// anything with a separator or traversal in it is rejected before it is used.

const fs = require('fs/promises');
const path = require('path');
const { DATA_ROOT } = require('./dataStore');

// Resolved per call so tests can point the store at a temporary root via
// CCI_DATA_ROOT. Unset in production, where it falls back to the shared root.
function dataRoot() {
  return process.env.CCI_DATA_ROOT || DATA_ROOT;
}
function teamsDir() {
  return path.join(dataRoot(), 'org', 'teams');
}
function scoutingDir() {
  return path.join(dataRoot(), 'org', 'scouting');
}
function rankingsPath() {
  return path.join(dataRoot(), 'org', 'rankings.json');
}

// ---------- Shared helpers (kept local to avoid widening dataStore's surface) ----------

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

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

function safeSegment(value, label) {
  const id = String(value ?? '');
  if (!id || id === '.' || id === '..' || /[/\\]/.test(id) || id.startsWith('.')) {
    throw new Error(`Invalid ${label}: ${id}`);
  }
  return id;
}

// New records get a stable, filesystem-safe id. A short random suffix keeps two
// saves in the same millisecond from colliding.
function makeId(prefix, seed) {
  const base = seed ? slugify(seed) : '';
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return base ? `${base}-${stamp}` : `${prefix}-${stamp}`;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function writeJson(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// Reads every *.json record in a directory, tagging each with its filename id.
async function listJson(dir, idKey) {
  let files = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    return [];
  }
  const out = [];
  for (const file of files) {
    const data = await readJson(path.join(dir, file));
    if (data) out.push({ [idKey]: path.basename(file, '.json'), ...data });
  }
  return out;
}

function teamSub(teamId, sub) {
  return path.join(teamsDir(), safeSegment(teamId, 'team id'), 'data', sub);
}

function clampInt(value, fallback = 0) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function str(value, max = 4000) {
  return String(value ?? '').slice(0, max);
}

function normalizeEventMaps(maps) {
  const raw = Array.isArray(maps)
    ? maps
    : typeof maps === 'string'
      ? maps.split(/[,;\n]+/)
      : [];
  const out = [];
  for (const entry of raw) {
    const name = typeof entry === 'string'
      ? str(entry, 60).trim()
      : str(entry?.map || entry?.name || '', 60).trim();
    if (name && !out.includes(name)) out.push(name);
    if (out.length >= 11) break;
  }
  return out;
}

// ---------- Schedule events (Calendar) ----------
//
// Coach-created calendar entries. The org Calendar surfaces every type so
// staff and creatives share one overview. Older keys still load.

const EVENT_TYPES = [
  'league-match',
  'scrim',
  'vod-review',
  'meeting',
  'training',
  'practice',
  'scrim-block',
  'other',
];

// Attendees can be the whole roster plus staff, unlike a 4-person scrim
// lineup, so this dedupes without normalizeLineup's tighter cap.
function normalizeAttendees(ids) {
  if (!Array.isArray(ids)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of ids) {
    const id = str(raw, 80);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= 30) break;
  }
  return out;
}

async function getEvents(teamId) {
  const rows = await listJson(teamSub(teamId, 'schedule'), 'event_id');
  return rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || '').localeCompare(b.time || '')));
}

async function saveEvent(teamId, event) {
  const dir = teamSub(teamId, 'schedule');
  const now = nowIso();
  const id = safeSegment(event.event_id || makeId('event', event.title), 'event id');
  const existing = event.event_id ? await readJson(path.join(dir, `${id}.json`)) : null;
  const type = EVENT_TYPES.includes(event.type) ? event.type : 'training';
  const record = {
    event_id: id,
    team_id: teamId,
    type,
    title: str(event.title || existing?.title || 'Training', 160),
    date: str(event.date || existing?.date || todayIso(), 10),
    time: event.time !== undefined ? (event.time ? str(event.time, 5) : null) : existing?.time || null,
    duration_min: event.duration_min !== undefined ? clampInt(event.duration_min, 0) || null : existing?.duration_min || null,
    opponent: event.opponent !== undefined ? str(event.opponent, 120) : existing?.opponent || '',
    maps: event.maps !== undefined ? normalizeEventMaps(event.maps) : existing?.maps || [],
    notes: event.notes !== undefined ? str(event.notes) : existing?.notes || '',
    attendee_ids: event.attendee_ids !== undefined ? normalizeAttendees(event.attendee_ids) : existing?.attendee_ids || [],
    created_at: existing?.created_at || now,
    updated_at: now,
  };
  await writeJson(path.join(dir, `${id}.json`), record);
  return record;
}

async function deleteEvent(teamId, eventId) {
  await fs.rm(path.join(teamSub(teamId, 'schedule'), `${safeSegment(eventId, 'event id')}.json`), { force: true });
}

// ---------- Scrims (Scrim Hub) ----------

const SCRIM_STATUSES = ['scheduled', 'completed', 'cancelled'];

function normalizeLineup(ids) {
  if (!Array.isArray(ids)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of ids) {
    const id = str(raw, 80);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= 8) break;
  }
  return out;
}

function normalizeTags(tags) {
  const list = Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',') : [];
  const out = [];
  for (const raw of list) {
    const t = str(raw, 40).trim();
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= 20) break;
  }
  return out;
}

function normalizeScrimMaps(maps) {
  if (!Array.isArray(maps)) return [];
  return maps.slice(0, 11).map((m) => ({
    map: str(m.map || '', 60),
    mode: str(m.mode || '', 40),
    side: str(m.side || '', 40),
    result: m.result === 'Win' || m.result === 'Loss' ? m.result : '',
    us: m.us === null || m.us === undefined || m.us === '' ? null : clampInt(m.us, 0),
    them: m.them === null || m.them === undefined || m.them === '' ? null : clampInt(m.them, 0),
    vod_url: str(m.vod_url || '', 1000),
    tags: normalizeTags(m.tags),
  }));
}

async function getScrims(teamId) {
  const rows = await listJson(teamSub(teamId, 'scrims'), 'scrim_id');
  return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

async function saveScrim(teamId, scrim) {
  const dir = teamSub(teamId, 'scrims');
  const now = nowIso();
  const id = safeSegment(scrim.scrim_id || makeId('scrim', scrim.opponent), 'scrim id');
  const existing = scrim.scrim_id ? await readJson(path.join(dir, `${id}.json`)) : null;
  const status = SCRIM_STATUSES.includes(scrim.status) ? scrim.status : 'scheduled';
  const record = {
    scrim_id: id,
    team_id: teamId,
    opponent: str(scrim.opponent || existing?.opponent || 'TBD', 120),
    date: str(scrim.date || existing?.date || todayIso(), 10),
    time: scrim.time !== undefined ? (scrim.time ? str(scrim.time, 5) : null) : existing?.time || null,
    format: str(scrim.format || existing?.format || 'Bo5', 20),
    status,
    maps: scrim.maps !== undefined ? normalizeScrimMaps(scrim.maps) : existing?.maps || [],
    notes: scrim.notes !== undefined ? str(scrim.notes) : existing?.notes || '',
    lineup: normalizeLineup(scrim.lineup !== undefined ? scrim.lineup : existing?.lineup),
    created_at: existing?.created_at || now,
    updated_at: now,
  };
  await writeJson(path.join(dir, `${id}.json`), record);
  return record;
}

async function deleteScrim(teamId, scrimId) {
  await fs.rm(path.join(teamSub(teamId, 'scrims'), `${safeSegment(scrimId, 'scrim id')}.json`), { force: true });
}

// ---------- VOD Library ----------

function normalizeMarkers(markers) {
  if (!Array.isArray(markers)) return [];
  return markers.slice(0, 200).map((m, i) => ({
    id: str(m.id || `m${i}`, 40),
    t: clampInt(m.t, 0),
    label: str(m.label || '', 120),
    note: str(m.note || '', 600),
  }));
}

async function getVods(teamId) {
  const rows = await listJson(teamSub(teamId, 'vods'), 'vod_id');
  return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

async function saveVod(teamId, vod) {
  const dir = teamSub(teamId, 'vods');
  const now = nowIso();
  const id = safeSegment(vod.vod_id || makeId('vod', vod.title), 'vod id');
  const existing = vod.vod_id ? await readJson(path.join(dir, `${id}.json`)) : null;
  const record = {
    vod_id: id,
    team_id: teamId,
    title: str(vod.title || existing?.title || 'Untitled VOD', 160),
    url: str(vod.url !== undefined ? vod.url : existing?.url || '', 1000),
    source: str(vod.source || existing?.source || 'Link', 40),
    date: str(vod.date || existing?.date || todayIso(), 10),
    map: str(vod.map !== undefined ? vod.map : existing?.map || '', 60),
    mode: str(vod.mode !== undefined ? vod.mode : existing?.mode || '', 40),
    opponent: str(vod.opponent !== undefined ? vod.opponent : existing?.opponent || '', 120),
    match_id: vod.match_id !== undefined ? vod.match_id || null : existing?.match_id || null,
    strategy_id: vod.strategy_id !== undefined ? vod.strategy_id || null : existing?.strategy_id || null,
    notes: vod.notes !== undefined ? str(vod.notes) : existing?.notes || '',
    markers: vod.markers !== undefined ? normalizeMarkers(vod.markers) : existing?.markers || [],
    created_at: existing?.created_at || now,
    updated_at: now,
  };
  await writeJson(path.join(dir, `${id}.json`), record);
  return record;
}

async function deleteVod(teamId, vodId) {
  await fs.rm(path.join(teamSub(teamId, 'vods'), `${safeSegment(vodId, 'vod id')}.json`), { force: true });
}

// ---------- Veto Lab ----------

function normalizeVetoSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps.slice(0, 30).map((s) => ({
    action: s.action === 'pick' || s.action === 'decider' ? s.action : 'ban',
    team: s.team === 'them' ? 'them' : 'us',
    mode: str(s.mode || '', 40),
    map: s.map ? str(s.map, 60) : null,
  }));
}

function normalizeVetoHistory(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 40).map((row) => ({
    veto_id: str(row.veto_id || '', 80),
    team_id: str(row.team_id || '', 80),
    format: str(row.format || 'Bo5', 20),
    first: row.first === 'them' ? 'them' : 'us',
    steps: normalizeVetoSteps(row.steps),
    recorded_at: str(row.recorded_at || nowIso(), 40),
  }));
}

async function getVetoes(teamId) {
  const rows = await listJson(teamSub(teamId, 'vetoes'), 'veto_id');
  return rows.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

async function saveVeto(teamId, veto) {
  const dir = teamSub(teamId, 'vetoes');
  const now = nowIso();
  const id = safeSegment(veto.veto_id || makeId('veto', veto.opponent), 'veto id');
  const existing = veto.veto_id ? await readJson(path.join(dir, `${id}.json`)) : null;
  const record = {
    veto_id: id,
    team_id: teamId,
    opponent: str(veto.opponent || existing?.opponent || 'Opponent', 120),
    format: str(veto.format || existing?.format || 'Bo5', 20),
    first: veto.first === 'them' ? 'them' : 'us',
    steps: veto.steps !== undefined ? normalizeVetoSteps(veto.steps) : existing?.steps || [],
    notes: veto.notes !== undefined ? str(veto.notes) : existing?.notes || '',
    created_at: existing?.created_at || now,
    updated_at: now,
  };
  await writeJson(path.join(dir, `${id}.json`), record);
  await rememberOpponentVeto(record);
  return record;
}

async function deleteVeto(teamId, vetoId) {
  const file = path.join(teamSub(teamId, 'vetoes'), `${safeSegment(vetoId, 'veto id')}.json`);
  const existing = await readJson(file);
  await fs.rm(file, { force: true });
  if (existing) await forgetOpponentVeto({ ...existing, veto_id: vetoId });
}

// A saved plan is also written onto the opponent's scout card so the next
// series against them (or a first look at a new team, via league habits)
// can read the book without re-opening Veto Lab.
async function rememberOpponentVeto(veto) {
  const name = str(veto.opponent, 120);
  if (!name) return;
  const opponents = await getOpponents();
  const existing = opponents.find((o) => String(o.name || '').toLowerCase() === name.toLowerCase());
  const entry = {
    veto_id: veto.veto_id,
    team_id: veto.team_id,
    format: veto.format,
    first: veto.first,
    steps: veto.steps,
    recorded_at: veto.updated_at || nowIso(),
  };
  const history = (existing?.veto_history || []).filter((row) => row.veto_id !== veto.veto_id);
  history.unshift(entry);
  await saveOpponent({
    opponent_id: existing?.opponent_id,
    name,
    tag: existing?.tag,
    region: existing?.region,
    players: existing?.players,
    map_notes: existing?.map_notes,
    tendencies: existing?.tendencies,
    notes: existing?.notes,
    veto_history: history.slice(0, 40),
  });
}

async function forgetOpponentVeto(veto) {
  const name = str(veto.opponent, 120);
  if (!name) return;
  const opponents = await getOpponents();
  const existing = opponents.find((o) => String(o.name || '').toLowerCase() === name.toLowerCase());
  if (!existing) return;
  const history = (existing.veto_history || []).filter((row) => row.veto_id !== veto.veto_id);
  await saveOpponent({ ...existing, veto_history: history });
}

// ---------- Scouting (org-level opponents) ----------

function normalizeOpponentPlayers(players) {
  if (!Array.isArray(players)) return [];
  return players.slice(0, 12).map((p) => ({
    gamertag: str(p.gamertag || '', 60),
    role: str(p.role || 'Flex', 20),
    note: str(p.note || '', 400),
  }));
}

// How sure we actually are about a piece of opponent intel — shown next to
// every intel item so a stale or unverified read never looks as solid as a
// confirmed one. Unrecognized/missing values fall back to the most cautious
// state rather than silently defaulting to "confirmed".
const INTEL_CONFIDENCE = ['CONFIRMED', 'LIKELY', 'OLD DATA', 'UNVERIFIED'];

function normalizeConfidence(value) {
  const v = String(value || '').trim().toUpperCase();
  return INTEL_CONFIDENCE.includes(v) ? v : 'UNVERIFIED';
}

function normalizeMapNotes(mapNotes) {
  if (!Array.isArray(mapNotes)) return [];
  return mapNotes.slice(0, 40).map((m) => ({
    map: str(m.map || '', 60),
    mode: str(m.mode || '', 40),
    threat: m.threat === 'high' || m.threat === 'low' ? m.threat : 'medium',
    note: str(m.note || '', 600),
    confidence: normalizeConfidence(m.confidence),
    source: str(m.source || '', 200),
    date: m.date ? str(m.date, 10) : null,
    vod_timestamp: str(m.vod_timestamp || '', 200),
  }));
}

// General (non-map-specific) intel items — tendencies, veto reads, player
// notes — each with its own confidence and optional provenance, distinct
// from the single free-text `tendencies` blob this supplements rather than
// replaces (existing data/UI reading `tendencies` keeps working unchanged).
function normalizeOpponentIntel(items) {
  if (!Array.isArray(items)) return [];
  return items
    .slice(0, 150)
    .map((it) => ({
      intel_id: str(it.intel_id || makeId('intel'), 80),
      text: str(it.text || '', 600),
      category: str(it.category || 'General', 40),
      confidence: normalizeConfidence(it.confidence),
      source: str(it.source || '', 200),
      date: it.date ? str(it.date, 10) : null,
      vod_timestamp: str(it.vod_timestamp || '', 200),
      created_at: str(it.created_at || nowIso(), 40),
    }))
    .filter((it) => it.text);
}

async function getOpponents() {
  const rows = await listJson(scoutingDir(), 'opponent_id');
  return rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

async function getOpponent(opponentId) {
  const data = await readJson(path.join(scoutingDir(), `${safeSegment(opponentId, 'opponent id')}.json`));
  return data ? { opponent_id: opponentId, ...data } : null;
}

async function saveOpponent(opponent) {
  const now = nowIso();
  const id = safeSegment(opponent.opponent_id || makeId('opp', opponent.name), 'opponent id');
  const existing = opponent.opponent_id ? await readJson(path.join(scoutingDir(), `${id}.json`)) : null;
  const record = {
    opponent_id: id,
    name: str(opponent.name || existing?.name || 'New Opponent', 120),
    tag: str(opponent.tag !== undefined ? opponent.tag : existing?.tag || '', 12),
    region: str(opponent.region !== undefined ? opponent.region : existing?.region || '', 60),
    players: opponent.players !== undefined ? normalizeOpponentPlayers(opponent.players) : existing?.players || [],
    map_notes: opponent.map_notes !== undefined ? normalizeMapNotes(opponent.map_notes) : existing?.map_notes || [],
    intel: opponent.intel !== undefined ? normalizeOpponentIntel(opponent.intel) : existing?.intel || [],
    tendencies: opponent.tendencies !== undefined ? str(opponent.tendencies) : existing?.tendencies || '',
    notes: opponent.notes !== undefined ? str(opponent.notes) : existing?.notes || '',
    veto_history: opponent.veto_history !== undefined ? normalizeVetoHistory(opponent.veto_history) : existing?.veto_history || [],
    created_at: existing?.created_at || now,
    updated_at: now,
  };
  await writeJson(path.join(scoutingDir(), `${id}.json`), record);
  return record;
}

async function deleteOpponent(opponentId) {
  await fs.rm(path.join(scoutingDir(), `${safeSegment(opponentId, 'opponent id')}.json`), { force: true });
}

// ---------- Rankings (org-level standings) ----------

function normalizeStandingsTeams(teams) {
  if (!Array.isArray(teams)) return [];
  return teams.slice(0, 60).map((t) => ({
    id: safeSegment(t.id || makeId('rank', t.name), 'ranking row id'),
    name: str(t.name || 'Team', 120),
    wins: clampInt(t.wins, 0),
    losses: clampInt(t.losses, 0),
    points: clampInt(t.points, 0),
    note: str(t.note || '', 200),
  }));
}

async function getRankings() {
  return (await readJson(rankingsPath())) || { region: '', updated_at: null, teams: [] };
}

async function saveRankings(rankings) {
  const record = {
    region: str(rankings?.region || '', 80),
    updated_at: nowIso(),
    teams: normalizeStandingsTeams(rankings?.teams),
  };
  await writeJson(rankingsPath(), record);
  return record;
}

module.exports = {
  EVENT_TYPES,
  INTEL_CONFIDENCE,
  getEvents,
  saveEvent,
  deleteEvent,
  getScrims,
  saveScrim,
  deleteScrim,
  getVods,
  saveVod,
  deleteVod,
  getVetoes,
  saveVeto,
  deleteVeto,
  getOpponents,
  getOpponent,
  saveOpponent,
  deleteOpponent,
  getRankings,
  saveRankings,
};
