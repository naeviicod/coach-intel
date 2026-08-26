// Last-write-wins sync for matches, strats, notes, tasks, planning, and org
// records. Local JSON stays the working copy; shared_docs is the org copy.

const fs = require('fs/promises');
const path = require('path');
const dataStore = require('./dataStore');
const planningStore = require('./planningStore');
const notificationStore = require('./notificationStore');
const supabase = require('./supabase');

function stamp(record) {
  const n = Date.parse(record?.updated_at || record?.created_at || 0);
  return Number.isFinite(n) ? n : 0;
}

function mergeRecords(localList, remoteRows, idKey) {
  const localById = new Map((localList || []).map((r) => [String(r[idKey] || r.id), r]));
  const toApply = [];
  const toDelete = [];
  const toPush = [];
  const seen = new Set();

  for (const row of remoteRows || []) {
    const id = String(row.id);
    seen.add(id);
    const local = localById.get(id);
    const deletedAt = row.deleted_at ? Date.parse(row.deleted_at) : 0;
    const payload = row.payload && typeof row.payload === 'object' ? { ...row.payload } : {};
    if (!payload.updated_at && row.updated_at) payload.updated_at = row.updated_at;
    const remoteStamp = Math.max(stamp({ updated_at: row.updated_at }), stamp(payload), deletedAt || 0);

    if (row.deleted_at) {
      if (!local) continue;
      if (stamp(local) <= deletedAt) toDelete.push(id);
      else toPush.push(local);
      continue;
    }

    if (!local) {
      toApply.push(payload);
      continue;
    }
    const localStamp = stamp(local);
    if (localStamp < remoteStamp) toApply.push(payload);
    else if (localStamp > remoteStamp) toPush.push(local);
  }

  for (const [id, local] of localById) {
    if (!seen.has(id)) toPush.push(local);
  }
  return { toApply, toDelete, toPush };
}

function dataRoot() {
  return process.env.CCI_DATA_ROOT || dataStore.DATA_ROOT;
}

function safeId(value) {
  const s = String(value || '');
  if (!s || s.includes('..') || /[\\/\0]/.test(s)) throw new Error('Invalid record id');
  return s;
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function teamFile(teamId, folder, id) {
  if (!teamId) return path.join(dataRoot(), 'org', folder, `${safeId(id)}.json`);
  return path.join(dataRoot(), 'org', 'teams', safeId(teamId), 'data', folder, `${safeId(id)}.json`);
}

async function listMapObjectives() {
  const root = path.join(dataRoot(), 'maps');
  let slugs = [];
  try {
    slugs = await fs.readdir(root, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const out = [];
  for (const dir of slugs) {
    if (!dir.isDirectory()) continue;
    let files = [];
    try {
      files = await fs.readdir(path.join(root, dir.name));
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const modeKey = path.basename(file, '.json');
      try {
        const raw = await fs.readFile(path.join(root, dir.name, file), 'utf8');
        const data = JSON.parse(raw);
        out.push({
          id: `${dir.name}::${modeKey}`,
          map_slug: dir.name,
          mode_key: modeKey,
          ...data,
        });
      } catch {
        // Skip a corrupt objectives file rather than blocking the rest of sync.
      }
    }
  }
  return out;
}

function profileFromOrg(org) {
  if (!org) return { id: 'profile', updated_at: '1970-01-01T00:00:00.000Z' };
  const { teamIds, ...profile } = org;
  return { id: 'profile', ...profile, updated_at: profile.updated_at || '1970-01-01T00:00:00.000Z' };
}

function rlsPushBlocked(err) {
  const msg = String(err?.message || err || '');
  return /row-level security|schema cache|ensure_profile|shared_docs/i.test(msg);
}

const KINDS = {
  match: { idKey: 'match_id', team: true, folder: 'matches', list: (t) => dataStore.getMatches(t), remove: (t, id) => dataStore.deleteMatch(t, id) },
  strat: { idKey: 'strategy_id', team: true, folder: 'strats', list: (t) => dataStore.getStrats(t), remove: (t, id) => dataStore.deleteStrat(t, id) },
  note: { idKey: 'note_id', team: true, folder: 'notes', list: (t) => dataStore.getNotes(t), remove: (t, id) => dataStore.deleteNote(t, id) },
  task: { idKey: 'task_id', team: true, folder: 'tasks', list: (t) => dataStore.getTasks(t), remove: (t, id) => dataStore.deleteTask(t, id) },
  event: { idKey: 'event_id', team: true, folder: 'schedule', list: (t) => planningStore.getEvents(t), remove: (t, id) => planningStore.deleteEvent(t, id) },
  scrim: { idKey: 'scrim_id', team: true, folder: 'scrims', list: (t) => planningStore.getScrims(t), remove: (t, id) => planningStore.deleteScrim(t, id) },
  vod: { idKey: 'vod_id', team: true, folder: 'vods', list: (t) => planningStore.getVods(t), remove: (t, id) => planningStore.deleteVod(t, id) },
  veto: { idKey: 'veto_id', team: true, folder: 'vetoes', list: (t) => planningStore.getVetoes(t), remove: (t, id) => planningStore.deleteVeto(t, id) },
  notification: {
    idKey: 'id',
    team: true,
    folder: 'notifications',
    list: (t) => notificationStore.getNotifications(t),
    remove: (t, id) => notificationStore.deleteNotification(t, id),
  },
  opponent: { idKey: 'opponent_id', team: false, list: () => planningStore.getOpponents(), remove: (_t, id) => planningStore.deleteOpponent(id) },
  rankings: {
    idKey: 'id',
    team: false,
    list: async () => {
      const row = await planningStore.getRankings();
      return [{ id: 'current', ...row, updated_at: row?.updated_at || '1970-01-01T00:00:00.000Z' }];
    },
  },
  org: {
    idKey: 'id',
    team: false,
    list: async () => [profileFromOrg(await dataStore.getOrg())],
  },
  ruleset: {
    idKey: 'id',
    team: false,
    list: async () => {
      const ruleset = await dataStore.getCdlRuleset();
      if (!ruleset) return [];
      return [{ id: 'cdl', ...ruleset, updated_at: ruleset.updated_at || ruleset.last_checked || '1970-01-01T00:00:00.000Z' }];
    },
  },
  map_obj: { idKey: 'id', team: false, list: () => listMapObjectives() },
};

async function putLocal(kind, teamId, payload) {
  const spec = KINDS[kind];
  if (kind === 'org') {
    const { id, teamIds, ...profile } = payload;
    await writeJson(path.join(dataRoot(), 'org', 'org-profile.json'), profile);
    return;
  }
  if (kind === 'rankings') {
    const { id, ...row } = payload;
    await writeJson(path.join(dataRoot(), 'org', 'rankings.json'), row);
    return;
  }
  if (kind === 'ruleset') {
    const { id, ...ruleset } = payload;
    await writeJson(path.join(dataRoot(), 'knowledge', 'cdl-ruleset.json'), ruleset);
    return;
  }
  if (kind === 'map_obj') {
    const slug = safeId(payload.map_slug);
    const modeKey = safeId(payload.mode_key);
    const { id, map_slug, mode_key, ...record } = payload;
    await writeJson(path.join(dataRoot(), 'maps', slug, `${modeKey}.json`), record);
    return;
  }
  if (kind === 'opponent') {
    await writeJson(path.join(dataRoot(), 'org', 'scouting', `${safeId(payload.opponent_id)}.json`), payload);
    return;
  }
  await writeJson(teamFile(teamId, spec.folder, payload[spec.idKey]), payload);
}

async function sessionReady() {
  try {
    const state = await supabase.get().getState();
    return Boolean(state?.session);
  } catch {
    return false;
  }
}

function docsApi() {
  return supabase.get();
}

async function localResult(kind, teamId) {
  if (kind === 'org') return dataStore.getOrg();
  if (kind === 'ruleset') return dataStore.getCdlRuleset();
  if (kind === 'rankings') return planningStore.getRankings();
  return KINDS[kind].list(teamId);
}

function hasLocalRecords(local) {
  return Array.isArray(local) && local.length > 0;
}

let onLocalChange = null;
function setOnLocalChange(fn) {
  onLocalChange = typeof fn === 'function' ? fn : null;
}

const hydrateJobs = new Map();

async function mergeRemote(kind, teamId, local) {
  const spec = KINDS[kind];
  let remote = [];
  try {
    remote = await docsApi().listDocs(kind, spec.team ? teamId : '');
  } catch (err) {
    console.warn('[cloud-sync] list failed', err?.message || err);
    return { result: await localResult(kind, teamId), localChanged: false };
  }
  const merged = mergeRecords(local, remote, spec.idKey);
  const localChanged = merged.toApply.length + merged.toDelete.length > 0;
  for (const payload of merged.toApply) await putLocal(kind, teamId, payload);
  for (const id of merged.toDelete) {
    if (spec.remove) await spec.remove(teamId, id);
  }
  for (const rec of merged.toPush) {
    try {
      await docsApi().upsertDoc(kind, spec.team ? teamId : '', rec[spec.idKey], rec);
    } catch (err) {
      console.warn('[cloud-sync] push failed', err?.message || err);
    }
  }
  return { result: await localResult(kind, teamId), localChanged };
}

async function hydrate(kind, teamId) {
  const spec = KINDS[kind];
  if (!spec) return localResult(kind, teamId);
  if (!(await sessionReady())) return localResult(kind, teamId);
  const local = await spec.list(teamId);
  const key = `${kind}\0${spec.team ? teamId || '' : ''}`;

  const run = () =>
    mergeRemote(kind, teamId, local).then((out) => {
      if (out.localChanged && onLocalChange) onLocalChange(kind);
      return out.result;
    });

  if (hasLocalRecords(local)) {
    if (!hydrateJobs.has(key)) {
      const job = run().catch((err) => {
        console.warn('[cloud-sync] background hydrate failed', err?.message || err);
      }).finally(() => hydrateJobs.delete(key));
      hydrateJobs.set(key, job);
    }
    return localResult(kind, teamId);
  }

  if (hydrateJobs.has(key)) return hydrateJobs.get(key);
  const job = run().finally(() => hydrateJobs.delete(key));
  hydrateJobs.set(key, job);
  return job;
}

function objectivesModeKey(mode) {
  const m = String(mode || '').toLowerCase();
  if (m.includes('hardpoint')) return 'hardpoint';
  if (m.includes('search') || m.includes('destroy')) return 'snd';
  if (m.includes('overload')) return 'overload';
  return null;
}

function payloadForPush(kind, record) {
  if (kind === 'org') return profileFromOrg(record);
  if (kind === 'rankings') return { id: 'current', ...record };
  if (kind === 'ruleset') return { id: 'cdl', ...record };
  if (kind === 'map_obj') {
    const modeKey = record.mode_key || objectivesModeKey(record.mode);
    const slug = record.map_slug;
    return { ...record, map_slug: slug, mode_key: modeKey, id: record.id || `${slug}::${modeKey}` };
  }
  return record;
}

async function push(kind, teamId, record) {
  if (!(await sessionReady())) return;
  const spec = KINDS[kind];
  const payload = payloadForPush(kind, record);
  const id = payload[spec.idKey] || payload.id;
  await docsApi().upsertDoc(kind, spec.team ? teamId : '', id, payload);
}

async function remove(kind, teamId, id) {
  if (!(await sessionReady())) return;
  const spec = KINDS[kind];
  await docsApi().tombstoneDoc(kind, spec.team ? teamId : '', id);
}

async function syncAll() {
  if (!(await sessionReady())) return { ok: true, skipped: 'signed-out' };
  let remote = [];
  try {
    remote = await docsApi().listAllDocs();
  } catch (err) {
    return { ok: false, errors: [err?.message || String(err)] };
  }

  const byKey = new Map();
  for (const row of remote) {
    const key = `${row.kind}\0${row.team_id || ''}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(row);
  }

  const teams = await dataStore.getTeams();
  const teamIds = new Set(teams.map((t) => t.id));
  for (const row of remote) {
    if (row.team_id) teamIds.add(row.team_id);
  }

  const errors = [];
  async function mergeKind(kind, teamId) {
    const spec = KINDS[kind];
    const key = `${kind}\0${spec.team ? teamId : ''}`;
    try {
      const local = await spec.list(teamId);
      const merged = mergeRecords(local, byKey.get(key) || [], spec.idKey);
      for (const payload of merged.toApply) await putLocal(kind, teamId, payload);
      for (const id of merged.toDelete) {
        if (spec.remove) await spec.remove(teamId, id);
      }
      for (const rec of merged.toPush) {
        try {
          await docsApi().upsertDoc(kind, spec.team ? teamId : '', rec[spec.idKey], rec);
        } catch (err) {
          if (rlsPushBlocked(err)) {
            console.warn('[cloud-sync] push skipped', kind, rec[spec.idKey], err?.message || err);
            continue;
          }
          throw err;
        }
      }
    } catch (err) {
      errors.push(`${kind}${teamId ? `/${teamId}` : ''}: ${err?.message || err}`);
    }
  }

  const orgKinds = Object.keys(KINDS).filter((k) => !KINDS[k].team);
  const teamKinds = Object.keys(KINDS).filter((k) => KINDS[k].team);
  for (const kind of orgKinds) await mergeKind(kind, '');
  await mergeKind('event', '');
  for (const teamId of teamIds) {
    for (const kind of teamKinds) await mergeKind(kind, teamId);
  }

  if (errors.length) {
    console.error('[cloud-sync]', errors.join(' | '));
    return { ok: false, errors };
  }
  return { ok: true, errors: [] };
}

module.exports = { mergeRecords, hasLocalRecords, hydrate, setOnLocalChange, push, remove, syncAll, KINDS };
