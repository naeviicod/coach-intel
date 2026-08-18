// Org-level permission roles (profiles.role), not in-game SMG/AR positions.
// `user` is the player role the product uses; `member` is the historical DB value.

const STAFF_ROLES = new Set(['owner', 'admin', 'team_leader', 'coach']);
const PLAYER_ROLES = new Set(['member', 'user', 'player']);
const CREATIVE_ROLES = new Set(['creative']);
const ALL_TEAMS_ROLES = new Set(['owner', 'admin', 'coach', 'analyst', 'creative']);

const ANALYTICS_PAGES = new Set([
  'teams',
  'players',
  'member',
  'matches',
  'statistics',
  'database',
  'reports',
  'rankings',
]);

const TEAM_PAGES = new Set([
  'team-hub',
  'command-center',
  'playbooks',
  'scrim-hub',
  'vod-library',
  'needs-review',
  'veto-lab',
]);

const ORG_CALENDAR_ROLES = new Set(['owner', 'admin', 'coach', 'analyst', 'creative', 'team_leader', 'member', 'user', 'player']);

const ALWAYS_PAGES = new Set(['settings', 'teach']);

export const ROLE_LABELS = {
  owner: 'Org owner',
  admin: 'Admin',
  team_leader: 'Team leader',
  coach: 'Coach',
  analyst: 'Analyst',
  creative: 'Creative',
  member: 'Player',
  user: 'Player',
  player: 'Player',
};

export const ASSIGNABLE_ROLES = ['owner', 'admin', 'team_leader', 'coach', 'analyst', 'creative', 'user'];

export function normalizeRole(role) {
  const r = String(role || '').toLowerCase().trim();
  if (r === 'admin') return 'admin';
  if (r === 'user' || r === 'player') return 'member';
  return r || 'member';
}

export function isStaff(role) {
  const r = String(role || '').toLowerCase().trim();
  return STAFF_ROLES.has(r) || STAFF_ROLES.has(normalizeRole(r));
}

export function isPlayer(role) {
  const r = String(role || '').toLowerCase().trim();
  return PLAYER_ROLES.has(r) || PLAYER_ROLES.has(normalizeRole(r));
}

export function canEdit(role) {
  return isStaff(role);
}

export function seesAllTeams(role) {
  const r = String(role || '').toLowerCase().trim();
  return ALL_TEAMS_ROLES.has(r);
}

export function isCreative(role) {
  const r = String(role || '').toLowerCase().trim();
  return CREATIVE_ROLES.has(r);
}

export function canAccessPage(role, page) {
  if (ALWAYS_PAGES.has(page)) return true;
  if (page === 'calendar') {
    const r = String(role || '').toLowerCase().trim();
    return ORG_CALENDAR_ROLES.has(r) || ORG_CALENDAR_ROLES.has(normalizeRole(r));
  }
  if (isStaff(role)) return true;
  if (isPlayer(role)) return ANALYTICS_PAGES.has(page) || TEAM_PAGES.has(page);
  if (normalizeRole(role) === 'analyst') return ANALYTICS_PAGES.has(page);
  if (isCreative(role)) return page === 'team-hub' || page === 'players' || page === 'database' || page === 'member';
  return false;
}

export function defaultLanding(role) {
  if (isStaff(role)) return 'dashboard';
  if (isPlayer(role) || isCreative(role)) return 'team-hub';
  return 'teams';
}

export function roleLabel(role) {
  const raw = String(role || '').toLowerCase().trim();
  return ROLE_LABELS[raw] || ROLE_LABELS[normalizeRole(role)] || 'Player';
}

export function localStaffAccess() {
  return { role: 'owner', canEdit: true, local: true, me: null };
}

export function accessFromProfile(me, { local = false } = {}) {
  if (local || !me) return localStaffAccess();
  const role = me.role || 'member';
  return { role, canEdit: canEdit(role), local: false, me };
}
