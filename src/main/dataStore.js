const fs = require('fs/promises');
const fss = require('fs');
const path = require('path');
const { bundledFor, mergeObjectives, NEEDS_VERIFICATION } = require('./mapObjectives');

function resolveDataRoot() {
  if (process.env.CCI_DATA_ROOT) return process.env.CCI_DATA_ROOT;
  try {
    const { app } = require('electron');
    // Packaged and `electron .` share the same userData store so demo files
    // in the repo's data/org folder never leak into a running session.
    if (app) return path.join(app.getPath('userData'), 'data');
  } catch {
    // Tests and scripts load this file without Electron.
  }
  return path.join(__dirname, '..', '..', 'data');
}

function clampPieceScale(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0.7;
  return Math.round(Math.min(1.4, Math.max(0.4, v)) * 100) / 100;
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

async function existingOrgLogo() {
  for (const rel of ['org/logos/org-logo.webp', 'org/logos/org-logo.png', 'org/logos/org-logo.jpg', 'org/logos/org-logo.jpeg']) {
    try {
      await fs.access(path.join(DATA_ROOT, rel));
      return rel;
    } catch {
      // try the next extension
    }
  }
  return null;
}

async function getOrg() {
  const raw = await readJson(path.join(ORG_DIR, 'org-profile.json'));
  const profile = raw || {
    name: 'My Organization',
    logo: null,
  };
  if (!profile.logo) {
    const found = await existingOrgLogo();
    if (found) profile.logo = found;
  }
  let teamIds = [];
  try {
    const entries = await fs.readdir(TEAMS_DIR, { withFileTypes: true });
    teamIds = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  const provisioned = Boolean(raw) || teamIds.length > 0;
  return {
    ...profile,
    teamIds,
    provisioned,
    locked: Boolean(raw?.locked) || provisioned,
  };
}

async function saveOrg(org) {
  const existing = (await readJson(path.join(ORG_DIR, 'org-profile.json'))) || {};
  const profileName = org.profileName !== undefined
    ? String(org.profileName || '').trim()
    : String(existing.profileName || existing.coachName || '').trim();
  const profileTitle = org.profileTitle !== undefined
    ? String(org.profileTitle || '').trim()
    : String(existing.profileTitle || '').trim();
  await writeJson(path.join(ORG_DIR, 'org-profile.json'), {
    ...existing,
    name: org.name || existing.name || 'My Organization',
    tag: org.tag !== undefined ? org.tag : existing.tag || null,
    logo: org.logo || existing.logo || (await existingOrgLogo()),
    coachName: profileName || existing.coachName || 'Coach',
    profileName,
    profileTitle,
    profilePhoto: org.profilePhoto !== undefined ? org.profilePhoto : existing.profilePhoto || null,
    accent: org.accent !== undefined ? org.accent : existing.accent || null,
    locked: true,
    updated_at: nowIso(),
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
    const filePath = path.join(dir, file);
    const data = await readJson(filePath);
    if (!data) continue;
    const row = { id: path.basename(file, '.json'), ...data };
    if (!row.updated_at) {
      try {
        row.updated_at = (await fs.stat(filePath)).mtime.toISOString();
      } catch {
        /* keep going */
      }
    }
    members.push(row);
  }
  return members.sort((a, b) => String(a.gamertag || '').localeCompare(String(b.gamertag || '')));
}

async function getMember(teamId, memberId) {
  const data = await readJson(path.join(teamDirFor(teamId), 'members', `${memberId}.json`));
  if (!data) return null;
  return { id: memberId, ...data };
}

function isNaeviiName(value) {
  const s = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return s === 'naevii' || s === 'naeviiszn' || s.startsWith('naeviiszn');
}

function memberTitle(title, member) {
  const explicit = String(title || '').trim().slice(0, 80);
  if (explicit) return explicit;
  if (isNaeviiName(member?.gamertag) || isNaeviiName(member?.name)) return 'Developer';
  return '';
}

const HANDLE_KEYS = ['activision', 'checkmate', 'discord', 'twitch', 'twitter', 'youtube', 'instagram', 'other'];

function memberHandles(raw, disabled) {
  if (!raw || typeof raw !== 'object') raw = {};
  const out = {};
  for (const key of HANDLE_KEYS) {
    const value = String(raw[key] || '').trim().slice(0, 120);
    if (value) out[key] = value;
  }
  if (disabled) out._disabled = '1';
  return out;
}

function memberDisabledFlag(member) {
  if (member?.disabled === false) return false;
  return Boolean(member?.disabled) || String(member?.handles?._disabled || '') === '1';
}

async function saveMember(teamId, member) {
  const id = member.id || slugify(member.gamertag);
  const dir = teamDirFor(teamId);
  const filePath = path.join(dir, 'members', `${id}.json`);
  const existing = await getMember(teamId, id);
  const userId = member.user_id !== undefined ? member.user_id : existing?.user_id || null;
  const record = {
    name: member.name || member.gamertag,
    gamertag: member.gamertag,
    aliases: member.aliases || [],
    role: member.role || 'Flex',
    photo: member.photo || null,
    slot: member.slot === 'bench' || member.slot === 'staff' || member.slot === 'fa' ? member.slot : 'starter',
    title: memberTitle(member.title, member),
    handles: memberHandles(member.handles, memberDisabledFlag(member)),
    disabled: memberDisabledFlag(member),
    updated_at: member.updated_at || new Date().toISOString(),
  };
  if (userId) record.user_id = userId;
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

async function transferMember(fromTeamId, toTeamId, memberId, { slot } = {}) {
  const from = String(fromTeamId || '').trim();
  const to = String(toTeamId || '').trim();
  const id = String(memberId || '').trim();
  if (!from || !to || !id) throw new Error('A team and player are required to transfer.');
  if (from === to) throw new Error('Pick a different team to transfer to.');

  const member = await getMember(from, id);
  const dest = await getMember(to, id);
  if (!member && !dest) throw new Error('That player is not on the source team.');

  if (!dest) {
    const destRoster = await getMembers(to);
    const sameTag = destRoster.find(
      (m) => String(m.gamertag || '').toLowerCase() === String((member.gamertag) || '').toLowerCase()
    );
    if (sameTag) throw new Error(`${member.gamertag} is already on that roster.`);
  }

  const source = member || dest;
  const nextSlot = slot === 'bench' || slot === 'staff' || slot === 'starter' || slot === 'fa' ? slot : source.slot;
  const saved = await saveMember(to, { ...source, id, slot: nextSlot });
  if (member) await deleteMember(from, id);
  return { ...saved, team_id: to, from_team_id: from };
}

async function transferMembers(fromTeamId, toTeamId, memberIds, opts) {
  const ids = [...new Set((memberIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) throw new Error('Pick at least one player to transfer.');
  const moved = [];
  for (const id of ids) moved.push(await transferMember(fromTeamId, toTeamId, id, opts || {}));
  return moved;
}

// ---------- Matches ----------

function matchesDirFor(teamId) {
  return path.join(teamDirFor(teamId), 'data', 'matches');
}

async function getMatches(teamId) {
  const dir = matchesDirFor(teamId);
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

// Team-level, mode-specific round/hill counters behind the advanced CoD
// metrics (hold %, break %, rotation %, opening-duel/first-blood/post-plant/
// retake %, Overload scoring/defensive-stop %). Every field is optional and
// starts null — a coach fills in as much as they have time to track, and a
// metric simply has no value to show until its counters exist. Non-negative
// integers only; anything else (blank, negative, junk) collapses to null
// rather than a fabricated number.
function clampCount(value, existing) {
  if (value === undefined) return existing ?? null;
  if (value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : existing ?? null;
}

const HP_FIELDS = ['holds_won', 'holds_attempted', 'breaks_won', 'breaks_attempted', 'rotations_won', 'rotations_attempted'];
const SND_FIELDS = [
  'offense_rounds', 'offense_round_wins', 'defense_rounds', 'defense_round_wins',
  'first_bloods', 'first_blood_wins', 'first_deaths', 'first_death_wins',
  'post_plant_rounds', 'post_plant_wins', 'retake_rounds', 'retake_wins',
];
const OVERLOAD_FIELDS = ['scoring_attempts', 'scoring_wins', 'defensive_attempts', 'defensive_stops'];

function mergeCounters(fields, incoming, existing) {
  if (incoming === undefined) return existing || null;
  const out = {};
  let any = false;
  for (const key of fields) {
    const v = clampCount(incoming?.[key], existing?.[key]);
    out[key] = v;
    if (v !== null) any = true;
  }
  return any ? out : null;
}

function clampModeScore(mode, score) {
  const cap = { Hardpoint: 250, 'Search & Destroy': 6, Overload: 8 }[mode];
  const m = String(score || '').match(/^\s*(-?\d+)\s*-\s*(-?\d+)\s*$/);
  if (!m) return String(score || '').trim();
  const us = Math.max(0, Number(m[1]));
  const them = Math.max(0, Number(m[2]));
  if (!Number.isFinite(cap)) return `${us}-${them}`;
  return `${Math.min(cap, us)}-${Math.min(cap, them)}`;
}

async function saveMatch(teamId, match) {
  const dir = matchesDirFor(teamId);
  await ensureDir(dir);
  const now = nowIso();
  const id = safeSegment(
    match.match_id || slugify(`${match.date || todayIso()}-${match.opponent || 'match'}-${Date.now()}`),
    'match id'
  );
  const existing = match.match_id ? await readJson(path.join(dir, `${id}.json`)) : null;
  const mode = match.mode !== undefined ? match.mode : existing?.mode || '';
  const score = clampModeScore(mode, match.score !== undefined ? match.score : existing?.score || '');

  const record = {
    match_id: id,
    team_id: teamId,
    date: match.date || existing?.date || todayIso(),
    opponent: match.opponent !== undefined ? match.opponent : existing?.opponent || '',
    mode,
    map: match.map !== undefined ? match.map : existing?.map || '',
    side: match.side !== undefined ? match.side : existing?.side || '',
    score,
    result: match.result !== undefined ? match.result : existing?.result || '',
    series_id: match.series_id !== undefined ? match.series_id : existing?.series_id || '',
    game: match.game !== undefined ? match.game : existing?.game || null,
    format: match.format !== undefined ? match.format : existing?.format || '',
    scoreboard_path: match.scoreboard_path !== undefined ? match.scoreboard_path : existing?.scoreboard_path || '',
    players: match.players !== undefined ? match.players : existing?.players || [],
    hp: mergeCounters(HP_FIELDS, match.hp, existing?.hp),
    snd: mergeCounters(SND_FIELDS, match.snd, existing?.snd),
    overload: mergeCounters(OVERLOAD_FIELDS, match.overload, existing?.overload),
    created_at: existing?.created_at || now,
    updated_at: now,
  };

  await writeJson(path.join(dir, `${id}.json`), record);
  return record;
}

async function deleteMatch(teamId, matchId) {
  await fs.rm(path.join(matchesDirFor(teamId), `${safeSegment(matchId, 'match id')}.json`), { force: true });
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

// Mirrors the renderer's normalizePos clamping (stratBoard/pieces.js) without
// importing renderer code into the main process — kept minimal on purpose.
function sanitizeSteps(steps) {
  if (!Array.isArray(steps)) return [];
  const clamp01 = (n) => (Number.isFinite(Number(n)) ? Math.min(1, Math.max(0, Number(n))) : 0.5);
  return steps.slice(0, 30).map((s) => ({
    label: String(s?.label || 'Step').slice(0, 60),
    player_positions: Array.isArray(s?.player_positions)
      ? s.player_positions.slice(0, 8).map((p) => ({
          member_id: p?.member_id ?? null,
          opponent: !!p?.opponent,
          x: clamp01(p?.x),
          y: clamp01(p?.y),
          facing: Number.isFinite(Number(p?.facing)) ? Number(p.facing) : 0,
        }))
      : [],
  }));
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
    objective_key: strat.objective_key !== undefined ? strat.objective_key : existing?.objective_key || '',
    team_id: teamId,
    player_positions: strat.player_positions || [],
    drawings: strat.drawings || [],
    notes: strat.notes || '',
    piece_scale: clampPieceScale(strat.piece_scale ?? existing?.piece_scale ?? 0.7),
    steps: strat.steps !== undefined ? sanitizeSteps(strat.steps) : existing?.steps || [],
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
      piece_scale: record.piece_scale,
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
    piece_scale: version.piece_scale ?? strat.piece_scale,
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

const NOTE_ATTACHMENT_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const NOTE_ATTACHMENT_MIMES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

function sanitizeNoteAttachments(teamId, incoming, previous = []) {
  const source = incoming === undefined ? previous : incoming;
  if (!Array.isArray(source)) throw new Error('Note attachments must be an array.');
  const prefix = `org/teams/${safeSegment(teamId, 'team id')}/data/note-images/`;
  const seen = new Set();
  const attachments = [];

  for (const raw of source) {
    if (attachments.length >= 8) break;
    if (!raw || typeof raw !== 'object') throw new Error('Invalid note attachment.');
    const id = safeSegment(raw.id, 'attachment id').slice(0, 120);
    const relative = String(raw.path || '').replace(/\\/g, '/');
    const ext = path.extname(relative).toLowerCase();
    if (!relative.startsWith(prefix) || !NOTE_ATTACHMENT_EXTENSIONS.has(ext) || seen.has(id)) {
      throw new Error('Invalid note attachment.');
    }
    const name = path.basename(String(raw.name || '')).slice(0, 160);
    if (!name) throw new Error('Invalid note attachment name.');
    seen.add(id);
    attachments.push({ id, path: relative, name, mime: NOTE_ATTACHMENT_MIMES[ext] });
  }
  return attachments;
}

function sanitizeNoteHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(0, 6).flatMap((entry) => {
    const revision = Number(entry?.revision);
    if (!Number.isInteger(revision) || revision < 1) return [];
    return [{
      revision,
      title: String(entry.title || 'Untitled note').slice(0, 160),
      body: String(entry.body || '').slice(0, 12000),
      updated_by: String(entry.updated_by || entry.author || 'Coach').slice(0, 120),
      updated_at: String(entry.updated_at || ''),
    }];
  });
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
  const expected = note.expected_revision;
  const existingRevision = Number(existing?.revision || 1);
  if (existing && expected !== undefined && Number(expected) !== existingRevision) {
    const err = new Error('This note changed while you were editing it. Reload the newer version before saving.');
    err.code = 'NOTE_CONFLICT';
    throw err;
  }

  const revision = existing ? existingRevision + 1 : 1;
  const history = existing
    ? [
        {
          revision: existingRevision,
          title: existing.title,
          body: existing.body,
          updated_by: existing.updated_by || existing.author || 'Coach',
          updated_at: existing.updated_at,
        },
        ...sanitizeNoteHistory(existing.history),
      ].slice(0, 6)
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
    assignee_id: task.assignee_id !== undefined ? task.assignee_id || null : existing?.assignee_id || null,
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

// Every team with local match history has a local team directory (that's where
// matches themselves live), whether or not team-profile.json exists — so this
// walks TEAMS_DIR directly rather than through getTeams(), which depends on
// team-profile.json and goes stale for any team created after teams moved to
// Supabase (see cci:saveTeam in main.js).
async function localTeamIds() {
  try {
    const entries = await fs.readdir(TEAMS_DIR, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    return [];
  }
}

// Blocks removal when matches reference this map, unless force is set — never
// touches match history itself, just counts it so the UI can warn.
async function removeCdlMap(mapId, { force = false } = {}) {
  const ruleset = await getCdlRuleset();
  if (!ruleset) throw new Error('CDL ruleset not found');
  const map = ruleset.maps.find((m) => m.map_id === mapId);
  if (!map) return { blocked: false };

  let matchCount = 0;
  const teamIds = await localTeamIds();
  for (const id of teamIds) {
    const matches = await getMatches(id);
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

// ---------- Map objectives (hills / bombsites / device spawns) ----------
//
// Separate from map art: callouts live in JSON so a coach can correct a hill
// without replacing the blueprint. Bundled competitive research fills the
// empty state; a saved file still wins for any field the coach has verified.

const MAPS_DATA_DIR = path.join(DATA_ROOT, 'maps');

function objectivesModeKey(mode) {
  const m = String(mode || '').toLowerCase();
  if (m.includes('hardpoint')) return 'hardpoint';
  if (m.includes('search') || m.includes('destroy')) return 'snd';
  if (m.includes('overload')) return 'overload';
  return null;
}

function mapObjectivesPath(mapSlug, modeKey) {
  return path.join(MAPS_DATA_DIR, safeSegment(mapSlug, 'map slug'), `${modeKey}.json`);
}

function coordFields(item) {
  const x = Number(item?.x);
  const y = Number(item?.y);
  const out = {};
  if (Number.isFinite(x)) out.x = Math.min(1, Math.max(0, x));
  if (Number.isFinite(y)) out.y = Math.min(1, Math.max(0, y));
  return out;
}

// Search & Destroy always has exactly two named bombsites and Overload always
// has exactly two scoring sides — that's a fixed rule of the game modes, not a
// guess about *this* map. Hardpoint hill count varies by map, so hills start
// empty rather than guessing how many exist.
function emptyObjectives(mapName, mode, modeKey) {
  const base = { map: mapName, mode, updated_at: null, verified_by: null };
  if (modeKey === 'hardpoint') return { ...base, hills: [] };
  if (modeKey === 'snd') {
    return {
      ...base,
      bombsites: [
        { label: 'A', location: NEEDS_VERIFICATION },
        { label: 'B', location: NEEDS_VERIFICATION },
      ],
      bomb_spawn: NEEDS_VERIFICATION,
      offense_spawn: NEEDS_VERIFICATION,
      defense_spawn: NEEDS_VERIFICATION,
    };
  }
  if (modeKey === 'overload') {
    return {
      ...base,
      device_spawns: [],
      team_a_zone: NEEDS_VERIFICATION,
      team_b_zone: NEEDS_VERIFICATION,
    };
  }
  return base;
}

async function getMapObjectives(mapSlug, mapName, mode) {
  const modeKey = objectivesModeKey(mode);
  if (!modeKey) return null;
  const fallback = emptyObjectives(mapName, mode, modeKey);
  const bundled = bundledFor(mapSlug, mapName, modeKey);
  const existing = await readJson(mapObjectivesPath(mapSlug, modeKey));
  const merged = mergeObjectives(bundled, existing, fallback);
  return { ...merged, map: mapName, mode };
}

async function saveMapObjectives(mapSlug, mapName, mode, data) {
  const modeKey = objectivesModeKey(mode);
  if (!modeKey) throw new Error(`Unknown objectives mode: ${mode}`);
  const slug = safeSegment(mapSlug, 'map slug');
  const now = nowIso();
  const record = { map: mapName, mode, updated_at: now, verified_by: data?.verified_by || null };

  if (modeKey === 'hardpoint') {
    record.hills = Array.isArray(data?.hills)
      ? data.hills.map((h, i) => ({
          order: Number.isFinite(h.order) ? h.order : i + 1,
          label: String(h.label || `P${i + 1}`).slice(0, 20),
          location: String(h.location || NEEDS_VERIFICATION).slice(0, 200),
          notes: String(h.notes || '').slice(0, 400),
          ...coordFields(h),
        }))
      : [];
  } else if (modeKey === 'snd') {
    record.bombsites = Array.isArray(data?.bombsites) && data.bombsites.length
      ? data.bombsites.map((b, i) => ({
          label: String(b.label || (i === 0 ? 'A' : 'B')).slice(0, 10),
          location: String(b.location || NEEDS_VERIFICATION).slice(0, 200),
          ...coordFields(b),
        }))
      : [
          { label: 'A', location: NEEDS_VERIFICATION },
          { label: 'B', location: NEEDS_VERIFICATION },
        ];
    record.bomb_spawn = String(data?.bomb_spawn || NEEDS_VERIFICATION).slice(0, 200);
    record.offense_spawn = String(data?.offense_spawn || NEEDS_VERIFICATION).slice(0, 200);
    record.defense_spawn = String(data?.defense_spawn || NEEDS_VERIFICATION).slice(0, 200);
  } else if (modeKey === 'overload') {
    record.device_spawns = Array.isArray(data?.device_spawns)
      ? data.device_spawns.map((d, i) => ({
          label: String(d.label || `Device ${i + 1}`).slice(0, 20),
          location: String(d.location || NEEDS_VERIFICATION).slice(0, 200),
          ...coordFields(d),
        }))
      : [];
    record.team_a_zone = String(data?.team_a_zone || NEEDS_VERIFICATION).slice(0, 200);
    record.team_b_zone = String(data?.team_b_zone || NEEDS_VERIFICATION).slice(0, 200);
  }
  if (data?.keys) record.keys = data.keys;

  await writeJson(mapObjectivesPath(slug, modeKey), record);
  return record;
}

async function readTeamLogos() {
  return (await readJson(path.join(ORG_DIR, 'team-logos.json'), {})) || {};
}

async function patchTeamLogo(teamId, logo) {
  const id = safeSegment(teamId, 'team');
  const all = await readTeamLogos();
  all[id] = logo;
  await writeJson(path.join(ORG_DIR, 'team-logos.json'), all);
  return logo;
}

async function applyLocalLogos(teams) {
  const logos = await readTeamLogos();
  return (teams || []).map((team) => (logos[team.id] ? { ...team, logo: logos[team.id] } : team));
}

async function applyLocalLogo(team) {
  if (!team?.id) return team;
  const logos = await readTeamLogos();
  return logos[team.id] ? { ...team, logo: logos[team.id] } : team;
}

// ---------- Files (logos / photos) ----------

// Optional personal mirror of uploaded map art to a folder outside the app's
// data dir (e.g. a source-of-truth asset library). Off by default so map-art
// uploads work on any machine; set CCI_MAP_ART_MIRROR_DIR to opt in on yours.
const MAP_ART_MIRROR_DIR = process.env.CCI_MAP_ART_MIRROR_DIR || null;

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

// Used by the picture pickers (org/team logos, profile and player photos):
// the renderer downsizes and re-encodes the pick as WebP on a <canvas> before
// this ever runs, so what lands on disk (and later syncs to cloud storage)
// is already small instead of whatever multi-megabyte original was chosen.
async function writeImageBytes(bytes, destRelative) {
  const dest = path.join(DATA_ROOT, destRelative);
  await ensureDir(path.dirname(dest));
  await fs.writeFile(dest, Buffer.from(bytes));
  return destRelative;
}

const SOURCE_IMAGE_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

// Reads an arbitrary OS-picked file (outside DATA_ROOT) as a data: URL so the
// renderer can draw it to a <canvas> without tripping cross-origin taint —
// only place in the pipeline that needs the picker's raw, uncompressed bytes.
async function readImageAsDataUrl(sourcePath) {
  const buffer = await fs.readFile(sourcePath);
  const ext = path.extname(sourcePath).slice(1).toLowerCase();
  const mime = SOURCE_IMAGE_MIME[ext] || 'application/octet-stream';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

const FOLDER_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

// Non-recursive: lists image files directly inside a user-picked folder, for
// bulk-matching against records by file name (e.g. player photo import).
async function listFolderImages(folderPath) {
  if (!folderPath) return [];
  let entries;
  try {
    entries = await fs.readdir(folderPath, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && FOLDER_IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => ({
      path: path.join(folderPath, entry.name),
      base: path.basename(entry.name, path.extname(entry.name)),
    }))
    .sort((a, b) => a.base.localeCompare(b.base));
}

async function saveMapArt(sourcePath, mapName, layoutKey) {
  const rawExt = path.extname(String(sourcePath || '')).toLowerCase();
  const ext = ['.jpg', '.jpeg', '.png', '.webp'].includes(rawExt) ? rawExt : '.jpg';
  const slug = slugify(mapName);
  if (!slug) throw new Error('Invalid map name');
  const key = String(layoutKey || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const rel = key ? `maps/${slug}-${key}${ext}` : `maps/${slug}${ext}`;
  await copyImage(sourcePath, rel);

  if (MAP_ART_MIRROR_DIR) {
    try {
      await fs.mkdir(MAP_ART_MIRROR_DIR, { recursive: true });
      const artName = key
        ? `${String(mapName || slug).trim().replace(/[^\w]+/g, '_')}_${key.toUpperCase()}_Layout${ext}`
        : mapArtFileName(mapName, ext);
      await fs.copyFile(sourcePath, path.join(MAP_ART_MIRROR_DIR, artName));
    } catch (err) {
      console.warn('[dataStore] map art mirror copy failed (non-fatal):', err.message);
    }
  }
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
  transferMember,
  transferMembers,
  getMatches,
  saveMatch,
  deleteMatch,
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
  getMapObjectives,
  saveMapObjectives,
  copyImage,
  writeImageBytes,
  readImageAsDataUrl,
  listFolderImages,
  saveMapArt,
  resolveDataPath,
  patchTeamLogo,
  applyLocalLogos,
  applyLocalLogo,
};
