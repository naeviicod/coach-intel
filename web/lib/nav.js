export const NAV_GROUPS = [
  {
    label: 'Main',
    items: [
      { href: '/dashboard', page: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
      { href: '/intel-feed', page: 'intel-feed', label: 'Intel Feed', icon: 'intel' },
      { href: '/calendar', page: 'calendar', label: 'Calendar', icon: 'calendar' },
      { href: '/tasks', page: 'tasks', label: 'Tasks', icon: 'tasks' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { href: '/teams', page: 'teams', label: 'Teams', icon: 'teams' },
      { href: '/players', page: 'players', label: 'Players', icon: 'players', aliases: ['member'] },
      { href: '/matches', page: 'matches', label: 'Matches', icon: 'matches' },
      { href: '/statistics', page: 'statistics', label: 'Statistics', icon: 'performance' },
      { href: '/database', page: 'database', label: 'Member Database', icon: 'database' },
      { href: '/reports', page: 'reports', label: 'Reports', icon: 'reports' },
      { href: '/rankings', page: 'rankings', label: 'Rankings', icon: 'rankings' },
    ],
  },
  {
    label: 'Team',
    items: [
      { href: '/team-hub', page: 'team-hub', label: 'Team Hub', icon: 'teamHub' },
      { href: '/playbooks', page: 'playbooks', label: 'Strats & Playbooks', icon: 'strats' },
      { href: '/scrim-hub', page: 'scrim-hub', label: 'Scrim Hub', icon: 'scrim' },
      { href: '/vod-library', page: 'vod-library', label: 'VOD Library', icon: 'vod' },
      { href: '/needs-review', page: 'needs-review', label: 'Scoreboard Inbox', icon: 'review' },
      { href: '/veto-lab', page: 'veto-lab', label: 'Veto Lab', icon: 'veto' },
      { href: '/war-room', page: 'war-room', label: 'War Room', icon: 'objectives' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { href: '/maps-modes', page: 'maps-modes', label: 'Maps & Modes', icon: 'mapsModes' },
      { href: '/scouting', page: 'scouting', label: 'Scouting', icon: 'scouting' },
    ],
  },
  {
    label: 'Integrations',
    items: [{ href: '/integrations', page: 'integrations', label: 'Integrations', icon: 'integrations' }],
  },
];

export const SETTINGS_ITEM = { href: '/settings', page: 'settings', label: 'Settings', icon: 'settings' };

export const TEAM_NAV_PAGES = new Set([
  'team-hub',
  'playbooks',
  'scrim-hub',
  'vod-library',
  'needs-review',
  'veto-lab',
  'war-room',
]);

export const APP_PREFIXES = [
  '/dashboard',
  '/intel-feed',
  '/calendar',
  '/tasks',
  '/teams',
  '/players',
  '/matches',
  '/statistics',
  '/database',
  '/reports',
  '/rankings',
  '/team-hub',
  '/playbooks',
  '/scrim-hub',
  '/vod-library',
  '/needs-review',
  '/veto-lab',
  '/war-room',
  '/maps-modes',
  '/scouting',
  '/integrations',
  '/settings',
];

export function isAppPath(pathname) {
  return APP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function pageFromPath(pathname) {
  const p = String(pathname || '');
  const hit = APP_PREFIXES.filter((prefix) => p === prefix || p.startsWith(`${prefix}/`)).sort(
    (a, b) => b.length - a.length
  )[0];
  return hit ? hit.slice(1) : '';
}
