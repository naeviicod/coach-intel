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

function needsTeamPush(local, remote) {
  return Boolean(local?.id) && !remote;
}

function needsMemberPush(local, remote) {
  if (!local?.id) return false;
  if (!remote) return true;
  return updatedAtMs(local) > updatedAtMs(remote);
}

function byId(rows) {
  return new Map((rows || []).filter((row) => row?.id).map((row) => [row.id, row]));
}

async function syncLocalRosterToRemote({ supabase, dataStore, docs } = {}) {
  const state = await supabase.get().getState();
  if (!state?.session) return { ok: true, skipped: 'signed-out' };

  await supabase.get().ensureProfile().catch(() => null);

  const teams = await dataStore.getTeams();
  let remoteTeams = [];
  try {
    remoteTeams = await supabase.get().getTeams();
  } catch {
    remoteTeams = [];
  }
  const remoteTeamById = byId(remoteTeams);

  const errors = [];
  for (const team of teams) {
    if (needsTeamPush(team, remoteTeamById.get(team.id))) {
      try {
        await supabase.get().saveTeam(team);
      } catch (err) {
        errors.push(`${team.name || team.id}: ${sharedWriteHint(err)}`);
      }
    }
    const members = await dataStore.getMembers(team.id);
    let remoteMembers = [];
    try {
      remoteMembers = await supabase.get().getMembers(team.id);
    } catch {
      remoteMembers = [];
    }
    const localById = byId(members);
    const remoteMemberById = byId(remoteMembers);
    for (const member of mergeMemberLists(members, remoteMembers)) {
      const local = localById.get(member.id);
      const remote = remoteMemberById.get(member.id);
      if (!needsMemberPush(local, remote)) {
        if (!local || updatedAtMs(member) > updatedAtMs(local)) {
          await dataStore.saveMember(team.id, member).catch(() => null);
        }
        continue;
      }
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

  const syncAll = docs?.syncAll || cloudSync.syncAll;
  const docResult = await syncAll();
  if (docResult?.errors?.length) errors.push(...docResult.errors);

  if (errors.length) {
    console.error('[roster-sync]', errors.join(' | '));
    return { ok: false, errors };
  }
  return { ok: true, errors: [] };
}

module.exports = {
  syncLocalRosterToRemote,
  sharedWriteHint,
  mergeMemberLists,
  needsTeamPush,
  needsMemberPush,
};
