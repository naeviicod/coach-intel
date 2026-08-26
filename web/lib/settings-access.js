import { isStaff } from './access.js';

export const SETTINGS_SECTIONS = [
  { key: 'profile', label: 'Profile', icon: 'players', sub: 'Your name, photo, title, and appearance', scope: 'everyone' },
  { key: 'organization', label: 'Organization', icon: 'teams', sub: 'Org identity, logo, and highlight color', scope: 'org-admin' },
  { key: 'game-rules', label: 'Game Rules', icon: 'mapsModes', sub: 'CDL ruleset and the active map pool', scope: 'staff' },
  { key: 'integrations', label: 'Integrations', icon: 'integrations', sub: 'Discord and outside data sources', scope: 'org-admin' },
  { key: 'team-access', label: 'Team Access', icon: 'roster', sub: 'Who can sign in, and their role', scope: 'staff' },
  { key: 'data', label: 'Data & Storage', icon: 'database', sub: 'Where your data lives', scope: 'org-admin' },
  { key: 'feedback', label: 'Feedback', icon: 'feedback', sub: 'Bugs, ideas, and anything that feels off', scope: 'everyone' },
  { key: 'about', label: 'About', icon: 'help', sub: 'Version and build information', scope: 'everyone' },
];

export function visibleSettingsSections(role, isOrgAdmin) {
  const staff = Boolean(isOrgAdmin) || isStaff(role);
  return SETTINGS_SECTIONS.filter((section) => {
    if (section.scope === 'everyone') return true;
    if (section.scope === 'staff') return staff;
    return Boolean(isOrgAdmin);
  });
}

export function resolveSettingsSection(role, isOrgAdmin, key) {
  const visible = visibleSettingsSections(role, isOrgAdmin);
  const def = visible.find((section) => section.key === key) || visible[0];
  return { visible, def, sectionKey: def.key };
}
