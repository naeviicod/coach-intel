const STAFF_ROLES = new Set(['super_admin', 'owner', 'admin', 'developer', 'team_leader', 'coach']);
const ALL_TEAMS_ROLES = new Set(['super_admin', 'owner', 'admin', 'developer', 'coach', 'team_leader', 'analyst', 'creative', 'free_agent']);
const ORG_EDIT_ROLES = new Set(['super_admin', 'owner', 'admin', 'developer', 'coach']);
const TRANSFER_ROLES = new Set(['super_admin', 'owner', 'admin', 'developer']);

function isNaevii(value) {
  const s = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return s === 'naevii' || s === 'naeviiszn' || s.startsWith('naeviiszn');
}

function resolveAccessRole(me, { names = [] } = {}) {
  const fields = [
    me?.discord_username,
    me?.display_name,
    me?.username,
    me?.gamertag,
    me?.name,
    me?.title,
    ...(Array.isArray(names) ? names : []),
  ];
  if (fields.some(isNaevii)) return 'super_admin';
  return me?.role || 'member';
}

function isProtectedPerson(person) {
  if (!person) return false;
  return [person.discord_username, person.display_name, person.gamertag, person.name, person.title]
    .some(isNaevii);
}

function assertNotProtectedPerson(person, action) {
  if (isProtectedPerson(person)) {
    throw new Error(action || 'Super Admin cannot be removed or demoted.');
  }
}

function isStaff(role) {
  const r = String(role || '').toLowerCase().trim();
  return STAFF_ROLES.has(r);
}

function seesAllTeams(role) {
  const r = String(role || '').toLowerCase().trim();
  return ALL_TEAMS_ROLES.has(r);
}

function canEdit(role) {
  return ORG_EDIT_ROLES.has(String(role || '').toLowerCase().trim());
}

function canEditTeam(role, teamId, { local, teamIds } = {}) {
  if (local) return true;
  const r = String(role || '').toLowerCase().trim();
  if (ORG_EDIT_ROLES.has(r)) return true;
  if (r !== 'team_leader' || !teamId) return false;
  return Array.isArray(teamIds) && teamIds.includes(teamId);
}

function canTransferMembers(role, { local } = {}) {
  if (local) return true;
  return TRANSFER_ROLES.has(String(role || '').toLowerCase().trim());
}

function canManageOrg(role, opts) {
  return canTransferMembers(role, opts);
}

async function assertCanManageOrg(supabase) {
  const session = await sessionEditor(supabase);
  if (session.local) return;
  if (!canManageOrg(session.role, session)) {
    throw new Error('Only org owners, admins, and developers can do that.');
  }
}

// Unlinked players used to filter this list to [] — then the app thought
// the org was missing and reopened first-run setup. Revoking an invite
// only unlinks that roster slot; it must never hide a provisioned org.
function scopeTeams(teams, { role, teamIds } = {}) {
  const list = Array.isArray(teams) ? teams : [];
  if (!role || seesAllTeams(role)) return list;
  if (!Array.isArray(teamIds) || teamIds.length === 0) return list;
  const allow = new Set(teamIds);
  return list.filter((team) => team && allow.has(team.id));
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
    if (me && !canEdit(resolveAccessRole(me, { names: listed?.linkedNames }))) {
      throw new Error('You do not have permission to edit.');
    }
    return;
  } catch (err) {
    if (String(err?.message || err).includes('permission')) throw err;
    console.warn('[access] could not load profile for edit check', err?.message || err);
    return;
  }
}

async function sessionEditor(supabase) {
  const state = await supabase.get().getState();
  if (!state?.configured || !state.session) return { local: true, me: null, teamIds: null };
  let listed = { me: null, teamIds: [] };
  try {
    listed = await Promise.race([
      supabase.get().listProfiles(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('profile check timed out')), 2500);
      }),
    ]);
  } catch (err) {
    console.warn('[access] could not load profile for edit check', err?.message || err);
    return { local: true, me: null, teamIds: null };
  }
  const me = listed?.me || null;
  if (!me) return { local: true, me: null, teamIds: null, role: 'owner' };
  let teamIds = listed?.teamIds;
  if (!Array.isArray(teamIds) && me.id && supabase.get().teamIdsForUser) {
    try {
      teamIds = await supabase.get().teamIdsForUser(me.id);
    } catch {
      teamIds = [];
    }
  }
  const linkedNames = listed?.linkedNames;
  const role = resolveAccessRole(me, { names: linkedNames });
  return { local: false, me, teamIds: Array.isArray(teamIds) ? teamIds : [], role, linkedNames };
}

async function assertCanEditTeam(supabase, teamId) {
  const session = await sessionEditor(supabase);
  if (session.local) return;
  if (!canEditTeam(session.role, teamId, session)) {
    throw new Error('You can only edit your own team.');
  }
}

async function assertCanTransfer(supabase) {
  const session = await sessionEditor(supabase);
  if (session.local) return;
  if (!isStaff(session.role)) throw new Error('You do not have permission to edit.');
  if (!canTransferMembers(session.role, session)) {
    throw new Error('Only org owners, admins, and developers can move players between teams.');
  }
}

module.exports = {
  isStaff,
  isNaevii,
  isProtectedPerson,
  assertNotProtectedPerson,
  canEdit,
  seesAllTeams,
  canEditTeam,
  canTransferMembers,
  canManageOrg,
  resolveAccessRole,
  assertCanEdit,
  assertCanEditTeam,
  assertCanTransfer,
  assertCanManageOrg,
  scopeTeams,
};
