const STAFF_ROLES = new Set(['owner', 'admin', 'team_leader', 'coach']);
const ALL_TEAMS_ROLES = new Set(['owner', 'admin', 'coach', 'analyst', 'creative']);

function isStaff(role) {
  const r = String(role || '').toLowerCase().trim();
  return STAFF_ROLES.has(r);
}

function seesAllTeams(role) {
  const r = String(role || '').toLowerCase().trim();
  return ALL_TEAMS_ROLES.has(r);
}

async function assertCanEdit(supabase) {
  const state = await supabase.get().getState();
  if (!state?.configured || !state.session) return;
  let me = null;
  try {
    const listed = await Promise.race([
      supabase.get().listProfiles(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('profile check timed out')), 2500);
      }),
    ]);
    me = listed?.me || null;
  } catch (err) {
    console.warn('[access] could not load profile for edit check', err?.message || err);
    return;
  }
  // No profile row yet — same as local staff. Only a known non-staff role is blocked.
  if (!me) return;
  if (!isStaff(me.role)) throw new Error('You do not have permission to edit.');
}

module.exports = { isStaff, seesAllTeams, assertCanEdit };
