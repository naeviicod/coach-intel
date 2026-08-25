export const NAV_GROUPS = [
  {
    label: 'Main',
    items: [
      { href: '/dashboard', page: 'dashboard', label: 'Dashboard' },
      { href: '/intel-feed', page: 'intel-feed', label: 'Intel Feed' },
      { href: '/calendar', page: 'calendar', label: 'Calendar' },
      { href: '/tasks', page: 'tasks', label: 'Tasks' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { href: '/teams', page: 'teams', label: 'Teams' },
      { href: '/players', page: 'players', label: 'Players' },
      { href: '/matches', page: 'matches', label: 'Matches' },
      { href: '/statistics', page: 'statistics', label: 'Statistics' },
      { href: '/database', page: 'database', label: 'Member Database' },
      { href: '/reports', page: 'reports', label: 'Reports' },
      { href: '/rankings', page: 'rankings', label: 'Rankings' },
    ],
  },
  {
    label: 'Team',
    items: [
      { href: '/team-hub', page: 'team-hub', label: 'Team Hub' },
      { href: '/playbooks', page: 'playbooks', label: 'Strats & Playbooks' },
      { href: '/scrim-hub', page: 'scrim-hub', label: 'Scrim Hub' },
      { href: '/vod-library', page: 'vod-library', label: 'VOD Library' },
      { href: '/needs-review', page: 'needs-review', label: 'Scoreboard Inbox' },
      { href: '/veto-lab', page: 'veto-lab', label: 'Veto Lab' },
      { href: '/war-room', page: 'war-room', label: 'War Room' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { href: '/maps-modes', page: 'maps-modes', label: 'Maps & Modes' },
      { href: '/scouting', page: 'scouting', label: 'Scouting' },
    ],
  },
];

export const SETTINGS_ITEM = { href: '/settings', page: 'settings', label: 'Settings' };

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
