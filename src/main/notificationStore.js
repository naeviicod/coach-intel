// Local persistence for in-app notifications — the delivery target for
// InAppProvider (see discord/notifications.js), which was previously a stub
// that only recorded "not implemented". Same one-JSON-file-per-record shape
// as dataStore's tasks/notes, under each team's own data directory, so it
// rides along with the existing team folder lifecycle (created/deleted with
// the team) without needing a new top-level data root.

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const dataStore = require('./dataStore');

function nowIso() {
  return new Date().toISOString();
}

function safeSegment(value, label) {
  const s = String(value ?? '').trim();
  if (!s || s.includes('..') || /[\\/\0]/.test(s)) throw new Error(`Invalid ${label || 'value'}`);
  return s;
}

function dirFor(teamId) {
  return path.join(dataStore.DATA_ROOT, 'org', 'teams', safeSegment(teamId, 'team id'), 'data', 'notifications');
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

async function getNotifications(teamId) {
  const dir = dirFor(teamId);
  let files = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    return [];
  }
  const rows = [];
  for (const file of files) {
    const data = await readJson(path.join(dir, file));
    if (data) rows.push(data);
  }
  return rows.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
}

async function addNotification(teamId, notif) {
  const id = safeSegment(notif.id || crypto.randomUUID(), 'notification id');
  const record = {
    id,
    team_id: teamId,
    event_id: notif.event_id || null,
    title: String(notif.title || 'Notification').slice(0, 200),
    subtitle: notif.subtitle ? String(notif.subtitle).slice(0, 300) : null,
    route: notif.route || null,
    // Roster member ids this notification is specifically about (e.g. the
    // people picked as attendees). Empty means "relevant to the whole team".
    recipient_member_ids: Array.isArray(notif.recipient_member_ids) ? notif.recipient_member_ids.slice(0, 50) : [],
    created_at: nowIso(),
  };
  await writeJson(path.join(dirFor(teamId), `${id}.json`), record);

  // Keep each team's feed bounded — this is a recent-activity feed, not an archive.
  const all = await getNotifications(teamId);
  const excess = all.slice(200);
  for (const old of excess) {
    await fs.rm(path.join(dirFor(teamId), `${old.id}.json`), { force: true }).catch(() => {});
  }
  return record;
}

async function deleteNotification(teamId, id) {
  await fs.rm(path.join(dirFor(teamId), `${safeSegment(id, 'notification id')}.json`), { force: true });
}

module.exports = { getNotifications, addNotification, deleteNotification };
