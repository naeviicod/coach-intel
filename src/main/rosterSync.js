// Push this machine's teams/members/docs into Supabase so every signed-in
// device sees the same roster, K/D, and match history. Local JSON is the cache.

const cloudSync = require('./cloudSync');

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
    for (const member of members) {
      try {
        await supabase.get().saveMember(team.id, member);
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

module.exports = { syncLocalRosterToRemote, sharedWriteHint };
