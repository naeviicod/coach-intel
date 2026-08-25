export const HUB_SECTIONS = [
  { key: 'overview', label: 'Overview', icon: 'dashboard' },
  { key: 'roster', label: 'Roster', icon: 'roster', count: 'members' },
  { key: 'notes', label: 'Team Notes', icon: 'notes', count: 'notes' },
  { key: 'objectives', label: 'Objectives', icon: 'objectives' },
  { key: 'veto', label: 'Veto History', icon: 'veto' },
  { key: 'statistics', label: 'Statistics', icon: 'performance' },
  { key: 'reports', label: 'Reports', icon: 'reports' },
  { key: 'practice', label: 'Planner', icon: 'calendar' },
  { key: 'settings', label: 'Team Settings', icon: 'settings' },
];

export const HUB_SECTION_KEYS = HUB_SECTIONS.map((s) => s.key);

export function parseHubSection(parts) {
  const list = (parts || []).filter(Boolean);
  const key = HUB_SECTION_KEYS.includes(list[0]) ? list[0] : 'overview';
  const sub = HUB_SECTION_KEYS.includes(list[0]) ? list.slice(1) : [];
  return { key, sub };
}

export function hubPath(teamId, section = 'overview', ...rest) {
  const bits = [String(teamId)];
  if (section && section !== 'overview') bits.push(section);
  for (const item of rest) {
    if (item) bits.push(String(item));
  }
  return `/teams/${bits.map(encodeURIComponent).join('/')}`;
}

export function isTeamHubPath(pathname) {
  return Boolean(pathname) && pathname.startsWith('/teams/') && pathname !== '/teams';
}
