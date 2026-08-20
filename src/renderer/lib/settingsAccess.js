// Which Settings sections a signed-in person may open.
//
// Settings used to be one binary: staff saw everything, everyone else saw a
// three-item stub. Both halves were wrong — a coach could rename the org and
// open the danger zone, while a player had no way to set their own photo or
// wallpaper. Sections are gated per scope instead, and the catalog lives here
// (free of DOM and section modules) so the rule is testable on its own.

const ORG_ADMIN_ROLES = new Set(['owner', 'admin', 'developer']);
const STAFF_ROLES = new Set(['owner', 'admin', 'developer', 'team_leader', 'coach']);

// `everyone` — yours or harmless. `staff` — runs a team day to day.
// `org-admin` — changes what every teammate sees, or destroys data.
export const SETTINGS_SECTIONS = [
  { key: 'profile', label: 'Profile', icon: 'players', sub: 'You on this Mac — name, photo, and appearance', scope: 'everyone' },
  { key: 'organization', label: 'Organization', icon: 'teams', sub: 'Org identity, logo, and highlight color', scope: 'org-admin' },
  { key: 'game-rules', label: 'Game Rules', icon: 'mapsModes', sub: 'CDL ruleset and the active map pool', scope: 'staff' },
  { key: 'integrations', label: 'Integrations', icon: 'integrations', sub: 'Discord and outside data sources', scope: 'org-admin' },
  { key: 'team-access', label: 'Team Access', icon: 'roster', sub: 'Who can sign in, and their role', scope: 'staff' },
  { key: 'data', label: 'Data & Storage', icon: 'database', sub: 'Where your data lives, and how to erase it', scope: 'org-admin' },
  { key: 'feedback', label: 'Feedback', icon: 'feedback', sub: 'Bugs, ideas, and anything that feels off', scope: 'everyone' },
  { key: 'about', label: 'About', icon: 'help', sub: 'Version and build information', scope: 'everyone' },
];

function role(access) {
  return String(access?.role || '').toLowerCase().trim();
}

export function isOrgAdmin(access) {
  // No Supabase session means a solo install on this Mac: there is nobody else
  // to lock out, so local use keeps the full app.
  if (access?.local) return true;
  return ORG_ADMIN_ROLES.has(role(access));
}

export function isSettingsStaff(access) {
  if (access?.local) return true;
  return STAFF_ROLES.has(role(access));
}

export function canSeeSection(section, access) {
  if (section?.scope === 'everyone') return true;
  if (section?.scope === 'staff') return isSettingsStaff(access);
  return isOrgAdmin(access);
}

export function visibleSettingsSections(access) {
  return SETTINGS_SECTIONS.filter((section) => canSeeSection(section, access));
}

// A player who lands on #/settings/data (a stale link, or a role that was just
// downgraded) gets their first allowed section rather than an empty panel.
export function resolveSettingsSection(access, key) {
  const visible = visibleSettingsSections(access);
  const def = visible.find((section) => section.key === key) || visible[0];
  return { visible, def, sectionKey: def.key };
}
