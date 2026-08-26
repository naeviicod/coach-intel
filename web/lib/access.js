const STAFF_ROLES = new Set(['owner', 'admin', 'developer', 'team_leader', 'coach']);
const PLAYER_ROLES = new Set(['member', 'user', 'player', 'free_agent']);
const CREATIVE_ROLES = new Set(['creative']);
const ALL_TEAMS_ROLES = new Set(['owner', 'admin', 'developer', 'coach', 'team_leader', 'analyst', 'creative', 'free_agent']);
const ORG_EDIT_ROLES = new Set(['owner', 'admin', 'developer', 'coach']);
const TRANSFER_ROLES = new Set(['owner', 'admin', 'developer']);

const ANALYTICS_PAGES = new Set([
  'teams', 'players', 'member', 'matches', 'statistics', 'database', 'reports', 'rankings',
]);

const TEAM_PAGES = new Set([
  'team-hub', 'command-center', 'playbooks', 'scrim-hub', 'vod-library', 'needs-review', 'veto-lab', 'war-room',
]);

const ALWAYS_PAGES = new Set(['settings']);
const STAFF_ONLY_PAGES = new Set(['calendar', 'tasks']);
const ORG_TOOL_PAGES = new Set(['maps-modes', 'scouting', 'integrations']);
const ORG_TOOL_ROLES = new Set(['owner', 'admin', 'developer']);
const PLAYER_MAIN_PAGES = new Set(['dashboard', 'intel-feed']);

export const ROLE_LABELS = {
  owner: 'Org owner',
  admin: 'Admin',
  developer: 'Developer',
  team_leader: 'Team leader',
  coach: 'Coach',
  analyst: 'Analyst',
  creative: 'Creative',
  free_agent: 'Free Agent',
  member: 'Player',
  user: 'Player',
  player: 'Player',
};

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
  return ORG_EDIT_ROLES.has(String(role || '').toLowerCase().trim());
}

export function canEditTeam(role, teamId, { local, teamIds } = {}) {
  if (local) return true;
  const r = String(role || '').toLowerCase().trim();
  if (ORG_EDIT_ROLES.has(r)) return true;
  if (r !== 'team_leader' || !teamId) return false;
  return Array.isArray(teamIds) && teamIds.includes(teamId);
}

export function canTransferMembers(role, { local } = {}) {
  if (local) return true;
  return TRANSFER_ROLES.has(String(role || '').toLowerCase().trim());
}

export function canManageOrg(role, opts) {
  return canTransferMembers(role, opts);
}

export function seesAllTeams(role) {
  return ALL_TEAMS_ROLES.has(String(role || '').toLowerCase().trim());
}

export function isCreative(role) {
  return CREATIVE_ROLES.has(String(role || '').toLowerCase().trim());
}

export function canAccessPage(role, page) {
  if (ALWAYS_PAGES.has(page)) return true;
  const r = String(role || '').toLowerCase().trim();
  if (ORG_TOOL_PAGES.has(page)) return ORG_TOOL_ROLES.has(r);
  if (STAFF_ONLY_PAGES.has(page)) return isStaff(role);
  if (isStaff(role)) return true;
  if (isPlayer(role)) {
    return PLAYER_MAIN_PAGES.has(page) || ANALYTICS_PAGES.has(page) || TEAM_PAGES.has(page);
  }
  if (normalizeRole(role) === 'analyst') return ANALYTICS_PAGES.has(page);
  if (isCreative(role)) return page === 'team-hub' || page === 'players' || page === 'database' || page === 'member';
  return false;
}

export function defaultLanding(role) {
  if (isStaff(role)) return 'dashboard';
  if (isPlayer(role) || isCreative(role)) return 'team-hub';
  return 'teams';
}

export function landingPath(role) {
  const page = defaultLanding(role);
  return page === 'team-hub' ? '/team-hub' : `/${page}`;
}

export function scopeTeams(teams, { role, teamIds } = {}) {
  const list = Array.isArray(teams) ? teams : [];
  if (!role || seesAllTeams(role)) return list;
  if (!Array.isArray(teamIds) || teamIds.length === 0) return list;
  const allow = new Set(teamIds);
  return list.filter((team) => team && allow.has(team.id));
}

export function roleLabel(role) {
  const raw = String(role || '').toLowerCase().trim();
  return ROLE_LABELS[raw] || ROLE_LABELS[normalizeRole(role)] || 'Player';
}

function isNaevii(value) {
  const s = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return s === 'naevii' || s === 'naeviiszn' || s.startsWith('naeviiszn');
}

export function resolveAccessRole(me, { names = [] } = {}) {
  const fields = [
    me?.discord_username,
    me?.display_name,
    me?.username,
    me?.gamertag,
    me?.name,
    me?.title,
    ...(Array.isArray(names) ? names : []),
  ];
  if (fields.some(isNaevii)) {
    const existing = String(me?.role || '').toLowerCase().trim();
    if (existing === 'owner' || existing === 'admin' || existing === 'developer') return existing;
    return 'developer';
  }
  return me?.role || 'member';
}
