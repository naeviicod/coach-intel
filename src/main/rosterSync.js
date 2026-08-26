// Push this machine's teams/members/docs into Supabase so every signed-in
// device sees the same roster, K/D, and match history. Local JSON is the cache.

const cloudSync = require('./cloudSync');

function updatedAtMs(row) {
  const t = Date.parse(row?.updated_at || '');
  return Number.isFinite(t) ? t : 0;
}

function mergeMember(local, remote) {
  if (!local) return remote;
  if (!remote) return local;
  const localNewer = updatedAtMs(local) >= updatedAtMs(remote);
  const winner = localNewer ? local : remote;
  const loser = localNewer ? remote : local;
  return {
    ...loser,
    ...winner,
    user_id: remote.user_id || local.user_id || null,
    linked: remote.linked || local.linked || null,
  };
}

function mergeMemberLists(local = [], remote = []) {
  const byId = new Map();
  for (const member of remote) if (member?.id) byId.set(member.id, member);
  for (const member of local) {
    if (!member?.id) continue;
    const prev = byId.get(member.id);
    byId.set(member.id, prev ? mergeMember(member, prev) : member);
  }
  return [...byId.values()].sort((a, b) =>
    String(a.gamertag || '').localeCompare(String(b.gamertag || ''))
  );
}

function ipcErrorMessage(err) {
  return String(err?.message || err || 'Request failed');
}

function sharedWriteHint(err) {
  const msg = ipcErrorMessage(err);
  if (/ensure_profile|PGRST202|row-level security|owner, admin, or coach|shared_docs|schema cache/i.test(msg)) {
    return 'Could not write shared org data. Run scripts/supabase/schema.sql in the Supabase SQL editor, then try again.';
  }
  return msg;
}

async function syncLocalRosterToRemote({ supabase, dataStore }) {
  const state = await supabase.get().getState();
  if (!state?.session) return { ok: true, skipped: 'signed-out' };

  await supabase.get().ensureProfile().catch(() => null);

  const teams = await dataStore.getTeams();
  const errors = [];
  for (const team of teams) {
    try {
      await supabase.get().saveTeam(team);
    } catch (err) {
      errors.push(`${team.name || team.id}: ${sharedWriteHint(err)}`);
      continue;
    }
    const members = await dataStore.getMembers(team.id);
    let remoteMembers = [];
    try {
      remoteMembers = await supabase.get().getMembers(team.id);
    } catch {
      remoteMembers = [];
    }
    for (const member of mergeMemberLists(members, remoteMembers)) {
      try {
        const saved = await supabase.get().saveMember(team.id, member);
        await dataStore.saveMember(team.id, {
          ...member,
          ...saved,
          id: member.id,
          updated_at: saved.updated_at || member.updated_at,
        });
      } catch (err) {
        errors.push(`${member.gamertag || member.id}: ${sharedWriteHint(err)}`);
      }
    }
  }

  const docs = await cloudSync.syncAll();
  if (docs?.errors?.length) errors.push(...docs.errors);

  if (errors.length) {
    console.error('[roster-sync]', errors.join(' | '));
    return { ok: false, errors };
  }
  return { ok: true, errors: [] };
}

module.exports = { syncLocalRosterToRemote, sharedWriteHint, mergeMemberLists };
